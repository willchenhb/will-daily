'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import TodoItem from './TodoItem'
import Editor from './Editor'
import SaveStatus from './SaveStatus'
import ConflictNotice from './ConflictNotice'
import RevisionHistory from './RevisionHistory'
import DraftNotice from './DraftNotice'
import { blockSaveForPendingImages, hasPendingImages } from '@/lib/editor-images'
import { useAutosave } from '@/lib/use-autosave'
import { useDragSort } from '@/lib/use-drag-sort'
import { isEmptyHtml } from '@/lib/html'
import { internalHref } from '@/lib/wiki'
import { sanitizeHtml } from '@/lib/sanitize'
import { keepInHistory, type SaveFlags } from '@/lib/save-doc'
import { clearDraft, pendingDraft, type Draft } from '@/lib/drafts'

export interface SavedPlan { id: number; content: string | null; updatedAt: string }

interface Todo {
  id: number
  text: string
  completed: boolean
  note: string | null
  order: number
}

interface WeeklyPlanProps {
  id?: number
  weekStart: string
  weekLabel: string
  content: string
  updatedAt?: string
  todos: Todo[]
  isCurrent?: boolean
  isNext?: boolean
  // Creates or updates the plan; rejects on failure (ConflictError on an edit conflict)
  onSave: (data: { id?: number; weekStart: string; content?: string } & SaveFlags) => Promise<SavedPlan>
  onRefresh: () => void
}

// Autosave compares this form, so an editor emptied back to "<p></p>" counts as unchanged
const normalize = (html: string) => (isEmptyHtml(html) ? '' : html)

