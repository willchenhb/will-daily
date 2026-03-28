'use client'

import { EditorRoot, EditorContent, EditorCommand, EditorCommandItem, EditorCommandList, EditorCommandEmpty, EditorBubble, EditorBubbleItem, type JSONContent, handleCommandNavigation, createSuggestionItems, Command, renderItems, type SuggestionItem } from 'novel'
import { useState, useEffect } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { Heading1, Heading2, Heading3, List, ListOrdered, TextQuote, Code, CheckSquare, Minus, Text } from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */
const suggestionItems = createSuggestionItems([
  { title: '正文', description: '普通段落文本', searchTerms: ['p', 'paragraph', 'text'], icon: <Text size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').run() },
  { title: '标题 1', description: '大标题', searchTerms: ['h1', 'heading'], icon: <Heading1 size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
  { title: '标题 2', description: '中标题', searchTerms: ['h2', 'subtitle'], icon: <Heading2 size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
  { title: '标题 3', description: '小标题', searchTerms: ['h3'], icon: <Heading3 size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
  { title: '待办列表', description: '任务清单', searchTerms: ['todo', 'task', 'check'], icon: <CheckSquare size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
  { title: '无序列表', description: '项目符号列表', searchTerms: ['bullet', 'list'], icon: <List size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { title: '有序列表', description: '编号列表', searchTerms: ['ordered', 'number'], icon: <ListOrdered size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { title: '引用', description: '引用文字', searchTerms: ['blockquote', 'quote'], icon: <TextQuote size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').toggleBlockquote().run() },
  { title: '代码块', description: '代码片段', searchTerms: ['code', 'codeblock'], icon: <Code size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  { title: '分割线', description: '水平分割线', searchTerms: ['hr', 'divider'], icon: <Minus size={18} />,
    command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
])

const slashCommand = Command.configure({
  suggestion: { items: () => suggestionItems, render: renderItems },
})

interface NovelEditorProps {
  content: string // HTML string
  onChange: (html: string) => void
  onSave?: () => void
  placeholder?: string
  editable?: boolean
}

export default function NovelEditor({ content, onChange, onSave, placeholder = '输入 / 插入内容...', editable = true }: NovelEditorProps) {
  const [initialContent, setInitialContent] = useState<JSONContent | undefined>(undefined)
  const [mounted, setMounted] = useState(false)

  // Convert HTML to JSONContent on mount only
  useEffect(() => {
    // Novel expects JSONContent, but we store HTML.
    // We'll use the editor's built-in HTML parsing by passing undefined initially
    // and setting content via the editor instance
    setMounted(true)
  }, [])

  const debouncedOnChange = useDebouncedCallback((editor: any) => {
    onChange(editor.getHTML())
  }, 300)

  if (!mounted) return null

  return (
    <EditorRoot>
      <EditorContent
        initialContent={initialContent}
        extensions={[slashCommand]}
        editable={editable}
        onUpdate={({ editor }) => debouncedOnChange(editor)}
        onCreate={({ editor }) => {
          // Set initial HTML content
          if (content) {
            editor.commands.setContent(content)
          }
        }}
        editorProps={{
          handleDOMEvents: {
            keydown: (_view, event) => {
              // Cmd/Ctrl+S
              if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                event.preventDefault()
                onSave?.()
                return true
              }
              return handleCommandNavigation(event)
            },
          },
          attributes: {
            class: 'font-content prose prose-sm max-w-none focus:outline-none min-h-[200px] text-gray-700 leading-relaxed p-4',
          },
        }}
        className="relative border border-gray-100 rounded-lg"
      >
        {/* Slash Command Menu */}
        <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-lg border border-gray-200 bg-white px-1 py-2 shadow-lg">
          <EditorCommandEmpty className="px-3 py-2 text-sm text-gray-400">无匹配结果</EditorCommandEmpty>
          <EditorCommandList>
            {suggestionItems.map((item: SuggestionItem) => (
              <EditorCommandItem
                key={item.title}
                value={item.title}
                onCommand={(val) => item.command?.(val)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-[#eef5ee] hover:text-[#3a7a4f] cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-100 bg-white text-gray-400">
                  {item.icon}
                </div>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.description}</p>
                </div>
              </EditorCommandItem>
            ))}
          </EditorCommandList>
        </EditorCommand>

        {/* Bubble Menu - appears on text selection */}
        <EditorBubble
          tippyOptions={{ placement: 'top' }}
          className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <EditorBubbleItem
            onSelect={(editor) => editor.chain().focus().toggleBold().run()}
            className="px-3 py-2 text-sm text-gray-500 hover:bg-[#eef5ee] hover:text-[#3a7a4f] font-bold cursor-pointer"
          >
            B
          </EditorBubbleItem>
          <EditorBubbleItem
            onSelect={(editor) => editor.chain().focus().toggleItalic().run()}
            className="px-3 py-2 text-sm text-gray-500 hover:bg-[#eef5ee] hover:text-[#3a7a4f] italic cursor-pointer"
          >
            I
          </EditorBubbleItem>
          <EditorBubbleItem
            onSelect={(editor) => editor.chain().focus().toggleStrike().run()}
            className="px-3 py-2 text-sm text-gray-500 hover:bg-[#eef5ee] hover:text-[#3a7a4f] line-through cursor-pointer"
          >
            S
          </EditorBubbleItem>
          <div className="w-px h-6 bg-gray-200" />
          <EditorBubbleItem
            onSelect={(editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className="px-3 py-2 text-sm text-gray-500 hover:bg-[#eef5ee] hover:text-[#3a7a4f] cursor-pointer"
          >
            H
          </EditorBubbleItem>
          <EditorBubbleItem
            onSelect={(editor) => editor.chain().focus().toggleCode().run()}
            className="px-3 py-2 text-sm text-gray-500 hover:bg-[#eef5ee] hover:text-[#3a7a4f] font-mono cursor-pointer"
          >
            {'<>'}
          </EditorBubbleItem>
        </EditorBubble>
      </EditorContent>
    </EditorRoot>
  )
}
