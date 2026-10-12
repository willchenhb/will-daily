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
  href: string
}

interface GraphEdge {
  nodeAId: number
  nodeBId: number
  weight: number
}

// A document taking part in a [[link]], and a link between two of them
interface LinkDoc { key: string; sourceType: string; sourceId: number; title: string; href: string }
interface WikiEdge { from: string; to: string; count: number }

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  docs: LinkDoc[]
  links: WikiEdge[]
}

// One document in the graph: from the keyword index, the link index, or both
interface Doc {
  key: string // `${sourceType}:${sourceId}`
  sourceType: string
  sourceId: number
  title: string
  href: string
  snippet?: string
  contentNodeId?: number
}

// Selected item can be a keyword or a document
type SelectedItem =
  | { type: 'keyword'; keyword: string }
  | { type: 'doc'; key: string }

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

const KEYWORD_COLOR = '#1e293b'
const KEYWORD_SELECTED_COLOR = '#ef4444'
const LINK_COLOR = '#3a7a4f'
const MIN_KEYWORD_REFS = 3 // keyword must appear in at least N content nodes

const docKeyOf = (type: string, id: number) => `${type}:${id}`
const graphIdOf = (key: string) => `doc:${key}`

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
  data, docs, links, showKeywords, filters, searchTerm, onSelect, selectedItem,
}: {
  data: GraphData
  docs: Map<string, Doc>
  links: WikiEdge[] // already filtered to visible documents
  showKeywords: boolean
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
    const keywords = showKeywords ? significantKeywords : new Map<string, { nodeId: number; weight: number }[]>()
    const keyOfContentNode = new Map(data.nodes.map(n => [n.id, docKeyOf(n.sourceType, n.sourceId)]))

    const selectedKeyword = selectedItem?.type === 'keyword' ? selectedItem.keyword : null
    const selectedDoc = selectedItem?.type === 'doc' ? selectedItem.key : null

    // Documents tied to the selected keyword, or linked to the selected document
    const highlightedDocs = new Set<string>()
    // Keywords tied to the selected document
    const highlightedKeywords = new Set<string>()

    if (selectedKeyword && keywords.has(selectedKeyword)) {
      for (const ref of keywords.get(selectedKeyword)!) {
        const key = keyOfContentNode.get(ref.nodeId)
        if (key) highlightedDocs.add(key)
      }
    }
    if (selectedDoc) {
      for (const [kw, refs] of Array.from(keywords.entries())) {
        if (refs.some(r => keyOfContentNode.get(r.nodeId) === selectedDoc)) highlightedKeywords.add(kw)
      }
      for (const l of links) {
        if (l.from === selectedDoc) highlightedDocs.add(l.to)
        if (l.to === selectedDoc) highlightedDocs.add(l.from)
      }
    }

    // Keyword nodes
    for (const [kw, refs] of Array.from(keywords.entries())) {
      const size = Math.min(18, Math.max(8, 6 + refs.length * 1.5))
      const isSelected = kw === selectedKeyword
      const dimmed = (selectedKeyword && !isSelected) || (selectedDoc && !highlightedKeywords.has(kw))
      graph.addNode(`kw:${kw}`, {
        label: kw,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isSelected ? size * 1.3 : size,
        color: isSelected ? KEYWORD_SELECTED_COLOR : dimmed ? '#d1d5db' : KEYWORD_COLOR,
        type: 'circle',
      })
    }

    // Link degree sizes linked documents, like Obsidian's graph
    const degree = new Map<string, number>()
    for (const l of links) {
      degree.set(l.from, (degree.get(l.from) || 0) + 1)
      degree.set(l.to, (degree.get(l.to) || 0) + 1)
    }

    const addDoc = (key: string) => {
      const id = graphIdOf(key)
      if (graph.hasNode(id)) return
      const doc = docs.get(key)
      if (!doc) return
      const isSelected = key === selectedDoc
      const dimmed = (selectedKeyword || selectedDoc) && !isSelected && !highlightedDocs.has(key)
      graph.addNode(id, {
        label: doc.title,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isSelected ? 10 : 6 + Math.min(6, degree.get(key) || 0),
        color: isSelected ? KEYWORD_SELECTED_COLOR : dimmed ? '#e5e7eb' : TYPE_COLORS[doc.sourceType] || '#9ca3af',
      })
    }

    // Content nodes connected to at least one significant keyword
    const keywordNodeIds = new Set(Array.from(keywords.values()).flatMap(refs => refs.map(r => r.nodeId)))
    for (const node of filteredNodes) {
      if (keywordNodeIds.has(node.id)) addDoc(docKeyOf(node.sourceType, node.sourceId))
    }

    // Edges: content -> keyword
    for (const [kw, refs] of Array.from(keywords.entries())) {
      for (const ref of refs) {
        const key = keyOfContentNode.get(ref.nodeId)
        if (!key || !graph.hasNode(graphIdOf(key))) continue
        const isActive = kw === selectedKeyword || key === selectedDoc
        try {
          graph.addEdge(graphIdOf(key), `kw:${kw}`, {
            size: isActive ? 2 : 0.5,
            color: isActive ? '#94a3b8' : '#e5e7eb',
          })
        } catch { /* skip duplicate */ }
      }
    }

    // Edges: document -> document ([[links]]); links in both directions share one thicker edge
    for (const l of links) {
      addDoc(l.from)
      addDoc(l.to)
      const from = graphIdOf(l.from)
      const to = graphIdOf(l.to)
      if (!graph.hasNode(from) || !graph.hasNode(to)) continue
      const isActive = l.from === selectedDoc || l.to === selectedDoc
      const dimmed = (selectedKeyword || selectedDoc) && !isActive
      if (graph.hasEdge(to, from)) {
        graph.updateEdgeAttribute(graph.edge(to, from), 'size', (size: number) => size + 1)
        continue
      }
      graph.addEdge(from, to, {
        size: isActive ? 2.5 : 1.5,
        color: dimmed ? '#d9e8dd' : LINK_COLOR,
      })
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
  }, [data.nodes, docs, links, showKeywords, filteredNodes, significantKeywords, selectedItem, loadGraph])

  // One call: registerEvents replaces every handler registered before it
  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        const nodeId = event.node
        if (nodeId.startsWith('kw:')) onSelect({ type: 'keyword', keyword: nodeId.slice(3) })
        else if (nodeId.startsWith('doc:')) onSelect({ type: 'doc', key: nodeId.slice(4) })
      },
      clickStage: () => onSelect(null),
      enterNode: () => { const c = sigma.getContainer(); if (c) c.style.cursor = 'pointer' },
      leaveNode: () => { const c = sigma.getContainer(); if (c) c.style.cursor = 'default' },
    })
  }, [registerEvents, onSelect, sigma])

  return null
}

