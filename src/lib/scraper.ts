import * as cheerio from 'cheerio'

interface ArticleMeta {
  title: string
  image: string | null
  content: string
  source: string
}

export async function scrapeArticle(url: string): Promise<ArticleMeta> {
  // Validate URL protocol
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are supported')
  }

  // AbortController with 15s timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)

    const html = await res.text()
    const $ = cheerio.load(html)

    // Detect source
    const isWechat = url.includes('mp.weixin.qq.com')
    const source = isWechat ? 'wechat' : parsed.hostname

    let title = ''
    let image: string | null = null
    let content = ''

    if (isWechat) {
      title = $('h1#activity-name').text().trim() ||
              $('meta[property="og:title"]').attr('content') || ''
      image = $('meta[property="og:image"]').attr('content') ||
              $('#js_content img').first().attr('data-src') ||
              $('#js_content img').first().attr('src') || null
      content = $('#js_content').text().replace(/\s+/g, ' ').trim()
    } else {
      title = $('meta[property="og:title"]').attr('content') ||
              $('title').text().trim() || ''
      image = $('meta[property="og:image"]').attr('content') ||
              $('meta[name="twitter:image"]').attr('content') || null
      content = $('article').text().trim() ||
                $('main').text().trim() ||
                $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000)
    }

    if (!title) throw new Error('Could not extract article title')

    return { title, image, content: content.slice(0, 8000), source }
  } finally {
    clearTimeout(timeout)
  }
}
