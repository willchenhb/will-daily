import Link from 'next/link'

interface NoteCardProps {
  id: number
  title: string
  content: string
  category: string | null
  summary: string | null
  createdAt: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').slice(0, 120)
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function NoteCard({ id, title, content, category, summary, createdAt }: NoteCardProps) {
  return (
    <Link href={`/notes/${id}`}>
      <div className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors cursor-pointer">
        <div className="flex justify-between items-center">
          <span className="text-[14px] font-medium text-gray-700">{title}</span>
          <span className="text-[11px] text-gray-400">{formatShortDate(createdAt)}</span>
        </div>
        <div className="text-[12px] text-gray-400 mt-1.5 line-clamp-2">
          {stripHtml(content)}
        </div>
        <div className="flex gap-2 mt-2 items-center">
          {category && (
            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{category}</span>
          )}
          {summary && (
            <span className="text-[10px] text-[#3a7a4f]">{'\u2726'} AI 摘要</span>
          )}
        </div>
      </div>
    </Link>
  )
}
