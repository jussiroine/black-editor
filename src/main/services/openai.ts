import OpenAI from 'openai'

let _client: OpenAI | undefined

export function initOpenAI(apiKey: string): void {
  _client = new OpenAI({ apiKey })
}

export function isOpenAIReady(): boolean {
  return !!_client
}

