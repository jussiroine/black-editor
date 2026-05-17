import React from 'react'
import type { PostMeta } from '../../../shared/types'

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

        {posts.map((post) => (
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
