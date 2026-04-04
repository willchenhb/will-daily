'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  embedding: string | null
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

// Selected item can be a keyword or a content node
type SelectedItem =
  | { type: 'keyword'; keyword: string }
  | { type: 'content'; node: GraphNode }

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

const KEYWORD_COLOR = '#1e293b'
const KEYWORD_SELECTED_COLOR = '#ef4444'
const MIN_KEYWORD_REFS = 3 // keyword must appear in at least N content nodes

function buildKeywordGraph(data: GraphData, filters: Record<string, boolean>, searchTerm: string) {
  // Parse embeddings and collect keyword stats
  const nodeKeywords = new Map<number, Record<string, number>>()
  const keywordRefs = new Map<string, { nodeId: number; weight: number }[]>()

  const filteredNodes = data.nodes.filter(n => {
    if (filters[n.sourceType] === false) return false
    if (searchTerm) return n.title.toLowerCase().includes(searchTerm.toLowerCase())
    return true
  })

  for (const node of filteredNodes) {
    if (!node.embedding) continue
    try {
      const keywords = JSON.parse(node.embedding) as Record<string, number>
      nodeKeywords.set(node.id, keywords)
      for (const [kw, weight] of Object.entries(keywords)) {
        if (weight < 0.5) continue // only significant keywords
        if (!keywordRefs.has(kw)) keywordRefs.set(kw, [])
        keywordRefs.get(kw)!.push({ nodeId: node.id, weight })
      }
    } catch { /* skip bad data */ }
  }

  // Filter keywords: must be referenced by enough content nodes
  const significantKeywords = new Map<string, { nodeId: number; weight: number }[]>()
  for (const [kw, refs] of Array.from(keywordRefs.entries())) {
    if (refs.length >= MIN_KEYWORD_REFS) {
      significantKeywords.set(kw, refs)
    }
  }

  return { filteredNodes, significantKeywords, nodeKeywords }
}

