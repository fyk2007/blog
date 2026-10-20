import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT 必须是 1–65535 之间的整数。');
  process.exit(1);
}

let root;
try {
  root = await fs.promises.realpath(directory);
} catch {
  console.error('未找到 dist/，请先运行 npm run build。');
  process.exit(1);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};
const insideRoot = file => file === root || file.startsWith(root + path.sep);

function reply(request, response, status, message) {
  const body = Buffer.from(message + '\n');
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    reply(request, response, 405, 'Method not allowed');
    return;
  }

  let url;
  let pathname;
  try {
    url = new URL(request.url, 'http://127.0.0.1');
    pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path');
  } catch {
    reply(request, response, 400, 'Bad request');
    return;
  }

  let file = path.resolve(root, '.' + pathname);
  if (!insideRoot(file)) {
    reply(request, response, 404, 'Not found');
    return;
  }

  try {
    file = await fs.promises.realpath(file);
    if (!insideRoot(file)) {
      reply(request, response, 404, 'Not found');
      return;
    }
    let stat = await fs.promises.stat(file);
    if (stat.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        response.writeHead(308, {
          Location: url.pathname + '/' + url.search,
          'Cache-Control': 'no-store',
        });
        response.end();
        return;
      }
      file = await fs.promises.realpath(path.join(file, 'index.html'));
      if (!insideRoot(file)) {
        reply(request, response, 404, 'Not found');
        return;
      }
      stat = await fs.promises.stat(file);
    }
    if (!stat.isFile()) {
      reply(request, response, 404, 'Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = fs.createReadStream(file);
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  } catch (error) {
    const missing = ['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code);
    reply(request, response, missing ? 404 : 500, missing ? 'Not found' : 'Server error');
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，可通过 PORT 指定其他端口。` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`本地预览：http://127.0.0.1:${port}/`);
  console.log('按 Ctrl+C 退出。');
});

function shutdown() {
  server.close(() => process.exit(0));
  server.closeAllConnections();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
