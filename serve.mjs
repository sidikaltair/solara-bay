// Tiny static server for the Solara Bay 3D rebuild. Serves this directory
// (game/ at /, screenshots/ at /screenshots/) with correct MIME types.
// Usage: node serve.mjs [port]   (default 8123)
// Then open http://localhost:8123/game/index.html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = parseInt(process.argv[2] || '8123', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/game/index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('not found: ' + p); return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Solara Bay 3D at http://127.0.0.1:${port}/game/index.html`);
  console.log(`Self-test: http://127.0.0.1:${port}/game/index.html?selftest=1`);
});
