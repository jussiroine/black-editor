import OpenAI from 'openai'

let _client: OpenAI | undefined

export function initOpenAI(apiKey: string): void {
  _client = new OpenAI({ apiKey })
}

export function isOpenAIReady(): boolean {
  return !!_client
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function suggestTags(markdownContent: string): Promise<string[]> {
  if (!_client) throw new Error('OpenAI not configured. Please add API key in Settings.')

  const plain = stripMarkdown(markdownContent)
  const excerpt = plain.split(/\s+/).slice(0, 500).join(' ')

  const resp = await _client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant that suggests relevant tags for blog posts. ' +
          'Return ONLY a JSON array of 5-7 lowercase tag strings. No explanation, no markdown — just the JSON array.'
      },
      {
        role: 'user',
        content: `Suggest tags for this blog post:\n\n${excerpt}`
      }
    ],
    temperature: 0.3,
    max_tokens: 150
  })

  const text = resp.choices[0]?.message?.content?.trim() ?? '[]'

  try {
    const parsed = JSON.parse(text) as unknown
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    const match = text.match(/\[[\s\S]*?\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as unknown
        if (Array.isArray(parsed)) return parsed.map(String)
      } catch {
        // ignore
      }
    }
  }

  return []
}
