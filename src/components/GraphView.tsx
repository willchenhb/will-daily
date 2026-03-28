'use client'

import { useState, useEffect, useCallback } from 'react'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from '@react-sigma/core'
import '@react-sigma/core/lib/style.css'

interface GraphNode {
  id: number
  sourceType: string
  sourceId: number
  title: string
  snippet: string
}

interface GraphEdge {
  nodeAId: number
  nodeBId: number
  weight: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const TYPE_COLORS: Record<string, string> = {
  diary: '#3b82f6',
  weekly: '#22c55e',
  article: '#f97316',
  note: '#a855f7',
}

const TYPE_LABELS: Record<string, string> = {
  diary: '日记',
  weekly: '周记',
  article: '精选',
  note: '笔记',
}

const TYPE_LINKS: Record<string, (sourceId: number) => string> = {
  diary: () => '/diary',
  weekly: () => '/weekly',
  article: (id) => `/curated/${id}`,
  note: (id) => `/notes/${id}`,
}

function GraphLoader({
  data, filters, searchTerm, onNodeClick, selectedNodeId,
}: {
  data: GraphData
  filters: Record<string, boolean>
  searchTerm: string
  onNodeClick: (node: GraphNode | null) => void
  selectedNodeId: number | null
}) {
  const loadGraph = useLoadGraph()
  const registerEvents = useRegisterEvents()
  const sigma = useSigma()

  useEffect(() => {
    const graph = new Graph()
    const connectionCount: Record<number, number> = {}
    for (const edge of data.edges) {
      const aVisible = filters[data.nodes.find(n => n.id === edge.nodeAId)?.sourceType || ''] !== false
      const bVisible = filters[data.nodes.find(n => n.id === edge.nodeBId)?.sourceType || ''] !== false
      if (aVisible && bVisible) {
        connectionCount[edge.nodeAId] = (connectionCount[edge.nodeAId] || 0) + 1
        connectionCount[edge.nodeBId] = (connectionCount[edge.nodeBId] || 0) + 1
      }
    }
    const filteredNodes = data.nodes.filter(n => {
      if (filters[n.sourceType] === false) return false
      if (searchTerm) return n.title.toLowerCase().includes(searchTerm.toLowerCase())
      return true
    })
    const nodeIds = new Set(filteredNodes.map(n => n.id))
    for (const node of filteredNodes) {
      const connections = connectionCount[node.id] || 0
      const size = Math.min(20, Math.max(5, 5 + connections * 2))
      const isSelected = node.id === selectedNodeId
      graph.addNode(String(node.id), {
        label: node.title,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isSelected ? size * 1.5 : size,
        color: isSelected ? '#ef4444' : TYPE_COLORS[node.sourceType] || '#9ca3af',
      })
    }
    for (const edge of data.edges) {
      if (nodeIds.has(edge.nodeAId) && nodeIds.has(edge.nodeBId)) {
        const edgeSize = edge.weight >= 0.7 ? 4 : edge.weight >= 0.5 ? 2.5 : 1
        try {
          graph.addEdge(String(edge.nodeAId), String(edge.nodeBId), {
            size: edgeSize,
            color: selectedNodeId
              ? (edge.nodeAId === selectedNodeId || edge.nodeBId === selectedNodeId ? '#ef4444' : '#e5e7eb')
              : '#d1d5db',
          })
        } catch { /* skip duplicate */ }
      }
    }
    if (graph.order > 0) {
      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: { gravity: 1, scalingRatio: 10, barnesHutOptimize: graph.order > 50, strongGravityMode: true },
      })
    }
    loadGraph(graph)
  }, [data, filters, searchTerm, selectedNodeId, loadGraph])

  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        const nodeId = parseInt(event.node)
        onNodeClick(data.nodes.find(n => n.id === nodeId) || null)
      },
      clickStage: () => onNodeClick(null),
    })
  }, [registerEvents, data.nodes, onNodeClick])

  useEffect(() => {
    registerEvents({
      enterNode: () => { const c = sigma.getContainer(); if (c) c.style.cursor = 'pointer' },
      leaveNode: () => { const c = sigma.getContainer(); if (c) c.style.cursor = 'default' },
    })
  }, [registerEvents, sigma])

  return null
}

