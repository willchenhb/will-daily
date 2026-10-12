// Shown when autosave hit a newer version saved elsewhere (another tab or device)
export default function ConflictNotice({ onReload, onOverwrite }: { onReload: () => void; onOverwrite: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
      <span className="flex-1 min-w-[200px]">这篇内容已在其他页面或设备上修改过，自动保存已暂停。两个版本都会保留在「历史版本」里。</span>
      <button onClick={onReload} className="rounded border border-amber-300 bg-white px-2.5 py-1 hover:bg-amber-100">
        载入最新版本
      </button>
      <button onClick={onOverwrite} className="rounded bg-amber-600 px-2.5 py-1 text-white hover:bg-amber-700">
        用我的覆盖
      </button>
    </div>
  )
}
