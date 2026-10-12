import DOMPurify from 'dompurify'

let hooked = false

// Read views render stored rich text with dangerouslySetInnerHTML. Besides the editor,
// content also arrives through the API (scripts, chat summaries), so strip scripts, event
// handlers and javascript: URLs, keeping the editor's markup (data-* on [[links]] and
// #tags, task-list checkboxes, link targets).
export function sanitizeHtml(html: string): string {
  // Read views only render after a client-side fetch; there is no DOM on the server
  if (typeof window === 'undefined') return ''
  if (!hooked) {
    DOMPurify.addHook('afterSanitizeAttributes', node => {
      if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer nofollow')
      }
    })
    hooked = true
  }
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
}
