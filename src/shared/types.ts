export interface Author {
  name: string
  role: string
  bio: string
  image: string
  alt: string
}

export interface FrontMatter {
  title: string
  date: string // ISO date string e.g. "2026-05-17"
  description: string
  image: string // Azure Blob URL for hero image
  alt: string // hero image alt text
  author: Author
  readTime: string // e.g. "6 min read"
  tags: string[]
  slug: string
  status: 'published' | 'draft'
}

export interface PostMeta {
  path: string  // e.g. "src/content/blog/my-post.mdx"
  name: string  // e.g. "my-post.mdx"
  sha: string
  status: 'published' | 'draft'
  date: string  // ISO date from frontmatter e.g. "2026-05-17", or ""
  title: string // post title from frontmatter, or ""
}

export interface LoadedPost {
  path: string
  sha: string
  frontMatter: FrontMatter
  content: string // markdown body without front matter
}

export interface AppConfig {
  github: {
    repo: string // "owner/repo"
    branch: string // "main"
    clientId: string
  }
  azure: {
    container: string
  }
  ollama: {
    url: string   // default: "http://localhost:11434"
    model: string // e.g. "gemma4:e4b"
  }
  author: string
}

// Sensitive config stored encrypted separately
export interface SensitiveConfig {
  githubToken?: string
  azureConnectionString?: string
}

export type Screen = 'browser' | 'editor' | 'settings'

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface DeviceFlowResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface TokenPollResponse {
  access_token?: string
  error?: string
  error_description?: string
  interval?: number // returned by slow_down — new required polling interval in seconds
}
