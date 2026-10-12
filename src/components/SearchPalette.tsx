'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { highlight, TypeBadge, type ContentResult } from './ContentResults'
import { fetchBookmarks, type Bookmark } from '@/lib/bookmarks'

// Dispatch this to open the palette from elsewhere (e.g. the sidebar button)
export const OPEN_SEARCH_EVENT = 'open-search'

// A query starting with ">" lists commands instead of searching (⌘P opens it that way)
const COMMAND_PREFIX = '>'

interface Command { id: string; icon: string; label: string; keys: string; run: () => void | Promise<void> }

interface Item {
  key: string
  run: () => void | Promise<void>
  render: (active: boolean) => React.ReactNode
}

// ⌘K quick search across notes, diary and weekly plans; ⌘P / ">" for commands
export default function SearchPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContentResult[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commandMode = query.startsWith(COMMAND_PREFIX)
  const searchText = commandMode ? '' : query.trim()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'k') {
        e.preventDefault()
        setQuery('')
        setOpen(o => !o)
      } else if (key === 'p') {
        e.preventDefault() // instead of the browser's print dialog
        setQuery(COMMAND_PREFIX)
        setOpen(true)
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

  // Bookmarks are the suggestions for an empty query
  useEffect(() => {
    if (open) fetchBookmarks().then(setBookmarks).catch(() => {})
  }, [open])

  // Debounced search; stale responses are aborted
  useEffect(() => {
    if (!open || !searchText) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(searchText)}`, { signal: controller.signal })
        .then(res => (res.ok ? res.json() : { results: [] }))
        .then(data => {
          setResults(data.results)
          setLoading(false)
        })
        .catch(() => {})
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [searchText, open])

  useEffect(() => { setActive(0) }, [query, results])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open || pathname === '/login') return null

  const close = () => {
    setOpen(false)
    setQuery('')
  }
  const go = (href: string) => {
    close()
    router.push(href)
  }

  const commands: Command[] = [
    {
      id: 'new-note', icon: '📝', label: '新建笔记', keys: 'new note xinjian biji',
      run: async () => {
        close()
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '新笔记', content: '' }),
        })
        if (res.ok) router.push(`/notes/${(await res.json()).id}`)
      },
    },
    { id: 'today', icon: '📓', label: '打开今天的日记', keys: 'today diary riji jintian', run: () => go('/diary') },
    { id: 'week', icon: '📋', label: '打开本周周记', keys: 'week weekly zhouji', run: () => go('/weekly') },
    { id: 'notes', icon: '🗂', label: '笔记列表', keys: 'notes list biji', run: () => go('/notes') },
    { id: 'tags', icon: '🏷️', label: '标签', keys: 'tags biaoqian', run: () => go('/tags') },
    { id: 'digest', icon: '📰', label: '今日导读', keys: 'digest daodu', run: () => go('/digest') },
    { id: 'curated', icon: '⭐', label: '精选文章', keys: 'curated jingxuan', run: () => go('/curated') },
    { id: 'materials', icon: '📁', label: '资料', keys: 'materials ziliao', run: () => go('/materials') },
    { id: 'graph', icon: '🕸️', label: '知识图谱', keys: 'graph tupu', run: () => go('/graph') },
    { id: 'template', icon: '🧩', label: '编辑日记模板', keys: 'template moban', run: () => go('/settings#template') },
    { id: 'export', icon: '📦', label: '导出全部为 Markdown', keys: 'export markdown daochu obsidian', run: () => go('/settings#export') },
    { id: 'settings', icon: '⚙️', label: '设置', keys: 'settings shezhi', run: () => go('/settings') },
  ]

  const terms = searchText.toLowerCase().split(/\s+/).filter(Boolean)
  let items: Item[]
  let heading: string | null = null

  if (commandMode) {
    const q = query.slice(COMMAND_PREFIX.length).trim().toLowerCase()
    heading = '命令'
    items = commands
      .filter(c => !q || c.label.toLowerCase().includes(q) || c.keys.includes(q))
      .map(c => ({
        key: c.id,
        run: c.run,
        render: () => (
          <div className="flex items-center gap-2.5">
            <span className="w-5 text-center text-[13px]">{c.icon}</span>
            <span className="text-[13px] text-gray-700">{c.label}</span>
          </div>
        ),
      }))
  } else if (!searchText) {
    heading = bookmarks.length ? '★ 收藏' : null
    items = bookmarks.map(b => ({
      key: `bookmark-${b.id}`,
      run: () => go(`/notes/${b.id}`),
      render: () => (
        <div className="flex items-center gap-2.5">
          <span className="w-5 text-center text-[12px] text-amber-400">★</span>
          <span className="text-[13px] text-gray-700 truncate">{b.title || '无标题'}</span>
        </div>
      ),
    }))
  } else {
    items = results.map(r => ({
      key: `${r.type}-${r.id}`,
      run: () => go(r.href),
      render: () => (
        <>
          <div className="flex items-center gap-2">
            <TypeBadge type={r.type} />
            <span className="text-[13px] text-gray-700 font-medium truncate">{highlight(r.title, terms)}</span>
            <span className="ml-auto text-[11px] text-gray-300 flex-none">{r.date}</span>
          </div>
          {r.snippet && (
            <div className="mt-1 text-[12px] text-gray-400 leading-relaxed line-clamp-2">{highlight(r.snippet, terms)}</div>
          )}
        </>
      ),
    }))
  }

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault()
      items[active].run()
    } else if (e.key === 'Escape') {
      close()
    }
  }

  const empty = commandMode
    ? '没有匹配的命令'
    : !searchText
      ? '输入关键词搜索 · 输入 > 执行命令（⌘P）'
      : loading ? '搜索中…' : '没有找到相关内容'

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-start justify-center px-4 pt-[12vh]" onMouseDown={close}>
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-gray-100">
          <span className="text-gray-300 text-[15px]">{commandMode ? '⌘' : '🔍'}</span>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="搜索笔记、日记、周记…（> 执行命令）"
            className="flex-1 py-3.5 text-[14px] outline-none bg-transparent"
          />
          <kbd className="text-[10px] text-gray-300 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {heading && items.length > 0 && (
            <div className="px-4 pt-2.5 pb-1 text-[10px] text-gray-300 tracking-wider">{heading}</div>
          )}
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-gray-300">{empty}</div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.key}
                data-index={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => item.run()}
                className={`w-full text-left px-4 py-2.5 border-b border-gray-50 last:border-b-0 ${
                  i === active ? 'bg-[#eef5ee]' : ''
                }`}
              >
                {item.render(i === active)}
              </button>
            ))
          )}
          {!commandMode && !searchText && items.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-50 text-[11px] text-gray-300">输入 &gt; 执行命令 · ⌘P</div>
          )}
        </div>
      </div>
    </div>
  )
}
