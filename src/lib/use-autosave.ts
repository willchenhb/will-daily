'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearDraft, writeDraft } from './drafts'

// idle: nothing edited yet · dirty: waiting for the debounce · saving · saved · error: retrying
// conflict: the server holds a newer version; autosave pauses until reset() or retry()
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'

// Thrown by `save` when the document changed elsewhere (HTTP 409); carries the server's version
export class ConflictError<T = unknown> extends Error {
  constructor(public current: T) {
    super('conflict')
  }
}

interface AutosaveOptions<T> {
  value: T
  // Persist `value`; must throw (reject) on failure so the hook can retry
  save: (value: T) => Promise<void>
  // false = not ready yet (e.g. an image is still uploading); retried on the next change
  canSave?: (value: T) => boolean
  // The baseline ("already saved") value is taken from the first enabled render
  enabled?: boolean
  delay?: number
  // Continuous typing never pauses for `delay`; save at least this often while dirty
  maxWait?: number
  // Mirror unsaved edits to a local draft under this key (see src/lib/drafts.ts)
  draftKey?: string
}

const RETRY_DELAY = 5000

// Obsidian-style autosave: saves `delay` ms after the last change (and at least every
// `maxWait` ms while edits keep coming, like Obsidian's coalescing save timer), serializes saves,
// retries failures, saves when the tab is hidden or the component unmounts, and warns
// before unload while something is unsaved.
export function useAutosave<T>({ value, save, canSave = () => true, enabled = true, delay = 1500, maxWait = 5000, draftKey }: AutosaveOptions<T>) {
  const key = JSON.stringify(value)
  const savedKeyRef = useRef<string | null>(null)
  if (enabled && savedKeyRef.current === null) savedKeyRef.current = key

  const latest = useRef({ value, key, save, canSave, draftKey })
  latest.current = { value, key, save, canSave, draftKey }

  const [status, setStatus] = useState<SaveStatus>('idle')
  const [conflict, setConflict] = useState<unknown>(null)
  const conflictRef = useRef(false)
  const inFlight = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const runRef = useRef<() => Promise<boolean>>(async () => true)
  // When the oldest unsaved edit was made; bounds how long the debounce can keep slipping
  const dirtySince = useRef<number | null>(null)

  // Save now if needed. Resolves true when everything is saved.
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current)
    while (inFlight.current) await inFlight.current
    const { value, key, save, canSave } = latest.current
    if (savedKeyRef.current === null || key === savedKeyRef.current) return true
    if (conflictRef.current || !canSave(value)) return false

    let ok = true
    let failure: unknown = null
    setStatus('saving')
    const attempt = save(value).then(
      () => { savedKeyRef.current = key },
      err => { ok = false; failure = err },
    )
    inFlight.current = attempt
    await attempt
    inFlight.current = null

    if (failure instanceof ConflictError) {
      conflictRef.current = true
      setConflict(failure.current)
      setStatus('conflict')
      return false
    }
    if (!ok) {
      setStatus('error')
      timer.current = setTimeout(() => runRef.current(), RETRY_DELAY)
      return false
    }
    if (latest.current.key !== savedKeyRef.current) {
      // Edited again while saving
      dirtySince.current = Date.now()
      setStatus('dirty')
      timer.current = setTimeout(() => runRef.current(), delay)
    } else {
      dirtySince.current = null
      if (latest.current.draftKey) clearDraft(latest.current.draftKey)
      setStatus('saved')
    }
    return true
  }, [delay])
  runRef.current = flush

  useEffect(() => {
    if (!enabled || savedKeyRef.current === null || conflictRef.current) return
    if (key === savedKeyRef.current) {
      clearTimeout(timer.current)
      // Edits undone back to the saved state: the draft is obsolete. Not on first load,
      // where a draft from an earlier session may still be waiting to be restored.
      if (draftKey && dirtySince.current !== null) clearDraft(draftKey)
      dirtySince.current = null
      setStatus(s => (s === 'dirty' ? 'saved' : s))
      return
    }
    if (draftKey) writeDraft(draftKey, latest.current.value)
    setStatus(s => (s === 'saving' ? s : 'dirty'))
    if (dirtySince.current === null) dirtySince.current = Date.now()
    const wait = Math.max(0, Math.min(delay, maxWait - (Date.now() - dirtySince.current)))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => runRef.current(), wait)
  }, [key, enabled, delay, maxWait, draftKey])

  useEffect(() => {
    const isUnsaved = () => savedKeyRef.current !== null && latest.current.key !== savedKeyRef.current
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUnsaved()) e.preventDefault()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') runRef.current()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimeout(timer.current)
      // In-app navigation: the fetch outlives the component
      runRef.current()
    }
  }, [])

  // Resolve a conflict by adopting `value` as the saved state (e.g. the server's version)
  const reset = useCallback((value: T) => {
    clearTimeout(timer.current)
    dirtySince.current = null
    if (latest.current.draftKey) clearDraft(latest.current.draftKey)
    conflictRef.current = false
    setConflict(null)
    savedKeyRef.current = JSON.stringify(value)
    setStatus('saved')
  }, [])

  // Resolve a conflict by saving again (the caller makes `save` overwrite this time)
  const retry = useCallback(() => {
    conflictRef.current = false
    setConflict(null)
    return runRef.current()
  }, [])

  return { status, flush, conflict, reset, retry }
}
