// A static file server for the local PDF editor. Zero dependencies, and it
// binds to the loopback interface only — the editor is for this machine.
//
// Nothing about a document ever reaches this server: the browser reads the
// file, edits it and writes the result back to disk entirely on its own. The
// server exists only to hand out the page and its two vendored libraries,
// because browsers refuse to load ES modules and workers over file://.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = Number(process.env.PDF_EDITOR_PORT || 4747);
const HOST = '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
};

function resolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = normalize(decoded === '/' ? '/index.html' : decoded).replace(/^(\.\.[/\\])+/, '');
  const full = join(ROOT, rel);
  // Refuse anything that climbed out of public/.
  return full === ROOT || full.startsWith(ROOT + sep) ? full : null;
}

createServer(async (req, res) => {
  const file = resolve(req.url || '/');
  if (!file) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(PORT, HOST, () => {
  console.log(`PDF editor running at http://${HOST}:${PORT}`);
  console.log('Open that in your browser. Ctrl+C here stops it.');
});
