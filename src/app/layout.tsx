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
        <main className="main-content min-h-screen bg-white transition-all duration-200 flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="py-4 text-center text-[11px] text-gray-400 border-t border-gray-50">
            <a
              href="https://beian.miit.gov.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition-colors"
            >
              京ICP备2026017980号-1
            </a>
          </footer>
        </main>
      </body>
    </html>
  )
}
