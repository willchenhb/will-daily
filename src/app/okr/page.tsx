'use client'

export default function OKRPage() {
  return (
    <div className="fixed inset-0 md:left-[180px] sidebar-adjust">
      <iframe
        src="/okr.html"
        className="w-full h-full border-0"
        title="OKR 承接关系全景图"
      />
      <style jsx>{`
        :global(body.sidebar-collapsed) .sidebar-adjust {
          left: 56px;
        }
      `}</style>
    </div>
  )
}
