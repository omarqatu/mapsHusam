#!/usr/bin/env node
// Serve the legacy (pre-React) site from a git ref, proxying the API to the dev backend.
//   node .claude/skills/legacy-compare/serve.mjs [ref=origin/main] [port=5188]
// Exports the ref with `git archive` into <TMPDIR>/legacy-<ref>, so nothing touches the working tree.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ref = process.argv[2] ?? 'origin/main';
const port = Number(process.argv[3] ?? 5188);
const dir = path.join(process.env.TMPDIR ?? '/tmp', `legacy-${ref.replace(/\W+/g, '_')}`);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  // node_modules-free and big folders excluded; the legacy pages only need html/js/css/ol/proj4/pic/icons.
  execSync(`git archive ${ref} | tar -x -C ${dir} --exclude=node_modules --exclude=database --exclude=docs`, { stdio: 'inherit' });
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (/^\/(api|geoserver-proxy|save-stat|socket\.io)/.test(u.pathname)) {
      const p = http.request({ host: 'localhost', port: 3000, path: req.url, method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      });
      p.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(p);
      return;
    }
    let f = path.join(dir, decodeURIComponent(u.pathname));
    if (f.endsWith('/')) f += 'index.html';
    fs.readFile(f, (e, d) => {
      if (e) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
      res.end(d);
    });
  })
  .listen(port, () => console.log(`legacy ${ref} on http://localhost:${port}/  (files in ${dir})`));
