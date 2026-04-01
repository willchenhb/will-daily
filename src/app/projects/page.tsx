'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Toast from '@/components/Toast'
import Loading from '@/components/Loading'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamMember {
  id: number
  name: string
}

interface Milestone {
  id: number
  title: string
  dueDate: string | null
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
}

interface Risk {
  id: number
  description: string
  probability: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
}

interface Project {
  id: number
  name: string
  code: string | null
  category: string
  owner: string
  status: 'planning' | 'in_progress' | 'paused' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  startDate: string | null
  targetEndDate: string | null
  okrObjectiveId: string | null
  milestones?: Milestone[]
  risks?: Risk[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['产品交付', '商业化', '平台建设', '技术攻关', '组织管理']

const STATUS_OPTIONS = [
  { value: 'planning', label: '规划中' },
  { value: 'in_progress', label: '进行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'completed', label: '已完成' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
]

const MILESTONE_STATUS_OPTIONS = [
  { value: 'not_started', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'delayed', label: '已延误' },
]

const CSV_COLUMN_MAP: Record<string, string> = {
  '项目名称': 'name', '名称': 'name', 'name': 'name',
  '类别': 'category', '分类': 'category', 'category': 'category',
  '负责人': 'owner', 'owner': 'owner',
  '状态': 'status', 'status': 'status',
  '优先级': 'priority', 'priority': 'priority',
  '开始日期': 'startDate', '开始时间': 'startDate',
  '截止日期': 'targetEndDate', '结束日期': 'targetEndDate', '截止时间': 'targetEndDate',
  'OKR': 'okrObjectiveId', 'okr': 'okrObjectiveId',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusLabel(status: Project['status']): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.label ?? status
}

function riskColor(level: 'low' | 'medium' | 'high'): string {
  if (level === 'low') return 'bg-green-50 text-green-700'
  if (level === 'medium') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

function riskLabel(level: 'low' | 'medium' | 'high'): string {
  if (level === 'low') return '低'
  if (level === 'medium') return '中'
  return '高'
}

function computeHealth(project: Project): 'green' | 'yellow' | 'red' {
  const risks = project.risks ?? []
  const milestones = project.milestones ?? []
  const hasHighRisk = risks.some(r => r.probability === 'high' && r.impact === 'high')
  const delayedCount = milestones.filter(m => m.status === 'delayed').length
  if (hasHighRisk || delayedCount >= 2) return 'red'
  if (delayedCount >= 1 || risks.some(r => r.probability === 'high' || r.impact === 'high')) return 'yellow'
  return 'green'
}

function healthDot(h: 'green' | 'yellow' | 'red') {
  const cls = h === 'green' ? 'bg-green-500' : h === 'yellow' ? 'bg-amber-400' : 'bg-red-500'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />
}

function progressPercent(project: Project): number {
  const ms = project.milestones ?? []
  if (ms.length === 0) return 0
  return Math.round((ms.filter(m => m.status === 'completed').length / ms.length) * 100)
}

function milestoneStatusDot(status: Milestone['status']) {
  if (status === 'completed') return <span className="w-3 h-3 rounded-full bg-[#3a7a4f] flex-shrink-0 inline-block" />
  if (status === 'in_progress') return <span className="w-3 h-3 rounded-full border-2 border-[#3a7a4f] flex-shrink-0 inline-block" />
  if (status === 'delayed') return <span className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0 inline-block" />
  return <span className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0 inline-block" />
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// ─── New Project Modal ────────────────────────────────────────────────────────

interface NewProjectModalProps {
  teamMembers: TeamMember[]
  onClose: () => void
  onCreated: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

function NewProjectModal({ teamMembers, onClose, onCreated, onToast }: NewProjectModalProps) {
  const [form, setForm] = useState({
    name: '',
    category: CATEGORIES[0],
    owner: teamMembers[0]?.name ?? '',
    priority: 'medium',
    startDate: '',
    targetEndDate: '',
    okrObjectiveId: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { onToast('请填写项目名称', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          startDate: form.startDate || null,
          targetEndDate: form.targetEndDate || null,
          okrObjectiveId: form.okrObjectiveId || null,
        }),
      })
      if (!res.ok) throw new Error('创建失败')
      onToast('项目已创建', 'success')
      onCreated()
      onClose()
    } catch {
      onToast('创建失败', 'error')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-gray-100 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800 mb-5">新建项目</h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[12px] text-gray-500 mb-1 block">项目名称 *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="项目名称..."
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block">分类</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f] bg-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block">负责人</label>
              <select
                value={form.owner}
                onChange={e => set('owner', e.target.value)}
                className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f] bg-white"
              >
                {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                {teamMembers.length === 0 && <option value="">-</option>}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[12px] text-gray-500 mb-1 block">优先级</label>
            <select
              value={form.priority}
              onChange={e => set('priority', e.target.value)}
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f] bg-white"
            >
              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block">开始日期</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
                className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f]"
              />
            </div>
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block">截止日期</label>
              <input
                type="date"
                value={form.targetEndDate}
                onChange={e => set('targetEndDate', e.target.value)}
                className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f]"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] text-gray-500 mb-1 block">OKR 目标 ID（选填）</label>
            <input
              value={form.okrObjectiveId}
              onChange={e => set('okrObjectiveId', e.target.value)}
              placeholder="关联 OKR..."
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="text-[13px] text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-[13px] text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] rounded-lg px-5 py-2 disabled:opacity-50"
          >
            {saving ? '创建中...' : '创建项目'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

interface CsvImportModalProps {
  onClose: () => void
  onImported: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

function CsvImportModal({ onClose, onImported, onToast }: CsvImportModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [colMap, setColMap] = useState<Record<string, string>>({})
  const [importing, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const parseCSV = async (text: string) => {
    let parsed: { data: string[][] } = { data: [] }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Papa = await (new Function('m', 'return import(m)'))('papaparse') as { default: { parse: (t: string, opts: Record<string, unknown>) => { data: string[][] } } }
      const result = Papa.default.parse(text, { skipEmptyLines: true })
      parsed = result as { data: string[][] }
    } catch {
      // Manual fallback: split by newlines and commas
      const lines = text.split('\n').filter(l => l.trim())
      parsed = { data: lines.map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, ''))) }
    }
    const data = parsed.data as string[][]
    if (data.length < 2) { onToast('CSV 格式无效', 'error'); return }
    const hdrs = data[0]
    const dataRows = data.slice(1).map(row => {
      const obj: Record<string, string> = {}
      hdrs.forEach((h, i) => { obj[h] = row[i] ?? '' })
      return obj
    })
    setHeaders(hdrs)
    setRows(dataRows)
    // Auto-detect column mapping
    const map: Record<string, string> = {}
    hdrs.forEach(h => {
      const mapped = CSV_COLUMN_MAP[h.trim()]
      if (mapped) map[h] = mapped
    })
    setColMap(map)
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => parseCSV(e.target?.result as string)
    reader.readAsText(file, 'utf-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setSaving(true)
    try {
      const projects = rows.map(row => {
        const obj: Record<string, string> = {}
        headers.forEach(h => {
          const field = colMap[h]
          if (field) obj[field] = row[h] ?? ''
        })
        return obj
      })
      const res = await fetch('/api/projects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects }),
      })
      if (!res.ok) throw new Error('导入失败')
      onToast(`已导入 ${rows.length} 个项目`, 'success')
      onImported()
      onClose()
    } catch {
      onToast('导入失败', 'error')
    }
    setSaving(false)
  }

  const FIELD_OPTIONS = ['', 'name', 'category', 'owner', 'status', 'priority', 'startDate', 'targetEndDate', 'okrObjectiveId']
  const FIELD_LABELS: Record<string, string> = {
    name: '项目名称', category: '分类', owner: '负责人', status: '状态',
    priority: '优先级', startDate: '开始日期', targetEndDate: '截止日期', okrObjectiveId: 'OKR ID',
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-gray-100 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800 mb-5">导入 CSV</h2>

        {rows.length === 0 ? (
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center cursor-pointer hover:border-[#3a7a4f] transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-3xl mb-3">📂</div>
            <p className="text-[13px] text-gray-500 mb-1">拖拽 CSV 文件到此处，或点击选择</p>
            <p className="text-[12px] text-gray-300">支持 UTF-8 编码的 CSV 文件</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="text-[13px] font-medium text-gray-700 mb-3">列映射</h3>
              <div className="grid grid-cols-2 gap-2">
                {headers.map(h => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-[12px] text-gray-500 w-24 truncate">{h}</span>
                    <span className="text-gray-300 text-xs">→</span>
                    <select
                      value={colMap[h] ?? ''}
                      onChange={e => setColMap(m => ({ ...m, [h]: e.target.value }))}
                      className="flex-1 text-[12px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#3a7a4f] bg-white"
                    >
                      {FIELD_OPTIONS.map(f => (
                        <option key={f} value={f}>{f ? FIELD_LABELS[f] : '忽略'}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <h3 className="text-[13px] font-medium text-gray-700 mb-2">预览（前5行）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {headers.map(h => (
                        <th key={h} className="text-left py-1.5 px-2 text-gray-400 font-normal whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {headers.map(h => (
                          <td key={h} className="py-1.5 px-2 text-gray-600 truncate max-w-[120px]">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-300 mt-1">共 {rows.length} 行数据</p>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="text-[13px] text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">
            取消
          </button>
          {rows.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="text-[13px] text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] rounded-lg px-5 py-2 disabled:opacity-50"
            >
              {importing ? '导入中...' : `导入 ${rows.length} 个项目`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

interface SidePanelProps {
  project: Project
  teamMembers: TeamMember[]
  onClose: () => void
  onUpdated: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

function SidePanel({ project: initialProject, teamMembers, onClose, onUpdated, onToast }: SidePanelProps) {
  const [project, setProject] = useState<Project>(initialProject)
  const [detail, setDetail] = useState<Project | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldValue, setFieldValue] = useState('')
  const [newMilestone, setNewMilestone] = useState('')
  const [newRisk, setNewRisk] = useState('')
  const [editingMilestone, setEditingMilestone] = useState<number | null>(null)
  const [milestoneEdit, setMilestoneEdit] = useState<Partial<Milestone>>({})

  // Load detail
  useEffect(() => {
    fetch(`/api/projects/${initialProject.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setDetail(d); setProject(d) } })
      .catch(() => {})
  }, [initialProject.id])

  const proj = detail ?? project

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const saveField = async (field: string, value: string) => {
    try {
      const res = await fetch(`/api/projects/${proj.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setDetail(updated)
      setProject(updated)
      onUpdated()
    } catch {
      onToast('保存失败', 'error')
    }
    setEditingField(null)
  }

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field)
    setFieldValue(currentValue)
  }

  const addMilestone = async () => {
    if (!newMilestone.trim()) return
    try {
      await fetch(`/api/projects/${proj.id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newMilestone.trim() }),
      })
      setNewMilestone('')
      refreshDetail()
    } catch {
      onToast('添加失败', 'error')
    }
  }

  const updateMilestone = async (mid: number, data: Partial<Milestone>) => {
    try {
      await fetch(`/api/projects/${proj.id}/milestones/${mid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setEditingMilestone(null)
      refreshDetail()
    } catch {
      onToast('更新失败', 'error')
    }
  }

  const deleteMilestone = async (mid: number) => {
    try {
      await fetch(`/api/projects/${proj.id}/milestones/${mid}`, { method: 'DELETE' })
      refreshDetail()
    } catch {
      onToast('删除失败', 'error')
    }
  }

  const addRisk = async () => {
    if (!newRisk.trim()) return
    try {
      await fetch(`/api/projects/${proj.id}/risks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newRisk.trim(), probability: 'medium', impact: 'medium' }),
      })
      setNewRisk('')
      refreshDetail()
    } catch {
      onToast('添加失败', 'error')
    }
  }

  const deleteRisk = async (rid: number) => {
    try {
      await fetch(`/api/projects/${proj.id}/risks/${rid}`, { method: 'DELETE' })
      refreshDetail()
    } catch {
      onToast('删除失败', 'error')
    }
  }

  const refreshDetail = () => {
    fetch(`/api/projects/${proj.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setDetail(d); setProject(d) } })
      .catch(() => {})
    onUpdated()
  }

  const milestones = proj.milestones ?? []
  const risks = proj.risks ?? []

  const InlineField = ({ field, label, value, type = 'text' }: { field: string; label: string; value: string; type?: string }) => (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-[12px] text-gray-400 w-20 flex-shrink-0 pt-0.5">{label}</span>
      {editingField === field ? (
        <input
          type={type}
          autoFocus
          value={fieldValue}
          onChange={e => setFieldValue(e.target.value)}
          onBlur={() => saveField(field, fieldValue)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveField(field, fieldValue)
            if (e.key === 'Escape') setEditingField(null)
          }}
          className="flex-1 text-[13px] border-b border-[#c5d9c5] outline-none bg-transparent py-0.5"
        />
      ) : (
        <span
          onClick={() => startEdit(field, value)}
          className="flex-1 text-[13px] text-gray-700 cursor-text hover:text-[#3a7a4f] transition-colors min-h-[20px]"
        >
          {value || <span className="text-gray-300">点击编辑...</span>}
        </span>
      )}
    </div>
  )

  const SelectField = ({ field, label, value, options }: { field: string; label: string; value: string; options: { value: string; label: string }[] }) => (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-[12px] text-gray-400 w-20 flex-shrink-0">{label}</span>
      <select
        value={value}
        onChange={e => saveField(field, e.target.value)}
        className="flex-1 text-[13px] border-none outline-none bg-transparent text-gray-700 cursor-pointer hover:text-[#3a7a4f]"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-full md:w-[420px] bg-white border-l border-gray-100 shadow-xl z-40 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-800">{proj.name}</h2>
            {proj.code && <span className="text-[11px] text-gray-400">{proj.code}</span>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Fields */}
          <div className="bg-[#f8faf8] border border-gray-100 rounded-lg px-4 py-2 mb-5">
            <InlineField field="name" label="项目名称" value={proj.name} />
            <InlineField field="code" label="项目编号" value={proj.code ?? ''} />
            <SelectField field="category" label="分类" value={proj.category} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
            <SelectField field="owner" label="负责人" value={proj.owner} options={teamMembers.map(m => ({ value: m.name, label: m.name }))} />
            <SelectField field="status" label="状态" value={proj.status} options={STATUS_OPTIONS} />
            <SelectField field="priority" label="优先级" value={proj.priority} options={PRIORITY_OPTIONS} />
            <InlineField field="startDate" label="开始日期" value={proj.startDate ? formatDate(proj.startDate) : ''} type="date" />
            <InlineField field="targetEndDate" label="截止日期" value={proj.targetEndDate ? formatDate(proj.targetEndDate) : ''} type="date" />
            <InlineField field="okrObjectiveId" label="OKR 目标" value={proj.okrObjectiveId ?? ''} />
          </div>

          {/* Milestones */}
          <div className="mb-5">
            <h3 className="text-[13px] font-medium text-gray-700 mb-3">里程碑</h3>
            {milestones.length > 0 ? (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gray-100" />
                <div className="flex flex-col gap-3 pl-6">
                  {milestones.map(m => (
                    <div key={m.id} className="group relative">
                      <div className="absolute -left-6 top-0.5">{milestoneStatusDot(m.status)}</div>
                      {editingMilestone === m.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            autoFocus
                            value={milestoneEdit.title ?? m.title}
                            onChange={e => setMilestoneEdit(prev => ({ ...prev, title: e.target.value }))}
                            className="text-[13px] border-b border-[#c5d9c5] outline-none bg-transparent"
                          />
                          <div className="flex gap-2">
                            <select
                              value={milestoneEdit.status ?? m.status}
                              onChange={e => setMilestoneEdit(prev => ({ ...prev, status: e.target.value as Milestone['status'] }))}
                              className="text-[12px] border border-gray-200 rounded px-2 py-1 bg-white outline-none"
                            >
                              {MILESTONE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <input
                              type="date"
                              value={milestoneEdit.dueDate ?? m.dueDate ?? ''}
                              onChange={e => setMilestoneEdit(prev => ({ ...prev, dueDate: e.target.value }))}
                              className="text-[12px] border border-gray-200 rounded px-2 py-1 outline-none flex-1"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => updateMilestone(m.id, milestoneEdit)} className="text-[11px] text-[#3a7a4f] hover:text-[#2d6b3f]">保存</button>
                            <button onClick={() => setEditingMilestone(null)} className="text-[11px] text-gray-400 hover:text-gray-600">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div
                            onClick={() => { setEditingMilestone(m.id); setMilestoneEdit({}) }}
                            className="flex-1 cursor-pointer"
                          >
                            <p className={`text-[13px] hover:text-[#3a7a4f] transition-colors ${m.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {m.title}
                            </p>
                            {m.dueDate && <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(m.dueDate)}</p>}
                          </div>
                          <button
                            onClick={() => deleteMilestone(m.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs flex-shrink-0 transition-opacity"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-gray-300 text-center py-3">暂无里程碑</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <input
                value={newMilestone}
                onChange={e => setNewMilestone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMilestone()}
                placeholder="+ 添加里程碑..."
                className="flex-1 text-[13px] text-gray-500 placeholder-gray-300 border-none outline-none bg-transparent"
              />
              {newMilestone && (
                <button onClick={addMilestone} className="text-[12px] text-[#3a7a4f]">添加</button>
              )}
            </div>
          </div>

          {/* Risks */}
          <div className="mb-4">
            <h3 className="text-[13px] font-medium text-gray-700 mb-3">风险</h3>
            {risks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {risks.map(r => (
                  <div key={r.id} className="group flex items-start gap-2 bg-[#f8faf8] rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-[13px] text-gray-700">{r.description}</p>
                      <div className="flex gap-1.5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${riskColor(r.probability)}`}>
                          概率: {riskLabel(r.probability)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${riskColor(r.impact)}`}>
                          影响: {riskLabel(r.impact)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteRisk(r.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs flex-shrink-0 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-gray-300 text-center py-3">暂无风险记录</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <input
                value={newRisk}
                onChange={e => setNewRisk(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRisk()}
                placeholder="+ 添加风险..."
                className="flex-1 text-[13px] text-gray-500 placeholder-gray-300 border-none outline-none bg-transparent"
              />
              {newRisk && (
                <button onClick={addRisk} className="text-[12px] text-[#3a7a4f]">添加</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索项目名称..."
          className="w-full text-[13px] border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-[#3a7a4f] bg-white"
        />
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      {projects.length === 0 ? (
        <div className="text-center text-gray-300 text-sm py-16">
          {searchDebounced || categoryFilter || statusFilter ? '没有找到匹配的项目' : '还没有项目，点击「新建项目」开始'}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3">项目名称</th>
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3">分类</th>
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3">负责人</th>
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3">截止日</th>
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3 w-32">进度</th>
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3">风险</th>
                  <th className="text-left text-[12px] text-gray-400 font-normal px-4 py-3">信号灯</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const health = computeHealth(p)
                  const progress = progressPercent(p)
                  const isHighRisk = health === 'red'
                  const maxRisk = p.risks && p.risks.length > 0
                    ? p.risks.reduce((max, r) => {
                        const score = (r.probability === 'high' ? 3 : r.probability === 'medium' ? 2 : 1) +
                                      (r.impact === 'high' ? 3 : r.impact === 'medium' ? 2 : 1)
                        return score > max.score ? { score, r } : max
                      }, { score: 0, r: p.risks[0] }).r
                    : null

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
                        {maxRisk ? (
                          <span className={`text-[11px] px-2 py-0.5 rounded ${riskColor(maxRisk.probability)}`}>
                            {riskLabel(maxRisk.probability)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-300">-</span>
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
            {projects.map(p => {
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
