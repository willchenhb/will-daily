'use client'

import { useState, useEffect, useCallback } from 'react'
import Toast from '@/components/Toast'
import Loading from '@/components/Loading'
import {
  OKR_MEMBERS, CATEGORIES, STATUS_OPTIONS,
  statusLabel, computeHealth, healthDot, progressPercent, formatDate, riskColor, riskLabel,
  type Project, type TeamMember,
} from './constants'
import NewProjectModal from './components/NewProjectModal'
import CsvImportModal from './components/CsvImportModal'
import SidePanel from './components/SidePanel'
import BoardView from './components/BoardView'

// ─── Sorting ─────────────────────────────────────────────────────────────────

type SortField = 'priority' | 'targetEndDate' | 'health' | 'owner' | 'status'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
const STATUS_ORDER: Record<string, number> = { in_progress: 3, planning: 2, paused: 1, completed: 0 }
const HEALTH_ORDER: Record<string, number> = { red: 3, yellow: 2, green: 1 }

function sortProjects(projects: Project[], field: SortField | null, dir: SortDir): Project[] {
  if (!field) return projects
  const sorted = [...projects].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'priority':
        cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0)
        break
      case 'targetEndDate':
        cmp = (a.targetEndDate ?? '9999').localeCompare(b.targetEndDate ?? '9999')
        break
      case 'health':
        cmp = (HEALTH_ORDER[computeHealth(a)] ?? 0) - (HEALTH_ORDER[computeHealth(b)] ?? 0)
        break
      case 'owner':
        cmp = a.owner.localeCompare(b.owner)
        break
      case 'status':
        cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)
        break
    }
    return dir === 'desc' ? -cmp : cmp
  })
  return sorted
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [ownerFilters, setOwnerFilters] = useState<string[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchProjects = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (categoryFilter) params.set('category', categoryFilter)
    if (searchDebounced) params.set('search', searchDebounced)
    const res = await fetch(`/api/projects?${params}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setProjects(data.projects ?? data)
    setLoading(false)
  }, [statusFilter, categoryFilter, searchDebounced])

  const fetchTeamMembers = useCallback(async () => {
    const res = await fetch('/api/team-members')
    if (!res.ok) return
    const data = await res.json()
    setTeamMembers(data.members ?? data)
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchTeamMembers() }, [fetchTeamMembers])

  // Owner filter: apply in frontend
  const filteredProjects = ownerFilters.length > 0
    ? projects.filter(p => ownerFilters.includes(p.owner))
    : projects

  const sortedProjects = sortProjects(filteredProjects, sortField, sortDir)

  // All unique owners for filter pills
  const allOwners = Array.from(new Set([...OKR_MEMBERS, ...projects.map(p => p.owner)].filter(Boolean)))

  const toggleOwnerFilter = (owner: string) => {
    setOwnerFilters(prev =>
      prev.includes(owner) ? prev.filter(o => o !== owner) : [...prev, owner]
    )
  }

  // Sort toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortField(null); setSortDir('asc') }
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-gray-300 ml-0.5">↕</span>
    return <span className="text-[#3a7a4f] ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Board view: status change via drag
  const handleStatusChange = async (projectId: number, newStatus: Project['status']) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      fetchProjects()
    } catch {
      showToast('状态更新失败', 'error')
    }
  }

  // Stats
  const stats = {
    total: projects.length,
    inProgress: projects.filter(p => p.status === 'in_progress').length,
    highRisk: projects.filter(p => computeHealth(p) === 'red').length,
    dueSoon: projects.filter(p => {
      if (!p.targetEndDate) return false
      const diff = new Date(p.targetEndDate).getTime() - Date.now()
      return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000
    }).length,
  }

  if (loading) return <div className="max-w-7xl mx-auto px-8 py-6"><Loading /></div>

  return (
    <div className="max-w-7xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Title bar */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-gray-800">项目管理</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCsvModal(true)}
            className="text-[13px] text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50"
          >
            导入 CSV
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="text-[13px] text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] rounded-lg px-4 py-2"
          >
            + 新建项目
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: '总项目数', value: stats.total },
          { label: '进行中', value: stats.inProgress },
          { label: '高风险', value: stats.highRisk },
          { label: '本周到期', value: stats.dueSoon },
        ].map(s => (
          <div key={s.label} className="bg-[#f8faf8] border border-gray-100 rounded-lg px-4 py-3">
            <div className="text-[22px] font-semibold text-gray-800">{s.value}</div>
            <div className="text-[12px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-[12px] px-3 py-1 rounded-full transition-colors ${!categoryFilter ? 'bg-[#3a7a4f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            全部
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
              className={`text-[12px] px-3 py-1 rounded-full transition-colors ${categoryFilter === c ? 'bg-[#3a7a4f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter(null)}
            className={`text-[12px] px-3 py-1 rounded-full transition-colors ${!statusFilter ? 'bg-[#3a7a4f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            全部
          </button>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(statusFilter === s.value ? null : s.value)}
              className={`text-[12px] px-3 py-1 rounded-full transition-colors ${statusFilter === s.value ? 'bg-[#3a7a4f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Owner pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setOwnerFilters([])}
            className={`text-[12px] px-3 py-1 rounded-full transition-colors ${ownerFilters.length === 0 ? 'bg-[#3a7a4f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            全部负责人
          </button>
          {allOwners.map(o => (
            <button
              key={o}
              onClick={() => toggleOwnerFilter(o)}
              className={`text-[12px] px-3 py-1 rounded-full transition-colors ${ownerFilters.includes(o) ? 'bg-[#3a7a4f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* Search + View toggle */}
      <div className="flex items-center gap-3 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索项目名称..."
          className="flex-1 text-[13px] border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-[#3a7a4f] bg-white"
        />
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`text-[12px] px-3 py-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            表格
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`text-[12px] px-3 py-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            看板
          </button>
        </div>
      </div>

      {/* Content */}
      {sortedProjects.length === 0 ? (
        <div className="text-center text-gray-300 text-sm py-16">
          {searchDebounced || categoryFilter || statusFilter || ownerFilters.length > 0 ? '没有找到匹配的项目' : '还没有项目，点击「新建项目」开始'}
        </div>
      ) : viewMode === 'board' ? (
        <BoardView
          projects={sortedProjects}
          onSelectProject={setSelectedProject}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3">项目名称</th>
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3">分类</th>
                  <th
                    className="text-left text-[12px] text-gray-400 font-normal px-4 py-3 cursor-pointer select-none hover:text-gray-600"
                    onClick={() => toggleSort('owner')}
                  >
                    负责人{sortIcon('owner')}
                  </th>
                  <th
                    className="text-left text-[12px] text-gray-400 font-normal px-4 py-3 cursor-pointer select-none hover:text-gray-600"
                    onClick={() => toggleSort('targetEndDate')}
                  >
                    截止日{sortIcon('targetEndDate')}
                  </th>
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3 w-32">进度</th>
                  <th
                    className="text-left text-[12px] text-gray-400 font-normal px-4 py-3 cursor-pointer select-none hover:text-gray-600"
                    onClick={() => toggleSort('priority')}
                  >
                    优先级{sortIcon('priority')}
                  </th>
                  <th
                    className="text-left text-[12px] text-gray-400 font-normal px-4 py-3 cursor-pointer select-none hover:text-gray-600"
                    onClick={() => toggleSort('health')}
                  >
                    信号灯{sortIcon('health')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map(p => {
                  const health = computeHealth(p)
                  const progress = progressPercent(p)
                  const isHighRisk = health === 'red'
                  const priorityOpt = [
                    { value: 'low', label: '低', cls: 'bg-gray-100 text-gray-500' },
                    { value: 'medium', label: '中', cls: 'bg-blue-50 text-blue-600' },
                    { value: 'high', label: '高', cls: 'bg-amber-50 text-amber-600' },
                    { value: 'critical', label: '紧急', cls: 'bg-red-50 text-red-600' },
                  ].find(o => o.value === p.priority)

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${isHighRisk ? 'border-l-[3px] border-red-400' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium text-gray-700">{p.name}</div>
                        <div className="text-[11px] text-gray-400">{statusLabel(p.status)}</div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">{p.category}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">{p.owner}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-500">{formatDate(p.targetEndDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#3a7a4f] rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-gray-400 w-7 text-right">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {priorityOpt && (
                          <span className={`text-[11px] px-2 py-0.5 rounded ${priorityOpt.cls}`}>
                            {priorityOpt.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{healthDot(health)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {sortedProjects.map(p => {
              const health = computeHealth(p)
              const progress = progressPercent(p)
              const isHighRisk = health === 'red'
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className={`bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-sm transition-shadow ${isHighRisk ? 'border-l-[3px] border-red-400' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[13px] font-medium text-gray-800">{p.name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{p.category} · {p.owner}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {healthDot(health)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#3a7a4f] rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-400">{progress}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{statusLabel(p.status)}</span>
                    {p.targetEndDate && (
                      <span className="text-[11px] text-gray-400">{formatDate(p.targetEndDate)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modals */}
      {showNewModal && (
        <NewProjectModal
          teamMembers={teamMembers}
          onClose={() => setShowNewModal(false)}
          onCreated={fetchProjects}
          onToast={showToast}
        />
      )}

      {showCsvModal && (
        <CsvImportModal
          onClose={() => setShowCsvModal(false)}
          onImported={fetchProjects}
          onToast={showToast}
        />
      )}

      {/* Side panel */}
      {selectedProject && (
        <SidePanel
          project={selectedProject}
          teamMembers={teamMembers}
          onClose={() => setSelectedProject(null)}
          onUpdated={fetchProjects}
          onToast={showToast}
        />
      )}
    </div>
  )
}
