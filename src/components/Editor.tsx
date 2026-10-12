'use client'

import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import ImageExtension from '@tiptap/extension-image'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Markdown } from '@tiptap/markdown'
import { createLowlight, common } from 'lowlight'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { handleImageDrop, handleImagePaste, insertImages, pickImageFiles } from '@/lib/editor-images'
import { markdownFromPaste } from '@/lib/editor-markdown'
import { BulletToTask } from '@/lib/editor-task-input'
import { Tag, WikiLink } from '@/lib/editor-wiki'
import { TAG_CHAR_CLASS, internalHref, isValidTag } from '@/lib/wiki'

const lowlight = createLowlight(common)

interface EditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
  onSave?: () => void
  // Classes for the editable area, e.g. its minimum height
  contentClassName?: string
}

// Prompt for a URL and apply it to the selection (or the link under the cursor)
function editLink(editor: TiptapEditor) {
  const prev = editor.getAttributes('link').href as string | undefined
  const input = window.prompt('链接地址（留空则移除链接）', prev || 'https://')
  if (input === null) return
  const href = input.trim()
  const chain = editor.chain().focus().extendMarkRange('link')
  if (!href || href === 'https://') chain.unsetLink().run()
  else chain.setLink({ href }).run()
}

function insertLink(editor: TiptapEditor) {
  const input = window.prompt('链接地址', 'https://')
  const href = input?.trim()
  if (!href || href === 'https://') return
  editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
}

function insertWikiLink(editor: TiptapEditor, noteId: number, label: string, at?: number) {
  const content = [{ type: 'wikiLink', attrs: { noteId, label } }, { type: 'text', text: ' ' }]
  if (at == null) editor.chain().focus().insertContent(content).run()
  else editor.chain().focus().insertContentAt(at, content).run()
}

function insertTag(editor: TiptapEditor, name: string) {
  editor.chain().focus().insertContent([{ type: 'tag', attrs: { name } }, { type: 'text', text: ' ' }]).run()
}

const SLASH_COMMANDS: { label: string; keys: string; icon: string; action: (e: TiptapEditor) => void }[] = [
  { label: '正文', keys: 'p text paragraph', icon: 'T', action: e => e.chain().focus().setParagraph().run() },
  { label: '标题 1', keys: 'h1 heading', icon: 'H1', action: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: '标题 2', keys: 'h2 heading', icon: 'H2', action: e => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: '标题 3', keys: 'h3 heading', icon: 'H3', action: e => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '待办列表', keys: 'todo task check', icon: '☑', action: e => e.chain().focus().toggleTaskList().run() },
  { label: '无序列表', keys: 'bullet list ul', icon: '•', action: e => e.chain().focus().toggleBulletList().run() },
  { label: '有序列表', keys: 'ordered number list ol', icon: '1.', action: e => e.chain().focus().toggleOrderedList().run() },
  { label: '引用', keys: 'quote blockquote', icon: '❝', action: e => e.chain().focus().toggleBlockquote().run() },
  { label: '代码块', keys: 'code codeblock', icon: '<>', action: e => e.chain().focus().toggleCodeBlock().run() },
  { label: '笔记链接', keys: 'wiki note link [[', icon: '[[', action: e => e.chain().focus().insertContent('[[').run() },
  { label: '链接', keys: 'link url', icon: '🔗', action: insertLink },
  { label: '分割线', keys: 'hr divider line', icon: '—', action: e => e.chain().focus().setHorizontalRule().run() },
  { label: '图片', keys: 'image img photo picture', icon: '🖼', action: e => { pickImageFiles().then(files => insertImages(e.view, files)) } },
]

// The popup menu opened by typing "/" (commands), "[[" (link a note) or "#" (tag)
type MenuKind = 'slash' | 'link' | 'tag'
interface MenuTrigger { kind: MenuKind; query: string; from: number; top: number; left: number }
interface MenuItem { key: string; icon: string; label: string; hint?: string; run: (e: TiptapEditor) => void }

