import OpenAI from 'openai'
import { prisma } from './prisma'

async function getAISettings() {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['ai_api_key', 'ai_model', 'ai_max_tokens'] } },
  })
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value
  return {
    apiKey: map.ai_api_key || '',
    model: map.ai_model || 'moonshot-v1-32k',
    maxTokens: parseInt(map.ai_max_tokens || '1024'),
  }
}

export async function generateSummary(content: string): Promise<string> {
  const settings = await getAISettings()

  if (!settings.apiKey) {
    throw new Error('未配置 API Key，请在设置页面配置')
  }

  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: 'https://api.moonshot.cn/v1',
  })

  // Strip HTML tags for the API
  const plainText = content.replace(/<[^>]*>/g, '').slice(0, 8000)

  const isK2 = settings.model.startsWith('kimi-k2')
  const response = await client.chat.completions.create({
    model: settings.model,
    messages: [
      { role: 'system', content: '你是一个笔记摘要助手。请对以下内容生成简洁的中文摘要，提取关键要点。' },
      { role: 'user', content: plainText },
    ],
    ...(isK2
      ? { max_completion_tokens: settings.maxTokens }
      : { max_tokens: settings.maxTokens, temperature: 0.3 }
    ),
  })

  return response.choices[0]?.message?.content || ''
}
