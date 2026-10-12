'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import TodoItem from './TodoItem'
import Editor from './Editor'
import SaveStatus from './SaveStatus'
import { blockSaveForPendingImages, hasPendingImages } from '@/lib/editor-images'
import { useAutosave } from '@/lib/use-autosave'
import { isEmptyHtml } from '@/lib/html'
import { internalHref } from '@/lib/wiki'

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
  todos: Todo[]
  isCurrent?: boolean
  isNext?: boolean
  // Creates or updates the plan and resolves to its id; rejects on failure
  onSave: (data: { id?: number; weekStart: string; content?: string }) => Promise<number>
  onRefresh: () => void
}

export default function WeeklyPlan({
  id,
  weekStart,
  weekLabel,
  content: initialContent,
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
  // A placeholder week gets its id from the first save
  const planIdRef = useRef(id)

  const { status, flush } = useAutosave({
    value: isEmptyHtml(content) ? '' : content,
    save: async html => { planIdRef.current = await onSave({ id: planIdRef.current, weekStart, content: html }) },
    canSave: html => !hasPendingImages(html),
  })

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
        planId = planIdRef.current = await onSave({ weekStart })
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

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[15px] font-semibold text-gray-700">{weekLabel}</span>
        {isCurrent && (
          <span className="text-[10px] text-white bg-[#3a7a4f] px-2 py-0.5 rounded">本周</span>
        )}
        {isNext && (
          <span className="text-[10px] text-[#3a7a4f] border border-[#c5d9c5] px-2 py-0.5 rounded">下周</span>
        )}
      </div>

      <div className="mb-4">
        {editingContent ? (
          <div>
            <Editor content={content} onChange={setContent} placeholder="本周总结和思考..." onSave={() => { flush() }} />
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
            dangerouslySetInnerHTML={{ __html: content }}
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

      <div className="flex flex-col gap-2.5">
        {todos.map(todo => (
          <TodoItem
            key={todo.id}
            id={todo.id}
            text={todo.text}
            completed={todo.completed}
            note={todo.note}
            weeklyPlanId={id!}
            onUpdate={onRefresh}
          />
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
    </div>
  )
}
