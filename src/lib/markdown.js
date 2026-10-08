import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** Markdown -> sanitized HTML. Browser-only (DOMPurify needs a DOM). */
export function renderMarkdown(md) {
  if (!md) return '';
  // Strip YAML frontmatter; it's metadata, not content.
  const body = md.replace(/^---\n[\s\S]*?\n---\n?/, '');
  return DOMPurify.sanitize(marked.parse(body, { async: false }));
}
