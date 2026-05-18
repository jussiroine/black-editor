import { type Editor } from '@tiptap/react'
import React, { useRef, useState } from 'react'

interface ToolbarProps {
  editor: Editor | null
  onInsertImage: () => void
}

export default function Toolbar({ editor, onInsertImage }: ToolbarProps): React.ReactElement {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)

  if (!editor) return <div className="toolbar" />

  const btn = (    label: string,
    title: string,
    active: boolean,
    action: () => void,
    disabled = false
  ) => (
    <button
      key={title}
      className={`toolbar-btn${active ? ' is-active' : ''}`}
      title={title}
      onClick={action}
      disabled={disabled}
      type="button"
    >
      {label}
    </button>
  )

  function openLinkPopover(): void {
    const existing = editor.getAttributes('link').href as string | undefined
    setLinkUrl(existing ?? '')
    setLinkOpen(true)
    setTimeout(() => linkInputRef.current?.focus(), 0)
  }

  function applyLink(): void {
    const href = linkUrl.trim()
    if (href) {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    setLinkOpen(false)
    setLinkUrl('')
  }

  function cancelLink(): void {
    setLinkOpen(false)
    setLinkUrl('')
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {btn('B', 'Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
        {btn('I', 'Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
        {btn('S', 'Strikethrough', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run())}
        {btn('`', 'Inline code', editor.isActive('code'), () => editor.chain().focus().toggleCode().run())}
      </div>

      <div className="toolbar-sep" />

      <div className="toolbar-group">
        {btn('H1', 'Heading 1', editor.isActive('heading', { level: 1 }), () =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        )}
        {btn('H2', 'Heading 2', editor.isActive('heading', { level: 2 }), () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        )}
        {btn('H3', 'Heading 3', editor.isActive('heading', { level: 3 }), () =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        )}
      </div>

      <div className="toolbar-sep" />

      <div className="toolbar-group">
        {btn('•—', 'Bullet list', editor.isActive('bulletList'), () =>
          editor.chain().focus().toggleBulletList().run()
        )}
        {btn('1.', 'Ordered list', editor.isActive('orderedList'), () =>
          editor.chain().focus().toggleOrderedList().run()
        )}
        {btn('"', 'Blockquote', editor.isActive('blockquote'), () =>
          editor.chain().focus().toggleBlockquote().run()
        )}
        {btn('```', 'Code block', editor.isActive('codeBlock'), () =>
          editor.chain().focus().toggleCodeBlock().run()
        )}
      </div>

      <div className="toolbar-sep" />

      <div className="toolbar-group">
        {btn('⎵—', 'Horizontal rule', false, () =>
          editor.chain().focus().setHorizontalRule().run()
        )}
        {btn('↩', 'Hard break', false, () =>
          editor.chain().focus().setHardBreak().run()
        )}
      </div>

      <div className="toolbar-sep" />

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          title="Insert image (upload to Azure)"
          onClick={onInsertImage}
          type="button"
        >
          🖼
        </button>
        <div className="toolbar-link-wrap">
          <button
            className={`toolbar-btn${editor.isActive('link') ? ' is-active' : ''}`}
            title="Insert / edit link"
            onClick={openLinkPopover}
            type="button"
          >
            🔗
          </button>
          {linkOpen && (
            <div className="toolbar-link-popover">
              <input
                ref={linkInputRef}
                type="url"
                className="toolbar-link-input"
                placeholder="https://"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                  if (e.key === 'Escape') cancelLink()
                }}
              />
              <button type="button" className="toolbar-btn" onClick={applyLink} title="Apply">✓</button>
              {editor.isActive('link') && (
                <button
                  type="button"
                  className="toolbar-btn"
                  title="Remove link"
                  onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); cancelLink() }}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-sep" />

      <div className="toolbar-group">
        {btn('↩', 'Undo', false, () => editor.chain().focus().undo().run(), !editor.can().undo())}
        {btn('↪', 'Redo', false, () => editor.chain().focus().redo().run(), !editor.can().redo())}
      </div>
    </div>
  )
}
