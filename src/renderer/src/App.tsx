import React, { useCallback, useEffect, useState } from 'react'
import PostBrowser from './screens/PostBrowser'
import EditorScreen from './screens/EditorScreen'
import SettingsScreen from './screens/SettingsScreen'
import type { AppConfig, LoadedPost, PostMeta, Screen } from '../../shared/types'

const defaultConfig: AppConfig = {
  github: { repo: '', branch: 'main', clientId: '' },
  azure: { container: 'blog-images' },
  author: ''
}

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('browser')
  const [config, setConfig] = useState<AppConfig>(defaultConfig)
  const [posts, setPosts] = useState<PostMeta[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [postsError, setPostsError] = useState('')
  const [currentPost, setCurrentPost] = useState<LoadedPost | null>(null)
  const [isLoadingPost, setIsLoadingPost] = useState(false)

  // Load config on mount
  useEffect(() => {
    void (async () => {
      const result = await window.api.config.get()
      if (result.ok) {
        setConfig(result.data)
        // If fully configured, fetch posts immediately
        if (result.data.github.repo && result.data.github.clientId) {
          fetchPosts()
        }
      }
    })()
  }, [])

  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true)
    setPostsError('')
    try {
      const result = await window.api.github.listPosts()
      if (result.ok) {
        setPosts(result.data)
      } else {
        setPostsError(result.error)
      }
    } finally {
      setIsLoadingPosts(false)
    }
  }, [])

  async function openPost(meta: PostMeta): Promise<void> {
    setIsLoadingPost(true)
    setPostsError('')
    try {
      const result = await window.api.github.getPost(meta.path)
      if (result.ok) {
        setCurrentPost(result.data)
        setScreen('editor')
      } else {
        setPostsError(result.error)
      }
    } finally {
      setIsLoadingPost(false)
    }
  }

  function newPost(): void {
    setCurrentPost(null)
    setScreen('editor')
  }

  function handlePostSaved(saved: LoadedPost): void {
    setCurrentPost(saved)
    // Update post list: add or replace
    setPosts((prev) => {
      const idx = prev.findIndex((p) => p.path === saved.path)
      const meta: PostMeta = { path: saved.path, name: saved.path.split('/').pop()!, sha: saved.sha }
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = meta
        return next
      }
      return [meta, ...prev]
    })
  }

  function handleSettingsSaved(updated: AppConfig): void {
    setConfig(updated)
    setScreen('browser')
    // Refresh post list with new config
    setTimeout(() => fetchPosts(), 300)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (screen === 'settings') {
    return (
      <SettingsScreen
        config={config}
        onSaved={handleSettingsSaved}
        onBack={() => setScreen('browser')}
      />
    )
  }

  if (screen === 'editor') {
    return (
      <EditorScreen
        post={currentPost}
        config={config}
        onSaved={handlePostSaved}
        onBack={() => setScreen('browser')}
        onSettings={() => setScreen('settings')}
      />
    )
  }

  return (
    <div className="app">
      {/* Setup nudge when GitHub is not configured */}
      {!config.github.repo && (
        <div className="setup-banner banner banner-info">
          GitHub repository not configured.{' '}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            style={{ marginLeft: 10 }}
            onClick={() => setScreen('settings')}
          >
            Open Settings
          </button>
        </div>
      )}

      {isLoadingPost && (
        <div className="fullscreen-loading">
          <span className="spinner" />
          <span>Opening post…</span>
        </div>
      )}

      <PostBrowser
        posts={posts}
        isLoading={isLoadingPosts}
        error={postsError}
        onOpen={openPost}
        onNew={newPost}
        onRefresh={fetchPosts}
        onSettings={() => setScreen('settings')}
      />
    </div>
  )
}
