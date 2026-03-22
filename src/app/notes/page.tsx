'use client'

import { useState, useEffect, useCallback } from 'react'
import NoteCard from '@/components/NoteCard'
import Toast from '@/components/Toast'
import { useRouter } from 'next/navigation'

interface NoteItem {
  id: number
  title: string
  content: string
  category: string | null
  summary: string | null
  createdAt: string
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const router = useRouter()

  const fetchNotes = useCallback(async () => {
    const params = activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : ''
    const res = await fetch(`/api/notes${params}`)
    const data = await res.json()
    setNotes(data.notes)
  }, [activeCategory])

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/notes/categories')
    const data = await res.json()
    setCategories(data)
  }, [])

  const checkApiKey = useCallback(async () => {
    const res = await fetch('/api/settings')
    if (!res.ok) return
    const data = await res.json()
    setHasApiKey(data.ai_api_key_set === 'true')
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])
  useEffect(() => { fetchCategories(); checkApiKey() }, [fetchCategories, checkApiKey])

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新笔记', content: '' }),
      })
      const note = await res.json()
      router.push(`/notes/${note.id}`)
    } catch {
      setToast({ message: '创建失败', type: 'error' })
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center mb-5">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[12px] px-2.5 py-1 rounded-full ${
              !activeCategory ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-400 border border-gray-100'
            }`}
          >
            全部
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-[12px] px-2.5 py-1 rounded-full ${
                activeCategory === cat ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-400 border border-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          onClick={handleCreate}
          className="text-[12px] bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
        >
          + 新笔记
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {notes.map(note => (
          <NoteCard key={note.id} {...note} hasApiKey={hasApiKey} onSummaryGenerated={fetchNotes} />
        ))}
        {notes.length === 0 && (
          <div className="text-center text-gray-300 text-sm py-12">暂无笔记</div>
        )}
      </div>
    </div>
  )
}
