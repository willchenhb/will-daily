import type { SaveStatus as Status } from '@/lib/use-autosave'

const LABELS: Record<Status, string> = {
  idle: '',
  dirty: '未保存',
  saving: '保存中…',
  saved: '已自动保存',
  error: '保存失败，稍后重试',
  conflict: '已暂停自动保存',
}

export default function SaveStatus({ status }: { status: Status }) {
  if (status === 'idle') return null
  return (
    <span className={`text-[11px] ${status === 'error' ? 'text-red-400' : status === 'conflict' ? 'text-amber-500' : 'text-gray-300'}`}>
      {LABELS[status]}
    </span>
  )
}
