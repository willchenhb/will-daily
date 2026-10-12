function formatAgo(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} 小时前`
  return new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Offers a local draft that never reached the server (see src/lib/drafts.ts)
export default function DraftNotice({ savedAt, onRestore, onDiscard }: { savedAt: number; onRestore: () => void; onDiscard: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-800">
      <span className="flex-1 min-w-[200px]">
        发现 {formatAgo(savedAt)}未保存到服务器的本地草稿（可能当时网络断开或页面被关闭）。恢复后，当前版本会先存入历史版本。
      </span>
      <button onClick={onDiscard} className="rounded border border-sky-300 bg-white px-2.5 py-1 hover:bg-sky-100">丢弃</button>
      <button onClick={onRestore} className="rounded bg-sky-600 px-2.5 py-1 text-white hover:bg-sky-700">恢复草稿</button>
    </div>
  )
}
