# Black Editor

Black Editor is a desktop content tool for the Blackhole site. It is built for creating, editing, and managing blog content in one place while synchronizing posts with GitHub and hosting images on Azure Blob Storage.

## What it does

- browses blog posts stored in a GitHub repository under `src/content/blog`
- creates new MDX posts and updates existing ones directly in GitHub
- edits front matter such as title, slug, tags, category, status, image, and description
- uploads pasted, dropped, or selected images to Azure Blob Storage and inserts the public URL into the post
- uses OpenAI to suggest tags for a draft
- stores app settings locally, with sensitive values encrypted when Electron safe storage is available

## How Black Editor fits the Blackhole workflow

Black Editor is meant to be the authoring app for Blackhole content:

- **GitHub** is the source of truth for blog posts and version history
- **Azure Blob Storage** hosts post images used in the content
- **Black Editor** connects to both services so authors can write and publish without manually switching between tools

## Main screens

- **Post browser** – lists available posts from GitHub and lets you create a new one
- **Editor** – writes post content, updates front matter, calculates read time, and saves back to GitHub
- **Settings** – configures GitHub, Azure Blob Storage, author details, and optional OpenAI access

## Configuration

### GitHub

Black Editor uses GitHub as the content backend.

You will need:

- a repository in `owner/repo` format
- the target branch
- a GitHub OAuth App client ID
- authorization through GitHub Device Flow

The app reads and writes blog posts in:

`src/content/blog`

### Azure Blob Storage

Black Editor uses Azure Blob Storage for images embedded in blog posts.

You will need:

- an Azure Storage connection string
- a blob container name

The configured container should allow public blob read access so uploaded images can be embedded in post content.

### OpenAI (optional)

If configured, OpenAI is used only for tag suggestions while editing posts.

## Local development

### Requirements

- Node.js
- npm

### Install dependencies

```bash
npm install
```

### Start the app in development

```bash
npm run dev
```

### Type-check

```bash
npm run typecheck:web
npm run typecheck:node
```

### Build the app

```bash
npm run build
```

### Create distributables

```bash
npm run dist
```

## Notes

- Post content is saved as MDX.
- Images are uploaded to Azure and referenced by URL in the editor content.
- Settings are stored locally on the machine running the app.
- GitHub remains the authoritative store for blog content.
