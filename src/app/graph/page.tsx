'use client'

import dynamic from 'next/dynamic'

const GraphView = dynamic(() => import('@/components/GraphView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <div className="text-gray-400 text-sm">加载图谱...</div>
    </div>
  ),
})

export default function GraphPage() {
  return <GraphView />
}
