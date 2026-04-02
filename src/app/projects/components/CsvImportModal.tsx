'use client'

import { useState, useRef } from 'react'
import { CSV_COLUMN_MAP } from '../constants'

interface CsvImportModalProps {
  onClose: () => void
  onImported: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

const FIELD_OPTIONS = ['', 'name', 'category', 'owner', 'status', 'priority', 'startDate', 'targetEndDate', 'okrObjectiveId']
const FIELD_LABELS: Record<string, string> = {
  name: '项目名称', category: '分类', owner: '负责人', status: '状态',
  priority: '优先级', startDate: '开始日期', targetEndDate: '截止日期', okrObjectiveId: 'OKR ID',
}

export default function CsvImportModal({ onClose, onImported, onToast }: CsvImportModalProps) {
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