function DocButton({ doc, onClick }: { doc: Doc; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[doc.sourceType] }} />
        <span className="text-[11px] text-gray-400">{TYPE_LABELS[doc.sourceType]}</span>
      </div>
      <p className="text-[12px] text-gray-700 leading-snug line-clamp-2">{doc.title}</p>
    </button>
  )
}

export default function GraphView() {
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [], docs: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
  const [filters, setFilters] = useState<Record<string, boolean>>({ diary: true, weekly: true, article: true, note: true })
  const [showKeywords, setShowKeywords] = useState(true)
  const [showLinks, setShowLinks] = useState(true)
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

  // Every document known to either index, keyed by `${type}:${id}`
  const docs = useMemo(() => {
    const map = new Map<string, Doc>()
    for (const n of data.nodes) {
      const key = docKeyOf(n.sourceType, n.sourceId)
      map.set(key, { key, sourceType: n.sourceType, sourceId: n.sourceId, title: n.title, href: n.href, snippet: n.snippet, contentNodeId: n.id })
    }
    for (const d of data.docs) {
      const known = map.get(d.key)
      // The link index has current titles; keep the keyword node's snippet
      map.set(d.key, known ? { ...known, title: d.title, href: d.href } : { ...d })
    }
    return map
  }, [data])

  const visibleLinks = useMemo(() => {
    if (!showLinks) return []
    const term = searchTerm.toLowerCase()
    const visible = (key: string) => {
      const doc = docs.get(key)
      return !!doc && filters[doc.sourceType] !== false && (!term || doc.title.toLowerCase().includes(term))
    }
    return data.links.filter(l => visible(l.from) && visible(l.to))
  }, [data.links, docs, filters, searchTerm, showLinks])

  // Sidebar content based on selection
  const sidebarContent = useMemo(() => {
    if (!selectedItem) return null

    if (selectedItem.type === 'keyword') {
      const refs = significantKeywords.get(selectedItem.keyword) || []
      const relatedDocs = refs
        .map(r => {
          const node = data.nodes.find(n => n.id === r.nodeId)
          const doc = node && docs.get(docKeyOf(node.sourceType, node.sourceId))
          return doc ? { doc, weight: r.weight } : null
        })
        .filter((x): x is { doc: Doc; weight: number } => x !== null)
        .sort((a, b) => b.weight - a.weight)
      return { kind: 'keyword' as const, title: selectedItem.keyword, relatedDocs }
    }

    const doc = docs.get(selectedItem.key)
    if (!doc) return null
    const connectedKeywords: { keyword: string; weight: number; refCount: number }[] = []
    if (doc.contentNodeId !== undefined) {
      for (const [kw, refs] of Array.from(significantKeywords.entries())) {
        const ref = refs.find(r => r.nodeId === doc.contentNodeId)
        if (ref) connectedKeywords.push({ keyword: kw, weight: ref.weight, refCount: refs.length })
      }
      connectedKeywords.sort((a, b) => b.weight - a.weight)
    }
    const outgoing = data.links.filter(l => l.from === doc.key).map(l => docs.get(l.to)).filter((d): d is Doc => !!d)
    const incoming = data.links.filter(l => l.to === doc.key).map(l => docs.get(l.from)).filter((d): d is Doc => !!d)
    return { kind: 'doc' as const, doc, connectedKeywords, outgoing, incoming }
  }, [selectedItem, significantKeywords, data.nodes, data.links, docs])

  const toggleFilter = (type: string) => setFilters(prev => ({ ...prev, [type]: !prev[type] }))

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-gray-400 text-sm">加载图谱...</div></div>
  }

  const chip = (on: boolean) =>
    `flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border transition-colors ${on ? 'border-gray-200 bg-white text-gray-700' : 'border-transparent bg-gray-50 text-gray-300'}`

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex gap-1.5">
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <button key={type} onClick={() => toggleFilter(type)} className={chip(filters[type])}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: filters[type] ? TYPE_COLORS[type] : '#d1d5db' }} />
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setShowKeywords(v => !v)} className={chip(showKeywords)} title="AI 关键词聚类（重建图谱后生成）">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: showKeywords ? KEYWORD_COLOR : '#d1d5db' }} />
            关键词
          </button>
          <button onClick={() => setShowLinks(v => !v)} className={chip(showLinks)} title="笔记之间的 [[双链]]，实时生成">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: showLinks ? LINK_COLOR : '#d1d5db' }} />
            双链
          </button>
        </div>
        <input type="text" placeholder="搜索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:border-gray-300" />
        <div className="flex-1" />
        <span className="text-[11px] text-gray-400">
          {significantKeywords.size} 关键词 · {data.nodes.length} 内容 · {data.links.length} 条双链
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
          {data.nodes.length === 0 && data.links.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-sm mb-2">图谱为空</p>
              <p className="text-[12px]">点击「重建图谱」生成关键词连接，或在笔记中用 [[ 链接其他笔记</p>
            </div>
          ) : (
            <SigmaContainer style={{ width: '100%', height: '100%' }} settings={{
              defaultNodeType: 'circle', defaultEdgeType: 'line', labelSize: 14,
              labelFont: 'Inter, system-ui, sans-serif', labelWeight: '500',
              labelColor: { color: '#1e293b' }, renderLabels: true, labelRenderedSizeThreshold: 6, enableEdgeEvents: false,
            }}>
              <GraphLoader
                data={data}
                docs={docs}
                links={visibleLinks}
                showKeywords={showKeywords}
                filters={filters}
                searchTerm={searchTerm}
                onSelect={handleSelect}
                selectedItem={selectedItem}
              />
            </SigmaContainer>
          )}
        </div>
        {sidebarContent && (
          <div className="w-[320px] border-l border-gray-100 bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sidebarContent.kind === 'keyword' ? KEYWORD_COLOR : TYPE_COLORS[sidebarContent.doc.sourceType] }}
                  />
                  <span className="text-[11px] text-gray-400">
                    {sidebarContent.kind === 'keyword' ? '关键词' : TYPE_LABELS[sidebarContent.doc.sourceType]}
                  </span>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-gray-300 hover:text-gray-500 text-sm">x</button>
              </div>
              <h3 className="text-[15px] font-medium text-gray-800 mb-3 leading-snug">
                {sidebarContent.kind === 'keyword' ? sidebarContent.title : sidebarContent.doc.title}
              </h3>

              {sidebarContent.kind === 'keyword' && (
                <div>
                  <h4 className="text-[12px] font-medium text-gray-600 mb-2">关联内容 ({sidebarContent.relatedDocs.length})</h4>
                  <div className="flex flex-col gap-2">
                    {sidebarContent.relatedDocs.map(({ doc, weight }) => (
                      <button key={doc.key} onClick={() => setSelectedItem({ type: 'doc', key: doc.key })}
                        className="text-left p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[doc.sourceType] }} />
                          <span className="text-[11px] text-gray-400">{TYPE_LABELS[doc.sourceType]}</span>
                          <span className="text-[10px] text-gray-300 ml-auto">{(weight * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-[12px] text-gray-700 leading-snug line-clamp-2">{doc.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sidebarContent.kind === 'doc' && (
                <>
                  {sidebarContent.doc.snippet && (
                    <p className="text-[12px] text-gray-500 leading-relaxed mb-4">{sidebarContent.doc.snippet}</p>
                  )}
                  <a href={sidebarContent.doc.href} className="inline-block text-[12px] text-blue-500 hover:text-blue-600 mb-4">查看原文 &rarr;</a>

                  {(sidebarContent.outgoing.length > 0 || sidebarContent.incoming.length > 0) && (
                    <div className="mb-4 space-y-3">
                      {sidebarContent.outgoing.length > 0 && (
                        <div>
                          <h4 className="text-[12px] font-medium text-gray-600 mb-2">链接到 ({sidebarContent.outgoing.length})</h4>
                          <div className="flex flex-col gap-2">
                            {sidebarContent.outgoing.map(d => <DocButton key={d.key} doc={d} onClick={() => setSelectedItem({ type: 'doc', key: d.key })} />)}
                          </div>
                        </div>
                      )}
                      {sidebarContent.incoming.length > 0 && (
                        <div>
                          <h4 className="text-[12px] font-medium text-gray-600 mb-2">被链接 ({sidebarContent.incoming.length})</h4>
                          <div className="flex flex-col gap-2">
                            {sidebarContent.incoming.map(d => <DocButton key={d.key} doc={d} onClick={() => setSelectedItem({ type: 'doc', key: d.key })} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {sidebarContent.connectedKeywords.length > 0 && (
                    <div>
                      <h4 className="text-[12px] font-medium text-gray-600 mb-2">关联关键词 ({sidebarContent.connectedKeywords.length})</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {sidebarContent.connectedKeywords.map(kw => (
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
