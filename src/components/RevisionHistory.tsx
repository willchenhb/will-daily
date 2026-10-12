'use client'

import { useEffect, useState } from 'react'
import type { DocType } from '@/lib/revisions-types'
import { sanitizeHtml } from '@/lib/sanitize'

interface RevisionSummary { id: number; title: string | null; createdAt: string; chars: number; preview: string }
interface RevisionDetail { id: number; title: string | null; content: string; createdAt: string }

function formatTime(iso: string): string {
  const d = new Date(iso)
  const minutes = Math.round((Date.now() - d.getTime()) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} 小时前`
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Modal listing earlier versions of a document, with a preview and restore
export default function RevisionHistory({ type, id, onRestore, onClose }: {
  type: DocType
  id: number
  onRestore: (revision: RevisionDetail) => void
  onClose: () => void
}) {
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null)
  const [selected, setSelected] = useState<RevisionDetail | null>(null)

  useEffect(() => {
    fetch(`/api/revisions?type=${type}&id=${id}`)
      .then(res => (res.ok ? res.json() : { revisions: [] }))
      .then(data => setRevisions(data.revisions))
      .catch(() => setRevisions([]))
  }, [type, id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const open = (rid: number) => {
    fetch(`/api/revisions/${rid}`)
      .then(res => (res.ok ? res.json() : null))
      .then(setSelected)
      .catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-4xl h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-[14px] font-medium text-gray-700">历史版本</span>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
        </div>

        {!revisions ? (
          <div className="flex-1 flex items-center justify-center text-[12px] text-gray-300">加载中…</div>
        ) : revisions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-6 text-center text-[12px] text-gray-400 leading-relaxed">
            还没有历史版本。<br />编辑时每隔约 10 分钟、或一次删掉大段内容时，会自动保留修改前的版本。
          </div>
        ) : (
          <div className="flex-1 flex min-h-0 flex-col md:flex-row">
            <div className="md:w-64 max-h-48 md:max-h-none overflow-y-auto border-b md:border-b-0 md:border-r border-gray-100">
              {revisions.map(r => (
                <button
                  key={r.id}
                  onClick={() => open(r.id)}
                  className={`w-full text-left px-4 py-2.5 border-b border-gray-50 ${selected?.id === r.id ? 'bg-[#eef5ee]' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-gray-700">{formatTime(r.createdAt)}</span>
                    <span className="text-gray-300">{r.chars} 字</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-400 truncate">{r.preview || '（无文字）'}</div>
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              {selected ? (
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
                    <span className="text-[11px] text-gray-400">
                      {new Date(selected.createdAt).toLocaleString('zh-CN')}{selected.title ? ` · ${selected.title}` : ''}
                    </span>
                    <button
                      onClick={() => {
                        if (!confirm('用这个版本替换当前正文？当前内容会先保存到历史版本。')) return
                        onRestore(selected)
                        onClose()
                      }}
                      className="text-[12px] text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-3 py-1 rounded"
                    >
                      恢复此版本
                    </button>
                  </div>
                  <div
                    className="flex-1 overflow-y-auto px-5 py-4 font-content prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.content) }}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[12px] text-gray-300">选择左侧的版本查看</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
