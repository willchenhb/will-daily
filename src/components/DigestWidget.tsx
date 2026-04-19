'use client'

import { useState, useEffect } from 'react'

interface DigestItem {
  id: number
  category: string
  title: string
  summary: string | null
  url: string | null
}

const CATEGORY_ICONS: Record<string, string> = {
  '时政新闻': '🏛️',
  'AI新闻': '🤖',
  '产品热点': '🔥',
  '体育新闻': '⚽',
}

const CATEGORY_ORDER = ['时政新闻', 'AI新闻', '产品热点', '体育新闻']

export default function DigestWidget({ collapsed }: { collapsed: boolean }) {
  const [grouped, setGrouped] = useState<Record<string, DigestItem[]>>({})
  const [expanded, setExpanded] = useState(true)
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    fetch('/api/digest')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.grouped) {
          setGrouped(data.grouped)
          setHasData(Object.keys(data.grouped).length > 0)
        }
      })
      .catch(() => {})
  }, [])

  if (!hasData) return null

  if (collapsed) {
    return (
      <div className="px-2 mb-2">
        <div className="flex justify-center py-2 text-[15px]" title="今日导读">📰</div>
      </div>
    )
  }

  const totalCount = Object.values(grouped).reduce((sum, items) => sum + items.length, 0)

  return (
    <div className="px-2 mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-1.5 w-full text-left text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
      >
        <span className="text-[13px]">📰</span>
        <span className="font-medium">今日导读</span>
        <span className="text-[10px] text-gray-300 ml-auto">{totalCount}</span>
        <span className="text-[10px] text-gray-300">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="mt-1 space-y-2">
          {CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(category => (
            <div key={category}>
              <div className="flex items-center gap-1 px-3 mb-0.5">
                <span className="text-[11px]">{CATEGORY_ICONS[category]}</span>
                <span className="text-[10px] font-medium text-gray-400">{category}</span>
              </div>
              <div className="space-y-0.5">
                {grouped[category].slice(0, 3).map(item => (
                  <a
                    key={item.id}
                    href={item.url || '#'}
                    target={item.url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="block px-3 py-1 text-[11px] text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded leading-snug truncate transition-colors"
                    title={item.summary || item.title}
                  >
                    {item.title}
                  </a>
                ))}
                {grouped[category].length > 3 && (
                  <div className="px-3 text-[10px] text-gray-300">+{grouped[category].length - 3} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
