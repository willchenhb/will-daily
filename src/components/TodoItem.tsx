'use client'

import { useState, useRef, useEffect } from 'react'

interface TodoItemProps {
  id: number
  text: string
  completed: boolean
  note: string | null
  weeklyPlanId: number
  onUpdate: () => void
}

export default function TodoItem({ id, text, completed, note, weeklyPlanId, onUpdate }: TodoItemProps) {
  const [isCompleted, setIsCompleted] = useState(completed)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(text)
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState(note || '')
  const [savingNote, setSavingNote] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const toggle = async () => {
    const newValue = !isCompleted
    setIsCompleted(newValue)
    await fetch(`/api/weekly/${weeklyPlanId}/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: newValue }),
    })
    onUpdate()
  }

  const saveText = async () => {
    if (!editText.trim()) { setEditText(text); setEditing(false); return }
    if (editText !== text) {
      await fetch(`/api/weekly/${weeklyPlanId}/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim() }),
      })
      onUpdate()
    }
    setEditing(false)
  }

  const saveNote = async () => {
    setSavingNote(true)
    await fetch(`/api/weekly/${weeklyPlanId}/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText || null }),
    })
    setSavingNote(false)
    onUpdate()
  }

  const handleDelete = async () => {
    await fetch(`/api/weekly/${weeklyPlanId}/todos/${id}`, { method: 'DELETE' })
    onUpdate()
  }

  return (
    <div className="group">
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={toggle}
          className="w-4 h-4 accent-[#3a7a4f] cursor-pointer flex-shrink-0"
        />

        {editing ? (
          <input
            ref={inputRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={saveText}
            onKeyDown={e => {
              if (e.key === 'Enter') saveText()
              if (e.key === 'Escape') { setEditText(text); setEditing(false) }
            }}
            className="flex-1 text-[14px] text-gray-700 border-b border-[#c5d9c5] outline-none bg-transparent py-0.5"
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className={`flex-1 text-[14px] cursor-text hover:text-[#3a7a4f] transition-colors ${
              isCompleted ? 'line-through text-gray-300' : 'text-gray-700'
            }`}
          >
            {text}
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowNote(!showNote)}
            className={`text-xs px-1.5 py-0.5 rounded ${
              note ? 'text-[#3a7a4f]' : 'text-gray-300 hover:text-gray-500'
            }`}
            title="反馈笔记"
          >
            {note ? '📝' : '💬'}
          </button>
          <button
            onClick={handleDelete}
            className="text-gray-300 hover:text-red-400 text-xs"
          >
            ✕
          </button>
        </div>

        {/* Show note indicator when collapsed */}
        {note && !showNote && (
          <span
            onClick={() => setShowNote(true)}
            className="text-[10px] text-[#3a7a4f] cursor-pointer"
          >
            📝
          </span>
        )}
      </div>

      {/* Note/feedback area */}
      {showNote && (
        <div className="ml-[26px] mt-1.5 mb-1">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="完成反馈、备注..."
            rows={2}
            className="w-full text-[12px] text-gray-500 bg-[#fafcfa] border border-gray-100 rounded px-2.5 py-1.5 outline-none focus:border-[#c5d9c5] resize-none"
          />
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => setShowNote(false)}
              className="text-[11px] text-gray-400 hover:text-gray-600"
            >
              收起
            </button>
            <button
              onClick={saveNote}
              disabled={savingNote}
              className="text-[11px] text-[#3a7a4f] hover:text-[#2d6b3f] disabled:opacity-50"
            >
              {savingNote ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
