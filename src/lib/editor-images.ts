// Image paste / drop / pick support shared by Editor (tiptap v3) and NovelEditor (novel, tiptap v2).
// Works on the raw ProseMirror view so it is independent of the tiptap version.

/* eslint-disable @typescript-eslint/no-explicit-any */
type ImageView = { state: any; dispatch: (tr: any) => void; isDestroyed?: boolean }

const MAX_DIMENSION = 1920
const KEEP_ORIGINAL_BELOW = 300 * 1024 // small images (e.g. screenshots) are uploaded untouched

// While an upload is in flight the document holds a temporary blob: URL, so saving
// then would persist a broken image. Save handlers check this first.
let pendingUploads = 0

// Returns true (and tells the user) when saving must wait. Also checks the HTML itself,
// since an editor may report its content on a debounce after the upload finished.
export function blockSaveForPendingImages(html: string): boolean {
  if (pendingUploads === 0 && !html.includes('src="blob:')) return false
  alert('图片还在上传中，请稍候再保存')
  return true
}

export function imageFilesFrom(list: FileList | null | undefined): File[] {
  return Array.from(list || []).filter(f => f.type.startsWith('image/'))
}

// Downscale to MAX_DIMENSION and re-encode as WebP; fall back to the original
// whenever that wouldn't help (GIFs keep their animation).
async function prepareImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file // let the server reject what it can't handle
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= KEEP_ORIGINAL_BELOW) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.85))
  return blob && blob.size < file.size ? blob : file
}

export async function uploadImage(file: File): Promise<string> {
  const blob = await prepareImage(file)
  const form = new FormData()
  form.append('file', blob, file.name || 'image')
  const res = await fetch('/api/uploads', { method: 'POST', body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.url) throw new Error(data?.error || '图片上传失败')
  return data.url
}

// Point the placeholder image (src = blobUrl) at its uploaded URL, or remove it on failure
function settleImage(view: ImageView, blobUrl: string, url: string | null) {
  if (view.isDestroyed) return
  let tr = view.state.tr
  let found = false
  view.state.doc.descendants((node: any, pos: number) => {
    if (found || node.type.name !== 'image' || node.attrs.src !== blobUrl) return
    found = true
    tr = url
      ? tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url })
      : tr.delete(pos, pos + node.nodeSize)
  })
  if (found) view.dispatch(tr)
}

// Insert images at `pos` (drop) or at the selection (paste / pick). Each shows a local
// preview right away and is swapped to the server URL once its upload finishes.
export function insertImages(view: ImageView, files: File[], pos?: number): boolean {
  const imageType = view.state.schema.nodes.image
  if (!imageType || files.length === 0) return false

  for (const file of files) {
    const blobUrl = URL.createObjectURL(file)
    const node = imageType.create({ src: blobUrl, alt: file.name || '' })
    const tr = pos == null
      ? view.state.tr.replaceSelectionWith(node)
      : view.state.tr.replaceRangeWith(pos, pos, node)
    view.dispatch(tr)

    pendingUploads++
    uploadImage(file)
      .then(url => settleImage(view, blobUrl, url))
      .catch(err => {
        settleImage(view, blobUrl, null)
        alert(err instanceof Error ? err.message : '图片上传失败')
      })
      .finally(() => {
        pendingUploads--
        URL.revokeObjectURL(blobUrl)
      })
  }
  return true
}

// ProseMirror handlePaste: take over only when the clipboard carries image files
export function handleImagePaste(view: ImageView, event: ClipboardEvent): boolean {
  const files = imageFilesFrom(event.clipboardData?.files)
  if (files.length === 0) return false
  event.preventDefault()
  return insertImages(view, files)
}

// ProseMirror handleDrop: take over only for image files dragged in from outside
export function handleImageDrop(view: ImageView & { posAtCoords: (c: { left: number; top: number }) => { pos: number } | null }, event: DragEvent, moved: boolean): boolean {
  if (moved) return false
  const files = imageFilesFrom(event.dataTransfer?.files)
  if (files.length === 0) return false
  event.preventDefault()
  const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
  return insertImages(view, files, pos)
}

// Open the OS file picker for images (used by the "图片" slash command)
export function pickImageFiles(): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/gif,image/webp'
    input.multiple = true
    input.onchange = () => resolve(imageFilesFrom(input.files))
    input.click()
  })
}
