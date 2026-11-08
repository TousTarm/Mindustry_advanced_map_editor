// Dev server for the web editor + a tiny file-based bridge so Claude (via the CLI) and the editor can
// exchange sketches and maps:
//   CLI `push`  -> .mindscape/inbox.json  -> editor polls GET /api/inbox and offers to load it
//   editor "Send to Claude" -> POST /api/outbox -> .mindscape/outbox.json + outbox.msav (CLI `pull` reads them)
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

const BRIDGE = path.resolve('.mindscape');

function bridge() {
  return {
    name: 'mindscape-bridge',
    configureServer(server) {
      server.middlewares.use('/api/inbox', (req, res) => {
        const f = path.join(BRIDGE, 'inbox.json');
        res.setHeader('Content-Type', 'application/json');
        if (!fs.existsSync(f)) return res.end('null');
        res.end(JSON.stringify({ mtime: fs.statSync(f).mtimeMs, data: JSON.parse(fs.readFileSync(f, 'utf8')) }));
      });
      server.middlewares.use('/api/outbox', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          fs.mkdirSync(BRIDGE, { recursive: true });
          const data = JSON.parse(body);
          if (data.msavBase64) {
            fs.writeFileSync(path.join(BRIDGE, 'outbox.msav'), Buffer.from(data.msavBase64, 'base64'));
            delete data.msavBase64;
          }
          fs.writeFileSync(path.join(BRIDGE, 'outbox.json'), JSON.stringify(data));
          res.setHeader('Content-Type', 'application/json');
          res.end('{"ok":true}');
        });
      });
    },
  };
}

export default defineConfig({
  root: 'web',
  publicDir: '../public',
  plugins: [bridge()],
  server: { port: 5178, fs: { allow: ['..'] } },
  build: { outDir: '../dist', emptyOutDir: true },
  worker: { format: 'es' },
});
