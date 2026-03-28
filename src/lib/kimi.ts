import OpenAI from 'openai'
import { prisma } from './prisma'

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

function createClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.moonshot.cn/v1',
    timeout: 120_000,
    maxRetries: 1,
  })
}

function buildParams(model: string) {
  const isK2 = model.startsWith('kimi-k2')
  return isK2 ? {} : { temperature: 0.3 }
}

export async function generateSummary(content: string): Promise<string> {
  const settings = await getAISettings()
  if (!settings.apiKey) throw new Error('未配置 API Key，请在 .env.local 中设置 KIMI_API_KEY')

  const client = createClient(settings.apiKey)
  const plainText = content.replace(/<[^>]*>/g, '').slice(0, 8000)

  const response = await client.chat.completions.create({
    model: settings.model,
    messages: [
      { role: 'system', content: '你是一个笔记摘要助手。请对以下内容生成简洁的中文摘要，提取关键要点。' },
      { role: 'user', content: plainText },
    ],
    ...buildParams(settings.model),
  })

  return response.choices[0]?.message?.content || ''
}

export interface ArticleAnalysis {
  summary: string
  keyPoints: string[]
  tags: string[]
  category: string
}

export async function analyzeArticle(content: string): Promise<ArticleAnalysis> {
  const settings = await getAISettings()
  if (!settings.apiKey) throw new Error('未配置 API Key，请在 .env.local 中设置 KIMI_API_KEY')

  const client = createClient(settings.apiKey)
  const plainText = content.replace(/<[^>]*>/g, '').slice(0, 8000)

  const response = await client.chat.completions.create({
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: `你是一个文章速读助手。请对以下文章进行深度分析，返回 JSON 格式：
{
  "summary": "详细的速读内容，使用 Markdown 格式",
  "keyPoints": ["要点1", "要点2", "要点3"],
  "tags": ["标签1", "标签2", "标签3"],
  "category": "tech"
}

速读要求：
- 500-800字，让读者不用看原文也能掌握核心内容
- 使用 Markdown 格式：**加粗**关键概念，用列表组织要点
- 结构：先用1-2句话概括主旨，然后分点列出核心观点和关键细节
- 保留重要的数据、案例和结论

关键要点要求：3-7个，每个要点一句话概括，抓住文章最核心的信息。

标签要求：3-5个，简短精炼（2-4个字），反映文章主题和领域。

分类要求：必须是以下之一：tech|finance|health|education|lifestyle|business|other
只返回 JSON，不要其他内容。`,
      },
      { role: 'user', content: plainText },
    ],
    ...buildParams(settings.model),
  })

  const text = response.choices[0]?.message?.content || ''

  try {
    // Extract JSON from response (may have markdown code block)
    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    const validCategories = ['tech', 'finance', 'health', 'education', 'lifestyle', 'business', 'other']
    return {
      summary: parsed.summary || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      category: validCategories.includes(parsed.category) ? parsed.category : 'other',
    }
  } catch {
    // Fallback: treat entire response as summary
    return { summary: text, keyPoints: [], tags: [], category: 'other' }
  }
}
