'use client'

import { useState } from 'react'
import TodoItem from './TodoItem'
import Editor from './Editor'

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
  onSave: (data: { id?: number; weekStart: string; content?: string }) => Promise<number | undefined>
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
  const [content, setContent] = useState(initialContent || '')
  const [editingContent, setEditingContent] = useState(false)
  const [newTodo, setNewTodo] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSaveContent = async () => {
    setSaving(true)
    await onSave({ id, weekStart, content })
    setSaving(false)
    setEditingContent(false)
  }

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return
    let planId = id
    if (!planId) {
      planId = await onSave({ weekStart })
    }
    if (!planId) return

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
            <Editor content={content} onChange={setContent} placeholder="本周总结和思考..." />
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={() => { setEditingContent(false); setContent(initialContent || '') }} className="text-xs text-gray-400 px-3 py-1">取消</button>
              <button onClick={handleSaveContent} disabled={saving} className="text-xs text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-3 py-1.5 rounded disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : content ? (
          <div
            className="font-content text-[14px] text-gray-500 leading-relaxed cursor-pointer hover:bg-gray-50 rounded p-2 -m-2"
            onClick={() => setEditingContent(true)}
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
