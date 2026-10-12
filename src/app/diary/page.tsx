'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import DiaryEntry, { type SavedEntry } from '@/components/DiaryEntry'
import Toast from '@/components/Toast'
import Loading from '@/components/Loading'
import DiaryCalendar from '@/components/DiaryCalendar'
import { getToday, formatDate } from '@/lib/dates'
import { internalHref } from '@/lib/wiki'
import { saveDoc, type SaveFlags } from '@/lib/save-doc'
import { applyDiaryTemplate } from '@/lib/diary-template'

const PAGE_SIZE = 20
const API_MAX_SIZE = 100

interface Entry {
  id: number
  date: string
  type?: string
  content: string
  updatedAt: string
}

export default function DiaryPage() {
  return (
    <Suspense>
      <DiaryList />
    </Suspense>
  )
}

function DiaryList() {
  // ?date=YYYY-MM-DD (from search or the calendar) shows just that day
  const dateFilter = useSearchParams().get('date')
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(PAGE_SIZE) // entries loaded so far ("加载更多" adds a page)
  const [template, setTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const today = getToday()
  const newEntryDate = dateFilter || today
  const hasDiaryFor = (date: string) => entries.some(e => e.date === date && (!e.type || e.type === 'diary'))

  // Reloads everything shown so far, so finishing an edit keeps older pages
  const fetchEntries = useCallback(async () => {
    if (dateFilter) {
      const res = await fetch(`/api/diary?from=${dateFilter}&to=${dateFilter}`)
      if (res.ok) setEntries((await res.json()).entries)
    } else {
      const loaded: Entry[] = []
      let count = 0
      for (let page = 1; page <= Math.ceil(limit / API_MAX_SIZE); page++) {
        const res = await fetch(`/api/diary?page=${page}&size=${API_MAX_SIZE}`)
        if (!res.ok) break
        const data = await res.json()
        loaded.push(...data.entries)
        count = data.total
        if (data.entries.length < API_MAX_SIZE) break
      }
      setEntries(loaded.slice(0, limit))
      setTotal(count)
    }
    setLoading(false)
  }, [dateFilter, limit])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  useEffect(() => {
    fetch('/api/settings')
      .then(res => (res.ok ? res.json() : {}))
      .then((data: { diary_template?: string }) => setTemplate(data.diary_template || ''))
      .catch(() => setTemplate(''))
  }, [])

  // Close the calendar on outside click
  useEffect(() => {
    if (!showCalendar) return
    const onDown = (e: MouseEvent) => {
      if (!calendarRef.current?.contains(e.target as Node)) setShowCalendar(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showCalendar])

  // Called by autosave: no toast or refetch, which would remount the entry being edited
  const handleSave = ({ id, date, ...rest }: { id?: number; date: string; content: string } & SaveFlags): Promise<SavedEntry> =>
    id
      ? saveDoc<SavedEntry>(`/api/diary/${id}`, rest)
      : saveDoc<SavedEntry>('/api/diary', { date, content: rest.content }, 'POST')

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

  // The new-entry editor starts from the template, so wait for it
  if (loading || template === null) return <div className="max-w-3xl mx-auto px-8 py-6"><Loading /></div>

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-800">日记</h1>
        <div className="flex items-center gap-3">
          {dateFilter && (
            <Link href="/diary" className="text-[12px] text-gray-400 hover:text-gray-600">← 全部日记</Link>
          )}
          <div className="relative" ref={calendarRef}>
            <button
              onClick={() => setShowCalendar(v => !v)}
              className="text-[12px] text-gray-500 border border-gray-200 rounded px-2.5 py-1 hover:bg-gray-50"
            >
              📅 日历
            </button>
            {showCalendar && (
              <div className="absolute right-0 top-full mt-2 z-30">
                <DiaryCalendar
                  selected={dateFilter}
                  onPick={date => {
                    setShowCalendar(false)
                    router.push(date === today ? '/diary' : `/diary?date=${date}`)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New entry for today, or for the picked day (backfilling) */}
      {!hasDiaryFor(newEntryDate) && (
        <>
          <DiaryEntry
            key={newEntryDate}
            date={newEntryDate}
            dateFormatted={formatDate(newEntryDate)}
            content={applyDiaryTemplate(template, newEntryDate)}
            isToday={newEntryDate === today}
            defaultEditing
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
              updatedAt={entry.updatedAt}
              isToday={entry.date === today}
              onSave={handleSave}
              onDone={fetchEntries}
              onDelete={handleDelete}
            />
          )}
          <div className="border-t border-gray-100 mb-6" />
        </div>
      ))}

      {!dateFilter && entries.length < total && (
        <div className="text-center">
          <button
            onClick={() => setLimit(l => l + PAGE_SIZE)}
            className="text-[12px] text-gray-500 border border-gray-200 rounded px-4 py-1.5 hover:bg-gray-50"
          >
            加载更多（还有 {total - entries.length} 篇）
          </button>
        </div>
      )}
    </div>
  )
}
