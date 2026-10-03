// Minimal static file server with SPA fallback — no dependencies.
//
// Render's static-site product only exposes rewrite rules (needed so that
// refreshing e.g. /agent serves index.html instead of a raw 404) through its
// dashboard, which isn't reachable via the API/MCP tools this was deployed
// with. Running the same dist/ output through a tiny Node web service
// sidesteps that: this server does the "serve index.html for any path that
// isn't a real file" fallback itself, so no dashboard step is needed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.map', '.txt', '.md']);
// path -> { mtime, br, gz, raw } so each file is compressed once, not per request.
const cache = new Map();

function load(filePath) {
  const mtime = fs.statSync(filePath).mtimeMs;
  const hit = cache.get(filePath);
  if (hit && hit.mtime === mtime) return hit;
  const raw = fs.readFileSync(filePath);
  const entry = { mtime, raw, br: null, gz: null };
  if (COMPRESSIBLE.has(path.extname(filePath)) && raw.length > 512) {
    entry.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
    entry.gz = zlib.gzipSync(raw, { level: 9 });
  }
  cache.set(filePath, entry);
  return entry;
}

function send(req, res, status, filePath) {
  const ext = path.extname(filePath);
  const e = load(filePath);
  const accept = String(req.headers['accept-encoding'] || '');
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    Vary: 'Accept-Encoding',
    // Vite emits content-hashed files under /assets: cache them forever.
    // index.html must always be revalidated so deploys show up immediately.
    'Cache-Control': filePath.includes(`${path.sep}assets${path.sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  };
  let body = e.raw;
  if (e.br && /\bbr\b/.test(accept)) { body = e.br; headers['Content-Encoding'] = 'br'; }
  else if (e.gz && /\bgzip\b/.test(accept)) { body = e.gz; headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const candidate = path.join(DIST, safePath);

  // Serve the file if it exists and actually lives inside dist/ (guards
  // against path traversal); otherwise fall back to index.html so
  // client-side routing (React Router) can handle the path.
  if (candidate.startsWith(DIST) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    send(req, res, 200, candidate);
  } else {
    send(req, res, 200, path.join(DIST, 'index.html'));
  }
});

// Pre-compress everything at boot so the first visitor isn't the one who pays for it.
for (const f of fs.readdirSync(DIST, { recursive: true })) {
  const full = path.join(DIST, String(f));
  if (fs.statSync(full).isFile()) load(full);
}

server.listen(PORT, () => console.log(`klin-web serving dist/ on :${PORT}`));
