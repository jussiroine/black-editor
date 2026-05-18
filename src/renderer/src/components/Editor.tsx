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

async function uploadBufferToAzure(
  arrayBuf: ArrayBuffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
  const buffer = Array.from(new Uint8Array(arrayBuf))
  const result = await window.api.azure.uploadImage(buffer, filename, mimeType)
  if (result.ok) return result.data
  console.error('Image upload failed:', result.error)
  return null
}

async function uploadFileToAzure(file: File): Promise<string | null> {
  const arrayBuf = await file.arrayBuffer()
  return uploadBufferToAzure(arrayBuf, file.name || 'image.png', file.type || 'image/png')
}

async function fetchAndUploadToAzure(src: string): Promise<string | null> {
  const resp = await fetch(src)
  if (!resp.ok) return null
  const arrayBuf = await resp.arrayBuffer()
  const contentType = resp.headers.get('content-type') || 'image/jpeg'
  const mimeType = contentType.split(';')[0]
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
  return uploadBufferToAzure(arrayBuf, `paste.${ext}`, mimeType)
}

function insertImageWithParagraph(editor: Editor | null, url: string, atPos?: number): void {
  if (!editor) return
  const chain = atPos !== undefined
    ? editor.chain().focus().insertContentAt(atPos, [
        { type: 'image', attrs: { src: url } },
        { type: 'paragraph' }
      ])
    : editor.chain().focus().insertContent([
        { type: 'image', attrs: { src: url } },
        { type: 'paragraph' }
      ])
  chain.run()
}

export default function EditorComponent({ content, onChange, onEditorReady }: EditorProps): React.ReactElement {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const initialised = useRef(false)
  const editorRef = useRef<Editor | null>(null)

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

        // Case 1: binary image blob in clipboard (screenshot, "Copy image" context menu)
        const imageItem = items.find((item) => item.type.startsWith('image/'))
        if (imageItem) {
          event.preventDefault()
          const file = imageItem.getAsFile()
          if (!file) return true // preventDefault already called – suppress default
          void uploadFileToAzure(file).then((url) => {
            if (url) insertImageWithParagraph(editorRef.current, url)
          })
          return true
        }

        // Case 2: HTML clipboard with an external image URL and no significant text
        // (e.g. copying an image from a browser page like GitHub)
        const html = event.clipboardData?.getData('text/html') ?? ''
        if (html) {
          const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
          const src = match?.[1]
          if (src?.startsWith('http')) {
            const textContent = html.replace(/<[^>]+>/g, '').trim()
            if (textContent.length < 10) {
              event.preventDefault()
              void fetchAndUploadToAzure(src)
                .then((url) => { if (url) insertImageWithParagraph(editorRef.current, url) })
                .catch((e) => console.error('[Editor] HTML image re-upload failed:', e))
              return true
            }
          }
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
            if (!file) return true // preventDefault already called
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
            void uploadFileToAzure(file).then((url) => {
              if (url) insertImageWithParagraph(editorRef.current, url, coords?.pos)
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
        editor.commands.setContent(content)
      }
      onEditorReady?.(editor)
    }
  }, [editor])

  // Keep editorRef current so paste/drop handlers always have the latest editor instance
  useEffect(() => { editorRef.current = editor }, [editor])

  // Re-load when content prop changes from outside (opening a different post)
  const prevContentRef = useRef(content)
  useEffect(() => {
    if (editor && prevContentRef.current !== content) {
      prevContentRef.current = content
      editor.commands.setContent(content)
    }
  }, [content, editor])

  function openImagePicker(): void {
    imageInputRef.current?.click()
  }

  async function handleImageFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    const url = await uploadFileToAzure(file)
    if (url) insertImageWithParagraph(editor, url)
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
