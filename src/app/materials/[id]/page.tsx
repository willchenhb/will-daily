'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { MATERIAL_SANDBOX } from '@/lib/materials'

interface Material {
  id: number
  title: string
  filename: string
  size: number
  description: string | null
  createdAt: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

const toolBtn = 'text-[12px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-2.5 py-1.5 rounded transition-colors whitespace-nowrap'

export default function MaterialDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [material, setMaterial] = useState<Material | null>(null)
  const [frameLoaded, setFrameLoaded] = useState(false)
  const frameWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/materials/${id}`)
      .then(res => {
        if (!res.ok) { router.replace('/materials'); return null }
        return res.json()
      })
      .then(data => { if (data) setMaterial(data) })
      .catch(() => {})
  }, [id, router])

  const handleDelete = async () => {
    if (!material || !confirm(`确定删除「${material.title}」吗？此操作不可恢复。`)) return
    const res = await fetch(`/api/materials/${material.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/materials')
  }

  const rawUrl = `/api/materials/${id}/raw`

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] md:h-screen">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-2.5 border-b border-gray-100 shrink-0">
        <Link href="/materials" className="text-[13px] text-gray-400 hover:text-gray-600 shrink-0">
          ← 资料
        </Link>
        <div className="min-w-0 flex-1" title={material?.description || undefined}>
          <h1 className="text-[15px] font-semibold text-gray-800 truncate font-content">
            {material?.title || '加载中…'}
          </h1>
          {material && (
            <p className="text-[11px] text-gray-400 truncate">
              {material.filename} · {formatSize(material.size)} · {formatDate(material.createdAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => frameWrapRef.current?.requestFullscreen?.()}
            className={`${toolBtn} hidden md:inline-block`}
          >
            全屏
          </button>
          <a href={rawUrl} target="_blank" rel="noopener noreferrer" className={toolBtn}>新窗口</a>
          <a href={`${rawUrl}?download=1`} className={toolBtn}>下载</a>
          <button onClick={handleDelete} className={`${toolBtn} hover:!text-red-500`}>删除</button>
        </div>
      </div>

      {/* Rendered HTML, isolated in a sandbox (no same-origin access to the app) */}
      <div ref={frameWrapRef} className="relative flex-1 bg-white">
        {!frameLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-block w-5 h-5 border-2 border-[#3a7a4f] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <iframe
          src={rawUrl}
          title={material?.title || '资料预览'}
          sandbox={MATERIAL_SANDBOX}
          allowFullScreen
          onLoad={() => setFrameLoaded(true)}
          className="w-full h-full border-0 bg-white"
        />
      </div>
    </div>
  )
}
