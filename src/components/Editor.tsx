'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

interface EditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
}

export default function Editor({ content, onChange, placeholder = '写点什么...', editable = true }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'font-content prose prose-sm max-w-none focus:outline-none min-h-[60px] text-gray-700 leading-relaxed',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="border border-dashed border-[#c5d9c5] rounded-md p-3">
      {editable && (
        <div className="flex gap-1 mb-2 border-b border-gray-100 pb-2">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2 py-1 text-xs rounded ${editor.isActive('bold') ? 'bg-[#eef5ee] text-[#3a7a4f]' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 text-xs rounded italic ${editor.isActive('italic') ? 'bg-[#eef5ee] text-[#3a7a4f]' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            I
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 py-1 text-xs rounded ${editor.isActive('heading', { level: 3 }) ? 'bg-[#eef5ee] text-[#3a7a4f]' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            H
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 text-xs rounded ${editor.isActive('bulletList') ? 'bg-[#eef5ee] text-[#3a7a4f]' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            &bull;
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-2 py-1 text-xs rounded ${editor.isActive('orderedList') ? 'bg-[#eef5ee] text-[#3a7a4f]' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            1.
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
