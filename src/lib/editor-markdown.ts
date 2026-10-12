// Markdown paste: text copied from ChatGPT, VS Code, a .md file etc. arrives as plain
// text, which ProseMirror would insert verbatim. Detect it so the editor can parse it.

const BLOCK_SYNTAX = /^(#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|>\s?|```|\|.+\|\s*$)/m
const INLINE_SYNTAX = /\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|!?\[[^\]\n]*\]\([^)\s]+\)/

// Rich HTML on the clipboard (copied from a web page, Notion, Word…) already carries the
// formatting, so let the default HTML paste handle it. Code editors only put styled
// <div>/<span> there, which doesn't count.
const SEMANTIC_HTML = /<(h[1-6]|p|ul|ol|li|strong|b|em|i|a|table|blockquote|pre|code|img)[\s>]/i

export function looksLikeMarkdown(text: string): boolean {
  return BLOCK_SYNTAX.test(text) || INLINE_SYNTAX.test(text)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Returns the markdown to parse, or null to let the default paste run
export function markdownFromPaste(view: { state: any }, event: ClipboardEvent): string | null {
  const data = event.clipboardData
  if (!data) return null
  // Inside a code block, paste stays literal
  if (view.state.selection.$from.parent.type.spec.code) return null
  const html = data.getData('text/html')
  if (html && SEMANTIC_HTML.test(html)) return null
  const text = data.getData('text/plain')
  return text && looksLikeMarkdown(text) ? text : null
}
