// Export notes, diary and weekly plans as an Obsidian-compatible Markdown vault (.zip),
// converted in the browser with the editor's own schema.
import { Editor } from '@tiptap/react'
import { strToU8, zipSync, type Zippable } from 'fflate'
import { contentExtensions } from './editor-extensions'
import { WikiLink } from './editor-wiki'
import { getWeekEnd, getWeekNumber } from './dates'

interface Note { id: number; title: string; content: string; category: string | null; createdAt: string; updatedAt: string }
interface DiaryRow { id: number; date: string; type?: string; content: string }
interface Todo { text: string; completed: boolean; note: string | null }
interface Plan { id: number; weekStart: string; title: string | null; content: string | null; todos: Todo[] }

const PAGE = 100
const UPLOAD_SRC = /\]\((\/api\/uploads\/[0-9a-f-]{36})\)/g
const EXT_BY_MIME: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }

async function fetchAll<T>(path: string, key: string): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; ; page++) {
    const res = await fetch(`${path}?page=${page}&size=${PAGE}`)
    if (!res.ok) throw new Error(`读取 ${path} 失败`)
    const batch: T[] = (await res.json())[key]
    rows.push(...batch)
    if (batch.length < PAGE) return rows
  }
}

// File names: no path separators or characters Windows/Obsidian reject
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || '无标题'
}

function yamlString(value: string): string {
  return JSON.stringify(value) // a valid YAML double-quoted scalar
}

export async function exportMarkdownZip(onProgress: (message: string) => void): Promise<Blob> {
  onProgress('读取笔记、日记、周记…')
  const [notes, diaries, plans] = await Promise.all([
    fetchAll<Note>('/api/notes', 'notes'),
    fetchAll<DiaryRow>('/api/diary', 'entries'),
    fetchAll<Plan>('/api/weekly', 'plans'),
  ])

  // Unique file name per note; [[links]] point at it (aliased when it differs from the title)
  const fileOf = new Map<number, string>()
  const taken = new Set<string>()
  for (const n of notes) {
    const base = safeName(n.title)
    let name = base
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} (${i})`
    taken.add(name.toLowerCase())
    fileOf.set(n.id, name)
  }

  const editor = new Editor({
    extensions: contentExtensions({
      wikiLink: WikiLink.extend({
        renderMarkdown: node => {
          const label: string = node.attrs?.label ?? ''
          const file = fileOf.get(Number(node.attrs?.noteId))
          if (!file) return label // linked note no longer exists
          return file === label ? `[[${file}]]` : `[[${file}|${label}]]`
        },
      }),
    }),
  })
  const toMarkdown = (html: string | null) => {
    if (!html) return ''
    editor.commands.setContent(html)
    return editor.getMarkdown().trim()
  }

  const files: Zippable = {}
  const add = (path: string, text: string) => { files[path] = strToU8(text.endsWith('\n') ? text : `${text}\n`) }

  onProgress(`转换 ${notes.length} 篇笔记…`)
  for (const n of notes) {
    const front = [
      '---',
      ...(n.category ? [`category: ${yamlString(n.category)}`] : []),
      `created: ${n.createdAt}`,
      `updated: ${n.updatedAt}`,
      '---',
    ].join('\n')
    add(`notes/${fileOf.get(n.id)}.md`, `${front}\n\n${toMarkdown(n.content)}`)
  }

  onProgress(`转换 ${diaries.length} 篇日记…`)
  const byDate = new Map<string, DiaryRow[]>()
  for (const d of diaries) byDate.set(d.date, [...(byDate.get(d.date) || []), d])
  byDate.forEach((rows, date) => {
    const parts = rows
      .sort((a, b) => (a.type === 'chat_summary' ? 1 : 0) - (b.type === 'chat_summary' ? 1 : 0))
      .map(r => (r.type === 'chat_summary' ? `## 群聊总结\n\n${toMarkdown(r.content)}` : toMarkdown(r.content)))
    add(`diary/${date}.md`, parts.join('\n\n'))
  })

  onProgress(`转换 ${plans.length} 篇周记…`)
  for (const p of plans) {
    const sections = [`# 第${getWeekNumber(p.weekStart)}周 · ${p.weekStart} ~ ${getWeekEnd(p.weekStart)}${p.title ? ` · ${p.title}` : ''}`]
    const reflection = toMarkdown(p.content)
    if (reflection) sections.push(reflection)
    if (p.todos.length) {
      sections.push('## 待办\n\n' + p.todos
        .map(t => `- [${t.completed ? 'x' : ' '}] ${t.text}${t.note ? `\n  - ${t.note}` : ''}`)
        .join('\n'))
    }
    add(`weekly/${p.weekStart}.md`, sections.join('\n\n'))
  }
  editor.destroy()

  // Uploaded images become local attachments, so the vault works offline
  const markdownPaths = Object.keys(files)
  const read = (path: string) => new TextDecoder().decode(files[path] as Uint8Array)
  const uploads = new Set<string>()
  for (const path of markdownPaths) {
    Array.from(read(path).matchAll(UPLOAD_SRC), m => uploads.add(m[1]))
  }
  const attachmentOf = new Map<string, string>()
  let done = 0
  for (const src of Array.from(uploads)) {
    onProgress(`下载图片 ${++done}/${uploads.size}…`)
    const res = await fetch(src)
    if (!res.ok) continue
    const blob = await res.blob()
    const name = `${src.split('/').pop()}.${EXT_BY_MIME[blob.type] || 'img'}`
    // Already compressed: store without deflating
    files[`attachments/${name}`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
    attachmentOf.set(src, name)
  }
  if (attachmentOf.size) {
    for (const path of markdownPaths) {
      const text = read(path)
      const next = text.replace(UPLOAD_SRC, (m, src) => (attachmentOf.has(src) ? `](../attachments/${attachmentOf.get(src)})` : m))
      if (next !== text) files[path] = strToU8(next)
    }
  }

  add('README.md', [
    '# Will Daily 导出',
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    '',
    `- notes/ — ${notes.length} 篇笔记（文件头记录分类与时间）`,
    `- diary/ — ${byDate.size} 天的日记（含群聊总结）`,
    `- weekly/ — ${plans.length} 周的周记与待办`,
    `- attachments/ — ${attachmentOf.size} 张图片`,
    '',
    '可直接用 Obsidian 打开此文件夹：`[[双向链接]]` 与 `#标签` 都会被识别。',
  ].join('\n'))

  onProgress('打包…')
  const zipped = zipSync(files, { level: 6 })
  return new Blob([zipped], { type: 'application/zip' })
}
