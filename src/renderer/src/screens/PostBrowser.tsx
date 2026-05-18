import React, { useState } from 'react'
import type { PostMeta } from '../../../shared/types'

type SortKey = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'

function extractDate(name: string): string {
  // Matches filenames starting with YYYY-MM-DD
  return name.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? ''
}

function sortPosts(posts: PostMeta[], sort: SortKey): PostMeta[] {
  return [...posts].sort((a, b) => {
    if (sort === 'name-asc') return a.name.localeCompare(b.name)
    if (sort === 'name-desc') return b.name.localeCompare(a.name)
    const da = extractDate(a.name) || a.name
    const db = extractDate(b.name) || b.name
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
          p.path.toLowerCase().includes(query.toLowerCase())
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
            <p>No posts found in <code>src/content/blog/</code>.</p>
            <p>Create your first post with <strong>+ New Post</strong>.</p>
          </div>
        )}

        {!isLoading && posts.length > 0 && filtered.length === 0 && (
          <div className="browser-empty">
            <p>No posts match <strong>{query}</strong>.</p>
          </div>
        )}

        {filtered.map((post) => (
          <button
            key={post.path}
            type="button"
            className="browser-post-item"
            onClick={() => onOpen(post)}
          >
            <span className="browser-post-name">{post.name.replace(/\.mdx$/, '')}</span>
            <span className="browser-post-path">{post.path}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
