// Derives "design previews" (the Claude-style artifact preview pane) from the
// folded session state. Nothing here is mocked: a preview exists only when the
// agent actually wrote an HTML file or deployed a preview URL.
import type { FoldedState } from './sessionReducer';

export interface PreviewItem {
  id: string;
  title: string;
  kind: 'html' | 'url';
  /** Full document for sandboxed srcDoc rendering (kind === 'html'). */
  html?: string;
  /** Raw source of the entry file, for the Code tab. */
  source?: string;
  /** Remote URL (kind === 'url'). */
  url?: string;
  path?: string;
}

const HTML_RE = /\.html?$/i;

function dirname(p: string) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }

function resolvePath(base: string, rel: string): string {
  if (/^([a-z]+:|\/\/|data:|#)/i.test(rel)) return '';
  const parts = (rel.startsWith('/') ? rel.slice(1) : (base ? base + '/' : '') + rel).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop(); else out.push(part);
  }
  return out.join('/');
}

function lookup(files: FoldedState['files'], path: string): string | undefined {
  if (!path) return undefined;
  if (files[path]) return files[path].content;
  const hit = Object.keys(files).find((k) => k.replace(/^\.?\//, '') === path);
  return hit ? files[hit].content : undefined;
}

/** Inline sibling CSS/JS written by the agent so the iframe is self-contained. */
export function bundleHtml(entryPath: string, files: FoldedState['files']): string {
  const html = files[entryPath]?.content ?? '';
  const base = dirname(entryPath);
  let out = html.replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, (tag) => {
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    const css = href ? lookup(files, resolvePath(base, href)) : undefined;
    return css !== undefined ? `<style>\n${css}\n</style>` : tag;
  });
  out = out.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
    const js = lookup(files, resolvePath(base, src));
    return js !== undefined ? `<script${a}${b}>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>` : tag;
  });
  return out;
}

function titleOf(html: string, path: string): string {
  const t = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(html)?.[1]?.trim();
  if (t) return t;
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()) || 'Preview';
}

export function derivePreviews(state: FoldedState): PreviewItem[] {
  const items: PreviewItem[] = [];
  for (const path of state.fileOrder) {
    if (!HTML_RE.test(path)) continue;
    const src = state.files[path]?.content;
    if (!src || !src.trim()) continue;
    items.push({
      id: `file:${path}`, kind: 'html', path, title: titleOf(src, path),
      html: bundleHtml(path, state.files), source: src,
    });
  }
  if (state.previewUrl) {
    let host = state.previewUrl;
    try { host = new URL(/^https?:/.test(host) ? host : `https://${host}`).host; } catch { /* keep raw */ }
    items.push({ id: `url:${state.previewUrl}`, kind: 'url', url: state.previewUrl, title: host });
  }
  return items;
}
