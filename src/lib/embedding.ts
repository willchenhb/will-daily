import { prisma } from './prisma'

const SIMILARITY_THRESHOLD = 0.3

interface KeywordFingerprint {
  [keyword: string]: number // keyword -> weight (0-1)
}

// Get Kimi client settings (reuse pattern from kimi.ts)
async function getAISettings() {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['ai_model'] } },
  })
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value
  return {
    apiKey: process.env.KIMI_API_KEY || '',
    model: map.ai_model || 'kimi-k2.5',
  }
}

// Generate keyword fingerprint via Kimi chat API
export async function generateFingerprint(text: string): Promise<KeywordFingerprint> {
  const settings = await getAISettings()
  if (!settings.apiKey) throw new Error('KIMI_API_KEY not configured')

  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: 'https://api.moonshot.cn/v1',
    timeout: 120_000,
  })

  const plainText = text.replace(/<[^>]*>/g, '').slice(0, 4000)

  const response = await client.chat.completions.create({
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: `你是一个语义分析助手。从以下文本中提取20-30个核心关键词/短语，并为每个分配权重(0-1)。
返回JSON格式: {"关键词1": 0.9, "关键词2": 0.7, ...}
权重标准: 1.0=核心主题, 0.7=重要相关, 0.3=次要提及
只返回JSON，不要其他内容。`,
      },
      { role: 'user', content: plainText },
    ],
  })

  const textResult = response.choices[0]?.message?.content || '{}'
  try {
    const jsonStr = textResult.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(jsonStr)
  } catch {
    return {}
  }
}

// Compute weighted Jaccard-like similarity between two keyword fingerprints
export function computeSimilarity(a: KeywordFingerprint, b: KeywordFingerprint): number {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length === 0 || keysB.length === 0) return 0

  let intersection = 0
  let union = 0

  const allKeys = Array.from(new Set([...keysA, ...keysB]))
  for (const key of allKeys) {
    const wA = a[key] || 0
    const wB = b[key] || 0
    intersection += Math.min(wA, wB)
    union += Math.max(wA, wB)
  }

  return union === 0 ? 0 : intersection / union
}

// Extract plain text for embedding based on content type
function getTextForType(sourceType: string, record: Record<string, unknown>): string {
  switch (sourceType) {
    case 'diary':
      return `${record.date} ${((record.content as string) || '').replace(/<[^>]*>/g, '')}`
    case 'weekly': {
      const todos = record.todos as Array<{ text: string }> | undefined
      const todoTexts = todos?.map((t) => t.text).join('\n') || ''
      return `${record.title || ''} ${((record.content as string) || '').replace(/<[^>]*>/g, '')} ${todoTexts}`
    }
    case 'note':
      return `${record.title || ''} ${((record.content as string) || '').replace(/<[^>]*>/g, '')}`
    case 'article':
      return `${record.title || ''} ${(record.summary as string) || ((record.content as string) || '').slice(0, 2000)}`
    default:
      return ''
  }
}

function getSnippet(sourceType: string, record: Record<string, unknown>): string {
  const raw = sourceType === 'article'
    ? ((record.summary as string) || (record.content as string) || '')
    : ((record.content as string) || '')
  return raw.replace(/<[^>]*>/g, '').slice(0, 200)
}

function getTitle(sourceType: string, record: Record<string, unknown>): string {
  switch (sourceType) {
    case 'diary': return `日记 ${record.date}`
    case 'weekly': return `周记 ${record.weekStart}`
    case 'note': return (record.title as string) || '未命名笔记'
    case 'article': return (record.title as string) || '未命名文章'
    default: return '未知'
  }
}

// Embed a single content item and update edges
export async function embedContent(sourceType: string, sourceId: number): Promise<void> {
  let record: Record<string, unknown> | null = null
  switch (sourceType) {
    case 'diary':
      record = await prisma.diaryEntry.findUnique({ where: { id: sourceId } }) as Record<string, unknown> | null
      break
    case 'weekly':
      record = await prisma.weeklyPlan.findUnique({ where: { id: sourceId }, include: { todos: true } }) as Record<string, unknown> | null
      break
    case 'note':
      record = await prisma.note.findUnique({ where: { id: sourceId } }) as Record<string, unknown> | null
      break
    case 'article':
      record = await prisma.curatedArticle.findUnique({ where: { id: sourceId } }) as Record<string, unknown> | null
      break
  }
  if (!record) return

  const text = getTextForType(sourceType, record)
  if (!text.trim()) return

  const fingerprint = await generateFingerprint(text)
  if (Object.keys(fingerprint).length === 0) return

  const title = getTitle(sourceType, record)
  const snippet = getSnippet(sourceType, record)

  // Upsert ContentNode
  const node = await prisma.contentNode.upsert({
    where: { sourceType_sourceId: { sourceType, sourceId } },
    create: { sourceType, sourceId, title, snippet, embedding: JSON.stringify(fingerprint), method: 'kimi' },
    update: { title, snippet, embedding: JSON.stringify(fingerprint), method: 'kimi' },
  })

  // Delete old edges for this node
  await prisma.contentEdge.deleteMany({
    where: { OR: [{ nodeAId: node.id }, { nodeBId: node.id }] },
  })

  // Compute similarity against all other nodes
  const allNodes = await prisma.contentNode.findMany({
    where: { id: { not: node.id }, embedding: { not: null } },
  })

  const newEdges: { nodeAId: number; nodeBId: number; weight: number }[] = []
  for (const other of allNodes) {
    if (!other.embedding) continue
    const otherFingerprint = JSON.parse(other.embedding) as KeywordFingerprint
    const similarity = computeSimilarity(fingerprint, otherFingerprint)
    if (similarity >= SIMILARITY_THRESHOLD) {
      const [a, b] = node.id < other.id ? [node.id, other.id] : [other.id, node.id]
      newEdges.push({ nodeAId: a, nodeBId: b, weight: similarity })
    }
  }

  // Batch insert edges
  for (const edge of newEdges) {
    await prisma.contentEdge.upsert({
      where: { nodeAId_nodeBId: { nodeAId: edge.nodeAId, nodeBId: edge.nodeBId } },
      create: edge,
      update: { weight: edge.weight },
    })
  }
}

// Remove a content node (edges cascade-delete)
export async function removeContentNode(sourceType: string, sourceId: number): Promise<void> {
  await prisma.contentNode.deleteMany({
    where: { sourceType, sourceId },
  })
}

// Rebuild all embeddings (admin operation)
export async function rebuildAllEmbeddings(): Promise<{ total: number; processed: number; errors: number }> {
  let processed = 0
  let errors = 0
  const items: { type: string; id: number }[] = []

  const diaries = await prisma.diaryEntry.findMany({ select: { id: true } })
  items.push(...diaries.map(d => ({ type: 'diary', id: d.id })))

  const weeklys = await prisma.weeklyPlan.findMany({ select: { id: true } })
  items.push(...weeklys.map(w => ({ type: 'weekly', id: w.id })))

  const notes = await prisma.note.findMany({ select: { id: true } })
  items.push(...notes.map(n => ({ type: 'note', id: n.id })))

  const articles = await prisma.curatedArticle.findMany({ select: { id: true } })
  items.push(...articles.map(a => ({ type: 'article', id: a.id })))

  const total = items.length

  for (const item of items) {
    try {
      await embedContent(item.type, item.id)
      processed++
      // Rate limit: 500ms between Kimi calls
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (e) {
      console.error(`Failed to embed ${item.type}/${item.id}:`, e instanceof Error ? e.message : e)
      errors++
    }
  }

  return { total, processed, errors }
}
