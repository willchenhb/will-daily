'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// idle: nothing edited yet · dirty: waiting for the debounce · saving · saved · error: retrying
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface AutosaveOptions<T> {
  value: T
  // Persist `value`; must throw (reject) on failure so the hook can retry
  save: (value: T) => Promise<void>
  // false = not ready yet (e.g. an image is still uploading); retried on the next change
  canSave?: (value: T) => boolean
  // The baseline ("already saved") value is taken from the first enabled render
  enabled?: boolean
  delay?: number
}

const RETRY_DELAY = 5000

// Obsidian-style autosave: saves `delay` ms after the last change, serializes saves,
// retries failures, saves when the tab is hidden or the component unmounts, and warns
// before unload while something is unsaved.
export function useAutosave<T>({ value, save, canSave = () => true, enabled = true, delay = 1500 }: AutosaveOptions<T>) {
  const key = JSON.stringify(value)
  const savedKeyRef = useRef<string | null>(null)
  if (enabled && savedKeyRef.current === null) savedKeyRef.current = key

  const latest = useRef({ value, key, save, canSave })
  latest.current = { value, key, save, canSave }

  const [status, setStatus] = useState<SaveStatus>('idle')
  const inFlight = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const runRef = useRef<() => Promise<boolean>>(async () => true)

  // Save now if needed. Resolves true when everything is saved.
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current)
    while (inFlight.current) await inFlight.current
    const { value, key, save, canSave } = latest.current
    if (savedKeyRef.current === null || key === savedKeyRef.current) return true
    if (!canSave(value)) return false

    let ok = true
    setStatus('saving')
    const attempt = save(value).then(
      () => { savedKeyRef.current = key },
      () => { ok = false },
    )
    inFlight.current = attempt
    await attempt
    inFlight.current = null

    if (!ok) {
      setStatus('error')
      timer.current = setTimeout(() => runRef.current(), RETRY_DELAY)
      return false
    }
    if (latest.current.key !== savedKeyRef.current) {
      // Edited again while saving
      setStatus('dirty')
      timer.current = setTimeout(() => runRef.current(), delay)
    } else {
      setStatus('saved')
    }
    return true
  }, [delay])
  runRef.current = flush

  useEffect(() => {
    if (!enabled || savedKeyRef.current === null) return
    if (key === savedKeyRef.current) {
      clearTimeout(timer.current)
      setStatus(s => (s === 'dirty' ? 'saved' : s))
      return
    }
    setStatus(s => (s === 'saving' ? s : 'dirty'))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => runRef.current(), delay)
  }, [key, enabled, delay])

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

  return { status, flush }
}
