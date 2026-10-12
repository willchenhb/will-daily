'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Editor from './Editor'
import SaveStatus from './SaveStatus'
import { blockSaveForPendingImages, hasPendingImages } from '@/lib/editor-images'
import { useAutosave } from '@/lib/use-autosave'
import { isEmptyHtml } from '@/lib/html'
import { internalHref } from '@/lib/wiki'

interface DiaryEntryProps {
  id?: number
  date: string
  dateFormatted: string
  content: string
  isToday?: boolean
  // Persists the entry and resolves to its id; rejects on failure
  onSave: (data: { id?: number; date: string; content: string }) => Promise<number>
  // Editing finished, e.g. to refresh the list
  onDone?: () => void
  onDelete?: (id: number) => Promise<void>
}

export default function DiaryEntry({ id, date, dateFormatted, content: initialContent, isToday, onSave, onDone, onDelete }: DiaryEntryProps) {
  const router = useRouter()
  const [content, setContent] = useState(initialContent)
  const [editing, setEditing] = useState(isToday && !id)
  // A new entry gets its id from the first autosave
  const idRef = useRef(id)

  const { status, flush } = useAutosave({
    value: isEmptyHtml(content) ? '' : content,
    save: async html => { idRef.current = await onSave({ id: idRef.current, date, content: html }) },
    // An emptied entry is not saved; deleting is explicit
    canSave: html => html !== '' && !hasPendingImages(html),
  })

  const handleDone = async () => {
    if (isEmptyHtml(content)) {
      if (idRef.current) alert('日记内容为空。如需删除，请点击"删除"')
      return
    }
    if (blockSaveForPendingImages(content)) return
    if (!(await flush())) return
    setEditing(false)
    onDone?.()
  }

  return (
    <div className="mb-6 group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-gray-400 tracking-wide">{dateFormatted}</span>
        <div className="flex items-center gap-2">
          {isToday && (
            <span className="text-[10px] text-white bg-[#3a7a4f] px-2 py-0.5 rounded">今天</span>
          )}
          {id && onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="text-[11px] text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              删除
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] text-gray-300 hover:text-gray-500"
            >
              编辑
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          <Editor content={content} onChange={setContent} placeholder="写点什么..." onSave={() => { flush() }} />
          <div className="flex gap-3 mt-2 justify-end items-center">
            <SaveStatus status={status} />
            <button
              onClick={handleDone}
              disabled={status === 'saving'}
              className="text-xs text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-3 py-1.5 rounded disabled:opacity-50"
            >
              完成
            </button>
          </div>
        </div>
      ) : (
        <div
          className="font-content prose prose-sm max-w-none text-gray-600 leading-relaxed cursor-pointer hover:bg-gray-50 rounded p-2 -m-2"
          onClick={e => {
            // [[links]] and #tags navigate in-app; other links open normally
            const href = internalHref(e.target)
            if (href && !e.metaKey && !e.ctrlKey) {
              e.preventDefault()
              router.push(href)
              return
            }
            if ((e.target as HTMLElement).closest('a')) return
            setEditing(true)
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
    </div>
  )
}
