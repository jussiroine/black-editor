# Black Editor — Project Context for AI Assistants

Electron + React + TypeScript desktop application for writing and managing MDX blog posts stored in a GitHub repository.

## Tech Stack

- **Electron 42** with **electron-vite** (main / preload / renderer split)
- **React 18** + **TypeScript 5** in the renderer
- **Tiptap** rich-text editor with Markdown serialisation (`tiptap-markdown`)
- **gray-matter** for YAML frontmatter parsing (used in both main and renderer)
- **Azure Blob Storage** (`@azure/storage-blob`) for image uploads
- **Ollama** local LLM for abstract / description generation
- **OpenAI** (optional, currently unused in core flow)
- **electron-builder** for distributable packaging

## Project Structure

```
src/
  main/             # Electron main process (Node.js)
    index.ts        # App bootstrap, BrowserWindow creation
    ipc.ts          # All ipcMain.handle() registrations
    services/
      github.ts     # GitHub Contents API: list, get, save, delete posts
      config.ts     # Config persistence (userData JSON + encrypted secrets)
      azure.ts      # Azure Blob image upload
      ollama.ts     # Ollama local LLM abstract generation
      openai.ts     # OpenAI integration (settings-driven)
  preload/
    index.ts        # contextBridge — exposes window.api to renderer
  renderer/
    src/
      App.tsx               # Root: screen routing, posts state, fetchPosts
      components/
        Editor.tsx          # Tiptap editor wrapper
        FrontMatterForm.tsx # Sidebar form for all post metadata fields
        Toolbar.tsx         # Editor toolbar actions
        BulkEditModal.tsx   # Bulk tag/status editing
      screens/
        PostBrowser.tsx     # Post list with sort, search, date column, draft badge
        EditorScreen.tsx    # Full editor view with autosave logic
        SettingsScreen.tsx  # GitHub / Azure / Ollama / author config
      utils/
        calculations.ts     # calculateReadTime(), generateSlug(), todayIso()
  shared/
    types.ts  # Shared TypeScript interfaces (FrontMatter, PostMeta, LoadedPost, AppConfig …)
    api.ts    # ElectronAPI interface — the contract between preload and renderer
tags.json     # Predefined tag list for autocomplete in FrontMatterForm
```

## Build Commands

```bash
npm run dev          # Start dev server (electron-vite + HMR)
npm run build        # Compile to out/
npm run dist         # Build + package distributable (dist/)
npm run typecheck:node   # Type-check main process
npm run typecheck:web    # Type-check renderer + preload
```

## Architecture

### IPC Contract
All renderer↔main communication goes through `window.api` (defined in `src/shared/api.ts`, bridged in `src/preload/index.ts`). Every IPC handler is registered in `src/main/ipc.ts`. Return type is always `IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }`.

### Adding a new IPC call
1. Add the function to the relevant service in `src/main/services/`
2. Register `ipcMain.handle('namespace:method', ...)` in `src/main/ipc.ts`
3. Add the method signature to `ElectronAPI` in `src/shared/api.ts`
4. Wire it in `src/preload/index.ts` via `ipcRenderer.invoke(...)`

### Config & Secrets
- `AppConfig` (non-sensitive) → `userData/config.json` via plain JSON
- `SensitiveConfig` (`githubToken`, `azureConnectionString`) → `userData/secrets.json` encrypted with Electron `safeStorage`; falls back to base64 if encryption unavailable

### Post Storage (GitHub)
- **Published posts**: `src/content/blog/*.mdx`
- **Draft posts**: `src/content/drafts/*.mdx`
- Posts are plain MDX files with YAML frontmatter. `gray-matter` parses them.
- `listPosts()` fetches both folders in parallel and enriches each entry with `date` + `title` from frontmatter (one GitHub API call per file, `Promise.allSettled`).
- A status change (draft↔published) triggers a file move: save to new path (no sha) then delete old file.

### FrontMatter Shape (`src/shared/types.ts` → `FrontMatter`)
```ts
{
  title, date, description, image, alt,
  author: { name, role, bio, image, alt },
  readTime, tags, slug,
  status: 'published' | 'draft'
}
```

### PostMeta Shape
```ts
{
  path, name, sha,
  status: 'published' | 'draft',
  date: string,   // ISO "YYYY-MM-DD" from frontmatter, or ""
  title: string   // from frontmatter, or ""
}
```

## Key Conventions

- `IpcResult<T>` is always checked with `if (result.ok)` before using `result.data`
- No React context or global state library — everything is prop-drilled from `App.tsx`
- `contentRef` in `EditorScreen` holds the latest Tiptap Markdown content; `frontMatter` state holds everything else
- Autosave fires every 2 minutes when `isDirty && !isSaving && title.trim()`
- Slug auto-generates from title on blur; `calculateReadTime` runs on every content change
- CSS custom properties for theming live in `src/renderer/src/index.css`; no CSS-in-JS
- No test framework is configured — verify changes by running `npm run dev`
