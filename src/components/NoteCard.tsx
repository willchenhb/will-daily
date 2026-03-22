'use client'

import Link from 'next/link'
import { useState } from 'react'

interface NoteCardProps {
  id: number
  title: string
  content: string
  category: string | null
  summary: string | null
  createdAt: string
  hasApiKey?: boolean
  onSummaryGenerated?: () => void
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').slice(0, 120)
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function NoteCard({ id, title, content, category, summary, createdAt, hasApiKey, onSummaryGenerated }: NoteCardProps) {
  const [summarizing, setSummarizing] = useState(false)

  const handleSummary = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSummarizing(true)
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: id }),
      })
      if (res.ok) {
        onSummaryGenerated?.()
      }
    } catch { /* ignore */ }
    setSummarizing(false)
  }

  return (
    <Link href={`/notes/${id}`}>
      <div className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors cursor-pointer group">
        <div className="flex justify-between items-center">
          <span className="text-[14px] font-medium text-gray-700">{title}</span>
          <div className="flex items-center gap-2">
            {hasApiKey && !summary && content && (
              <button
                onClick={handleSummary}
                disabled={summarizing}
                className="text-[10px] text-[#3a7a4f] border border-[#c5d9c5] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#f0faf4] disabled:opacity-50"
              >
                {summarizing ? '生成中...' : '✦ 摘要'}
              </button>
            )}
            <span className="text-[11px] text-gray-400">{formatShortDate(createdAt)}</span>
          </div>
        </div>
        <div className="text-[12px] text-gray-400 mt-1.5 line-clamp-2">
          {stripHtml(content)}
        </div>
        <div className="flex gap-2 mt-2 items-center">
          {category && (
            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{category}</span>
          )}
          {summary && (
            <span className="text-[10px] text-[#3a7a4f]">{'\u2726'} AI 摘要</span>
          )}
        </div>
      </div>
    </Link>
  )
}
