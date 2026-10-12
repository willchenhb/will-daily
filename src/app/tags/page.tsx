'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Loading from '@/components/Loading'
import { ContentResultList, type ContentResult } from '@/components/ContentResults'
import { tagHref } from '@/lib/wiki'

interface TagCount { name: string; count: number }

export default function TagsPage() {
  return (
    <Suspense>
      <Tags />
    </Suspense>
  )
}

function Tags() {
  // ?t=读书 shows everything tagged #读书
  const selected = useSearchParams().get('t')
  const [tags, setTags] = useState<TagCount[] | null>(null)
  const [results, setResults] = useState<ContentResult[] | null>(null)

  useEffect(() => {
    fetch('/api/tags')
      .then(res => (res.ok ? res.json() : { tags: [] }))
      .then(data => setTags(data.tags))
      .catch(() => setTags([]))
  }, [])

  useEffect(() => {
    setResults(null)
    if (!selected) return
    fetch(`/api/tags?t=${encodeURIComponent(selected)}`)
      .then(res => (res.ok ? res.json() : { results: [] }))
      .then(data => setResults(data.results))
      .catch(() => setResults([]))
  }, [selected])

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      <h1 className="text-lg font-semibold text-gray-800 mb-4">标签</h1>

      {!tags ? (
        <Loading />
      ) : tags.length === 0 ? (
        <div className="text-[13px] text-gray-400 leading-relaxed">
          还没有标签。在笔记、日记、周记里输入 <span className="tag">#标签名</span> 加空格即可添加。
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-6">
          {tags.map(t => (
            <Link
              key={t.name}
              href={t.name === selected ? '/tags' : tagHref(t.name)}
              className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
                t.name === selected
                  ? 'bg-[#3a7a4f] border-[#3a7a4f] text-white'
                  : 'bg-[#eef5ee] border-transparent text-[#3a7a4f] hover:border-[#c5d9c5]'
              }`}
            >
              #{t.name} <span className="opacity-60">{t.count}</span>
            </Link>
          ))}
        </div>
      )}

      {selected && (
        <div>
          <div className="text-[12px] text-gray-500 mb-1 px-3">
            #{selected} {results && <span className="text-gray-300">{results.length}</span>}
          </div>
          {!results ? (
            <Loading />
          ) : results.length === 0 ? (
            <div className="text-[12px] text-gray-300 px-3 py-2">没有内容使用这个标签</div>
          ) : (
            <ContentResultList results={results} terms={[`#${selected}`]} />
          )}
        </div>
      )}
    </div>
  )
}
