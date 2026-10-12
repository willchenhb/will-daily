// 收藏 (bookmarked notes). Components listening for BOOKMARKS_EVENT refresh their lists.
export const BOOKMARKS_EVENT = 'bookmarks-changed'

export interface Bookmark { id: number; title: string }

export async function fetchBookmarks(): Promise<Bookmark[]> {
  const res = await fetch('/api/notes?pinned=1&size=50')
  if (!res.ok) return []
  return (await res.json()).notes.map((n: Bookmark) => ({ id: n.id, title: n.title }))
}

export async function setPinned(noteId: number, pinned: boolean): Promise<boolean> {
  const res = await fetch(`/api/notes/${noteId}/pin`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinned }),
  })
  if (res.ok) window.dispatchEvent(new Event(BOOKMARKS_EVENT))
  return res.ok
}
