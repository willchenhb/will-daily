// [[wiki links]] and #tags as stored in rich-text HTML. Shared by the editor, the
// read views and the API, so the markup below is the contract between them:
//   <a data-type="wikilink" data-note-id="12" href="/notes/12" class="wikilink">Title</a>
//   <span data-type="tag" data-tag="读书" class="tag">#读书</span>

// Letters (incl. CJK), digits, _ - /. At least one non-digit, so "#1" stays plain text.
const TAG_CHAR = '[\\p{L}\\p{N}_\\-/]'
const TAG_NAME = new RegExp(`^(?=.*[^\\p{N}])${TAG_CHAR}+$`, 'u')

export const TAG_CHAR_CLASS = TAG_CHAR

export function isValidTag(name: string): boolean {
  return TAG_NAME.test(name)
}

export function tagHref(name: string): string {
  return `/tags?t=${encodeURIComponent(name)}`
}

// Raw-HTML substrings used to find documents that link to a note / carry a tag
export function wikiLinkMarker(noteId: number): string {
  return `data-note-id="${noteId}"`
}

export function tagMarker(name: string): string {
  return `data-tag="${name}"`
}

export function extractTags(html: string): string[] {
  return Array.from(new Set(Array.from(html.matchAll(/data-tag="([^"]+)"/g), m => m[1])))
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// After a note is renamed, update the visible label of every link to it
export function renameWikiLinks(html: string, noteId: number, title: string): string {
  const link = new RegExp(`(<a\\b[^>]*\\bdata-note-id="${noteId}"[^>]*>)[^<]*(</a>)`, 'g')
  return html.replace(link, (_m, open, close) => open + escapeText(title) + close)
}

// In-app destination of a clicked wiki link, tag or relative link inside rich text
export function internalHref(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const tag = target.closest('span[data-type="tag"]')
  if (tag) return tagHref(tag.getAttribute('data-tag') || '')
  const href = target.closest('a')?.getAttribute('href')
  return href && href.startsWith('/') && !href.startsWith('//') ? href : null
}
