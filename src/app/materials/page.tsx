'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import Toast from '@/components/Toast'
import Loading from '@/components/Loading'

interface Material {
  id: number
  title: string
  filename: string
  size: number
  description: string | null
  createdAt: string
  updatedAt: string
}

const MAX_SIZE = 10 * 1024 * 1024

type SortKey = 'newest' | 'oldest' | 'name' | 'size'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: '最新上传' },
  { key: 'oldest', label: '最早上传' },
  { key: 'name', label: '按名称' },
  { key: 'size', label: '按大小' },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function hasFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files')
}

const actionBtn = 'text-[12px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition-colors'

export default function MaterialsPage() {
  const [items, setItems] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/materials')
      if (res.ok) {
        const data = await res.json()
        setItems(data.materials)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || uploading) return
    const errors: string[] = []
    const valid = files.filter(f => {
      if (!/\.html?$/i.test(f.name)) { errors.push(`${f.name}：仅支持 .html / .htm`); return false }
      if (f.size > MAX_SIZE) { errors.push(`${f.name}：超过 10MB`); return false }
      return true
    })

    // One request per file keeps each upload well under the nginx body limit
    let ok = 0
    if (valid.length > 0) {
      setUploading({ done: 0, total: valid.length })
      for (let i = 0; i < valid.length; i++) {
        const form = new FormData()
        form.append('file', valid[i])
        try {
          const res = await fetch('/api/materials', { method: 'POST', body: form })
          if (res.ok) {
            ok++
          } else {
            const data = await res.json().catch(() => null)
            errors.push(data?.error || `${valid[i].name}：上传失败`)
          }
        } catch {
          errors.push(`${valid[i].name}：网络错误`)
        }
        setUploading({ done: i + 1, total: valid.length })
      }
      setUploading(null)
      fetchItems()
    }

    if (errors.length === 0) {
      setToast({ message: `已上传 ${ok} 份资料`, type: 'success' })
    } else if (ok > 0) {
      setToast({ message: `已上传 ${ok} 份，${errors.length} 份失败：${errors[0]}`, type: 'error' })
    } else {
      setToast({ message: errors[0], type: 'error' })
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragCounter.current++
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragCounter.current = 0
    setDragActive(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }

  const startEdit = (m: Material) => {
    setEditingId(m.id)
    setEditTitle(m.title)
    setEditDesc(m.description || '')
  }

  const saveEdit = async () => {
    if (editingId === null) return
    if (!editTitle.trim()) {
      setToast({ message: '标题不能为空', type: 'error' })
      return
    }
    try {
      const res = await fetch(`/api/materials/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), description: editDesc.trim() }),
      })
      if (!res.ok) throw new Error()
      const updated: Material = await res.json()
      setItems(prev => prev.map(m => (m.id === updated.id ? updated : m)))
      setEditingId(null)
      setToast({ message: '已保存', type: 'success' })
    } catch {
      setToast({ message: '保存失败', type: 'error' })
    }
  }

  const handleDelete = async (m: Material) => {
    if (!confirm(`确定删除「${m.title}」吗？此操作不可恢复。`)) return
    try {
      const res = await fetch(`/api/materials/${m.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setItems(prev => prev.filter(x => x.id !== m.id))
      setToast({ message: '已删除', type: 'success' })
    } catch {
      setToast({ message: '删除失败', type: 'error' })
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? items.filter(m =>
          m.title.toLowerCase().includes(q) ||
          m.filename.toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q))
      : items
    const sorted = [...filtered]
    switch (sort) {
      case 'oldest': sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break
      case 'name': sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')); break
      case 'size': sorted.sort((a, b) => b.size - a.size); break
      default: sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return sorted
  }, [items, search, sort])

  if (loading) return <div className="max-w-5xl mx-auto px-8 py-6"><Loading /></div>

  return (
    <div
      className="max-w-5xl mx-auto px-4 md:px-8 py-6 min-h-[calc(100vh-120px)]"
      onDragEnter={handleDragEnter}
      onDragOver={e => { if (hasFiles(e)) e.preventDefault() }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {toast && <Toast key={toast.message} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {dragActive && (
        <div className="fixed inset-0 z-40 bg-[#3a7a4f]/10 border-4 border-dashed border-[#3a7a4f] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl shadow-lg px-8 py-6 text-center">
            <div className="text-3xl mb-2">📁</div>
            <div className="text-[14px] font-medium text-[#3a7a4f]">松开即可上传 HTML 文件</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">资料</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">上传 HTML 文件，在线渲染查看 · 共 {items.length} 份</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!!uploading}
          className="text-[13px] text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-4 py-2 rounded-lg disabled:opacity-60 whitespace-nowrap"
        >
          {uploading ? `上传中 ${uploading.done}/${uploading.total}` : '+ 上传 HTML'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm,text/html"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || [])
            e.target.value = ''
            uploadFiles(files)
          }}
        />
      </div>

      {items.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 hover:border-[#3a7a4f] rounded-xl py-20 text-center transition-colors"
        >
          <div className="text-3xl mb-3">📁</div>
          <div className="text-[14px] text-gray-500">拖拽 HTML 文件到这里，或点击上传</div>
          <div className="text-[12px] text-gray-300 mt-1">支持 .html / .htm，单个文件不超过 10MB，可多选</div>
        </button>
      ) : (
        <>
          {/* Search + sort */}
          <div className="flex gap-2 mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索标题、文件名或备注..."
              className="flex-1 text-[13px] border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-[#3a7a4f] bg-white"
            />
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f] bg-white"
            >
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="text-center text-gray-300 text-sm py-16">没有找到匹配的资料</div>
          ) : (
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
              {visible.map(m => (
                <div key={m.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[#eef5ee] text-[#3a7a4f] flex items-center justify-center text-[10px] font-semibold tracking-wide shrink-0">
                    HTML
                  </div>

                  {editingId === m.id ? (
                    <div className="flex-1 min-w-0 space-y-2">
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveEdit()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        autoFocus
                        placeholder="标题"
                        className="w-full text-[13px] border border-gray-200 rounded px-3 py-1.5 outline-none focus:border-[#3a7a4f]"
                      />
                      <textarea
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setEditingId(null) }}
                        rows={2}
                        placeholder="备注（可选）"
                        className="w-full text-[12px] border border-gray-200 rounded px-3 py-1.5 outline-none focus:border-[#3a7a4f] resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 px-3 py-1">取消</button>
                        <button onClick={saveEdit} className="text-xs text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-3 py-1.5 rounded">保存</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/materials/${m.id}`}
                          className="block text-[14px] font-medium text-gray-800 hover:text-[#3a7a4f] truncate font-content"
                        >
                          {m.title}
                        </Link>
                        {m.description && (
                          <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-1 min-w-0">
                          <span className="truncate">{m.filename}</span>
                          <span className="shrink-0">·</span>
                          <span className="shrink-0">{formatSize(m.size)}</span>
                          <span className="shrink-0">·</span>
                          <span className="shrink-0">{formatDateTime(m.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                        <a href={`/api/materials/${m.id}/raw`} target="_blank" rel="noopener noreferrer" className={actionBtn} title="新窗口打开">↗</a>
                        <a href={`/api/materials/${m.id}/raw?download=1`} className={actionBtn}>下载</a>
                        <button onClick={() => startEdit(m)} className={actionBtn}>编辑</button>
                        <button onClick={() => handleDelete(m)} className={`${actionBtn} hover:!text-red-500`}>删除</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-300 text-center mt-4">也可以直接把 HTML 文件拖进页面上传</p>
        </>
      )}
    </div>
  )
}
