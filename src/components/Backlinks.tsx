'use client'

import { useEffect, useState } from 'react'
import { ContentResultList, type ContentResult } from './ContentResults'

// "反向链接" panel under a note: who links here, and who mentions it without a link
export default function Backlinks({ noteId, title }: { noteId: number; title: string }) {
  const [data, setData] = useState<{ links: ContentResult[]; mentions: ContentResult[] } | null>(null)
  const [showMentions, setShowMentions] = useState(false)

  // Refetch after a rename is saved: unlinked mentions are matched by title
  useEffect(() => {
    fetch(`/api/notes/${noteId}/backlinks`)
      .then(res => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => {})
  }, [noteId, title])

  if (!data) return null

  return (
    <div className="mt-10 border-t border-gray-100 pt-4">
      <div className="text-[12px] font-medium text-gray-500 mb-1 px-3">
        🔗 反向链接 <span className="text-gray-300">{data.links.length}</span>
      </div>
      {data.links.length > 0 ? (
        <ContentResultList results={data.links} terms={[title]} />
      ) : (
        <div className="text-[12px] text-gray-300 px-3 py-2">
          还没有内容链接到这篇笔记。在任意笔记、日记、周记中输入 [[ 即可链接。
        </div>
      )}

      {data.mentions.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowMentions(v => !v)}
            className="text-[12px] text-gray-400 hover:text-gray-600 px-3"
          >
            {showMentions ? '▾' : '▸'} 未链接的提及 <span className="text-gray-300">{data.mentions.length}</span>
          </button>
          {showMentions && <ContentResultList results={data.mentions} terms={[title]} />}
        </div>
      )}
    </div>
  )
}
