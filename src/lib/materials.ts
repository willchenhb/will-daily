// Shared helpers for the 资料 (HTML materials) module

export const MAX_MATERIAL_SIZE = 10 * 1024 * 1024 // 10MB per file

// Everything except the (potentially large) HTML content
export const MATERIAL_LIST_SELECT = {
  id: true,
  title: true,
  filename: true,
  size: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const

// Sandbox applied both as an iframe attribute and as a CSP header on the raw route,
// so uploaded scripts run in an opaque origin and can't touch the app's session or APIs.
export const MATERIAL_SANDBOX =
  'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads'

const META_CHARSET_RE = /(<meta[^>]+charset\s*=\s*["']?\s*)([\w-]+)/i

// Decode uploaded bytes, honoring BOM or <meta charset> (e.g. GBK pages), and
// normalize the declared charset to utf-8 since we always serve utf-8.
export function decodeHtml(buf: Uint8Array): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf)
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf)
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return new TextDecoder('utf-8').decode(buf)

  const head = new TextDecoder('latin1').decode(buf.subarray(0, 2048))
  const charset = head.match(META_CHARSET_RE)?.[2].toLowerCase()
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      const html = new TextDecoder(charset).decode(buf)
      return html.replace(META_CHARSET_RE, '$1utf-8')
    } catch {
      // Unknown charset label: fall through to utf-8
    }
  }
  return new TextDecoder('utf-8').decode(buf)
}

function codePoint(n: number): string {
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => codePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function cleanText(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

// Prefer <title>, then the first <h1>
export function extractTitle(html: string): string | null {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (title) {
    const t = cleanText(title[1])
    if (t) return t
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1) {
    const t = cleanText(h1[1])
    if (t) return t
  }
  return null
}
