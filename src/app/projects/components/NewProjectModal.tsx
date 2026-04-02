'use client'

import { useState } from 'react'
import {
  OKR_OPTIONS, OKR_MEMBERS, CATEGORIES, PRIORITY_OPTIONS,
  type TeamMember,
} from '../constants'

interface NewProjectModalProps {
  teamMembers: TeamMember[]
  onClose: () => void
  onCreated: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

export default function NewProjectModal({ teamMembers, onClose, onCreated, onToast }: NewProjectModalProps) {
  const allOwners = Array.from(new Set([...OKR_MEMBERS, ...teamMembers.map(m => m.name)]))
  const [customOwner, setCustomOwner] = useState('')
  const [showCustomOwner, setShowCustomOwner] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: CATEGORIES[0],
    owner: allOwners[0] ?? '',
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
          description: form.description.trim() || null,
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

          <div>
            <label className="text-[12px] text-gray-500 mb-1 block">项目描述（选填）</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="项目描述..."
              rows={3}
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f] resize-none"
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
              {showCustomOwner ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={customOwner}
                    onChange={e => setCustomOwner(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && customOwner.trim()) { set('owner', customOwner.trim()); setShowCustomOwner(false) }
                      if (e.key === 'Escape') { setShowCustomOwner(false) }
                    }}
                    placeholder="输入姓名..."
                    className="flex-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f]"
                  />
                  <button
                    onClick={() => { if (customOwner.trim()) { set('owner', customOwner.trim()); setShowCustomOwner(false) } }}
                    className="text-[12px] text-white bg-[#3a7a4f] rounded-lg px-3 py-2"
                  >确定</button>
                  <button
                    onClick={() => setShowCustomOwner(false)}
                    className="text-[12px] text-gray-500 border border-gray-200 rounded-lg px-3 py-2"
                  >取消</button>
                </div>
              ) : (
                <select
                  value={allOwners.includes(form.owner) ? form.owner : '__custom__'}
                  onChange={e => {
                    if (e.target.value === '__new__') { setShowCustomOwner(true); setCustomOwner('') }
                    else set('owner', e.target.value)
                  }}
                  className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f] bg-white"
                >
                  {allOwners.map(name => <option key={name} value={name}>{name}</option>)}
                  {!allOwners.includes(form.owner) && form.owner && (
                    <option value="__custom__">{form.owner}</option>
                  )}
                  <option value="__new__">+ 新增负责人...</option>
                </select>
              )}
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
            <select
              value={form.okrObjectiveId}
              onChange={e => set('okrObjectiveId', e.target.value)}
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#3a7a4f] bg-white"
            >
              <option value="">关联 OKR...</option>
              {OKR_OPTIONS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(o => (
                    <option key={o.id} value={o.id}>{o.id}：{o.text}</option>
                  ))}
                </optgroup>
              ))}
            </select>
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
