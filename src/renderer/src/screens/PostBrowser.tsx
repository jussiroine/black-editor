import React, { useState } from 'react'
import type { PostMeta } from '../../../shared/types'

type SortKey = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'

function sortPosts(posts: PostMeta[], sort: SortKey): PostMeta[] {
  return [...posts].sort((a, b) => {
    const ta = a.title || a.name
    const tb = b.title || b.name
    if (sort === 'name-asc') return ta.localeCompare(tb)
    if (sort === 'name-desc') return tb.localeCompare(ta)
    // ISO date strings sort correctly with localeCompare
    const da = a.date || ''
    const db = b.date || ''
    if (sort === 'date-asc') return da.localeCompare(db)
    return db.localeCompare(da) // date-desc
  })
}

interface PostBrowserProps {
  posts: PostMeta[]
  isLoading: boolean
  error: string
  onOpen: (meta: PostMeta) => void
  onNew: () => void
  onRefresh: () => void
  onSettings: () => void
}

export default function PostBrowser({
  posts,
  isLoading,
  error,
  onOpen,
  onNew,
  onRefresh,
  onSettings
}: PostBrowserProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('date-desc')

  const filtered = sortPosts(
    query.trim()
      ? posts.filter((p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.path.toLowerCase().includes(query.toLowerCase()) ||
          p.title.toLowerCase().includes(query.toLowerCase())
        )
      : posts,
    sort
  )

  return (
    <div className="browser-screen">
      <div className="browser-header">
        <span className="browser-logo">Black Editor</span>
        <div className="browser-header-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onSettings}>
            ⚙ Settings
          </button>
        </div>
      </div>

      <div className="browser-toolbar">
        <button type="button" className="btn btn-primary" onClick={onNew}>
          + New Post
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh post list"
        >
          {isLoading ? <span className="spinner" /> : '↻ Refresh'}
        </button>
        <input
          type="search"
          className="browser-search"
          placeholder="Search posts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="browser-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          title="Sort order"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="name-asc">A → Z</option>
          <option value="name-desc">Z → A</option>
        </select>
      </div>

      {error && (
        <div className="banner banner-error" style={{ margin: '0 24px' }}>
          {error}
        </div>
      )}

      <div className="browser-list">
        {isLoading && posts.length === 0 && (
          <div className="browser-empty">
            <span className="spinner" />
            <span>Loading posts from GitHub…</span>
          </div>
        )}

        {!isLoading && !error && posts.length === 0 && (
          <div className="browser-empty">
            <p>No posts found in <code>src/content/blog/</code> or <code>src/content/drafts/</code>.</p>
            <p>Create your first post with <strong>+ New Post</strong>.</p>
          </div>
        )}

        {!isLoading && posts.length > 0 && filtered.length === 0 && (
          <div className="browser-empty">
            <p>No posts match <strong>{query}</strong>.</p>
          </div>
        )}

        {filtered.map((post) => (
          <div
            key={post.path}
            className="browser-post-item"
            onClick={() => onOpen(post)}
          >
            <div className="browser-post-info">
              <span className="browser-post-name">
                {post.title || post.name.replace(/\.mdx$/, '')}
                {post.status === 'draft' && (
                  <span className="draft-badge">Draft</span>
                )}
              </span>
              <span className="browser-post-path">{post.path}</span>
            </div>
            {post.date && (
              <span className="browser-post-date">
                {new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            )}
          </div>
        ))}

      </div>
    </div>
  )
}
