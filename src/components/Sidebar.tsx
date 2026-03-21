'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/diary', icon: '📓', label: '日记' },
  { href: '/weekly', icon: '📋', label: '周记' },
  { href: '/notes', icon: '📝', label: '笔记' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) setCollapsed(JSON.parse(saved))
  }, [])

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed)
    document.body.classList.toggle('sidebar-expanded', !collapsed)
  }, [collapsed])

  const toggle = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(!prev))
      return !prev
    })
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-100 flex flex-col transition-all duration-200 z-10 ${
        collapsed ? 'w-14' : 'w-[180px]'
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="text-xl">🎋</span>
        {!collapsed && (
          <span className="text-[17px] font-semibold text-gray-800">Will Daily</span>
        )}
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                active
                  ? 'bg-[#eef5ee] text-[#3a7a4f] font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="text-[15px]">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 mb-1">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
            pathname === '/settings'
              ? 'bg-[#eef5ee] text-[#3a7a4f] font-medium'
              : 'text-gray-400 hover:bg-gray-50'
          }`}
        >
          <span className="text-[15px]">⚙️</span>
          {!collapsed && <span>设置</span>}
        </Link>
      </div>

      {!collapsed && (
        <div className="text-center py-3 border-t border-gray-50">
          <span className="text-[11px] text-gray-300 tracking-wider">🌿 日拱一卒</span>
        </div>
      )}

      <button
        onClick={toggle}
        className="text-gray-300 hover:text-gray-500 text-sm py-2 transition-colors"
      >
        {collapsed ? '››' : '‹‹'}
      </button>
    </aside>
  )
}
