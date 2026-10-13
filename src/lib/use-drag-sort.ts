'use client'

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

interface Drag {
  id: number
  // Index of the dragged item, and every item's box, when the drag started
  from: number
  rects: { top: number; height: number }[]
  gap: number
  startY: number
  dy: number
}

// Where the dragged item would land: after every other item whose middle it has passed
function targetIndex(d: Drag): number {
  const center = d.rects[d.from].top + d.rects[d.from].height / 2 + d.dy
  return d.rects.filter((r, k) => k !== d.from && r.top + r.height / 2 < center).length
}

// Reorder a vertical list by dragging a handle (mouse or touch), or with ↑/↓ on the focused
// handle. While dragging, rows are only shifted with transforms; the list is reordered once on
// drop, so the handle never moves in the DOM and keeps its pointer capture throughout.
// The element given `listRef` must have exactly one child per item, in order.
export function useDragSort<T extends { id: number }>(items: T[], onReorder: (next: T[]) => void) {
  const listRef = useRef<HTMLDivElement>(null)
  // The ref is read by the event handlers, the state drives rendering
  const dragRef = useRef<Drag | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const setDrag = (d: Drag | null) => {
    dragRef.current = d
    setDragState(d)
  }

  const move = (from: number, to: number) => {
    if (from === to) return
    const next = items.slice()
    next.splice(to, 0, ...next.splice(from, 1))
    onReorder(next)
  }

  const handleProps = (id: number) => ({
    'data-sort-handle': id,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || !listRef.current) return
      const from = items.findIndex(i => i.id === id)
      const rows = Array.from(listRef.current.children)
      if (from < 0 || rows.length !== items.length) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const rects = rows.map(el => {
        const r = el.getBoundingClientRect()
        return { top: r.top, height: r.height }
      })
      const gap = rects.length > 1 ? rects[1].top - rects[0].top - rects[0].height : 0
      setDrag({ id, from, rects, gap, startY: e.clientY, dy: 0 })
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = dragRef.current
      if (d?.id === id) setDrag({ ...d, dy: e.clientY - d.startY })
    },
    onPointerUp: () => {
      const d = dragRef.current
      if (d?.id !== id) return
      setDrag(null)
      move(d.from, targetIndex(d))
    },
    onPointerCancel: () => setDrag(null),
    // Capture can also end without a pointerup (e.g. the row was re-rendered away)
    onLostPointerCapture: () => {
      if (dragRef.current?.id === id) setDrag(null)
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      e.preventDefault()
      const from = items.findIndex(i => i.id === id)
      const to = from + (e.key === 'ArrowUp' ? -1 : 1)
      if (from < 0 || to < 0 || to >= items.length) return
      move(from, to)
      // Moving the row in the DOM can drop focus; put it back on the same handle
      requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-sort-handle="${id}"]`)?.focus())
    },
  })

  const itemStyle = (id: number): CSSProperties | undefined => {
    if (!drag) return undefined
    const index = items.findIndex(i => i.id === id)
    if (index === drag.from) return { transform: `translateY(${drag.dy}px)`, zIndex: 10 }
    // Rows between the start and the landing slot make room for the dragged one
    const to = targetIndex(drag)
    const shift = drag.rects[drag.from].height + drag.gap
    let y = 0
    if (drag.from < to && index > drag.from && index <= to) y = -shift
    if (to < drag.from && index >= to && index < drag.from) y = shift
    return { transform: `translateY(${y}px)`, transition: 'transform 150ms ease' }
  }

  return { listRef, draggingId: drag?.id ?? null, handleProps, itemStyle }
}
