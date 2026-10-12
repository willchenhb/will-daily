'use client'

import { useEffect, useState, type RefObject } from 'react'

interface Heading { level: number; text: string; el: HTMLElement }

const MIN_HEADINGS = 2
const ACTIVE_OFFSET = 120 // px from the top of the viewport

// 大纲: headings of the editor inside `containerRef`, click to jump. A side panel on wide
// screens, a collapsible list above the editor otherwise. `version` changes when the
// content changes, so the list is rebuilt.
export default function NoteOutline({ containerRef, version }: { containerRef: RefObject<HTMLElement>; version: unknown }) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    // After the editor has rendered this change
    const timer = setTimeout(() => {
      const els = containerRef.current?.querySelectorAll<HTMLElement>('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3')
      setHeadings(Array.from(els || [], el => ({ level: Number(el.tagName[1]), text: el.textContent?.trim() || '', el }))
        .filter(h => h.text))
    }, 50)
    return () => clearTimeout(timer)
  }, [containerRef, version])

  useEffect(() => {
    if (headings.length < MIN_HEADINGS) return
    const onScroll = () => {
      let current = 0
      headings.forEach((h, i) => { if (h.el.getBoundingClientRect().top < ACTIVE_OFFSET) current = i })
      // Headings near the end can't scroll up to the offset; at the bottom, the last one is current
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      setActive(atBottom ? headings.length - 1 : current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [headings])

  if (headings.length < MIN_HEADINGS) return null

  const minLevel = Math.min(...headings.map(h => h.level))
  const list = (
    <ul className="space-y-0.5">
      {headings.map((h, i) => (
        <li key={i}>
          <button
            onClick={() => h.el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{ paddingLeft: (h.level - minLevel) * 12 }}
            className={`block w-full truncate text-left text-[12px] leading-6 transition-colors ${
              i === active ? 'text-[#3a7a4f] font-medium' : 'text-gray-400 hover:text-gray-700'
            }`}
            title={h.text}
          >
            {h.text}
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      {/* ≥1400px: fits in the margin right of the centred note (sidebar 180px + 768px column) */}
      <aside className="hidden min-[1400px]:block fixed top-24 right-4 w-48 max-h-[70vh] overflow-y-auto">
        <div className="text-[10px] text-gray-300 tracking-wider mb-2">大纲</div>
        {list}
      </aside>
      <details className="min-[1400px]:hidden mb-3 rounded-lg border border-gray-100 px-3 py-2">
        <summary className="cursor-pointer select-none text-[12px] text-gray-400">大纲 · {headings.length} 个标题</summary>
        <div className="mt-2">{list}</div>
      </details>
    </>
  )
}
