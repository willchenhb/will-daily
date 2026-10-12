// An editor with no content serializes to "<p></p>"
export function isEmptyHtml(html: string | null | undefined): boolean {
  return !html || html.replace(/<p><\/p>/g, '').trim() === ''
}

// Plain text of stored rich-text HTML (for search matching and snippets)
export function htmlToText(html: string): string {
  return html
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote|pre|br|hr|tr|td|th|label)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
