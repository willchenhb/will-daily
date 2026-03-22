'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Toast from '@/components/Toast'
import Loading from '@/components/Loading'
import Markdown from '@/components/Markdown'

interface Article {
  id: number
  url: string
  title: string
  image: string | null
  summary: string | null
  tags: string | null
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

function shortSummary(summary: string | null): string {
  if (!summary) return ''
  return summary.length > 100 ? summary.slice(0, 100) + '...' : summary
}

function parseTags(tags: string | null): string[] {
  if (!tags) return []
  return tags.split(',').filter(Boolean)
}

export default function CuratedPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const router = useRouter()

  const fetchArticles = useCallback(async () => {
    const res = await fetch('/api/curated')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setArticles(data.articles)
    setLoading(false)
  }, [])

  useEffect(() => { fetchArticles() }, [fetchArticles])

  // Auto-refresh when articles are pending analysis (no summary yet)
  useEffect(() => {
    const hasPending = articles.some(a => a.summary === null && a.createdAt)
    if (!hasPending) return
    const timer = setInterval(fetchArticles, 5000)
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
      setToast({ message: '已收藏', type: 'success' })
      setUrl('')
      fetchArticles()
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : '添加失败', type: 'error' })
    }
    setAdding(false)
  }

  if (loading) return <div className="max-w-4xl mx-auto px-8 py-6"><Loading /></div>

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
          {adding ? '收藏中...' : '+ 收藏'}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-[13px] text-gray-500 border border-gray-200 hover:bg-gray-50 px-3 py-2.5 rounded-lg disabled:opacity-50"
          title="刷新"
        >
          {refreshing ? '...' : '刷新'}
        </button>
      </div>

      {/* Article cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles.map(article => (
          <div
            key={article.id}
            onClick={() => router.push(`/curated/${article.id}`)}
            className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
          >
            {/* Cover image */}
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

              {/* Tags */}
              {parseTags(article.tags).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {parseTags(article.tags).map(tag => (
                    <span key={tag} className="text-[10px] bg-[#eef5ee] text-[#3a7a4f] px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Short summary */}
              {article.summary ? (
                <div className="line-clamp-2">
                  <Markdown content={shortSummary(article.summary)} className="text-[12px] [&_*]:text-gray-500" />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-[#3a7a4f] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-[#3a7a4f]">速读生成中...</span>
                </div>
              )}
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
