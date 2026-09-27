import 'server-only';
import { all, get, run } from './db';

export type Page = { slug: string; title: string; body: string; updatedAt: string };

export function getPage(slug: string): Page | null {
  const r = get<{ slug: string; title: string; body: string; updated_at: string }>(
    'SELECT slug, title, body, updated_at FROM pages WHERE slug = ?',
    slug,
  );
  return r ? { slug: r.slug, title: r.title, body: r.body, updatedAt: r.updated_at } : null;
}

export function listPages(): Page[] {
  return all<{ slug: string; title: string; body: string; updated_at: string }>(
    'SELECT slug, title, body, updated_at FROM pages ORDER BY title',
  ).map((r) => ({ slug: r.slug, title: r.title, body: r.body, updatedAt: r.updated_at }));
}

export function savePage(slug: string, title: string, body: string): void {
  run(
    `INSERT INTO pages (slug, title, body, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(slug) DO UPDATE SET title = excluded.title, body = excluded.body, updated_at = excluded.updated_at`,
    slug,
    title,
    body,
  );
}

export type Block = { type: 'h2'; text: string } | { type: 'p'; text: string } | { type: 'ul'; items: string[] };

/**
 * Minimal, safe formatting for admin-edited pages:
 *   "## Heading"  → heading
 *   "- item"      → bullet list
 *   blank line    → new paragraph
 * Everything is rendered as text (no HTML), so nothing can inject markup.
 */
export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== '');
    if (!lines.length) continue;
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) blocks.push({ type: 'p', text: para.join('\n') });
      if (list.length) blocks.push({ type: 'ul', items: list });
      para = [];
      list = [];
    };
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('## ')) {
        flush();
        blocks.push({ type: 'h2', text: t.slice(3).trim() });
      } else if (/^[-*•] /.test(t)) {
        if (para.length) {
          blocks.push({ type: 'p', text: para.join('\n') });
          para = [];
        }
        list.push(t.slice(2).trim());
      } else {
        if (list.length) {
          blocks.push({ type: 'ul', items: list });
          list = [];
        }
        para.push(t);
      }
    }
    flush();
  }
  return blocks;
}
