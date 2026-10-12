'use client'

import { useState, useEffect, useCallback } from 'react'
import Toast from '@/components/Toast'
import Editor from '@/components/Editor'
import { TEMPLATE_PLACEHOLDERS } from '@/lib/diary-template'

const MODELS = [
  { value: 'kimi-k3', label: 'kimi-k3 (旗舰 · 1M 上下文)' },
  { value: 'kimi-k2.6', label: 'kimi-k2.6 (多模态)' },
  { value: 'kimi-k2.7-code', label: 'kimi-k2.7-code (编程)' },
  { value: 'moonshot-v1-auto', label: 'moonshot-v1-auto (自动)' },
  { value: 'moonshot-v1-8k', label: 'moonshot-v1-8k (快速)' },
  { value: 'moonshot-v1-32k', label: 'moonshot-v1-32k' },
  { value: 'moonshot-v1-128k', label: 'moonshot-v1-128k (长文本)' },
]

export default function SettingsPage() {
  const [apiKeySet, setApiKeySet] = useState(false)
  const [model, setModel] = useState('kimi-k3')
  const [saving, setSaving] = useState(false)
  const [template, setTemplate] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [exportProgress, setExportProgress] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setApiKeySet(data.ai_api_key_set === 'true')
    setModel(data.ai_model || 'kimi-k3')
    setTemplate(prev => prev ?? (data.diary_template || ''))
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_model: model }),
      })
      setToast({ message: '设置已保存', type: 'success' })
      fetchSettings()
    } catch {
      setToast({ message: '保存失败', type: 'error' })
    }
    setSaving(false)
  }

  const handleSaveTemplate = async () => {
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diary_template: template && template !== '<p></p>' ? template : '' }),
      })
      if (!res.ok) throw new Error()
      setToast({ message: '日记模板已保存', type: 'success' })
    } catch {
      setToast({ message: '保存失败', type: 'error' })
    }
    setSavingTemplate(false)
  }

  const handleExport = async () => {
    setExportProgress('准备中…')
    try {
      // Loaded on demand: pulls in the zip library
      const { exportMarkdownZip } = await import('@/lib/export-markdown')
      const blob = await exportMarkdownZip(setExportProgress)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `will-daily-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setToast({ message: '导出完成', type: 'success' })
    } catch (e) {
      setToast({ message: `导出失败：${e instanceof Error ? e.message : '未知错误'}`, type: 'error' })
    }
    setExportProgress(null)
  }

  return (
    <div className="max-w-xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <h1 className="text-lg font-semibold text-gray-800 mb-6">设置</h1>

      <div className="space-y-5">
        <div className="border-b border-gray-100 pb-5">
          <h2 className="text-[14px] font-medium text-gray-700 mb-4">AI 摘要配置</h2>
          <p className="text-[12px] text-gray-400 mb-4">
            使用 Kimi API 生成笔记摘要和精选速读。API 端点: https://api.moonshot.cn/v1
          </p>

          <div className="mb-4">
            <label className="text-[12px] text-gray-500 block mb-1">API Key</label>
            {apiKeySet ? (
              <div className="text-[12px] text-green-600 bg-green-50 border border-green-200 rounded px-3 py-2">
                API Key 已通过环境变量配置
              </div>
            ) : (
              <div className="text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                请在 .env.local 文件中设置 KIMI_API_KEY 环境变量
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="text-[12px] text-gray-500 block mb-1">模型</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full text-[13px] border border-gray-200 rounded px-3 py-2 outline-none focus:border-[#3a7a4f] bg-white"
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[13px] text-white bg-[#3a7a4f] hover:bg-[#2d6b3f] px-4 py-2 rounded disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>

        <div className="border-t border-gray-100 pt-5">
          <h2 className="text-[14px] font-medium text-gray-700 mb-2">日记模板</h2>
          <p className="text-[12px] text-gray-400 mb-3 leading-relaxed">
            新建日记时自动填入，可用「/待办列表」「## 标题」等格式。
            {TEMPLATE_PLACEHOLDERS.map(p => (
              <span key={p.key}> <code className="text-[11px] bg-gray-50 px-1 rounded">{p.key}</code> 会替换为{p.label}。</span>
            ))}
            留空则不使用模板。
          </p>
          {template !== null && (
            <div className="border border-gray-100 rounded-lg px-3 py-2 mb-3">
              <Editor content={template} onChange={setTemplate} placeholder="例如：## 今日三件事 …" contentClassName="min-h-[120px]" onSave={handleSaveTemplate} />
            </div>
          )}
          <button
            onClick={handleSaveTemplate}
            disabled={savingTemplate}
            className="text-[13px] text-[#3a7a4f] border border-[#c5d9c5] px-4 py-2 rounded hover:bg-[#f0faf4] disabled:opacity-50"
          >
            {savingTemplate ? '保存中...' : '保存模板'}
          </button>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h2 className="text-[14px] font-medium text-gray-700 mb-2">导出 Markdown</h2>
          <p className="text-[12px] text-gray-400 mb-3 leading-relaxed">
            把全部笔记、日记、周记和图片打包成 .zip，可直接用 Obsidian 打开，[[链接]] 和 #标签 都能识别；也可当作离线备份。
          </p>
          <button
            onClick={handleExport}
            disabled={exportProgress !== null}
            className="text-[13px] text-[#3a7a4f] border border-[#c5d9c5] px-4 py-2 rounded hover:bg-[#f0faf4] disabled:opacity-50"
          >
            {exportProgress ?? '导出全部为 Markdown'}
          </button>
        </div>
      </div>
    </div>
  )
}
