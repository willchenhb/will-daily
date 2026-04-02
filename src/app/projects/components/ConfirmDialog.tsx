'use client'

interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl border border-gray-100 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-[13px] text-gray-500 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-[13px] text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="text-[13px] text-white bg-red-500 hover:bg-red-600 rounded-lg px-4 py-2"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
