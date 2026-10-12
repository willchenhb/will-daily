// Local drafts: unsaved edits mirrored to localStorage, so they survive a failed save
// (offline, server down) followed by closing the tab or a crash. Like Obsidian keeping a
// text backup when a write fails. Cleared once the server has the content.
const PREFIX = 'will-daily:draft:'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export interface Draft<T> { value: T; savedAt: number }

export function readDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const draft = JSON.parse(raw) as Draft<T>
    if (Date.now() - draft.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function writeDraft<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt: Date.now() }))
  } catch {
    // Storage full or blocked (private mode): drafts are best-effort
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

// A stored draft that differs from what the server has, or null (stale drafts are dropped)
export function pendingDraft<T>(key: string, serverValue: T): Draft<T> | null {
  const draft = readDraft<T>(key)
  if (!draft) return null
  if (JSON.stringify(draft.value) === JSON.stringify(serverValue)) {
    clearDraft(key)
    return null
  }
  return draft
}
