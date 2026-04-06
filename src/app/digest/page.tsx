'use client'

import { useState, useEffect, useCallback } from 'react'

interface DigestItem {
  id: number
  date: string
  category: string
  title: string
  summary: string | null
  url: string | null
  source: string | null
  createdAt: string
}

const CATEGORY_ORDER = ['时政新闻', 'AI新闻', '产品热点']
const CATEGORY_ICONS: Record<string, string> = {
  '时政新闻': '🏛️',
  'AI新闻': '🤖',
  '产品热点': '🔥',
}
const CATEGORY_COLORS: Record<string, string> = {
  '时政新闻': '#dc2626',
  'AI新闻': '#2563eb',
  '产品热点': '#ea580c',
}

function getToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}`
}

export default function DigestPage() {
  const [date, setDate] = useState(getToday())
  const [grouped, setGrouped] = useState<Record<string, DigestItem[]>>({})
  const [loading, setLoading] = useState(true)

  const fetchDigest = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/digest?date=${d}`)
      if (res.ok) {
        const data = await res.json()
        setGrouped(data.grouped || {})
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchDigest(date) }, [date, fetchDigest])

  const goDay = (offset: number) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  const totalCount = Object.values(grouped).reduce((sum, items) => sum + items.length, 0)
  const hasData = totalCount > 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">今日导读</h1>
          <p className="text-sm text-gray-400 mt-0.5">{formatDate(date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => goDay(-1)} className="px-2.5 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">&larr; 前一天</button>
          {date !== getToday() && (
            <button onClick={() => setDate(getToday())} className="px-2.5 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">今天</button>
          )}
          <button onClick={() => goDay(1)} className="px-2.5 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" disabled={date >= getToday()}>后一天 &rarr;</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">加载中...</div>
      ) : !hasData ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm">暂无导读内容</p>
          <p className="text-gray-300 text-xs mt-2">通过 API 推送新闻到 /api/digest/push</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(category => (
            <section key={category}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{CATEGORY_ICONS[category]}</span>
                <h2 className="text-[15px] font-semibold" style={{ color: CATEGORY_COLORS[category] }}>{category}</h2>
                <span className="text-[11px] text-gray-300 ml-1">{grouped[category].length} 条</span>
              </div>
              <div className="space-y-2">
                {grouped[category].map(item => (
                  <div key={item.id} className="group border border-gray-100 rounded-xl p-3.5 hover:border-gray-200 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="text-[13px] font-medium text-gray-800 hover:text-blue-600 transition-colors leading-snug">
                            {item.title}
                          </a>
                        ) : (
                          <p className="text-[13px] font-medium text-gray-800 leading-snug">{item.title}</p>
                        )}
                        {item.summary && (
                          <p className="text-[12px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{item.summary}</p>
                        )}
                      </div>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-gray-300 hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors">
                          ↗
                        </a>
                      )}
                    </div>
                    {item.source && (
                      <div className="mt-1.5">
                        <span className="text-[10px] text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded">{item.source}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Show any categories not in CATEGORY_ORDER */}
          {Object.keys(grouped).filter(cat => !CATEGORY_ORDER.includes(cat)).map(category => (
            <section key={category}>
              <h2 className="text-[15px] font-semibold text-gray-700 mb-3">{category}</h2>
              <div className="space-y-2">
                {grouped[category].map(item => (
                  <div key={item.id} className="border border-gray-100 rounded-xl p-3.5">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-[13px] font-medium text-gray-800 hover:text-blue-600">{item.title}</a>
                    ) : (
                      <p className="text-[13px] font-medium text-gray-800">{item.title}</p>
                    )}
                    {item.summary && <p className="text-[12px] text-gray-500 mt-1">{item.summary}</p>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
