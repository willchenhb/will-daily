'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Editor from './Editor'
import SaveStatus from './SaveStatus'
import ConflictNotice from './ConflictNotice'
import RevisionHistory from './RevisionHistory'
import DraftNotice from './DraftNotice'
import { blockSaveForPendingImages, hasPendingImages } from '@/lib/editor-images'
import { useAutosave } from '@/lib/use-autosave'
import { isEmptyHtml } from '@/lib/html'
import { internalHref } from '@/lib/wiki'
import { sanitizeHtml } from '@/lib/sanitize'
import { keepInHistory, type SaveFlags } from '@/lib/save-doc'
import { clearDraft, pendingDraft, type Draft } from '@/lib/drafts'

export interface SavedEntry { id: number; content: string; updatedAt: string }

interface DiaryEntryProps {
  id?: number
  date: string
  dateFormatted: string
  content: string
  updatedAt?: string
  isToday?: boolean
  // Open in the editor (a not-yet-saved entry); defaults to a new entry for today
  defaultEditing?: boolean
  // Persists the entry; rejects on failure (ConflictError on an edit conflict)
  onSave: (data: { id?: number; date: string; content: string } & SaveFlags) => Promise<SavedEntry>
  // Editing finished, e.g. to refresh the list
  onDone?: () => void
  onDelete?: (id: number) => Promise<void>
}

// Autosave compares this form, so an editor emptied back to "<p></p>" counts as unchanged
const normalize = (html: string) => (isEmptyHtml(html) ? '' : html)

export default function DiaryEntry({ id, date, dateFormatted, content: initialContent, updatedAt, isToday, defaultEditing, onSave, onDone, onDelete }: DiaryEntryProps) {
  const router = useRouter()
  const [content, setContent] = useState(initialContent)
  const [editing, setEditing] = useState(defaultEditing ?? (isToday && !id))
  const [showHistory, setShowHistory] = useState(false)
  // Bumped to remount the editor with new content (restore, reload after conflict)
  const [editorKey, setEditorKey] = useState(0)
  // A new entry gets its id from the first autosave
  const idRef = useRef(id)
  // Version being edited (server updatedAt), and flags for the next save
  const versionRef = useRef(updatedAt ?? null)
  const nextSaveFlags = useRef<SaveFlags>({})
  // One diary entry per day, so the date identifies the draft (also before the first save)
  const draftKey = `diary:${date}`
  const [draft, setDraft] = useState<Draft<string> | null>(null)

  useEffect(() => {
    setDraft(pendingDraft<string>(draftKey, normalize(initialContent)))
    // Only when the entry first appears; later edits are this component's own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  const { status, flush, conflict, reset, retry } = useAutosave({
    value: normalize(content),
    save: async html => {
      const saved = await onSave({ id: idRef.current, date, content: html, baseUpdatedAt: versionRef.current, ...nextSaveFlags.current })
      nextSaveFlags.current = {}
      idRef.current = saved.id
      versionRef.current = saved.updatedAt
    },
    // An emptied entry is not saved; deleting is explicit
    canSave: html => html !== '' && !hasPendingImages(html),
    draftKey,
  })

  const restoreDraft = () => {
    if (!draft) return
    nextSaveFlags.current = { snapshot: true }
    setContent(draft.value)
    setDraft(null)
    setEditing(true)
    setEditorKey(k => k + 1)
  }

  const discardDraft = () => {
    clearDraft(draftKey)
    setDraft(null)
  }

  const loadLatest = () => {
    if (idRef.current) keepInHistory('diary', idRef.current, content)
    const latest = conflict as SavedEntry
    setContent(latest.content)
    versionRef.current = latest.updatedAt
    reset(normalize(latest.content))
    setEditorKey(k => k + 1)
  }

  const overwrite = () => {
    nextSaveFlags.current = { force: true }
    retry()
  }

  const restoreRevision = (revision: { content: string }) => {
    nextSaveFlags.current = { snapshot: true }
    setContent(revision.content)
    setEditorKey(k => k + 1)
  }

  const docId = id ?? idRef.current
  const safeContent = useMemo(() => sanitizeHtml(content), [content])

  const handleDone = async () => {
    if (isEmptyHtml(content)) {
      if (idRef.current) alert('日记内容为空。如需删除，请点击"删除"')
      return
    }
    // A new entry still showing just the template: nothing to save yet
    if (!idRef.current && normalize(content) === normalize(initialContent)) return
    if (blockSaveForPendingImages(content)) return
    if (!(await flush())) return
    setEditing(false)
    onDone?.()
  }

  return (
    <div className="mb-6 group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-gray-400 tracking-wide">{dateFormatted}</span>
        <div className="flex items-center gap-2">
          {isToday && (
            <span className="text-[10px] text-white bg-[#3a7a4f] px-2 py-0.5 rounded">今天</span>
          )}
          {docId && (
            <button
              onClick={() => setShowHistory(true)}
              className="text-[11px] text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              历史
            </button>
          )}
          {id && onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="text-[11px] text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              删除
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] text-gray-300 hover:text-gray-500"
            >
              编辑
            </button>
          )}
        </div>
      </div>

      {conflict !== null && <ConflictNotice onReload={loadLatest} onOverwrite={overwrite} />}
      {draft && <DraftNotice savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />}

      {editing ? (
        <div>
          <Editor key={editorKey} content={content} onChange={setContent} placeholder="写点什么..." onSave={() => { flush() }} showWordCount />
          <div className="flex gap-3 mt-2 justify-end items-center">
            <SaveStatus status={status} />
            <button
              onClick={handleDone}
              disabled={status === 'saving'}
              className="text-xs text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-3 py-1.5 rounded disabled:opacity-50"
            >
              完成
            </button>
          </div>
        </div>
      ) : (
        <div
          className="font-content prose prose-sm max-w-none text-gray-600 leading-relaxed cursor-pointer hover:bg-gray-50 rounded p-2 -m-2"
          onClick={e => {
            // [[links]] and #tags navigate in-app; other links open normally
            const href = internalHref(e.target)
            if (href && !e.metaKey && !e.ctrlKey) {
              e.preventDefault()
              router.push(href)
              return
            }
            if ((e.target as HTMLElement).closest('a')) return
            setEditing(true)
          }}
          dangerouslySetInnerHTML={{ __html: safeContent }}
        />
      )}

      {showHistory && docId && (
        <RevisionHistory type="diary" id={docId} onRestore={restoreRevision} onClose={() => setShowHistory(false)} />
      )}
    </div>
  )
}