export default function WeeklyPlan({
  id,
  weekStart,
  weekLabel,
  content: initialContent,
  updatedAt,
  todos,
  isCurrent,
  isNext,
  onSave,
  onRefresh,
}: WeeklyPlanProps) {
  const router = useRouter()
  const [content, setContent] = useState(initialContent || '')
  const [editingContent, setEditingContent] = useState(false)
  const [newTodo, setNewTodo] = useState('')
  // Shown order of the todos; follows the server's list, and is updated right away on reorder
  const [items, setItems] = useState(todos)
  useEffect(() => setItems(todos), [todos])
  const [showHistory, setShowHistory] = useState(false)
  // Bumped to remount the editor with new content (restore, reload after conflict)
  const [editorKey, setEditorKey] = useState(0)
  // A placeholder week gets its id from the first save
  const planIdRef = useRef(id)
  // Version being edited (server updatedAt), and flags for the next save
  const versionRef = useRef(updatedAt ?? null)
  const nextSaveFlags = useRef<SaveFlags>({})
  // One plan per week, so the week identifies the draft (also before the first save)
  const draftKey = `weekly:${weekStart}`
  const [draft, setDraft] = useState<Draft<string> | null>(null)

  useEffect(() => {
    setDraft(pendingDraft<string>(draftKey, normalize(initialContent || '')))
    // Only when the plan first appears; later edits are this component's own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  const remember = (saved: SavedPlan) => {
    planIdRef.current = saved.id
    versionRef.current = saved.updatedAt
  }

  const { status, flush, conflict, reset, retry } = useAutosave({
    value: normalize(content),
    save: async html => {
      remember(await onSave({ id: planIdRef.current, weekStart, content: html, baseUpdatedAt: versionRef.current, ...nextSaveFlags.current }))
      nextSaveFlags.current = {}
    },
    canSave: html => !hasPendingImages(html),
    draftKey,
  })

  const restoreDraft = () => {
    if (!draft) return
    nextSaveFlags.current = { snapshot: true }
    setContent(draft.value)
    setDraft(null)
    setEditingContent(true)
    setEditorKey(k => k + 1)
  }

  const discardDraft = () => {
    clearDraft(draftKey)
    setDraft(null)
  }

  const loadLatest = () => {
    if (planIdRef.current) keepInHistory('weekly', planIdRef.current, content)
    const latest = conflict as SavedPlan
    setContent(latest.content || '')
    versionRef.current = latest.updatedAt
    reset(normalize(latest.content || ''))
    setEditorKey(k => k + 1)
  }

  const overwrite = () => {
    nextSaveFlags.current = { force: true }
    retry()
  }

  const safeContent = useMemo(() => sanitizeHtml(content), [content])

  const restoreRevision = (revision: { content: string }) => {
    nextSaveFlags.current = { snapshot: true }
    setContent(revision.content)
    setEditorKey(k => k + 1)
  }

  const handleDone = async () => {
    if (blockSaveForPendingImages(content)) return
    if (!(await flush())) return
    setEditingContent(false)
    onRefresh()
  }

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return
    let planId = planIdRef.current
    if (!planId) {
      try {
        const saved = await onSave({ weekStart })
        remember(saved)
        planId = saved.id
      } catch {
        alert('创建周记失败')
        return
      }
    }

    await fetch(`/api/weekly/${planId}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newTodo.trim() }),
    })
    setNewTodo('')
    onRefresh()
  }

  const reorder = async (next: Todo[]) => {
    setItems(next)
    const res = await fetch(`/api/weekly/${planIdRef.current}/todos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map(t => t.id) }),
    }).catch(() => null)
    if (!res?.ok) {
      alert('调整顺序失败，已恢复原来的顺序')
      onRefresh()
    }
  }

  const { listRef, draggingId, handleProps, itemStyle } = useDragSort(items, reorder)

  return (
    // Named group: the todo rows have hover actions of their own
    <div className="mb-8 group/plan">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[15px] font-semibold text-gray-700">{weekLabel}</span>
        <div className="flex items-center gap-2">
          {planIdRef.current && (
            <button
              onClick={() => setShowHistory(true)}
              className="text-[11px] text-gray-300 hover:text-gray-500 opacity-0 group-hover/plan:opacity-100 transition-opacity"
            >
              历史
            </button>
          )}
          {isCurrent && (
            <span className="text-[10px] text-white bg-[#3a7a4f] px-2 py-0.5 rounded">本周</span>
          )}
          {isNext && (
            <span className="text-[10px] text-[#3a7a4f] border border-[#c5d9c5] px-2 py-0.5 rounded">下周</span>
          )}
        </div>
      </div>

      {conflict !== null && <ConflictNotice onReload={loadLatest} onOverwrite={overwrite} />}
      {draft && <DraftNotice savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />}

      <div className="mb-4">
        {editingContent ? (
          <div>
            <Editor key={editorKey} content={content} onChange={setContent} placeholder="本周总结和思考..." onSave={() => { flush() }} showWordCount />
            <div className="flex gap-3 mt-2 justify-end items-center">
              <SaveStatus status={status} />
              <button onClick={handleDone} disabled={status === 'saving'} className="text-xs text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-3 py-1.5 rounded disabled:opacity-50">
                完成
              </button>
            </div>
          </div>
        ) : !isEmptyHtml(content) ? (
          <div
            className="font-content prose prose-sm max-w-none text-gray-500 leading-relaxed cursor-pointer hover:bg-gray-50 rounded p-2 -m-2"
            onClick={e => {
              // [[links]] and #tags navigate in-app; other links open normally
              const href = internalHref(e.target)
              if (href && !e.metaKey && !e.ctrlKey) {
                e.preventDefault()
                router.push(href)
                return
              }
              if ((e.target as HTMLElement).closest('a')) return
              setEditingContent(true)
            }}
            dangerouslySetInnerHTML={{ __html: safeContent }}
          />
        ) : (isCurrent || isNext) ? (
          <div
            className="text-[13px] text-gray-300 cursor-pointer hover:text-gray-400 py-1"
            onClick={() => setEditingContent(true)}
          >
            + 写周反思...
          </div>
        ) : null}
      </div>

      <div ref={listRef} className={`flex flex-col gap-2.5 ${draggingId !== null ? 'select-none' : ''}`}>
        {items.map(todo => (
          <div
            key={todo.id}
            style={itemStyle(todo.id)}
            className={`relative group/row rounded ${draggingId === todo.id ? 'bg-white shadow-md' : ''}`}
          >
            {items.length > 1 && (
              <button
                type="button"
                {...handleProps(todo.id)}
                aria-label="拖动调整顺序"
                title="拖动调整顺序（也可按 ↑↓）"
                className={`absolute -left-6 top-0 h-[21px] w-6 flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none select-none outline-none focus-visible:text-[#3a7a4f] transition-opacity ${
                  draggingId === todo.id ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100'
                }`}
              >
                <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden="true">
                  <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
                  <circle cx="2" cy="6" r="1.2" /><circle cx="6" cy="6" r="1.2" />
                  <circle cx="2" cy="10" r="1.2" /><circle cx="6" cy="10" r="1.2" />
                </svg>
              </button>
            )}
            <TodoItem
              id={todo.id}
              text={todo.text}
              completed={todo.completed}
              note={todo.note}
              weeklyPlanId={id!}
              onUpdate={onRefresh}
            />
          </div>
        ))}
      </div>

      {(isCurrent || isNext || id) && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
            placeholder="添加待办..."
            className="flex-1 text-[13px] text-gray-500 placeholder-gray-300 border-none outline-none bg-transparent"
          />
          {newTodo && (
            <button onClick={handleAddTodo} className="text-xs text-[#3a7a4f]">添加</button>
          )}
        </div>
      )}
      {showHistory && planIdRef.current && (
        <RevisionHistory type="weekly" id={planIdRef.current} onRestore={restoreRevision} onClose={() => setShowHistory(false)} />
      )}
    </div>
  )
}
