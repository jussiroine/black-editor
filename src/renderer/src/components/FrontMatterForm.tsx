import React, { useRef, useState } from 'react'
import type { FrontMatter } from '../../../shared/types'
import { generateSlug, todayIso } from '../utils/calculations'
import PREDEFINED_TAGS from '../../../../tags.json'

interface FrontMatterFormProps {
  frontMatter: FrontMatter
  onChange: (fm: FrontMatter) => void
}

export default function FrontMatterForm({
  frontMatter,
  onChange
}: FrontMatterFormProps): React.ReactElement {
  const heroInputRef = useRef<HTMLInputElement>(null)
  const [tagInput, setTagInput] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [heroUploading, setHeroUploading] = useState(false)
  const [heroError, setHeroError] = useState('')

  const suggestions = tagInput.trim()
    ? PREDEFINED_TAGS.filter(
        (t) => t.includes(tagInput.toLowerCase()) && !frontMatter.tags.includes(t)
      )
    : []

  const inlineCompletion = tagInput.trim()
    ? PREDEFINED_TAGS.find(
        (t) => t.startsWith(tagInput.toLowerCase()) && !frontMatter.tags.includes(t)
      ) ?? null
    : null

  function set<K extends keyof FrontMatter>(key: K, value: FrontMatter[K]): void {
    onChange({ ...frontMatter, [key]: value })
  }

  function handleTitleBlur(): void {
    if (!frontMatter.slug && frontMatter.title) {
      set('slug', generateSlug(frontMatter.title))
    }
  }

  function addTag(raw: string): void {
    const tag = raw.trim().toLowerCase()
    if (!tag) return
    if (!frontMatter.tags.includes(tag)) {
      set('tags', [...frontMatter.tags, tag])
    }
    setTagInput('')
    setActiveIndex(-1)
  }

  function removeTag(tag: string): void {
    set('tags', frontMatter.tags.filter((t) => t !== tag))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Tab' && inlineCompletion) {
      e.preventDefault()
      setTagInput(inlineCompletion)
      setActiveIndex(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setTagInput('')
      setActiveIndex(-1)
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        addTag(suggestions[activeIndex])
      } else {
        addTag(tagInput)
      }
    } else if (e.key === 'Backspace' && !tagInput && frontMatter.tags.length > 0) {
      removeTag(frontMatter.tags[frontMatter.tags.length - 1])
    }
  }

  async function handleHeroImageChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    setHeroUploading(true)
    setHeroError('')
    try {
      const arrayBuf = await file.arrayBuffer()
      const buffer = Array.from(new Uint8Array(arrayBuf))
      const result = await window.api.azure.uploadImage(buffer, file.name, file.type)
      if (result.ok) {
        onChange({
          ...frontMatter,
          image: result.data,
          alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
        })
      } else {
        setHeroError(result.error)
      }
    } finally {
      setHeroUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="fm-form">
      {/* Row 1: title + slug */}
      <div className="fm-row fm-row-2">
        <div className="field">
          <label>Title</label>
          <input
            type="text"
            value={frontMatter.title}
            onChange={(e) => set('title', e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Post title"
          />
        </div>
        <div className="field">
          <label>Slug</label>
          <input
            type="text"
            value={frontMatter.slug}
            onChange={(e) => set('slug', e.target.value)}
            placeholder="auto-from-title"
          />
        </div>
      </div>

      {/* Row 2: description */}
      <div className="field">
        <label>Description</label>
        <textarea
          value={frontMatter.description}
          onChange={(e) => set('description', e.target.value)}
          rows={2}
          placeholder="Brief summary of the post"
        />
      </div>

      {/* Row 3: author + date + status */}
      <div className="fm-row fm-row-3">
        <div className="field">
          <label>Author</label>
          <input
            type="text"
            value={frontMatter.author.name}
            onChange={(e) => set('author', { ...frontMatter.author, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={frontMatter.date || todayIso()}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Status</label>
          <select
            value={frontMatter.status}
            onChange={(e) => set('status', e.target.value as 'published' | 'draft')}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {/* Row 4: read time */}
      <div className="fm-row fm-row-2">
        <div className="field">
          <label>Read time (auto)</label>
          <input
            type="text"
            value={frontMatter.readTime}
            readOnly
            style={{ color: 'var(--text-secondary)', cursor: 'default' }}
          />
        </div>
      </div>

      {/* Row 5: tags */}
      <div className="field">
        <label>Tags</label>
        <div className="tags-input-wrapper">
          {frontMatter.tags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} title="Remove tag">×</button>
            </span>
          ))}
          <div className="tags-input-container">
            <input
              type="text"
              className="tags-inline-input"
              value={tagInput}
              onChange={(e) => { setTagInput(e.target.value); setActiveIndex(-1) }}
              onKeyDown={handleTagKeyDown}
              onBlur={() => addTag(tagInput)}
              placeholder={frontMatter.tags.length === 0 ? 'Add tags…' : ''}
              autoComplete="off"
            />
            {inlineCompletion && tagInput.length > 0 && (
              <span className="tag-ghost-text" aria-hidden="true">
                <span style={{ visibility: 'hidden' }}>{tagInput}</span>
                {inlineCompletion.slice(tagInput.length)}
              </span>
            )}
            {suggestions.length > 0 && (
              <ul className="tags-suggestions" role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    key={s}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={`tags-suggestion-item${i === activeIndex ? ' tags-suggestion-item--active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Row 6: hero image */}
      <div className="fm-row fm-row-hero">
        <div className="field" style={{ flex: 1 }}>
          <label>Hero image</label>
          <div className="hero-image-row">
            {frontMatter.image ? (
              <div className="hero-preview">
                <img src={frontMatter.image} alt={frontMatter.alt} />
                <button
                  type="button"
                  className="hero-remove-btn"
                  onClick={() => { set('image', ''); set('alt', '') }}
                  title="Remove hero image"
                >×</button>
              </div>
            ) : (
              <button
                type="button"
                className="btn hero-upload-btn"
                onClick={() => heroInputRef.current?.click()}
                disabled={heroUploading}
              >
                {heroUploading ? <><span className="spinner" /> Uploading…</> : '↑ Upload hero image'}
              </button>
            )}
            {heroError && <span className="field-error">{heroError}</span>}
          </div>
        </div>
        {frontMatter.image && (
          <div className="field" style={{ flex: 1 }}>
            <label>Hero image alt text</label>
            <input
              type="text"
              value={frontMatter.alt}
              onChange={(e) => set('alt', e.target.value)}
              placeholder="Describe the image"
            />
          </div>
        )}
      </div>

      <input
        ref={heroInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleHeroImageChange}
      />
    </div>
  )
}
