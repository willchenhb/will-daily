'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import NovelEditor from '@/components/NovelEditor'
import Toast from '@/components/Toast'
import Markdown from '@/components/Markdown'

interface NoteDetail {
  id: number
  title: string
  content: string
  category: string | null
  summary: string | null
}

export default function NoteDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [note, setNote] = useState<NoteDetail | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Track dirty state for unsaved changes warning
  const [isDirty, setIsDirty] = useState(false)
  const savedValuesRef = useRef({ title: '', content: '', category: '' })

  const fetchNote = useCallback(async () => {
    const res = await fetch(`/api/notes/${id}`)
    if (!res.ok) { router.push('/notes'); return }
    const data = await res.json()
    setNote(data)
    setTitle(data.title)
    setContent(data.content)
    setCategory(data.category || '')
    savedValuesRef.current = { title: data.title, content: data.content, category: data.category || '' }
    setIsDirty(false)
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

  // Track dirty state
  const handleTitleChange = (val: string) => {
    setTitle(val)
    setIsDirty(
      val !== savedValuesRef.current.title ||
      content !== savedValuesRef.current.content ||
      category !== savedValuesRef.current.category
    )
  }

  const handleContentChange = (val: string) => {
    setContent(val)
    setIsDirty(
      title !== savedValuesRef.current.title ||
      val !== savedValuesRef.current.content ||
      category !== savedValuesRef.current.category
    )
  }

  const handleCategoryChange = (val: string) => {
    setCategory(val)
    setIsDirty(
      title !== savedValuesRef.current.title ||
      content !== savedValuesRef.current.content ||
      val !== savedValuesRef.current.category
    )
  }

  // beforeunload warning for unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category: category || null }),
      })
      setToast({ message: '已保存', type: 'success' })
      savedValuesRef.current = { title, content, category }
      setIsDirty(false)
      fetchNote()
    } catch {
      setToast({ message: '保存失败', type: 'error' })
    }
    setSaving(false)
  }

  const handleSummary = async () => {
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
      fetchNote()
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

      <button onClick={() => router.push('/notes')} className="text-[12px] text-gray-400 hover:text-gray-600 mb-4">
        {'\u2190'} 返回笔记
      </button>

      {note.summary && (
        <div className="bg-[#f8faf8] border border-[#e0ebe0] rounded-lg p-3 mb-4">
          <div className="text-[10px] text-[#3a7a4f] mb-1">{'\u2726'} AI 摘要</div>
          <Markdown content={note.summary} className="text-[13px]" />
        </div>
      )}

      <input
        value={title}
        onChange={e => handleTitleChange(e.target.value)}
        className="w-full text-xl font-semibold text-gray-800 border-none outline-none mb-2 bg-transparent"
        placeholder="标题"
      />

      <div className="mb-4">
        <input
          value={category}
          onChange={e => handleCategoryChange(e.target.value)}
          list="category-suggestions"
          placeholder="分类（可选）"
          className="text-[12px] text-gray-500 border border-gray-100 rounded px-2 py-1 outline-none bg-transparent"
        />
        <datalist id="category-suggestions">
          {categories.map(c => <option key={c} value={c} />)}
        </datalist>
      </div>

      <NovelEditor content={content} onChange={handleContentChange} placeholder="开始写笔记..." onSave={handleSave} />

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
            onClick={handleDelete}
            className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5"
          >
            删除
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-4 py-1.5 rounded disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
