'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Toast from '@/components/Toast'
import Loading from '@/components/Loading'
import Markdown from '@/components/Markdown'

interface Article {
  id: number
  url: string
  title: string
  author: string | null
  image: string | null
  summary: string | null
  keyPoints: string | null
  tags: string | null
  category: string | null
  source: string | null
  status: string | null
  createdAt: string
}

const CATEGORIES = [
  { key: 'tech', label: '科技', emoji: '🔬' },
  { key: 'finance', label: '金融', emoji: '💰' },
  { key: 'health', label: '健康', emoji: '🏥' },
  { key: 'education', label: '教育', emoji: '📚' },
  { key: 'lifestyle', label: '生活', emoji: '🏠' },
  { key: 'business', label: '商业', emoji: '💼' },
  { key: 'other', label: '其他', emoji: '📌' },
]

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

function categoryInfo(key: string | null) {
  return CATEGORIES.find(c => c.key === key)
}

function statusBadge(status: string | null) {
  switch (status) {
    case 'pending':
    case 'analyzing':
      return <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded">分析中</span>
    case 'failed':
      return <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">失败</span>
    default:
      return null
  }
}

const PAGE_SIZE = 20

export default function CuratedPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [url, setUrl] = useState('')
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const observerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchArticles = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum > 1) setLoadingMore(true)
    const params = new URLSearchParams({ page: String(pageNum), size: String(PAGE_SIZE) })
    if (selectedCategory) params.set('category', selectedCategory)
    if (searchDebounced) params.set('search', searchDebounced)
    const res = await fetch(`/api/curated?${params}`)
    if (!res.ok) { setLoading(false); setLoadingMore(false); return }
    const data = await res.json()
    setArticles(prev => append ? [...prev, ...data.articles] : data.articles)
    setHasMore(data.articles.length === PAGE_SIZE && pageNum * PAGE_SIZE < data.total)
    setTotal(data.total)
    setCounts(data.counts || {})
    setPage(pageNum)
    setLoading(false)
    setLoadingMore(false)
  }, [selectedCategory, searchDebounced])

  useEffect(() => { fetchArticles(1) }, [fetchArticles])

  // Infinite scroll: load more when sentinel is visible
  const pageRef = useRef(page)
  pageRef.current = page
  const hasMoreRef = useRef(hasMore)
  hasMoreRef.current = hasMore
  const loadingMoreRef = useRef(loadingMore)
  loadingMoreRef.current = loadingMore

  useEffect(() => {
    const el = observerRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
        fetchArticles(pageRef.current + 1, true)
      }
    }, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchArticles])

  // Auto-refresh only for articles created in the last 2 minutes without summary
  useEffect(() => {
    const now = Date.now()
    const hasPending = articles.some(a =>
      (a.status === 'pending' || a.status === 'analyzing') &&
      (now - new Date(a.createdAt).getTime()) < 120_000
    )
    if (!hasPending) return
    const timer = setInterval(() => fetchArticles(1), 8000)
    return () => clearInterval(timer)
  }, [articles, fetchArticles])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchArticles(1)
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
      fetchArticles(1)
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : '添加失败', type: 'error' })
    }
    setAdding(false)
  }

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0)

  if (loading) return <div className="max-w-6xl mx-auto px-8 py-6"><Loading /></div>

  return (
    <div className="max-w-6xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Add URL input + refresh */}
      <div className="flex gap-2 mb-3">
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

      {/* Search box */}
      <div className="mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索文章标题或摘要..."
          className="w-full text-[13px] border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-[#3a7a4f] bg-white"
        />
      </div>

      {/* Category filter bar */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`text-[12px] px-3 py-1.5 rounded-full transition-colors ${
            !selectedCategory
              ? 'bg-[#3a7a4f] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部({totalAll})
        </button>
        {CATEGORIES.map(cat => {
          const count = counts[cat.key] || 0
          if (count === 0) return null
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(selectedCategory === cat.key ? null : cat.key)}
              className={`text-[12px] px-3 py-1.5 rounded-full transition-colors ${
                selectedCategory === cat.key
                  ? 'bg-[#3a7a4f] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.emoji}{cat.label}({count})
            </button>
          )
        })}
      </div>

      {/* Article cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              {/* Source, category, status & date */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                  {sourceLabel(article.source)}
                </span>
                {categoryInfo(article.category) && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                    {categoryInfo(article.category)!.emoji}{categoryInfo(article.category)!.label}
                  </span>
                )}
                {statusBadge(article.status)}
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
              ) : (article.status === 'pending' || article.status === 'analyzing') ? (
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-[#3a7a4f] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-[#3a7a4f]">速读生成中...</span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Infinite scroll sentinel - always rendered */}
      <div ref={observerRef} className="h-4" />
      {loadingMore && (
        <div className="flex justify-center py-6">
          <span className="inline-block w-5 h-5 border-2 border-[#3a7a4f] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!hasMore && articles.length > PAGE_SIZE && (
        <div className="text-center text-gray-300 text-sm py-6">没有更多了</div>
      )}

      {articles.length === 0 && !loading && (
        <div className="text-center text-gray-300 text-sm py-16">
          {searchDebounced || selectedCategory ? '没有找到匹配的文章' : '粘贴微信文章链接，开始收藏精选内容'}
        </div>
      )}
    </div>
  )
}
