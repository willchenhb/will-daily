// Server-side helpers for editor image uploads

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10MB (client compresses before upload)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isUploadKey(key: string): boolean {
  return UUID_RE.test(key)
}

// Detect the real image type from magic bytes instead of trusting the client's
// Content-Type. SVG is intentionally unsupported (it can carry scripts).
export function sniffImageType(buf: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...Array.from(buf.subarray(start, end)))
  if (buf.length >= 8 && buf[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'image/gif'
  if (buf.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}
