'use client'

import { useState, useEffect, useCallback } from 'react'
import DiaryEntry from '@/components/DiaryEntry'
import Toast from '@/components/Toast'
import Loading from '@/components/Loading'
import { getToday, formatDate } from '@/lib/dates'

interface Entry {
  id: number
  date: string
  content: string
}

export default function DiaryPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const today = getToday()
  const todayExists = entries.some(e => e.date === today)

  const fetchEntries = useCallback(async () => {
    const res = await fetch('/api/diary')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setEntries(data.entries)
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleSave = async (data: { id?: number; date: string; content: string }) => {
    try {
      if (data.id) {
        await fetch(`/api/diary/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data.content }),
        })
      } else {
        await fetch('/api/diary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: data.date, content: data.content }),
        })
      }
      setToast({ message: '已保存', type: 'success' })
      fetchEntries()
    } catch {
      setToast({ message: '保存失败', type: 'error' })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这篇日记？')) return
    try {
      await fetch(`/api/diary/${id}`, { method: 'DELETE' })
      setToast({ message: '已删除', type: 'success' })
      fetchEntries()
    } catch {
      setToast({ message: '删除失败', type: 'error' })
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-8 py-6"><Loading /></div>

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <h1 className="text-lg font-semibold text-gray-800 mb-4">日记</h1>

      {!todayExists && (
        <>
          <DiaryEntry
            date={today}
            dateFormatted={formatDate(today)}
            content=""
            isToday
            onSave={handleSave}
          />
          <div className="border-t border-gray-100 mb-6" />
        </>
      )}

      {entries.map(entry => (
        <div key={entry.id}>
          <DiaryEntry
            id={entry.id}
            date={entry.date}
            dateFormatted={formatDate(entry.date)}
            content={entry.content}
            isToday={entry.date === today}
            onSave={handleSave}
            onDelete={handleDelete}
          />
          <div className="border-t border-gray-100 mb-6" />
        </div>
      ))}
    </div>
  )
}
