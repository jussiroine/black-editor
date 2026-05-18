import React, { useEffect, useRef, useState } from 'react'
import FrontMatterForm from '../components/FrontMatterForm'
import EditorComponent from '../components/Editor'
import type { AppConfig, FrontMatter, LoadedPost } from '../../../shared/types'
import { calculateReadTime, generateSlug, todayIso } from '../utils/calculations'

function extractImageUrls(markdown: string): string[] {
  const mdImages = [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1])
  const htmlImages = [...markdown.matchAll(/<img[^>]+src=["']([^"']+)["']/g)].map((m) => m[1])
  return Array.from(new Set([...mdImages, ...htmlImages]))
}

interface AssetPanelProps {
  filePath: string
  heroImage: string
  content: string
  onClose: () => void
}

function AssetPanel({ filePath, heroImage, content, onClose }: AssetPanelProps): React.ReactElement {
  const embeddedImages = extractImageUrls(content)
  const allImages = Array.from(new Set([heroImage, ...embeddedImages].filter(Boolean)))

  return (
    <div className="asset-panel">
      <div className="asset-panel-header">
        <span className="asset-panel-title">Post Assets</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
      </div>
      <div className="asset-panel-body">
        <div className="asset-section">
          <div className="asset-label">MDX file</div>
          <div className="asset-value asset-mono">{filePath || <em>not yet saved</em>}</div>
        </div>
        <div className="asset-section">
          <div className="asset-label">Images ({allImages.length})</div>
          {allImages.length === 0 ? (
            <div className="asset-empty">No images found</div>
          ) : (
            <ul className="asset-image-list">
              {allImages.map((url) => (
                <li key={url} className="asset-image-item">
                  {heroImage === url && <span className="asset-badge">hero</span>}
                  <a
                    href={url}
                    title={url}
                    target="_blank"
                    rel="noreferrer"
                    className="asset-url"
                  >
                    {url}
                  </a>
                  <button
                    type="button"
                    className="asset-copy-btn"
                    title="Copy URL"
                    onClick={() => navigator.clipboard.writeText(url)}
                  >
                    ⎘
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

interface EditorScreenProps {
  post: LoadedPost | null // null = new post
  config: AppConfig
  onSaved: (post: LoadedPost) => void
  onBack: () => void
  onSettings: () => void
}

function defaultFrontMatter(author: string): FrontMatter {
  return {
    title: '',
    date: todayIso(),
    description: '',
    image: '',
    alt: '',
    author: { name: author, role: '', bio: '', image: '', alt: author },
    category: '',
    readTime: '1 min read',
    tags: [],
    slug: '',
    status: 'draft'
  }
}

export default function EditorScreen({
  post,
  config,
  onSaved,
  onBack,
  onSettings
}: EditorScreenProps): React.ReactElement {
  const isNew = !post

  const [frontMatter, setFrontMatter] = useState<FrontMatter>(
    post ? post.frontMatter : defaultFrontMatter(config.author)
  )
  const [content, setContent] = useState(post ? post.content : '')
  const [sha, setSha] = useState<string | undefined>(post?.sha)
  const [filePath, setFilePath] = useState<string>(post?.path ?? '')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuggestingTags, setIsSuggestingTags] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const contentRef = useRef(content)

  // Always-fresh ref so the autosave interval captures latest state without re-subscribing
  const autosaveRef = useRef<() => void>(() => {})
  useEffect(() => {
    autosaveRef.current = () => {
      if (isDirty && !isSaving && frontMatter.title.trim()) {
        void handleSave()
      }
    }
  })

  // Autosave every 2 minutes
  useEffect(() => {
    const AUTOSAVE_MS = 2 * 60 * 1000
    const timer = setInterval(() => autosaveRef.current(), AUTOSAVE_MS)
    return () => clearInterval(timer)
  }, [])

  // Warn before window close when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent): void => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Sync window title with post title + dirty indicator
  useEffect(() => {
    const title = frontMatter.title || (isNew ? 'New Post' : 'Untitled')
    document.title = `${isDirty ? '• ' : ''}${title} — Black Editor`
    return () => { document.title = 'Black Editor' }
  }, [frontMatter.title, isDirty, isNew])

  // When a different post is loaded from outside, reset state
  useEffect(() => {
    const fm = post ? post.frontMatter : defaultFrontMatter(config.author)
    setFrontMatter(fm)
    const c = post ? post.content : ''
    setContent(c)
    contentRef.current = c
    setSha(post?.sha)
    setFilePath(post?.path ?? '')
    setIsDirty(false)
    setError('')
  }, [post])

  function handleFrontMatterChange(fm: FrontMatter): void {
    setFrontMatter(fm)
    setIsDirty(true)
  }

  function handleContentChange(markdown: string): void {
    contentRef.current = markdown
    // Recalculate read time
    const rt = calculateReadTime(markdown)
    if (rt !== frontMatter.readTime) {
      setFrontMatter((prev) => ({ ...prev, readTime: rt }))
    }
    setIsDirty(true)
  }

  async function handleSuggestTags(): Promise<void> {
    setIsSuggestingTags(true)
    setError('')
    try {
      const result = await window.api.openai.suggestTags(contentRef.current)
      if (result.ok) {
        const merged = Array.from(new Set([...frontMatter.tags, ...result.data]))
        setFrontMatter((prev) => ({ ...prev, tags: merged }))
        setIsDirty(true)
      } else {
        setError(result.error)
      }
    } finally {
      setIsSuggestingTags(false)
    }
  }

  async function handleSave(): Promise<void> {
    if (!frontMatter.title.trim()) {
      setError('Title is required before saving.')
      return
    }
    if (!frontMatter.slug.trim()) {
      setFrontMatter((prev) => ({
        ...prev,
        slug: generateSlug(frontMatter.title)
      }))
    }

    setIsSaving(true)
    setError('')

    const slug = frontMatter.slug || generateSlug(frontMatter.title)
    const path = filePath || `src/content/blog/${slug}.mdx`
    const message = sha
      ? `update: ${frontMatter.title}`
      : `post: ${frontMatter.title}`

    try {
      const result = await window.api.github.savePost(
        path,
        { ...frontMatter, slug },
        contentRef.current,
        sha,
        message
      )
      if (result.ok) {
        const saved: LoadedPost = {
          path,
          sha: result.data,
          frontMatter: { ...frontMatter, slug },
          content: contentRef.current
        }
        setSha(result.data)
        setFilePath(path)
        setIsDirty(false)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2500)
        onSaved(saved)
      } else {
        setError(result.error)
      }
    } finally {
      setIsSaving(false)
    }
  }

  function handleBack(): void {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Discard and go back?')) return
    }
    onBack()
  }

  return (
    <div className="editor-screen">
      {/* Top bar */}
      <div className="editor-topbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleBack}>
          ← Back
        </button>
        <span className="editor-topbar-title">
          {frontMatter.title || (isNew ? 'New Post' : 'Untitled')}
          {isDirty && <span className="dirty-dot" title="Unsaved changes"> •</span>}
        </span>
        <div className="editor-topbar-actions">
          {saveSuccess && (
            <span className="save-success-msg">✓ Saved to GitHub</span>
          )}
          {error && (
            <span className="save-error-msg" title={error}>⚠ Error</span>
          )}
          <button
            type="button"
            className={`btn btn-ghost btn-sm${showInfo ? ' btn-active' : ''}`}
            onClick={() => setShowInfo((v) => !v)}
            title="Post assets"
          >
            ℹ
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onSettings}
            title="Settings"
          >
            ⚙
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <><span className="spinner" /> Saving…</> : '↑ Save to GitHub'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="editor-error-banner banner banner-error">
          {error}
          <button type="button" onClick={() => setError('')} style={{ float: 'right', background: 'none', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Assets info panel */}
      {showInfo && (
        <AssetPanel
          filePath={filePath}
          heroImage={frontMatter.image}
          content={content}
          onClose={() => setShowInfo(false)}
        />
      )}

      {/* Scrollable body */}
      <div className="editor-body">
        {/* Front matter form */}
        <div className="fm-section">
          <FrontMatterForm
            frontMatter={frontMatter}
            onChange={handleFrontMatterChange}
            onSuggestTags={handleSuggestTags}
            isSuggestingTags={isSuggestingTags}
          />
        </div>

        <hr className="fm-divider" />

        {/* TipTap editor */}
        <EditorComponent
          content={content}
          onChange={handleContentChange}
        />
      </div>
    </div>
  )
}
