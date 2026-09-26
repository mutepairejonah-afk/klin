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
};

function send(res, status, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(status, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const candidate = path.join(DIST, safePath);

  // Serve the file if it exists and actually lives inside dist/ (guards
  // against path traversal); otherwise fall back to index.html so
  // client-side routing (React Router) can handle the path.
  if (candidate.startsWith(DIST) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    send(res, 200, candidate);
  } else {
    send(res, 200, path.join(DIST, 'index.html'));
  }
});

server.listen(PORT, () => console.log(`klin-web serving dist/ on :${PORT}`));
