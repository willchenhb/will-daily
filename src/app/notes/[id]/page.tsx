'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Editor from '@/components/Editor'
import SaveStatus from '@/components/SaveStatus'
import Backlinks from '@/components/Backlinks'
import NoteOutline from '@/components/NoteOutline'
import ConflictNotice from '@/components/ConflictNotice'
import RevisionHistory from '@/components/RevisionHistory'
import { hasPendingImages } from '@/lib/editor-images'
import { useAutosave } from '@/lib/use-autosave'
import { keepInHistory, saveDoc, type SaveFlags } from '@/lib/save-doc'
import { setPinned } from '@/lib/bookmarks'
import Toast from '@/components/Toast'
import Markdown from '@/components/Markdown'

interface NoteDetail {
  id: number
  title: string
  content: string
  category: string | null
  summary: string | null
  pinnedAt: string | null
  updatedAt: string
}

export default function NoteDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [note, setNote] = useState<NoteDetail | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [summarizing, setSummarizing] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [pinned, setPinnedState] = useState(false)
  // Title as last saved, so backlinks follow renames
  const [savedTitle, setSavedTitle] = useState('')
  // Bumped to remount the editor with new content (restore, reload after conflict)
  const [editorKey, setEditorKey] = useState(0)
  // Version being edited (server updatedAt), and flags for the next save
  const versionRef = useRef<string | null>(null)
  const nextSaveFlags = useRef<SaveFlags>({})
  const editorBoxRef = useRef<HTMLDivElement>(null)

  const fetchNote = useCallback(async () => {
    const res = await fetch(`/api/notes/${id}`)
    if (!res.ok) { router.push('/notes'); return }
    const data = await res.json()
    setNote(data)
    setTitle(data.title)
    setContent(data.content)
    setCategory(data.category || '')
    setSavedTitle(data.title)
    setPinnedState(!!data.pinnedAt)
    versionRef.current = data.updatedAt
  }, [id, router])

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/notes/categories')
    setCategories(await res.json())
  }, [])

  const checkApiKey = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) return
      const settings = await res.json()
      setHasApiKey(settings.ai_api_key_set === 'true')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => { fetchNote(); fetchCategories(); checkApiKey() }, [fetchNote, fetchCategories, checkApiKey])

  const { status, flush, conflict, reset, retry } = useAutosave({
    value: { title, content, category },
    enabled: note !== null,
    save: async v => {
      const saved = await saveDoc<NoteDetail>(`/api/notes/${id}`, {
        title: v.title,
        content: v.content,
        category: v.category || null,
        baseUpdatedAt: versionRef.current,
        ...nextSaveFlags.current,
      })
      nextSaveFlags.current = {}
      versionRef.current = saved.updatedAt
      setSavedTitle(saved.title)
    },
    canSave: v => !hasPendingImages(v.content),
  })

  // Conflict: take the server's version…
  const loadLatest = () => {
    keepInHistory('note', Number(id), content, title)
    const latest = conflict as NoteDetail
    const fields = { title: latest.title, content: latest.content, category: latest.category || '' }
    setTitle(fields.title)
    setContent(fields.content)
    setCategory(fields.category)
    setSavedTitle(fields.title)
    versionRef.current = latest.updatedAt
    reset(fields)
    setEditorKey(k => k + 1)
  }

  // …or overwrite it (the replaced version is kept in history)
  const overwrite = () => {
    nextSaveFlags.current = { force: true }
    retry()
  }

  const restoreRevision = (revision: { content: string }) => {
    nextSaveFlags.current = { snapshot: true }
    setContent(revision.content)
    setEditorKey(k => k + 1)
  }

  const handleBack = async () => {
    await flush()
    router.push('/notes')
  }

  const handleSummary = async () => {
    // The summary is generated from the saved note
    if (!(await flush())) {
      setToast({ message: '笔记还没保存（图片上传中？），请稍后再试', type: 'error' })
      return
    }
    setSummarizing(true)
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: Number(id) }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Summary failed')
      }
      setToast({ message: '摘要已生成', type: 'success' })
      // Only the summary changed; keep the fields being edited untouched
      const updated = await fetch(`/api/notes/${id}`).then(r => r.json())
      setNote(updated)
    } catch (e) {
      setToast({ message: `生成摘要失败: ${e instanceof Error ? e.message : '未知错误'}`, type: 'error' })
    }
    setSummarizing(false)
  }

  const handleDelete = async () => {
    if (!confirm('确定删除这篇笔记？')) return
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    router.push('/notes')
  }

  if (!note) return null

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <button onClick={handleBack} className="text-[12px] text-gray-400 hover:text-gray-600 mb-4">
        {'\u2190'} 返回笔记
      </button>

      {note.summary && (
        <div className="bg-[#f8faf8] border border-[#e0ebe0] rounded-lg p-3 mb-4">
          <div className="text-[10px] text-[#3a7a4f] mb-1">{'\u2726'} AI 摘要</div>
          <Markdown content={note.summary} className="text-[13px]" />
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="flex-1 min-w-0 text-xl font-semibold text-gray-800 border-none outline-none bg-transparent"
          placeholder="标题"
        />
        <button
          onClick={async () => {
            const next = !pinned
            setPinnedState(next)
            if (!(await setPinned(note.id, next))) setPinnedState(!next)
          }}
          title={pinned ? '取消收藏' : '收藏'}
          className={`flex-none text-lg leading-none ${pinned ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
        >
          {pinned ? '★' : '☆'}
        </button>
      </div>

      <div className="mb-4">
        <input
          value={category}
          onChange={e => setCategory(e.target.value)}
          list="category-suggestions"
          placeholder="分类（可选）"
          className="text-[12px] text-gray-500 border border-gray-100 rounded px-2 py-1 outline-none bg-transparent"
        />
        <datalist id="category-suggestions">
          {categories.map(c => <option key={c} value={c} />)}
        </datalist>
      </div>

      {conflict !== null && <ConflictNotice onReload={loadLatest} onOverwrite={overwrite} />}

      <NoteOutline containerRef={editorBoxRef} version={`${editorKey}:${content}`} />

      <div ref={editorBoxRef} className="border border-gray-100 rounded-lg px-3 py-2">
        <Editor key={editorKey} content={content} onChange={setContent} placeholder="开始写笔记，输入 / 插入内容..." onSave={() => { flush() }} contentClassName="min-h-[300px]" showWordCount />
      </div>

      <div className="flex justify-between items-center mt-4">
        <div className="flex gap-2">
          {hasApiKey && (
            <button
              onClick={handleSummary}
              disabled={summarizing}
              className="text-xs text-[#3a7a4f] border border-[#c5d9c5] px-3 py-1.5 rounded hover:bg-[#f0faf4] disabled:opacity-50"
            >
              {summarizing ? '生成中...' : '\u2726 生成摘要'}
            </button>
          )}
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5"
          >
            历史版本
          </button>
          <button
            onClick={handleDelete}
            className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5"
          >
            删除
          </button>
        </div>
        <SaveStatus status={status} />
      </div>

      <Backlinks noteId={note.id} title={savedTitle} />

      {showHistory && (
        <RevisionHistory type="note" id={note.id} onRestore={restoreRevision} onClose={() => setShowHistory(false)} />
      )}
    </div>
  )
}
