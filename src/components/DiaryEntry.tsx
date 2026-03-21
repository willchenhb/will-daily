'use client'

import { useState } from 'react'
import Editor from './Editor'

interface DiaryEntryProps {
  id?: number
  date: string
  dateFormatted: string
  content: string
  isToday?: boolean
  onSave: (data: { id?: number; date: string; content: string }) => Promise<void>
}

export default function DiaryEntry({ id, date, dateFormatted, content: initialContent, isToday, onSave }: DiaryEntryProps) {
  const [content, setContent] = useState(initialContent)
  const [editing, setEditing] = useState(isToday && !id)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!content || content === '<p></p>') return
    setSaving(true)
    await onSave({ id, date, content })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-gray-400 tracking-wide">{dateFormatted}</span>
        <div className="flex items-center gap-2">
          {isToday && (
            <span className="text-[10px] text-white bg-[#3a7a4f] px-2 py-0.5 rounded">今天</span>
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

      {editing ? (
        <div>
          <Editor content={content} onChange={setContent} placeholder="写点什么..." />
          <div className="flex gap-2 mt-2 justify-end">
            <button
              onClick={() => { setEditing(false); setContent(initialContent) }}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-3 py-1.5 rounded disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="font-content text-[15px] text-gray-600 leading-relaxed cursor-pointer hover:bg-gray-50 rounded p-2 -m-2"
          onClick={() => setEditing(true)}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
    </div>
  )
}