export default function GraphView() {
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [filters, setFilters] = useState<Record<string, boolean>>({ diary: true, weekly: true, article: true, note: true })
  const [searchTerm, setSearchTerm] = useState('')
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/graph')
      if (!res.ok) return
      setData(await res.json())
    } catch (e) {
      console.error('Failed to fetch graph data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRebuild = async () => {
    if (rebuilding) return
    setRebuilding(true)
    setRebuildResult(null)
    try {
      const res = await fetch('/api/graph/rebuild', { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        setRebuildResult(`完成: ${result.processed}/${result.total} 成功, ${result.errors} 失败`)
        await fetchData()
      } else {
        setRebuildResult(`错误: ${result.error}`)
      }
    } catch {
      setRebuildResult('请求失败')
    } finally {
      setRebuilding(false)
    }
  }

  const handleNodeClick = useCallback((node: GraphNode | null) => setSelectedNode(node), [])

  const connectedNodes = selectedNode
    ? data.edges
        .filter(e => e.nodeAId === selectedNode.id || e.nodeBId === selectedNode.id)
        .map(e => {
          const otherId = e.nodeAId === selectedNode.id ? e.nodeBId : e.nodeAId
          const other = data.nodes.find(n => n.id === otherId)
          return other ? { ...other, weight: e.weight } : null
        })
        .filter((n): n is GraphNode & { weight: number } => n !== null)
        .sort((a, b) => b.weight - a.weight)
    : []

  const toggleFilter = (type: string) => setFilters(prev => ({ ...prev, [type]: !prev[type] }))

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-gray-400 text-sm">加载图谱...</div></div>
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex gap-1.5">
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <button key={type} onClick={() => toggleFilter(type)}
              className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border transition-colors ${filters[type] ? 'border-gray-200 bg-white text-gray-700' : 'border-transparent bg-gray-50 text-gray-300'}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: filters[type] ? TYPE_COLORS[type] : '#d1d5db' }} />
              {label}
            </button>
          ))}
        </div>
        <input type="text" placeholder="搜索节点..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:border-gray-300" />
        <div className="flex-1" />
        <span className="text-[11px] text-gray-400">{data.nodes.length} 节点 / {data.edges.length} 连接</span>
        <button onClick={handleRebuild} disabled={rebuilding}
          className={`text-[12px] px-3 py-1 rounded border transition-colors ${rebuilding ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
          {rebuilding ? '重建中...' : '重建图谱'}
        </button>
      </div>
      {rebuildResult && (
        <div className="px-4 py-2 text-[12px] text-gray-500 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          {rebuildResult}
          <button onClick={() => setRebuildResult(null)} className="ml-2 text-gray-400 hover:text-gray-600">x</button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative bg-gray-50">
          {data.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-sm mb-2">图谱为空</p>
              <p className="text-[12px]">点击「重建图谱」生成知识连接</p>
            </div>
          ) : (
            <SigmaContainer style={{ width: '100%', height: '100%' }} settings={{
              defaultNodeType: 'circle', defaultEdgeType: 'line', labelSize: 12,
              labelFont: 'Inter, system-ui, sans-serif', labelWeight: '400',
              labelColor: { color: '#374151' }, renderLabels: true, labelRenderedSizeThreshold: 8, enableEdgeEvents: false,
            }}>
              <GraphLoader data={data} filters={filters} searchTerm={searchTerm} onNodeClick={handleNodeClick} selectedNodeId={selectedNode?.id ?? null} />
            </SigmaContainer>
          )}
        </div>
        {selectedNode && (
          <div className="w-[320px] border-l border-gray-100 bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[selectedNode.sourceType] }} />
                  <span className="text-[11px] text-gray-400">{TYPE_LABELS[selectedNode.sourceType]}</span>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-gray-300 hover:text-gray-500 text-sm">x</button>
              </div>
              <h3 className="text-[15px] font-medium text-gray-800 mb-2 leading-snug">{selectedNode.title}</h3>
              {selectedNode.snippet && <p className="text-[12px] text-gray-500 leading-relaxed mb-4">{selectedNode.snippet}</p>}
              <a href={TYPE_LINKS[selectedNode.sourceType]?.(selectedNode.sourceId)} className="inline-block text-[12px] text-blue-500 hover:text-blue-600 mb-4">查看原文 &rarr;</a>
              {connectedNodes.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-medium text-gray-600 mb-2">关联内容 ({connectedNodes.length})</h4>
                  <div className="flex flex-col gap-2">
                    {connectedNodes.map(node => (
                      <button key={node.id} onClick={() => { const found = data.nodes.find(n => n.id === node.id); if (found) setSelectedNode(found) }}
                        className="text-left p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[node.sourceType] }} />
                          <span className="text-[11px] text-gray-400">{TYPE_LABELS[node.sourceType]}</span>
                          <span className="text-[10px] text-gray-300 ml-auto">{(node.weight * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-[12px] text-gray-700 leading-snug line-clamp-2">{node.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
