import { ConflictError } from './use-autosave'
import type { DocType } from './revisions-types'

// Flags understood by the note / diary / weekly save endpoints (see src/lib/revisions.ts)
export interface SaveFlags {
  baseUpdatedAt?: string | null // version being edited; a newer one on the server → 409
  force?: boolean // overwrite even if the server has a newer version
  snapshot?: boolean // always keep the version being replaced in history
}

// JSON request for an autosaved document; 409 becomes a ConflictError
export async function saveDoc<T>(url: string, body: object, method: 'PUT' | 'POST' = 'PUT'): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 409) throw new ConflictError((await res.json()).current)
  if (!res.ok) throw new Error('保存失败')
  return res.json()
}

// Keep local edits in history before discarding them for the server's version
export function keepInHistory(type: DocType, id: number, content: string, title?: string): Promise<unknown> {
  return fetch('/api/revisions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, id, content, title }),
  }).catch(() => {})
}
