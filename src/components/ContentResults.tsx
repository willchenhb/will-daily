import Link from 'next/link'
import type { ReactNode } from 'react'

// Shape returned by /api/search, /api/tags?t= and /api/notes/:id/backlinks
export interface ContentResult {
  type: 'note' | 'diary' | 'weekly'
  id: number
  title: string
  snippet: string
  date: string
  href: string
}

export const TYPE_LABELS: Record<ContentResult['type'], string> = { note: '笔记', diary: '日记', weekly: '周记' }

// Wrap occurrences of `terms` in <mark>
export function highlight(text: string, terms: string[]): ReactNode {
  const words = terms.filter(Boolean)
  if (words.length === 0) return text
  const escaped = words.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
  return parts.map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="bg-[#fef3c7] text-inherit rounded-sm">{part}</mark> : part
  )
}

export function TypeBadge({ type }: { type: ContentResult['type'] }) {
  return (
    <span className="text-[10px] text-[#3a7a4f] border border-[#c5d9c5] rounded px-1.5 py-px flex-none">
      {TYPE_LABELS[type]}
    </span>
  )
}

export function ContentResultList({ results, terms = [] }: { results: ContentResult[]; terms?: string[] }) {
  return (
    <div className="flex flex-col">
      {results.map(r => (
        <Link
          key={`${r.type}-${r.id}`}
          href={r.href}
          className="block px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TypeBadge type={r.type} />
            <span className="text-[13px] text-gray-700 font-medium truncate">{highlight(r.title, terms)}</span>
            <span className="ml-auto text-[11px] text-gray-300 flex-none">{r.date}</span>
          </div>
          {r.snippet && (
            <div className="mt-1 text-[12px] text-gray-400 leading-relaxed line-clamp-2">{highlight(r.snippet, terms)}</div>
          )}
        </Link>
      ))}
    </div>
  )
}
