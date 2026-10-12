'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { highlight, TypeBadge, type ContentResult } from './ContentResults'

type SearchResult = ContentResult

// Dispatch this to open the palette from elsewhere (e.g. the sidebar button)
export const OPEN_SEARCH_EVENT = 'open-search'

// Cmd/Ctrl+K quick search across notes, diary and weekly plans
export default function SearchPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
    }
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  // Debounced search; stale responses are aborted
  useEffect(() => {
    const q = query.trim()
    if (!open || !q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(res => (res.ok ? res.json() : { results: [] }))
        .then(data => {
          setResults(data.results)
          setActive(0)
          setLoading(false)
        })
        .catch(() => {})
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open || pathname === '/login') return null

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const go = (result: SearchResult) => {
    close()
    router.push(result.href)
  }

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      go(results[active])
    } else if (e.key === 'Escape') {
      close()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-start justify-center px-4 pt-[12vh]" onMouseDown={close}>
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-gray-100">
          <span className="text-gray-300 text-[15px]">🔍</span>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="搜索笔记、日记、周记…（空格分隔多个关键词）"
            className="flex-1 py-3.5 text-[14px] outline-none bg-transparent"
          />
          <kbd className="text-[10px] text-gray-300 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="px-4 py-6 text-center text-[12px] text-gray-300">输入关键词开始搜索 · ⌘K 随时打开</div>
          ) : loading && results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-gray-300">搜索中…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-gray-400">没有找到相关内容</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}`}
                data-index={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`w-full text-left px-4 py-2.5 border-b border-gray-50 last:border-b-0 ${
                  i === active ? 'bg-[#eef5ee]' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <TypeBadge type={r.type} />
                  <span className="text-[13px] text-gray-700 font-medium truncate">{highlight(r.title, terms)}</span>
                  <span className="ml-auto text-[11px] text-gray-300 flex-none">{r.date}</span>
                </div>
                {r.snippet && (
                  <div className="mt-1 text-[12px] text-gray-400 leading-relaxed line-clamp-2">{highlight(r.snippet, terms)}</div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
