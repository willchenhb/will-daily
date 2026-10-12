'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { OPEN_SEARCH_EVENT } from './SearchPalette'
import { BOOKMARKS_EVENT, fetchBookmarks, type Bookmark } from '@/lib/bookmarks'

const openSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))

const navItems = [
  { href: '/digest', icon: '📰', label: '导读' },
  { href: '/diary', icon: '📓', label: '日记' },
  { href: '/weekly', icon: '📋', label: '周记' },
  { href: '/notes', icon: '📝', label: '笔记' },
  { href: '/tags', icon: '🏷️', label: '标签' },
  { href: '/curated', icon: '⭐', label: '精选' },
  { href: '/materials', icon: '📁', label: '资料' },
  { href: '/graph', icon: '🕸️', label: '图谱' },
]

interface AuthUser {
  id: number
  username: string
  role: string
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authEnabled, setAuthEnabled] = useState(false)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) setCollapsed(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if (!isMobile) {
      document.body.classList.toggle('sidebar-collapsed', collapsed)
      document.body.classList.toggle('sidebar-expanded', !collapsed)
    }
  }, [collapsed, isMobile])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Fetch auth user info (skip on login page)
  useEffect(() => {
    if (pathname === '/login') return
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) {
          setAuthEnabled(true)
          return res.json()
        }
        if (res.status === 401) {
          setAuthEnabled(true)
          setAuthUser(null)
        }
        return null
      })
      .then(data => {
        if (data?.user) setAuthUser(data.user)
      })
      .catch(() => {})
  }, [pathname])

  // 收藏: reload on navigation and whenever a note is (un)bookmarked
  useEffect(() => {
    if (pathname === '/login') return
    const load = () => { fetchBookmarks().then(setBookmarks).catch(() => {}) }
    load()
    window.addEventListener(BOOKMARKS_EVENT, load)
    return () => window.removeEventListener(BOOKMARKS_EVENT, load)
  }, [pathname])

  const bookmarkList = (onNavigate?: () => void) => bookmarks.length > 0 && (
    <div className="px-2 mt-3">
      <div className="px-3 pb-1 text-[10px] text-gray-300 tracking-wider">★ 收藏</div>
      {bookmarks.slice(0, 10).map(b => (
        <Link
          key={b.id}
          href={`/notes/${b.id}`}
          onClick={onNavigate}
          title={b.title}
          className={`block truncate px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
            pathname === `/notes/${b.id}` ? 'bg-[#eef5ee] text-[#3a7a4f]' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          {b.title || '无标题'}
        </Link>
      ))}
    </div>
  )

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthUser(null)
    router.push('/login')
    router.refresh()
  }

  const toggle = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(!prev))
      return !prev
    })
  }

  const closeMobile = useCallback(() => {
    setMobileOpen(false)
  }, [])

  // Hide sidebar on login page
  if (pathname === '/login') return null

  // Mobile: top bar + overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Fixed top bar */}
        <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 flex items-center px-4 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-600 text-xl mr-3"
            aria-label="打开菜单"
          >
            ☰
          </button>
          <span className="text-xl">🎋</span>
          <span className="text-[17px] font-semibold text-gray-800 ml-2">Will Daily</span>
          <button
            onClick={openSearch}
            className="ml-auto text-gray-400 text-lg"
            aria-label="搜索"
          >
            🔍
          </button>
        </div>

        {/* Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30"
            onClick={closeMobile}
          />
        )}

        {/* Slide-in sidebar */}
        <aside
          className={`fixed left-0 top-0 h-screen w-[220px] bg-white border-r border-gray-100 flex flex-col z-40 transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center gap-2 px-4 py-5">
            <span className="text-xl">🎋</span>
            <span className="text-[17px] font-semibold text-gray-800">Will Daily</span>
          </div>

          <nav className="flex-1 flex flex-col gap-1 px-2">
            {navItems.map(item => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobile}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                    active
                      ? 'bg-[#eef5ee] text-[#3a7a4f] font-medium'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[15px]">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
            {bookmarkList(closeMobile)}
          </nav>

          <div className="px-2 mb-1">
            <Link
              href="/help"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                pathname === '/help'
                  ? 'bg-[#eef5ee] text-[#3a7a4f] font-medium'
                  : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              <span className="text-[15px]">❓</span>
              <span>说明</span>
            </Link>
            <Link
              href="/settings"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                pathname === '/settings'
                  ? 'bg-[#eef5ee] text-[#3a7a4f] font-medium'
                  : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              <span className="text-[15px]">⚙️</span>
              <span>设置</span>
            </Link>
          </div>

          {authEnabled && authUser && (
            <div className="px-2 mb-1 space-y-1">
              {authUser.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={closeMobile}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                    pathname === '/admin'
                      ? 'bg-[#eef5ee] text-[#3a7a4f] font-medium'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[15px]">👤</span>
                  <span>管理</span>
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-gray-400 hover:bg-gray-50 transition-colors"
              >
                <span className="text-[15px]">🚪</span>
                <span>退出 ({authUser.username})</span>
              </button>
            </div>
          )}

          <div className="text-center py-3 border-t border-gray-50">
            <span className="text-[11px] text-gray-300 tracking-wider">🌿 日拱一卒</span>
          </div>
        </aside>
      </>
    )
  }

  // Desktop: existing collapsible sidebar
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

      <div className="px-2 mb-1">
        <button
          onClick={openSearch}
          title="搜索 (⌘K)"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-400 border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <span className="text-[13px]">🔍</span>
          {!collapsed && (
            <>
              <span>搜索</span>
              <kbd className="ml-auto text-[10px] text-gray-300">⌘K</kbd>
            </>
          )}
        </button>
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
        {!collapsed && bookmarkList()}
      </nav>

      <div className="px-2 mb-1">
        <Link
          href="/help"
          title="说明"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
            pathname === '/help'
              ? 'bg-[#eef5ee] text-[#3a7a4f] font-medium'
              : 'text-gray-400 hover:bg-gray-50'
          }`}
        >
          <span className="text-[15px]">❓</span>
          {!collapsed && <span>说明</span>}
        </Link>
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

      {authEnabled && authUser && (
        <div className="px-2 mb-1 space-y-1">
          {authUser.role === 'admin' && (
            <Link
              href="/admin"
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                pathname === '/admin'
                  ? 'bg-[#eef5ee] text-[#3a7a4f] font-medium'
                  : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              <span className="text-[15px]">👤</span>
              {!collapsed && <span>管理</span>}
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-gray-400 hover:bg-gray-50 transition-colors"
            title={`退出 ${authUser.username}`}
          >
            <span className="text-[15px]">🚪</span>
            {!collapsed && <span>退出 ({authUser.username})</span>}
          </button>
        </div>
      )}

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
