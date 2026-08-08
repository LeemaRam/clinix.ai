import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 8080);
const DIST_DIR = join(process.cwd(), 'dist');
const INDEX_FILE = join(DIST_DIR, 'index.html');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

const sendFile = (res, filePath) => {
  const ext = extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
  });

  createReadStream(filePath).pipe(res);
};

const safeJoin = (base, targetPath) => {
  const normalizedPath = normalize(targetPath).replace(/^([.][.][/\\])+/, '');
  return join(base, normalizedPath);
};

const server = createServer((req, res) => {
  if (!existsSync(DIST_DIR) || !existsSync(INDEX_FILE)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Build output not found. Run npm run build first.');
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  const requestedPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const filePath = safeJoin(DIST_DIR, requestedPath);

  if (existsSync(filePath)) {
    const stats = statSync(filePath);
    if (stats.isFile()) {
      sendFile(res, filePath);
      return;
    }
  }

  // SPA fallback for client-side routes.
  sendFile(res, INDEX_FILE);
});

server.listen(PORT, () => {
  console.log(`Frontend server listening on port ${PORT}`);
});
