import React, { useEffect, useRef, useState } from 'react'
import type { PostMeta } from '../../../shared/types'

type PostStatus = 'pending' | 'fetching' | 'generating' | 'saving' | 'done' | 'error'

interface PostProgress {
  meta: PostMeta
  status: PostStatus
  error?: string
}

interface BulkEditModalProps {
  posts: PostMeta[]
  operations: ('description')[]
  onClose: (didChange: boolean) => void
}

function statusIcon(status: PostStatus): React.ReactNode {
  if (status === 'done') return <span className="bulk-icon bulk-icon-done">✓</span>
  if (status === 'error') return <span className="bulk-icon bulk-icon-error">✗</span>
  if (status === 'pending') return <span className="bulk-icon bulk-icon-pending">○</span>
  return <span className="spinner bulk-icon" />
}

function statusLabel(status: PostStatus): string {
  if (status === 'fetching') return 'Fetching…'
  if (status === 'generating') return 'Generating…'
  if (status === 'saving') return 'Saving…'
  return ''
}

export default function BulkEditModal({
  posts,
  operations,
  onClose
}: BulkEditModalProps): React.ReactElement {
  const [progress, setProgress] = useState<PostProgress[]>(
    posts.map((meta) => ({ meta, status: 'pending' }))
  )
  const [running, setRunning] = useState(true)
  const [changedCount, setChangedCount] = useState(0)
  const cancelledRef = useRef(false)

  function setPostStatus(path: string, status: PostStatus, error?: string): void {
    setProgress((prev) =>
      prev.map((p) =>
        p.meta.path === path ? { ...p, status, error } : p
      )
    )
  }

  useEffect(() => {
    const postsSnap = posts
    const opsSnap = operations

    async function run(): Promise<void> {
      let changed = 0
      for (const meta of postsSnap) {
        if (cancelledRef.current) break

        // 1. Fetch full post
        setPostStatus(meta.path, 'fetching')
        const postResult = await window.api.github.getPost(meta.path)
        if (!postResult.ok) {
          setPostStatus(meta.path, 'error', postResult.error)
          continue
        }

        const loaded = postResult.data
        let fm = { ...loaded.frontMatter }

        // 2. Generate abstract for this post
        setPostStatus(meta.path, 'generating')
        const descResult = opsSnap.includes('description')
          ? await window.api.ollama.generateAbstract(loaded.content)
          : null

        if (descResult?.ok) {
          fm = { ...fm, description: descResult.data }
        }

        // 3. Save back to GitHub
        setPostStatus(meta.path, 'saving')
        let saveResult = await window.api.github.savePost(
          meta.path,
          fm,
          loaded.content,
          loaded.sha,
          'bulk: update frontmatter'
        )

        // Retry once on 409 (stale SHA — re-fetch and apply same changes)
        if (!saveResult.ok && saveResult.error?.includes('409')) {
          const retryFetch = await window.api.github.getPost(meta.path)
          if (retryFetch.ok) {
            let freshFm = { ...retryFetch.data.frontMatter }
            if (opsSnap.includes('description') && descResult?.ok) {
              freshFm = { ...freshFm, description: descResult.data }
            }
            saveResult = await window.api.github.savePost(
              meta.path,
              freshFm,
              retryFetch.data.content,
              retryFetch.data.sha,
              'bulk: update frontmatter'
            )
          }
        }

        if (saveResult.ok) {
          setPostStatus(meta.path, 'done')
          changed++
        } else {
          setPostStatus(meta.path, 'error', saveResult.error)
        }
      }

      setChangedCount(changed)
      setRunning(false)
    }

    void run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const opLabel = 'abstracts'

  return (
    <div className="bulk-modal-overlay">
      <div className="bulk-modal">
        <div className="bulk-modal-header">
          <span className="bulk-modal-title">Generating {opLabel}</span>
        </div>

        <div className="bulk-modal-body">
          {progress.map(({ meta, status, error }) => (
            <div key={meta.path} className={`bulk-post-row bulk-status-${status}`}>
              {statusIcon(status)}
              <div className="bulk-post-info">
                <span className="bulk-post-name">{meta.name.replace(/\.mdx$/, '')}</span>
                {error ? (
                  <span className="bulk-post-detail bulk-post-error" title={error}>{error}</span>
                ) : (
                  statusLabel(status) && (
                    <span className="bulk-post-detail">{statusLabel(status)}</span>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bulk-modal-footer">
          {running ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { cancelledRef.current = true }}
            >
              Cancel
            </button>
          ) : (
            <>
              <span className="bulk-summary">
                {changedCount} of {posts.length} post{posts.length !== 1 ? 's' : ''} updated
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onClose(changedCount > 0)}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
