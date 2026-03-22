'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownProps {
  content: string
  className?: string
}

export default function Markdown({ content, className = '' }: MarkdownProps) {
  return (
    <div className={`prose prose-sm max-w-none prose-headings:text-gray-700 prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-700 prose-a:text-[#3a7a4f] font-content ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
