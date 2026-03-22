'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useCallback, useEffect, useRef } from 'react'

interface EditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
  onSave?: () => void
}

const SLASH_COMMANDS = [
  { label: '标题 1', icon: 'H1', action: (e: NonNullable<ReturnType<typeof useEditor>>) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: '标题 2', icon: 'H2', action: (e: NonNullable<ReturnType<typeof useEditor>>) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: '标题 3', icon: 'H3', action: (e: NonNullable<ReturnType<typeof useEditor>>) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '无序列表', icon: '•', action: (e: NonNullable<ReturnType<typeof useEditor>>) => e.chain().focus().toggleBulletList().run() },
  { label: '有序列表', icon: '1.', action: (e: NonNullable<ReturnType<typeof useEditor>>) => e.chain().focus().toggleOrderedList().run() },
  { label: '引用', icon: '❝', action: (e: NonNullable<ReturnType<typeof useEditor>>) => e.chain().focus().toggleBlockquote().run() },
  { label: '代码块', icon: '<>', action: (e: NonNullable<ReturnType<typeof useEditor>>) => e.chain().focus().toggleCodeBlock().run() },
  { label: '分割线', icon: '—', action: (e: NonNullable<ReturnType<typeof useEditor>>) => e.chain().focus().setHorizontalRule().run() },
]

export default function Editor({ content, onChange, placeholder = '输入 / 插入内容...', editable = true, onSave }: EditorProps) {
  const [showSlash, setShowSlash] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashIndex, setSlashIndex] = useState(0)
  const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null)
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null)
  const [showBubble, setShowBubble] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const filteredCommands = SLASH_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(slashFilter)
  )

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())

      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - 20), from, '\n'
      )
      const slashMatch = textBefore.match(/\/([^\s/]*)$/)

      if (slashMatch) {
        setSlashFilter(slashMatch[1].toLowerCase())
        setShowSlash(true)
        setSlashIndex(0)
        const coords = editor.view.coordsAtPos(from)
        const editorRect = editor.view.dom.getBoundingClientRect()
        setSlashPos({
          top: coords.bottom - editorRect.top + 4,
          left: coords.left - editorRect.left,
        })
      } else {
        setShowSlash(false)
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from === to || !editable) {
        setShowBubble(false)
        return
      }
      // Show bubble menu above selection, clamped to container bounds
      const coords = editor.view.coordsAtPos(from)
      const endCoords = editor.view.coordsAtPos(to)
      const editorRect = editor.view.dom.getBoundingClientRect()
      const rawTop = coords.top - editorRect.top - 40
      const rawLeft = (coords.left + endCoords.left) / 2 - editorRect.left - 80
      setBubblePos({
        top: Math.max(0, rawTop),
        left: Math.max(0, Math.min(rawLeft, editorRect.width - 200)),
      })
      setShowBubble(true)
    },
    editorProps: {
      attributes: {
        class: 'font-content prose prose-sm max-w-none focus:outline-none min-h-[60px] text-gray-700 leading-relaxed',
      },
      handleKeyDown: (_view, event) => {
        // Cmd/Ctrl+S shortcut
        if ((event.metaKey || event.ctrlKey) && event.key === 's') {
          event.preventDefault()
          onSaveRef.current?.()
          return true
        }

        if (!showSlash) return false
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setSlashIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
          return true
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setSlashIndex(prev => Math.max(prev - 1, 0))
          return true
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          executeSlashCommand(slashIndex)
          return true
        }
        if (event.key === 'Escape') {
          setShowSlash(false)
          return true
        }
        return false
      },
    },
  })

  const executeSlashCommand = useCallback((index: number) => {
    if (!editor || !filteredCommands[index]) return
    const { from } = editor.state.selection
    const textBefore = editor.state.doc.textBetween(
      Math.max(0, from - 20), from, '\n'
    )
    const slashMatch = textBefore.match(/\/([^\s/]*)$/)
    if (slashMatch) {
      editor.chain().focus()
        .deleteRange({ from: from - slashMatch[0].length, to: from })
        .run()
    }
    filteredCommands[index].action(editor)
    setShowSlash(false)
  }, [editor, filteredCommands])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSlash(false)
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
            className={`px-2 py-1 text-xs rounded font-bold ${editor.isActive('bold') ? 'text-white bg-gray-600' : 'text-gray-300 hover:text-white'}`}
          >B</button>
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
            className={`px-2 py-1 text-xs rounded italic ${editor.isActive('italic') ? 'text-white bg-gray-600' : 'text-gray-300 hover:text-white'}`}
          >I</button>
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }}
            className={`px-2 py-1 text-xs rounded line-through ${editor.isActive('strike') ? 'text-white bg-gray-600' : 'text-gray-300 hover:text-white'}`}
          >S</button>
          <div className="w-px h-4 bg-gray-600 mx-0.5" />
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}
            className={`px-2 py-1 text-xs rounded ${editor.isActive('heading', { level: 2 }) ? 'text-white bg-gray-600' : 'text-gray-300 hover:text-white'}`}
          >H</button>
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run() }}
            className={`px-2 py-1 text-xs rounded font-mono ${editor.isActive('code') ? 'text-white bg-gray-600' : 'text-gray-300 hover:text-white'}`}
          >{'<>'}</button>
        </div>
      )}

      {/* Slash command menu */}
      {showSlash && filteredCommands.length > 0 && slashPos && (
        <div
          ref={menuRef}
          className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48"
          style={{ top: slashPos.top, left: slashPos.left }}
        >
          <div className="px-2 py-1 text-[10px] text-gray-400 uppercase tracking-wider">插入内容</div>
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.label}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors ${
                i === slashIndex ? 'bg-[#eef5ee] text-[#3a7a4f]' : 'text-gray-600 hover:bg-gray-50'
              }`}
              onMouseEnter={() => setSlashIndex(i)}
              onMouseDown={e => { e.preventDefault(); executeSlashCommand(i) }}
            >
              <span className="w-6 text-center text-[11px] text-gray-400">{cmd.icon}</span>
              <span>{cmd.label}</span>
            </button>
          ))}
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
