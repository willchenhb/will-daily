'use client'

import { useState, useEffect, useCallback } from 'react'
import Toast from '@/components/Toast'

interface Article {
  id: number
  url: string
  title: string
  image: string | null
  summary: string | null
  source: string | null
  createdAt: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function sourceLabel(source: string | null): string {
  if (source === 'wechat') return '微信'
  return source || '网页'
}

function proxyImage(url: string | null): string | null {
  if (!url) return null
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

export default function CuratedPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchArticles = useCallback(async () => {
    const res = await fetch('/api/curated')
    const data = await res.json()
    setArticles(data.articles)
  }, [])

  useEffect(() => { fetchArticles() }, [fetchArticles])

  // Auto-refresh when there are generating articles
  useEffect(() => {
    const hasGenerating = articles.some(a => a.summary === '__generating__')
    if (!hasGenerating) return
    const timer = setInterval(fetchArticles, 3000)
    return () => clearInterval(timer)
  }, [articles, fetchArticles])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchArticles()
    setRefreshing(false)
  }

  const handleAdd = async () => {
    if (!url.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/curated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '添加失败')
      }
      setToast({ message: '已收藏，速读生成中...', type: 'success' })
      setUrl('')
      fetchArticles()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : '添加失败', type: 'error' })
    }
    setAdding(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除？')) return
    await fetch(`/api/curated/${id}`, { method: 'DELETE' })
    fetchArticles()
  }

  const handleResummary = async (id: number) => {
    setToast({ message: '正在生成速读...', type: 'success' })
    try {
      const res = await fetch(`/api/curated/${id}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setToast({ message: '速读已更新', type: 'success' })
      fetchArticles()
    } catch (e) {
      setToast({ message: `生成失败: ${e instanceof Error ? e.message : '未知错误'}`, type: 'error' })
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Add URL input + refresh */}
      <div className="flex gap-2 mb-6">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="粘贴微信文章或网页链接..."
          className="flex-1 text-[13px] border border-gray-200 rounded-lg px-4 py-2.5 outline-none focus:border-[#3a7a4f] bg-white"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !url.trim()}
          className="text-[13px] text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-5 py-2.5 rounded-lg disabled:opacity-50 whitespace-nowrap"
        >
          {adding ? '抓取中...' : '+ 收藏'}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-[13px] text-gray-500 border border-gray-200 hover:bg-gray-50 px-3 py-2.5 rounded-lg disabled:opacity-50"
          title="刷新"
        >
          {refreshing ? '⏳' : '🔄'}
        </button>
      </div>

      {/* Article cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles.map(article => (
          <div key={article.id} className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
            {/* Cover image via proxy */}
            {article.image && (
              <div className="h-40 overflow-hidden bg-gray-50">
                <img
                  src={proxyImage(article.image)!}
                  alt={article.title}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                />
              </div>
            )}

            <div className="p-4">
              {/* Source & date */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                  {sourceLabel(article.source)}
                </span>
                <span className="text-[11px] text-gray-400">{formatDate(article.createdAt)}</span>
              </div>

              {/* Title */}
              <h3 className="text-[14px] font-medium text-gray-800 mb-2 line-clamp-2 font-content">
                {article.title}
              </h3>

              {/* Summary */}
              {article.summary === '__generating__' ? (
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-[#3a7a4f] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-[#3a7a4f]">速读生成中...</span>
                </div>
              ) : article.summary ? (
                <div className="mb-3">
                  <div className="text-[10px] text-[#3a7a4f] mb-1 font-medium">✦ 速读</div>
                  <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-4 font-content">
                    {article.summary}
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-gray-300 mb-3 italic">暂无速读摘要</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#3a7a4f] hover:text-[#2d6b3f] font-medium"
                  onClick={e => e.stopPropagation()}
                >
                  阅读原文 →
                </a>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleResummary(article.id)}
                    className="text-[11px] text-gray-400 hover:text-[#3a7a4f]"
                  >
                    {article.summary && article.summary !== '__generating__' ? '重新速读' : '生成速读'}
                  </button>
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="text-[11px] text-gray-400 hover:text-red-400"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {articles.length === 0 && (
        <div className="text-center text-gray-300 text-sm py-16">
          粘贴微信文章链接，开始收藏精选内容
        </div>
      )}
    </div>
  )
}
