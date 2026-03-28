'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Toast from '@/components/Toast'
import Markdown from '@/components/Markdown'

interface ArticleDetail {
  id: number
  url: string
  title: string
  author: string | null
  image: string | null
  content: string | null
  summary: string | null
  keyPoints: string | null
  tags: string | null
  category: string | null
  source: string | null
  status: string | null
  createdAt: string
}

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  tech: { label: '科技', emoji: '🔬' },
  finance: { label: '金融', emoji: '💰' },
  health: { label: '健康', emoji: '🏥' },
  education: { label: '教育', emoji: '📚' },
  lifestyle: { label: '生活', emoji: '🏠' },
  business: { label: '商业', emoji: '💼' },
  other: { label: '其他', emoji: '📌' },
}

function proxyImage(url: string | null): string | null {
  if (!url) return null
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

function sourceLabel(source: string | null): string {
  if (source === 'wechat') return '微信'
  return source || '网页'
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function parseTags(tags: string | null): string[] {
  if (!tags) return []
  return tags.split(',').filter(Boolean)
}

function parseKeyPoints(keyPoints: string | null): string[] {
  if (!keyPoints) return []
  try {
    const arr = JSON.parse(keyPoints)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export default function CuratedDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [article, setArticle] = useState<ArticleDetail | null>(null)
  const [showContent, setShowContent] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchArticle = useCallback(async () => {
    const res = await fetch(`/api/curated/${id}`)
    if (!res.ok) { router.push('/curated'); return }
    setArticle(await res.json())
  }, [id, router])

  useEffect(() => { fetchArticle() }, [fetchArticle])

  // Auto-refresh while analyzing
  useEffect(() => {
    if (!article || (article.status !== 'pending' && article.status !== 'analyzing')) return
    const timer = setInterval(fetchArticle, 3000)
    return () => clearInterval(timer)
  }, [article, fetchArticle])

  const handleReanalyze = async () => {
    setReanalyzing(true)
    try {
      const res = await fetch(`/api/curated/${id}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setToast({ message: '分析已更新', type: 'success' })
      fetchArticle()
    } catch (e) {
      setToast({ message: `分析失败: ${e instanceof Error ? e.message : '未知错误'}`, type: 'error' })
    }
    setReanalyzing(false)
  }

  const handleDelete = async () => {
    if (!confirm('确定删除？')) return
    await fetch(`/api/curated/${id}`, { method: 'DELETE' })
    router.push('/curated')
  }

  if (!article) return null

  const tags = parseTags(article.tags)
  const keyPoints = parseKeyPoints(article.keyPoints)
  const cat = article.category ? CATEGORIES[article.category] : null

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Back */}
      <button onClick={() => router.push('/curated')} className="text-[12px] text-gray-400 hover:text-gray-600 mb-5 block">
        ← 返回精选
      </button>

      {/* Cover image */}
      {article.image && (
        <div className="h-56 rounded-xl overflow-hidden bg-gray-50 mb-5">
          <img
            src={proxyImage(article.image)!}
            alt={article.title}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
          />
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
          {sourceLabel(article.source)}
        </span>
        {cat && (
          <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
            {cat.emoji}{cat.label}
          </span>
        )}
        {article.author && (
          <span className="text-[12px] text-gray-500">{article.author}</span>
        )}
        <span className="text-[12px] text-gray-400">{formatFullDate(article.createdAt)}</span>
      </div>

      {/* Title */}
      <h1 className="text-xl font-semibold text-gray-800 mb-4 font-content">
        {article.title}
      </h1>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {tags.map(tag => (
            <span key={tag} className="text-[11px] bg-[#eef5ee] text-[#3a7a4f] px-2 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="bg-[#f8faf8] border border-[#e0ebe0] rounded-xl p-5 mb-5">
        <div className="text-[11px] text-[#3a7a4f] font-medium mb-2">✦ 速读</div>
        {(article.status === 'pending' || article.status === 'analyzing') ? (
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-[#3a7a4f] border-t-transparent rounded-full animate-spin" />
            <span className="text-[13px] text-[#3a7a4f]">速读生成中...</span>
          </div>
        ) : article.summary ? (
          <Markdown content={article.summary} className="text-[13px] [&_*]:!text-gray-800" />
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-[13px] text-gray-400 italic">暂无速读摘要</p>
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="text-[12px] text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-3 py-1 rounded disabled:opacity-50"
            >
              {reanalyzing ? '分析中...' : '生成速读'}
            </button>
          </div>
        )}
      </div>

      {/* Key Points */}
      {keyPoints.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] text-[#3a7a4f] font-medium mb-2">📋 关键要点</div>
          <ol className="list-decimal list-inside space-y-1.5">
            {keyPoints.map((point, i) => (
              <li key={i} className="text-[13px] text-gray-700 leading-relaxed font-content">{point}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Show original content */}
      <div className="mb-5">
        <button
          onClick={() => setShowContent(!showContent)}
          className="text-[13px] text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50"
        >
          {showContent ? '收起原文' : '查看原文'}
        </button>

        {showContent && article.content && (
          <div className="mt-4 bg-gray-50 rounded-xl p-5 text-[13px] text-gray-600 leading-relaxed font-content whitespace-pre-wrap max-h-[600px] overflow-y-auto">
            {article.content}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] text-[#3a7a4f] hover:text-[#2d6b3f] font-medium"
        >
          阅读原文 →
        </a>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="text-[12px] text-[#3a7a4f] border border-[#c5d9c5] px-3 py-1 rounded hover:bg-[#eef5ee] disabled:opacity-50"
          >
            {reanalyzing ? '分析中...' : '重新分析'}
          </button>
          <button
            onClick={handleDelete}
            className="text-[12px] text-gray-400 hover:text-red-400"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}
