import matter from 'gray-matter'
import type {
  Author,
  DeviceFlowResponse,
  FrontMatter,
  LoadedPost,
  PostMeta,
  TokenPollResponse
} from '../../shared/types'

const GITHUB_API = 'https://api.github.com'
const POSTS_PATH = 'src/content/blog'

let _token: string | undefined
let _repo: string | undefined // "owner/repo"
let _branch: string | undefined

export function initGitHub(token: string, repo: string, branch: string): void {
  _token = token
  _repo = repo
  _branch = branch
}

export function isGitHubReady(): boolean {
  return !!(_token && _repo)
}

function parseRepo(repo: string): { owner: string; repo: string } {
  const [owner, name] = repo.split('/')
  if (!owner || !name) throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`)
  return { owner, repo: name }
}

async function ghFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!_token) throw new Error('GitHub not authenticated. Please connect in Settings.')
  const resp = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `token ${_token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Black-Editor/1.0',
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
  return resp
}

export async function listPosts(): Promise<PostMeta[]> {
  const { owner, repo } = parseRepo(_repo!)
  const resp = await ghFetch(
    `/repos/${owner}/${repo}/contents/${POSTS_PATH}?ref=${encodeURIComponent(_branch!)}`
  )
  if (resp.status === 404) return [] // directory doesn't exist yet
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`GitHub API error ${resp.status}: ${body}`)
  }
  const data = (await resp.json()) as Array<{
    type: string
    name: string
    path: string
    sha: string
  }>
  if (!Array.isArray(data)) throw new Error('Expected directory listing from GitHub')
  return data
    .filter((f) => f.type === 'file' && f.name.endsWith('.mdx'))
    .map((f) => ({ path: f.path, name: f.name, sha: f.sha }))
}

export async function getPost(filePath: string): Promise<LoadedPost> {
  const { owner, repo } = parseRepo(_repo!)
  const resp = await ghFetch(
    `/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(_branch!)}`
  )
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`GitHub API error ${resp.status}: ${body}`)
  }
  const data = (await resp.json()) as { type: string; content: string; sha: string }
  if (data.type !== 'file') throw new Error('Expected a file')

  const raw = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
  const parsed = matter(raw)
  const fm = parsed.data as Partial<FrontMatter>

  return {
    path: filePath,
    sha: data.sha,
    content: parsed.content.trim(),
    frontMatter: {
      title: fm.title ?? '',
      date: fm.date instanceof Date
        ? fm.date.toISOString().slice(0, 10)
        : (fm.date ? String(fm.date).slice(0, 10) : new Date().toISOString().slice(0, 10)),
      description: fm.description ?? '',
      image: fm.image ?? '',
      alt: fm.alt ?? '',
      author: (() => {
        const a = fm.author as unknown
        if (typeof a === 'object' && a !== null) {
          const ao = a as Record<string, unknown>
          return {
            name: typeof ao.name === 'string' ? ao.name : '',
            role: typeof ao.role === 'string' ? ao.role : '',
            bio: typeof ao.bio === 'string' ? ao.bio : '',
            image: typeof ao.image === 'string' ? ao.image : '',
            alt: typeof ao.alt === 'string' ? ao.alt : ''
          } satisfies Author
        }
        const name = typeof a === 'string' ? a : ''
        return { name, role: '', bio: '', image: '', alt: name } satisfies Author
      })(),
      category: fm.category ?? '',
      readTime: typeof fm.readTime === 'number'
        ? `${fm.readTime} min read`
        : (typeof fm.readTime === 'string' ? fm.readTime : '1 min read'),
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      slug: fm.slug ?? '',
      status: fm.status === 'published' ? 'published' : 'draft'
    }
  }
}

export async function savePost(
  filePath: string,
  frontMatter: FrontMatter,
  content: string,
  sha: string | undefined,
  message: string
): Promise<string> {
  const { owner, repo } = parseRepo(_repo!)
  const fileContent = matter.stringify('\n' + content.trim() + '\n', frontMatter as unknown as Record<string, unknown>)
  const encoded = Buffer.from(fileContent).toString('base64')

  const body: Record<string, unknown> = {
    message,
    content: encoded,
    branch: _branch
  }
  if (sha) body.sha = sha

  const resp = await ghFetch(`/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`GitHub save error ${resp.status}: ${errBody}`)
  }
  const data = (await resp.json()) as { content: { sha: string } }
  return data.content?.sha ?? ''
}

// GitHub Device Flow -------------------------------------------------------

export async function startDeviceFlow(clientId: string): Promise<DeviceFlowResponse> {
  const resp = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope: 'repo' })
  })
  if (!resp.ok) throw new Error(`Device flow request failed: ${resp.status}`)
  return resp.json() as Promise<DeviceFlowResponse>
}

export async function pollDeviceToken(
  clientId: string,
  deviceCode: string
): Promise<TokenPollResponse> {
  const resp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  })
  if (!resp.ok) throw new Error(`Token poll failed: ${resp.status}`)
  return resp.json() as Promise<TokenPollResponse>
}
