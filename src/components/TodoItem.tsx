'use client'

import { useState } from 'react'

interface TodoItemProps {
  id: number
  text: string
  completed: boolean
  weeklyPlanId: number
  onUpdate: () => void
}

export default function TodoItem({ id, text, completed, weeklyPlanId, onUpdate }: TodoItemProps) {
  const [isCompleted, setIsCompleted] = useState(completed)

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

  const handleDelete = async () => {
    await fetch(`/api/weekly/${weeklyPlanId}/todos/${id}`, { method: 'DELETE' })
    onUpdate()
  }

  return (
    <div className="flex items-center gap-2.5 group">
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={toggle}
        className="w-4 h-4 accent-[#3a7a4f] cursor-pointer"
      />
      <span className={`flex-1 text-[14px] ${isCompleted ? 'line-through text-gray-300' : 'text-gray-700'}`}>
        {text}
      </span>
      <button
        onClick={handleDelete}
        className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </div>
  )
}
