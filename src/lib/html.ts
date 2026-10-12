// An editor with no content serializes to "<p></p>"
export function isEmptyHtml(html: string | null | undefined): boolean {
  return !html || html.replace(/<p><\/p>/g, '').trim() === ''
}

function safeCodePoint(cp: number): string | undefined {
  return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : undefined
}

// Plain text of stored rich-text HTML (for search matching and snippets)
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote|pre|br|hr|tr|td|th|label)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (m, n) => safeCodePoint(Number(n)) ?? m)
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => safeCodePoint(parseInt(n, 16)) ?? m)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
