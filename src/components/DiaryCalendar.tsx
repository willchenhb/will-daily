'use client'

import { useEffect, useState } from 'react'
import { getToday } from '@/lib/dates'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const pad = (n: number) => String(n).padStart(2, '0')

// Month grid (Monday first); days with an entry are marked, clicking a day picks it
export default function DiaryCalendar({ selected, onPick }: { selected?: string | null; onPick: (date: string) => void }) {
  const today = getToday()
  const initial = (selected || today).slice(0, 7)
  const [month, setMonth] = useState(initial) // YYYY-MM
  const [marked, setMarked] = useState<Set<string>>(new Set())

  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const leading = (new Date(year, mon - 1, 1).getDay() + 6) % 7 // blanks before the 1st

  useEffect(() => {
    fetch(`/api/diary/dates?from=${month}-01&to=${month}-${pad(daysInMonth)}`)
      .then(res => (res.ok ? res.json() : { dates: [] }))
      .then(data => setMarked(new Set(data.dates)))
      .catch(() => {})
  }, [month, daysInMonth])

  const shift = (delta: number) => {
    const d = new Date(year, mon - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }

  return (
    <div className="w-72 rounded-xl border border-gray-100 bg-white p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => shift(-1)} className="px-2 text-gray-400 hover:text-gray-700" aria-label="上个月">‹</button>
        <button onClick={() => setMonth(today.slice(0, 7))} className="text-[13px] font-medium text-gray-700" title="回到本月">
          {year}年{mon}月
        </button>
        <button onClick={() => shift(1)} className="px-2 text-gray-400 hover:text-gray-700" aria-label="下个月">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map(w => <div key={w} className="text-[10px] text-gray-300 py-1">{w}</div>)}
        {Array.from({ length: leading }, (_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${month}-${pad(i + 1)}`
          const has = marked.has(date)
          const isSelected = date === selected
          const isFuture = date > today
          return (
            <button
              key={date}
              disabled={isFuture}
              onClick={() => onPick(date)}
              title={has ? '查看这天的日记' : '写这天的日记'}
              className={`relative h-8 rounded-md text-[12px] transition-colors ${
                isSelected
                  ? 'bg-[#3a7a4f] text-white'
                  : isFuture
                    ? 'text-gray-200 cursor-default'
                    : has
                      ? 'text-[#3a7a4f] font-semibold hover:bg-[#eef5ee]'
                      : 'text-gray-500 hover:bg-gray-50'
              } ${date === today && !isSelected ? 'ring-1 ring-[#3a7a4f]' : ''}`}
            >
              {i + 1}
              {has && !isSelected && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#3a7a4f]" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
