let _url = 'http://localhost:11434'
let _model = 'gemma4:e4b'

export function initOllama(url: string, model: string): void {
  _url = url || 'http://localhost:11434'
  _model = model || 'gemma4:e4b'
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

async function ollamaGenerate(prompt: string): Promise<string> {
  const resp = await fetch(`${_url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: _model, prompt, stream: false })
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Ollama error ${resp.status}: ${body}`)
  }
  const data = (await resp.json()) as { response?: string }
  return data.response?.trim() ?? ''
}

export async function generateDescription(content: string): Promise<string> {
  const plain = stripMarkdown(content)
  const excerpt = plain.split(/\s+/).slice(0, 600).join(' ')
  const prompt =
    'Write a 2-4 sentence summary/description for the following blog post. Use passive voice where appropriate.' +
    'Return ONLY the summary text with no markdown formatting or additional commentary.\n\n' +
    excerpt
  return ollamaGenerate(prompt)
}

export async function suggestTags(content: string): Promise<string[]> {
  const plain = stripMarkdown(content)
  const excerpt = plain.split(/\s+/).slice(0, 500).join(' ')
  const prompt =
    'Return ONLY a JSON array of 5-7 lowercase tag strings for this blog post. ' +
    'No explanation, no markdown — just the JSON array.\n\n' +
    excerpt
  const text = await ollamaGenerate(prompt)
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