const LINK_TRIGGER = /\[\[([^[\]\n￼]*)$/
const TAG_TRIGGER = new RegExp(`(?:^|[\\s\\ufffc])#(${TAG_CHAR_CLASS}*)$`, 'u')
const SLASH_TRIGGER = /(?:^|[\s￼])\/([^\s/]*)$/
const MENU_TITLES: Record<MenuKind, string> = { slash: '插入内容', link: '链接到笔记', tag: '标签' }

function detectTrigger(editor: TiptapEditor): Omit<MenuTrigger, 'top' | 'left'> | null {
  const { $from, empty } = editor.state.selection
  if (!empty || $from.parent.type.spec.code) return null
  // Text of the current block up to the cursor; inline atoms count as one character,
  // so string offsets map 1:1 to document positions
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 80), $from.parentOffset, undefined, '￼')
  let m = before.match(LINK_TRIGGER)
  if (m) return { kind: 'link', query: m[1].trim(), from: $from.pos - m[0].length }
  m = before.match(TAG_TRIGGER)
  if (m) return { kind: 'tag', query: m[1], from: $from.pos - m[1].length - 1 }
  m = before.match(SLASH_TRIGGER)
  if (m) return { kind: 'slash', query: m[1].toLowerCase(), from: $from.pos - m[1].length - 1 }
  return null
}

interface NoteHit { id: number; title: string }

