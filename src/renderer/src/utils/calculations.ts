/**
 * Calculates estimated read time in minutes.
 * Strips markdown syntax before counting words.
 */
export function calculateReadTime(markdownContent: string): string {
  const text = markdownContent
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|.*?\|/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const wordCount = text.split(' ').filter(Boolean).length
  return `${Math.max(1, Math.ceil(wordCount / 200))} min read`
}

/**
 * Derives a URL-safe slug from a title string.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