function GraphLoader({
  data, filters, searchTerm, onSelect, selectedItem,
}: {
  data: GraphData
  filters: Record<string, boolean>
  searchTerm: string
  onSelect: (item: SelectedItem | null) => void
  selectedItem: SelectedItem | null
}) {
  const loadGraph = useLoadGraph()
  const registerEvents = useRegisterEvents()
  const sigma = useSigma()

  const { filteredNodes, significantKeywords } = useMemo(
    () => buildKeywordGraph(data, filters, searchTerm),
    [data, filters, searchTerm],
  )

  useEffect(() => {
    const graph = new Graph()

    const selectedKeyword = selectedItem?.type === 'keyword' ? selectedItem.keyword : null
    const selectedContentId = selectedItem?.type === 'content' ? selectedItem.node.id : null

    // Collect which content nodes are connected to selected keyword
    const highlightedContentIds = new Set<number>()
    // Collect which keywords are connected to selected content node
    const highlightedKeywords = new Set<string>()

    if (selectedKeyword && significantKeywords.has(selectedKeyword)) {
      for (const ref of significantKeywords.get(selectedKeyword)!) {
        highlightedContentIds.add(ref.nodeId)
      }
    }
    if (selectedContentId) {
      for (const [kw, refs] of Array.from(significantKeywords.entries())) {
        if (refs.some(r => r.nodeId === selectedContentId)) {
          highlightedKeywords.add(kw)
        }
      }
    }

    // Add keyword nodes
    for (const [kw, refs] of Array.from(significantKeywords.entries())) {
      const refCount = refs.length
      const size = Math.min(18, Math.max(8, 6 + refCount * 1.5))
      const isSelected = kw === selectedKeyword
      const isHighlighted = highlightedKeywords.has(kw)
      const dimmed = (selectedKeyword && !isSelected) || (selectedContentId && !isHighlighted)

      graph.addNode(`kw:${kw}`, {
        label: kw,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isSelected ? size * 1.3 : size,
        color: isSelected ? KEYWORD_SELECTED_COLOR : dimmed ? '#d1d5db' : KEYWORD_COLOR,
        type: 'circle',
      })
    }

    // Add content nodes (only those connected to at least one significant keyword)
    const contentNodesInGraph = new Set<number>()
    for (const node of filteredNodes) {
      let hasKeyword = false
      for (const [kw] of Array.from(significantKeywords.entries())) {
        if (significantKeywords.get(kw)!.some(r => r.nodeId === node.id)) {
          hasKeyword = true
          break
        }
      }
      if (!hasKeyword) continue

      contentNodesInGraph.add(node.id)
      const isSelected = node.id === selectedContentId
      const isHighlighted = highlightedContentIds.has(node.id)
      const dimmed = (selectedKeyword && !isHighlighted) || (selectedContentId && !isSelected)

      graph.addNode(String(node.id), {
        label: node.title,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isSelected ? 10 : 6,
        color: isSelected ? KEYWORD_SELECTED_COLOR : dimmed ? '#e5e7eb' : TYPE_COLORS[node.sourceType] || '#9ca3af',
      })
    }

    // Add edges: content -> keyword
    for (const [kw, refs] of Array.from(significantKeywords.entries())) {
      for (const ref of refs) {
        if (!contentNodesInGraph.has(ref.nodeId)) continue
        const isActive = kw === selectedKeyword || ref.nodeId === selectedContentId
        try {
          graph.addEdge(String(ref.nodeId), `kw:${kw}`, {
            size: isActive ? 2 : 0.5,
            color: isActive ? '#94a3b8' : '#e5e7eb',
          })
        } catch { /* skip duplicate */ }
      }
    }

    if (graph.order > 0) {
      forceAtlas2.assign(graph, {
        iterations: 300,
        settings: {
          gravity: 1,
          scalingRatio: 200,
          barnesHutOptimize: graph.order > 50,
          strongGravityMode: false,
        },
      })
    }
    loadGraph(graph)
  }, [filteredNodes, significantKeywords, selectedItem, loadGraph])

  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        const nodeId = event.node
        if (nodeId.startsWith('kw:')) {
          onSelect({ type: 'keyword', keyword: nodeId.slice(3) })
        } else {
          const contentNode = data.nodes.find(n => n.id === parseInt(nodeId))
          if (contentNode) onSelect({ type: 'content', node: contentNode })
        }
      },
      clickStage: () => onSelect(null),
    })
  }, [registerEvents, data.nodes, onSelect])

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
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
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

  const handleSelect = useCallback((item: SelectedItem | null) => setSelectedItem(item), [])

  const { significantKeywords } = useMemo(
    () => buildKeywordGraph(data, filters, searchTerm),
    [data, filters, searchTerm],
  )

  // Sidebar content based on selection
  const sidebarContent = useMemo(() => {
    if (!selectedItem) return null

    if (selectedItem.type === 'keyword') {
      const refs = significantKeywords.get(selectedItem.keyword) || []
      const relatedNodes = refs
        .map(r => {
          const node = data.nodes.find(n => n.id === r.nodeId)
          return node ? { ...node, weight: r.weight } : null
        })
        .filter((n): n is GraphNode & { weight: number } => n !== null)
        .sort((a, b) => b.weight - a.weight)

      return {
        title: selectedItem.keyword,
        subtitle: '关键词',
        color: KEYWORD_COLOR,
        items: relatedNodes,
        isKeyword: true,
      }
    }

    // Content node selected - show connected keywords
    const node = selectedItem.node
    const connectedKeywords: { keyword: string; weight: number; refCount: number }[] = []
    for (const [kw, refs] of Array.from(significantKeywords.entries())) {
      const ref = refs.find(r => r.nodeId === node.id)
      if (ref) {
        connectedKeywords.push({ keyword: kw, weight: ref.weight, refCount: refs.length })
      }
    }
    connectedKeywords.sort((a, b) => b.weight - a.weight)

    return {
      title: node.title,
      subtitle: TYPE_LABELS[node.sourceType],
      color: TYPE_COLORS[node.sourceType],
      snippet: node.snippet,
      link: TYPE_LINKS[node.sourceType]?.(node.sourceId),
      keywords: connectedKeywords,
      isKeyword: false,
    }
  }, [selectedItem, significantKeywords, data.nodes])

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
        <input type="text" placeholder="搜索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:border-gray-300" />
        <div className="flex-1" />
        <span className="text-[11px] text-gray-400">
          {significantKeywords.size} 关键词 / {data.nodes.length} 内容
        </span>
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
              defaultNodeType: 'circle', defaultEdgeType: 'line', labelSize: 14,
              labelFont: 'Inter, system-ui, sans-serif', labelWeight: '500',
              labelColor: { color: '#1e293b' }, renderLabels: true, labelRenderedSizeThreshold: 6, enableEdgeEvents: false,
            }}>
              <GraphLoader data={data} filters={filters} searchTerm={searchTerm} onSelect={handleSelect} selectedItem={selectedItem} />
            </SigmaContainer>
          )}
        </div>
        {sidebarContent && (
          <div className="w-[320px] border-l border-gray-100 bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sidebarContent.color }} />
                  <span className="text-[11px] text-gray-400">{sidebarContent.subtitle}</span>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-gray-300 hover:text-gray-500 text-sm">x</button>
              </div>
              <h3 className="text-[15px] font-medium text-gray-800 mb-3 leading-snug">{sidebarContent.title}</h3>

              {sidebarContent.isKeyword && sidebarContent.items && (
                <div>
                  <h4 className="text-[12px] font-medium text-gray-600 mb-2">关联内容 ({sidebarContent.items.length})</h4>
                  <div className="flex flex-col gap-2">
                    {sidebarContent.items.map((node: GraphNode & { weight: number }) => (
                      <button key={node.id} onClick={() => setSelectedItem({ type: 'content', node })}
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

              {!sidebarContent.isKeyword && (
                <>
                  {'snippet' in sidebarContent && sidebarContent.snippet && (
                    <p className="text-[12px] text-gray-500 leading-relaxed mb-4">{sidebarContent.snippet}</p>
                  )}
                  {'link' in sidebarContent && sidebarContent.link && (
                    <a href={sidebarContent.link} className="inline-block text-[12px] text-blue-500 hover:text-blue-600 mb-4">查看原文 &rarr;</a>
                  )}
                  {'keywords' in sidebarContent && sidebarContent.keywords && sidebarContent.keywords.length > 0 && (
                    <div>
                      <h4 className="text-[12px] font-medium text-gray-600 mb-2">关联关键词 ({sidebarContent.keywords.length})</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {sidebarContent.keywords.map((kw: { keyword: string; weight: number; refCount: number }) => (
                          <button key={kw.keyword} onClick={() => setSelectedItem({ type: 'keyword', keyword: kw.keyword })}
                            className="text-[11px] px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                            {kw.keyword}
                            <span className="text-gray-400 ml-1">({kw.refCount})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
