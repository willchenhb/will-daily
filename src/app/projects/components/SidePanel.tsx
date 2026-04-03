'use client'

import { useState, useEffect } from 'react'
import {
  OKR_OPTIONS, OKR_MEMBERS, CATEGORIES, STATUS_OPTIONS, PRIORITY_OPTIONS,
  MILESTONE_STATUS_OPTIONS, RISK_LEVEL_OPTIONS,
  riskColor, riskLabel, milestoneStatusDot, formatDate,
  type Project, type TeamMember, type Milestone,
} from '../constants'
import ConfirmDialog from './ConfirmDialog'

interface SidePanelProps {
  project: Project
  teamMembers: TeamMember[]
  onClose: () => void
  onUpdated: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

export default function SidePanel({ project: initialProject, teamMembers, onClose, onUpdated, onToast }: SidePanelProps) {
  const [project, setProject] = useState<Project>(initialProject)
  const [detail, setDetail] = useState<Project | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldValue, setFieldValue] = useState('')
  const [newMilestone, setNewMilestone] = useState('')
  const [newRisk, setNewRisk] = useState('')
  const [editingMilestone, setEditingMilestone] = useState<number | null>(null)
  const [milestoneEdit, setMilestoneEdit] = useState<Partial<Milestone>>({})
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'milestone' | 'risk'; id: number; name: string } | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${initialProject.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setDetail(d); setProject(d) } })
      .catch(() => {})
  }, [initialProject.id])

  const proj = detail ?? project

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

  const updateRisk = async (rid: number, field: string, value: string) => {
    try {
      await fetch(`/api/projects/${proj.id}/risks/${rid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      refreshDetail()
    } catch {
      onToast('更新失败', 'error')
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

  const InlineField = ({ field, label, value, type = 'text', multiline = false }: { field: string; label: string; value: string; type?: string; multiline?: boolean }) => (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-[12px] text-gray-400 w-20 flex-shrink-0 pt-0.5">{label}</span>
      {editingField === field ? (
        multiline ? (
          <textarea
            autoFocus
            value={fieldValue}
            onChange={e => setFieldValue(e.target.value)}
            onBlur={() => saveField(field, fieldValue)}
            onKeyDown={e => {
              if (e.key === 'Escape') setEditingField(null)
            }}
            rows={3}
            className="flex-1 text-[13px] border border-[#c5d9c5] rounded outline-none bg-transparent py-1 px-1 resize-none"
          />
        ) : (
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
        )
      ) : (
        <span
          onClick={() => startEdit(field, value)}
          className="flex-1 text-[13px] text-gray-700 cursor-text hover:text-[#3a7a4f] transition-colors min-h-[20px] whitespace-pre-wrap"
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

  const handleConfirmDelete = () => {
    if (!confirmDelete) return
    if (confirmDelete.type === 'milestone') deleteMilestone(confirmDelete.id)
    else deleteRisk(confirmDelete.id)
    setConfirmDelete(null)
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />

      <div className="fixed right-0 top-0 h-screen w-full md:w-[480px] bg-white border-l border-gray-100 shadow-xl z-40 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-800">{proj.name}</h2>
            {proj.code && <span className="text-[11px] text-gray-400">{proj.code}</span>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="bg-[#f8faf8] border border-gray-100 rounded-lg px-4 py-2 mb-5">
            <InlineField field="name" label="项目名称" value={proj.name} />
            <InlineField field="code" label="项目编号" value={proj.code ?? ''} />
            <InlineField field="description" label="项目描述" value={proj.description ?? ''} multiline />
            <SelectField field="category" label="分类" value={proj.category} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
            <SelectField field="owner" label="负责人" value={proj.owner} options={Array.from(new Set([...OKR_MEMBERS, ...teamMembers.map(m => m.name), proj.owner].filter(Boolean))).map(n => ({ value: n, label: n }))} />
            <SelectField field="status" label="状态" value={proj.status} options={STATUS_OPTIONS} />
            <SelectField field="priority" label="优先级" value={proj.priority} options={PRIORITY_OPTIONS} />
            <InlineField field="startDate" label="开始日期" value={proj.startDate ? formatDate(proj.startDate) : ''} type="date" />
            <InlineField field="targetEndDate" label="截止日期" value={proj.targetEndDate ? formatDate(proj.targetEndDate) : ''} type="date" />
            <div className="flex flex-col gap-1 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-gray-400 w-20 flex-shrink-0">OKR 目标</span>
                <select
                  value={proj.okrObjectiveId ?? ''}
                  onChange={e => saveField('okrObjectiveId', e.target.value)}
                  className="flex-1 text-[13px] border-none outline-none bg-transparent text-gray-700 cursor-pointer hover:text-[#3a7a4f] min-w-0"
                >
                  <option value="">未关联</option>
                  {OKR_OPTIONS.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map(o => (
                        <option key={o.id} value={o.id}>{o.id}：{o.text}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {proj.okrObjectiveId && (() => {
                const okr = OKR_OPTIONS.flatMap(g => g.items).find(o => o.id === proj.okrObjectiveId)
                return okr ? (
                  <p className="text-[12px] text-gray-500 pl-[88px] leading-relaxed break-words">
                    {okr.id}：{okr.text}
                  </p>
                ) : null
              })()}
            </div>
          </div>

          {/* Milestones */}
          <div className="mb-5">
            <h3 className="text-[13px] font-medium text-gray-700 mb-3">里程碑</h3>
            {milestones.length > 0 ? (
              <div className="relative">
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
                            onClick={() => setConfirmDelete({ type: 'milestone', id: m.id, name: m.title })}
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
                      <div className="flex gap-1.5 mt-1.5">
                        <span className="text-[10px] text-gray-400 leading-[24px]">概率:</span>
                        <select
                          value={r.probability}
                          onChange={e => updateRisk(r.id, 'probability', e.target.value)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border-none outline-none cursor-pointer ${riskColor(r.probability)}`}
                        >
                          {RISK_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span className="text-[10px] text-gray-400 leading-[24px] ml-1">影响:</span>
                        <select
                          value={r.impact}
                          onChange={e => updateRisk(r.id, 'impact', e.target.value)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border-none outline-none cursor-pointer ${riskColor(r.impact)}`}
                        >
                          {RISK_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDelete({ type: 'risk', id: r.id, name: r.description })}
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

      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.type === 'milestone' ? '删除里程碑' : '删除风险'}
          message={`确定要删除「${confirmDelete.name}」吗？此操作不可撤销。`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}
