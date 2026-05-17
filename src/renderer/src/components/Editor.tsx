import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExtension from '@tiptap/extension-image'
import LinkExtension from '@tiptap/extension-link'
import TableExtension from '@tiptap/extension-table'
import TableRowExtension from '@tiptap/extension-table-row'
import TableCellExtension from '@tiptap/extension-table-cell'
import TableHeaderExtension from '@tiptap/extension-table-header'
import PlaceholderExtension from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import Toolbar from './Toolbar'
import type { Editor } from '@tiptap/react'

interface EditorProps {
  content: string // initial markdown content
  onChange: (markdown: string) => void
  onEditorReady?: (editor: Editor) => void
}

async function uploadFileToAzure(file: File): Promise<string | null> {
  const arrayBuf = await file.arrayBuffer()
  const buffer = Array.from(new Uint8Array(arrayBuf))
  const result = await window.api.azure.uploadImage(
    buffer,
    file.name || 'image.png',
    file.type || 'image/png'
  )
  if (result.ok) return result.data
  console.error('Image upload failed:', result.error)
  return null
}

export default function EditorComponent({ content, onChange, onEditorReady }: EditorProps): React.ReactElement {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const initialised = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { languageClassPrefix: 'language-' }
      }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      TableExtension.configure({ resizable: false }),
      TableRowExtension,
      TableCellExtension,
      TableHeaderExtension,
      PlaceholderExtension.configure({
        placeholder: 'Start writing your post…'
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        transformCopiedText: true,
        transformPastedText: false // we handle paste manually
      })
    ],
    content: '',
    editorProps: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? [])
        const imageItem = items.find((item) => item.type.startsWith('image/'))
        if (imageItem) {
          event.preventDefault()
          const file = imageItem.getAsFile()
          if (!file) return false
          void uploadFileToAzure(file).then((url) => {
            if (url) {
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes.image.create({ src: url })
                )
              )
            }
          })
          return true
        }
        return false
      },
      handleDrop(view, event, _slice, moved) {
        if (!moved) {
          const items = Array.from(event.dataTransfer?.items ?? [])
          const imageItem = items.find((item) => item.type.startsWith('image/'))
          if (imageItem) {
            event.preventDefault()
            const file = imageItem.getAsFile()
            if (!file) return false
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
            void uploadFileToAzure(file).then((url) => {
              if (url) {
                const pos = coords?.pos ?? view.state.doc.content.size
                view.dispatch(
                  view.state.tr.insert(pos, view.state.schema.nodes.image.create({ src: url }))
                )
              }
            })
            return true
          }
        }
        return false
      }
    },
    onUpdate({ editor: e }) {
      onChange(e.storage.markdown.getMarkdown() as string)
    }
  })

  // Load initial markdown content once the editor is ready
  useEffect(() => {
    if (editor && !initialised.current) {
      initialised.current = true
      if (content) {
        // tiptap-markdown adds setMarkdownContent but types may lag
        ;(editor.commands as unknown as { setMarkdownContent(c: string): void }).setMarkdownContent(content)
      }
      onEditorReady?.(editor)
    }
  }, [editor])

  // Re-load when content prop changes from outside (opening a different post)
  const prevContentRef = useRef(content)
  useEffect(() => {
    if (editor && prevContentRef.current !== content) {
      prevContentRef.current = content
      ;(editor.commands as unknown as { setMarkdownContent(c: string): void }).setMarkdownContent(content)
    }
  }, [content, editor])

  function openImagePicker(): void {
    imageInputRef.current?.click()
  }

  async function handleImageFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    const url = await uploadFileToAzure(file)
    if (url) editor.chain().focus().setImage({ src: url }).run()
    e.target.value = '' // reset so same file can be selected again
  }

  return (
    <div className="editor-container">
      <Toolbar editor={editor} onInsertImage={openImagePicker} />
      <div className="tiptap-wrapper">
        <EditorContent editor={editor} className="tiptap" />
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFileSelected}
      />
    </div>
  )
}