export default function Editor({ content, onChange, placeholder = '输入 / 插入内容...', editable = true, onSave, contentClassName = 'min-h-[60px]' }: EditorProps) {
  const router = useRouter()
  const [menu, setMenu] = useState<MenuTrigger | null>(null)
  const [menuIndex, setMenuIndex] = useState(0)
  const [noteHits, setNoteHits] = useState<NoteHit[]>([])
  const [knownTags, setKnownTags] = useState<string[] | null>(null)
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null)
  const [showBubble, setShowBubble] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<TiptapEditor | null>(null)
  const routerRef = useRef(router)
  routerRef.current = router
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const updateMenu = (editor: TiptapEditor) => {
    const trigger = detectTrigger(editor)
    if (!trigger) {
      setMenu(null)
      return
    }
    const coords = editor.view.coordsAtPos(editor.state.selection.from)
    const editorRect = editor.view.dom.getBoundingClientRect()
    setMenu(prev => {
      if (!prev || prev.kind !== trigger.kind || prev.query !== trigger.query) setMenuIndex(0)
      return { ...trigger, top: coords.bottom - editorRect.top + 4, left: coords.left - editorRect.left }
    })
  }

  // Note suggestions for "[[": recently edited notes, or title matches
  const linkQuery = menu?.kind === 'link' ? menu.query : null
  useEffect(() => {
    if (linkQuery === null) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/notes?q=${encodeURIComponent(linkQuery)}&size=8`, { signal: controller.signal })
        .then(res => (res.ok ? res.json() : { notes: [] }))
        .then(data => setNoteHits(data.notes.map((n: NoteHit) => ({ id: n.id, title: n.title }))))
        .catch(() => {})
    }, 120)
    return () => { clearTimeout(timer); controller.abort() }
  }, [linkQuery])

  // Existing tags for "#", loaded once per editor
  const tagMenuOpen = menu?.kind === 'tag'
  useEffect(() => {
    if (!tagMenuOpen || knownTags) return
    fetch('/api/tags')
      .then(res => (res.ok ? res.json() : { tags: [] }))
      .then(data => setKnownTags(data.tags.map((t: { name: string }) => t.name)))
      .catch(() => setKnownTags([]))
  }, [tagMenuOpen, knownTags])

  const menuItems = ((): MenuItem[] => {
    if (!menu) return []
    const q = menu.query
    if (menu.kind === 'slash') {
      return SLASH_COMMANDS
        .filter(cmd => cmd.label.toLowerCase().includes(q) || cmd.keys.includes(q))
        .map(cmd => ({ key: cmd.label, icon: cmd.icon, label: cmd.label, run: cmd.action }))
    }
    if (menu.kind === 'link') {
      const items: MenuItem[] = noteHits.map(n => ({
        key: `note-${n.id}`, icon: '📝', label: n.title || '无标题',
        run: e => insertWikiLink(e, n.id, n.title),
      }))
      if (q && !noteHits.some(n => n.title === q)) {
        items.push({
          key: 'create', icon: '＋', label: `新建笔记「${q}」`, hint: '创建并链接',
          run: e => {
            const at = e.state.selection.from
            fetch('/api/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: q, content: '' }),
            })
              .then(res => (res.ok ? res.json() : Promise.reject()))
              .then(note => insertWikiLink(e, note.id, note.title, at))
              .catch(() => alert('新建笔记失败'))
          },
        })
      }
      return items
    }
    const lower = q.toLowerCase()
    const items: MenuItem[] = (knownTags || [])
      .filter(t => t.toLowerCase().includes(lower))
      .slice(0, 8)
      .map(t => ({ key: `tag-${t}`, icon: '#', label: t, run: e => insertTag(e, t) }))
    if (q && isValidTag(q) && !(knownTags || []).includes(q)) {
      items.push({
        key: 'new-tag', icon: '＋', label: `新标签 #${q}`,
        run: e => { insertTag(e, q); setKnownTags(prev => [...(prev || []), q]) },
      })
    }
    return items
  })()

  const runMenuItem = (index: number) => {
    const editor = editorRef.current
    const item = menuItems[index]
    if (!editor || !menu || !item) return
    // Remove the typed trigger ("/cmd", "[[query", "#tag") before running the item
    editor.chain().focus().deleteRange({ from: menu.from, to: editor.state.selection.from }).run()
    item.run(editor)
    setMenu(null)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
        link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https' },
      }),
      Placeholder.configure({ placeholder }),
      ImageExtension,
      TaskList,
      TaskItem.configure({ nested: true }),
      BulletToTask,
      CodeBlockLowlight.configure({ lowlight }),
      WikiLink,
      Tag,
      Markdown,
    ],
    content,
    editable,
    immediatelyRender: false,
    onCreate: ({ editor }) => { editorRef.current = editor },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
      updateMenu(editor)
    },
    onSelectionUpdate: ({ editor }) => {
      updateMenu(editor)
      const { from, to } = editor.state.selection
      // Text formatting doesn't apply to a selected image / link chip or inside code
      if (from === to || !editable || ['image', 'wikiLink', 'tag', 'codeBlock'].some(n => editor.isActive(n))) {
        setShowBubble(false)
        return
      }
      // Show bubble menu above selection, clamped to container bounds
      const coords = editor.view.coordsAtPos(from)
      const endCoords = editor.view.coordsAtPos(to)
      const editorRect = editor.view.dom.getBoundingClientRect()
      const rawTop = coords.top - editorRect.top - 40
      const rawLeft = (coords.left + endCoords.left) / 2 - editorRect.left - 100
      setBubblePos({
        top: Math.max(0, rawTop),
        left: Math.max(0, Math.min(rawLeft, editorRect.width - 240)),
      })
      setShowBubble(true)
    },
    editorProps: {
      attributes: {
        class: `font-content prose prose-sm max-w-none focus:outline-none ${contentClassName} text-gray-700 leading-relaxed`,
      },
      handlePaste: (view, event) => {
        if (handleImagePaste(view, event)) return true
        const markdown = markdownFromPaste(view, event)
        if (!markdown || !editorRef.current) return false
        editorRef.current.commands.insertContent(markdown, { contentType: 'markdown' })
        return true
      },
      handleDrop: (view, event, _slice, moved) => handleImageDrop(view, event, moved),
      // [[links]] and #tags navigate in-app on click (Cmd/Ctrl+click: new tab);
      // web links don't navigate while editing, Cmd/Ctrl+click opens them
      handleClick: (_view, _pos, event) => {
        const mod = event.metaKey || event.ctrlKey
        const internal = internalHref(event.target)
        if (internal) {
          if (mod) window.open(internal, '_blank')
          else routerRef.current.push(internal)
          return true
        }
        if (!mod) return false
        const anchor = (event.target as HTMLElement).closest('a')
        if (!anchor?.href) return false
        window.open(anchor.href, '_blank', 'noopener,noreferrer')
        return true
      },
      handleKeyDown: (view, event) => {
        const mod = event.metaKey || event.ctrlKey
        // Cmd/Ctrl+S shortcut
        if (mod && event.key === 's') {
          event.preventDefault()
          onSaveRef.current?.()
          return true
        }
        // Cmd/Ctrl+K on a selection or link edits the link; otherwise it opens global search
        if (mod && event.key.toLowerCase() === 'k' && editorRef.current
          && (!view.state.selection.empty || editorRef.current.isActive('link'))) {
          event.preventDefault()
          event.stopPropagation()
          editLink(editorRef.current)
          return true
        }

        if (!menu || menuItems.length === 0) return false
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setMenuIndex(prev => Math.min(prev + 1, menuItems.length - 1))
          return true
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setMenuIndex(prev => Math.max(prev - 1, 0))
          return true
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && !event.isComposing) {
          event.preventDefault()
          runMenuItem(Math.min(menuIndex, menuItems.length - 1))
          return true
        }
        if (event.key === 'Escape') {
          setMenu(null)
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Cmd/Ctrl+S at document level for when editor is not focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSaveRef.current?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!editor) return null

  const bubbleButton = (active: boolean, extra = '') =>
    `px-2 py-1 text-xs rounded ${extra} ${active ? 'text-white bg-gray-600' : 'text-gray-300 hover:text-white'}`

  return (
    <div className="relative rounded-md p-1" ref={wrapperRef}>
      {/* Floating bubble toolbar on text selection */}
      {showBubble && bubblePos && editable && (
        <div
          className="absolute z-50 flex items-center gap-0.5 bg-gray-800 rounded-lg shadow-lg px-1 py-0.5"
          style={{ top: bubblePos.top, left: bubblePos.left }}
        >
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
            className={bubbleButton(editor.isActive('bold'), 'font-bold')}
          >B</button>
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
            className={bubbleButton(editor.isActive('italic'), 'italic')}
          >I</button>
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }}
            className={bubbleButton(editor.isActive('strike'), 'line-through')}
          >S</button>
          <div className="w-px h-4 bg-gray-600 mx-0.5" />
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}
            className={bubbleButton(editor.isActive('heading', { level: 2 }))}
          >H</button>
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run() }}
            className={bubbleButton(editor.isActive('code'), 'font-mono')}
          >{'<>'}</button>
          <button
            onMouseDown={e => { e.preventDefault(); editLink(editor) }}
            className={bubbleButton(editor.isActive('link'))}
            title="链接 (⌘K)"
          >🔗</button>
        </div>
      )}

      {/* "/" commands, "[[" note links, "#" tags */}
      {menu && menuItems.length > 0 && (
        <div
          ref={menuRef}
          className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-56 max-h-[320px] overflow-y-auto"
          style={{ top: menu.top, left: menu.left }}
        >
          <div className="px-2 py-1 text-[10px] text-gray-400 uppercase tracking-wider">{MENU_TITLES[menu.kind]}</div>
          {menuItems.map((item, i) => (
            <button
              key={item.key}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors ${
                i === menuIndex ? 'bg-[#eef5ee] text-[#3a7a4f]' : 'text-gray-600 hover:bg-gray-50'
              }`}
              onMouseEnter={() => setMenuIndex(i)}
              onMouseDown={e => { e.preventDefault(); runMenuItem(i) }}
            >
              <span className="w-6 flex-none text-center text-[11px] text-gray-400">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {item.hint && <span className="ml-auto flex-none text-[10px] text-gray-300">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
