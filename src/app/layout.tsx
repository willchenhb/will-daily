import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Will Daily',
  description: '个人日记、周记、笔记',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="font-sans sidebar-expanded">
        <Sidebar />
        <main className="main-content min-h-screen bg-white transition-all duration-200">
          {children}
        </main>
      </body>
    </html>
  )
}
