'use client'

import { useState, useEffect, useCallback } from 'react'
import Toast from '@/components/Toast'

const MODELS = [
  { value: 'kimi-k2.5', label: 'kimi-k2.5 (最新)' },
  { value: 'moonshot-v1-auto', label: 'moonshot-v1-auto (自动)' },
  { value: 'moonshot-v1-8k', label: 'moonshot-v1-8k (快速)' },
  { value: 'moonshot-v1-32k', label: 'moonshot-v1-32k' },
  { value: 'moonshot-v1-128k', label: 'moonshot-v1-128k (长文本)' },
]

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [apiKeyMasked, setApiKeyMasked] = useState('')
  const [apiKeySet, setApiKeySet] = useState(false)
  const [model, setModel] = useState('kimi-k2.5')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setApiKeySet(data.ai_api_key_set === 'true')
    setApiKeyMasked(data.ai_api_key_masked || '')
    setModel(data.ai_model || 'kimi-k2.5')
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = { ai_model: model }
      if (apiKey) body.ai_api_key = apiKey
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setToast({ message: '设置已保存', type: 'success' })
      setApiKey('')
      fetchSettings()
    } catch {
      setToast({ message: '保存失败', type: 'error' })
    }
    setSaving(false)
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
            {apiKeySet && !apiKey && (
              <div className="text-[12px] text-gray-400 mb-1">当前: {apiKeyMasked}</div>
            )}
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={apiKeySet ? '输入新的 API Key 替换' : '输入 Kimi API Key'}
              className="w-full text-[13px] border border-gray-200 rounded px-3 py-2 outline-none focus:border-[#3a7a4f]"
            />
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
      </div>
    </div>
  )
}
