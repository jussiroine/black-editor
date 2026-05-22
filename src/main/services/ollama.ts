let _url = 'http://localhost:11434'
let _model = 'qwen3.6:27b'

export function initOllama(url: string, model: string): void {
  _url = url || 'http://localhost:11434'
  _model = model || 'qwen3.6:27b'
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

export async function generateAbstract(content: string): Promise<string> {
  const plain = stripMarkdown(content)
  const excerpt = plain.split(/\s+/).slice(0, 600).join(' ')
  const prompt =
    'You\'re writing a short intro blurb for a blog post. Your job is to orient a reader to what the post is about so they can decide whether to read it — not' + 
    'to summarize it. You\'ll be given the full text of the post. Write 2–4 sentences that:' +
    '- State the topic and the central question, problem, or argument the post\n' +
    '  engages with.\n' +
    '- Convey why it matters or who it\'s for, when that\'s clear from the post.\n' +
    '- Do NOT reveal the post\'s conclusions, recommendations, or final takeaways —\n' +
    '  leave the reader a reason to read on.\n' +
    '- Do NOT walk through the post\'s structure or enumerate what each section covers.\n' +
    'Match the tone of the post. Write in plain, direct prose, in the third person' +
    ' about the subject matter. Don\'t open with meta-phrases like "In this post" or ' +
    '"This article explores" — start with the substance. Output only the intro ' +
    'text: no heading, label, or quotation marks.' +
    'Return ONLY the summary text with no markdown formatting or additional commentary.\n\n' +
    excerpt
  return ollamaGenerate(prompt)
}
