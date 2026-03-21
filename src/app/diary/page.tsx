'use client'
import Editor from '@/components/Editor'
import { useState } from 'react'

export default function DiaryPage() {
  const [content, setContent] = useState('')
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-lg font-semibold mb-4">Editor Test</h1>
      <Editor content={content} onChange={setContent} />
    </div>
  )
}
