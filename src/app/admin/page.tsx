'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  username: string
  role: string
  apiToken: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

function maskToken(token: string): string {
  if (token.length <= 8) return '****'
  return token.slice(0, 4) + '****' + token.slice(-4)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<{ id: number; role: string } | null>(null)

  // New user form
  const [showForm, setShowForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [formLoading, setFormLoading] = useState(false)

  // Edit password
  const [editPasswordId, setEditPasswordId] = useState<number | null>(null)
  const [editPasswordValue, setEditPasswordValue] = useState('')

  // Revealed tokens
  const [revealedTokens, setRevealedTokens] = useState<Set<number>>(new Set())

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.status === 403) {
        router.push('/diary')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [router])

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setCurrentUser(data.user)
        if (data.user.role !== 'admin') {
          router.push('/diary')
        }
      }
    } catch {
      // ignore
    }
  }, [router])

  useEffect(() => {
    fetchCurrentUser()
    fetchUsers()
  }, [fetchCurrentUser, fetchUsers])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create user')
        return
      }

      setShowForm(false)
      setNewUsername('')
      setNewPassword('')
      setNewRole('user')
      await fetchUsers()
    } catch {
      setError('Network error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (res.ok) await fetchUsers()
    } catch {
      setError('Failed to update user')
    }
  }

  const handleChangeRole = async (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) await fetchUsers()
    } catch {
      setError('Failed to update role')
    }
  }

  const handleResetPassword = async (userId: number) => {
    if (!editPasswordValue.trim()) return
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: editPasswordValue }),
      })
      if (res.ok) {
        setEditPasswordId(null)
        setEditPasswordValue('')
      }
    } catch {
      setError('Failed to reset password')
    }
  }

  const handleRegenerateToken = async (userId: number) => {
    if (!confirm('确定要重新生成 API Token 吗？旧 Token 将立即失效。')) return
    try {
      const res = await fetch(`/api/admin/users/${userId}/regenerate-token`, {
        method: 'POST',
      })
      if (res.ok) await fetchUsers()
    } catch {
      setError('Failed to regenerate token')
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`确定要删除用户「${user.username}」吗？此操作不可恢复。`)) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete user')
        return
      }
      await fetchUsers()
    } catch {
      setError('Failed to delete user')
    }
  }

  const toggleTokenReveal = (userId: number) => {
    setRevealedTokens(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">用户管理</h1>
          <p className="text-sm text-gray-400 mt-1">管理系统用户和 API Token</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#3a7a4f] text-white text-sm rounded-lg hover:bg-[#2d6340] transition-colors"
        >
          {showForm ? '取消' : '添加用户'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">
            x
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreateUser} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">用户名</label>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#3a7a4f] focus:ring-1 focus:ring-[#3a7a4f] outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#3a7a4f] focus:ring-1 focus:ring-[#3a7a4f] outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">角色</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#3a7a4f] focus:ring-1 focus:ring-[#3a7a4f] outline-none bg-white"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={formLoading}
              className="px-4 py-2 bg-[#3a7a4f] text-white text-sm rounded-lg hover:bg-[#2d6340] disabled:opacity-50 transition-colors"
            >
              {formLoading ? '创建中...' : '创建用户'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">用户名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">角色</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">API Token</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">状态</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">创建时间</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {u.username}
                  {currentUser?.id === u.id && (
                    <span className="ml-1.5 text-xs text-[#3a7a4f] bg-[#eef5ee] px-1.5 py-0.5 rounded">
                      me
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.role === 'admin'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded cursor-pointer" onClick={() => toggleTokenReveal(u.id)}>
                    {revealedTokens.has(u.id) ? u.apiToken : maskToken(u.apiToken)}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${u.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {u.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {editPasswordId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="password"
                          value={editPasswordValue}
                          onChange={e => setEditPasswordValue(e.target.value)}
                          placeholder="新密码"
                          className="w-24 px-2 py-1 text-xs border border-gray-200 rounded focus:border-[#3a7a4f] outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          className="text-xs text-[#3a7a4f] hover:text-[#2d6340]"
                        >
                          确定
                        </button>
                        <button
                          onClick={() => { setEditPasswordId(null); setEditPasswordValue('') }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleChangeRole(u)}
                          className="text-xs text-gray-400 hover:text-[#3a7a4f] px-1.5 py-1"
                          title={u.role === 'admin' ? '降为 User' : '升为 Admin'}
                        >
                          {u.role === 'admin' ? '降级' : '升级'}
                        </button>
                        <button
                          onClick={() => { setEditPasswordId(u.id); setEditPasswordValue('') }}
                          className="text-xs text-gray-400 hover:text-[#3a7a4f] px-1.5 py-1"
                          title="重置密码"
                        >
                          改密
                        </button>
                        <button
                          onClick={() => handleRegenerateToken(u.id)}
                          className="text-xs text-gray-400 hover:text-[#3a7a4f] px-1.5 py-1"
                          title="重新生成 API Token"
                        >
                          重置Token
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`text-xs px-1.5 py-1 ${
                            u.isActive
                              ? 'text-gray-400 hover:text-amber-500'
                              : 'text-gray-400 hover:text-green-600'
                          }`}
                          title={u.isActive ? '禁用' : '启用'}
                        >
                          {u.isActive ? '禁用' : '启用'}
                        </button>
                        {currentUser?.id !== u.id && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1"
                            title="删除用户"
                          >
                            删除
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            暂无用户
          </div>
        )}
      </div>
    </div>
  )
}
