'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import DiaryEntry from '@/components/DiaryEntry'
import Toast from '@/components/Toast'
import Loading from '@/components/Loading'
import { getToday, formatDate } from '@/lib/dates'
import { internalHref } from '@/lib/wiki'

interface Entry {
  id: number
  date: string
  type?: string
  content: string
}

export default function DiaryPage() {
  return (
    <Suspense>
      <DiaryList />
    </Suspense>
  )
}

function DiaryList() {
  // ?date=YYYY-MM-DD (from search) shows just that day
  const dateFilter = useSearchParams().get('date')
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const today = getToday()
  const todayDiaryExists = entries.some(e => e.date === today && (!e.type || e.type === 'diary'))

  const fetchEntries = useCallback(async () => {
    const res = await fetch(dateFilter ? `/api/diary?from=${dateFilter}&to=${dateFilter}` : '/api/diary')
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries)
    }
    setLoading(false)
  }, [dateFilter])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // Called by autosave: no toast or refetch, which would remount the entry being edited
  const handleSave = async (data: { id?: number; date: string; content: string }): Promise<number> => {
    const res = data.id
      ? await fetch(`/api/diary/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data.content }),
        })
      : await fetch('/api/diary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: data.date, content: data.content }),
        })
    if (!res.ok) throw new Error('保存失败')
    const entry = await res.json()
    return entry.id
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

      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-800">日记</h1>
        {dateFilter && (
          <Link href="/diary" className="text-[12px] text-gray-400 hover:text-gray-600">← 全部日记</Link>
        )}
      </div>

      {dateFilter && entries.length === 0 && (
        <div className="text-[13px] text-gray-400">{formatDate(dateFilter)} 没有日记</div>
      )}

      {!dateFilter && !todayDiaryExists && (
        <>
          <DiaryEntry
            date={today}
            dateFormatted={formatDate(today)}
            content=""
            isToday
            onSave={handleSave}
            onDone={fetchEntries}
          />
          <div className="border-t border-gray-100 mb-6" />
        </>
      )}

      {entries.map(entry => (
        <div key={entry.id}>
          {entry.type === 'chat_summary' ? (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-400 tracking-wide">
                  💬 群聊总结 · {formatDate(entry.date)}
                </span>
                {entry.date === today && (
                  <span className="text-[10px] text-white bg-blue-500 px-2 py-0.5 rounded">今天</span>
                )}
              </div>
              <div
                className="font-content text-[14px] text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4 prose prose-sm max-w-none"
                onClick={e => {
                  const href = internalHref(e.target)
                  if (href && !e.metaKey && !e.ctrlKey) { e.preventDefault(); router.push(href) }
                }}
                dangerouslySetInnerHTML={{ __html: entry.content }}
              />
            </div>
          ) : (
            <DiaryEntry
              id={entry.id}
              date={entry.date}
              dateFormatted={formatDate(entry.date)}
              content={entry.content}
              isToday={entry.date === today}
              onSave={handleSave}
              onDone={fetchEntries}
              onDelete={handleDelete}
            />
          )}
          <div className="border-t border-gray-100 mb-6" />
        </div>
      ))}
    </div>
  )
}
