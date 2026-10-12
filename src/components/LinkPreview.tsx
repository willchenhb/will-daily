'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

interface Preview { id: number; title: string; content: string }

const SHOW_DELAY = 450
const HIDE_DELAY = 200
const CACHE_MS = 30_000
const CARD_WIDTH = 360
const CARD_MAX_HEIGHT = 320

// Hovering a [[link]] anywhere (editor, read views) shows the linked note in a card,
// like Obsidian's page preview. Mounted once in the root layout.
export default function LinkPreview() {
  const pathname = usePathname()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const cache = useRef(new Map<number, { at: number; data: Promise<Preview | null> }>())
  const showTimer = useRef<ReturnType<typeof setTimeout>>()
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()
  const hoverId = useRef<number | null>(null)

  useEffect(() => {
    const load = (id: number) => {
      const hit = cache.current.get(id)
      if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
      const data = fetch(`/api/notes/${id}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
      cache.current.set(id, { at: Date.now(), data })
      return data
    }

    const onOver = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest('[data-link-preview]')) {
        clearTimeout(hideTimer.current) // moving into the card keeps it open
        return
      }
      const link = target.closest<HTMLElement>('a.wikilink[data-note-id]')
      if (!link) return
      const id = Number(link.dataset.noteId)
      if (!id) return
      clearTimeout(hideTimer.current) // back on the same link before the card closed
      if (hoverId.current === id) return
      hoverId.current = id
      clearTimeout(showTimer.current)
      showTimer.current = setTimeout(async () => {
        const data = await load(id)
        if (hoverId.current !== id || !data) return
        const r = link.getBoundingClientRect()
        const below = r.bottom + 8 + CARD_MAX_HEIGHT < window.innerHeight
        setPos({
          left: Math.max(8, Math.min(r.left, window.innerWidth - CARD_WIDTH - 8)),
          top: below ? r.bottom + 6 : Math.max(8, r.top - CARD_MAX_HEIGHT - 6),
        })
        setPreview(data)
      }, SHOW_DELAY)
    }

    const onOut = (e: MouseEvent) => {
      const from = e.target as Element
      if (!from.closest('a.wikilink, [data-link-preview]')) return
      const to = e.relatedTarget as Element | null
      const fromLink = from.closest('a.wikilink')
      // Still inside the card, or moving between children of the same link
      if (to?.closest('[data-link-preview]') || (fromLink && to?.closest('a.wikilink') === fromLink)) return
      clearTimeout(showTimer.current)
      hideTimer.current = setTimeout(() => {
        hoverId.current = null
        setPreview(null)
      }, HIDE_DELAY)
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      clearTimeout(showTimer.current)
      clearTimeout(hideTimer.current)
    }
  }, [])

  // Navigating away (e.g. clicking the link) closes the card; edits may have changed notes
  useEffect(() => {
    hoverId.current = null
    setPreview(null)
    cache.current.clear()
  }, [pathname])

  if (!preview || !pos) return null

  return (
    <div
      data-link-preview
      className="fixed z-[70] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
      style={{ left: pos.left, top: pos.top, width: CARD_WIDTH, maxHeight: CARD_MAX_HEIGHT }}
    >
      <div className="border-b border-gray-50 px-4 py-2 text-[13px] font-medium text-gray-700 truncate">{preview.title || '无标题'}</div>
      <div
        className="font-content prose prose-sm max-w-none px-4 py-2 text-[13px] text-gray-600 overflow-hidden"
        style={{ maxHeight: CARD_MAX_HEIGHT - 40 }}
        dangerouslySetInnerHTML={{ __html: preview.content || '<p class="text-gray-300">（空笔记）</p>' }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white" />
    </div>
  )
}
