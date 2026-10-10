import { createServer } from 'node:http';
import { readFile, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { generate, recipe, encode, validPath, score } from './src/maze.js';
export function createApp({ dataDir = process.env.DATA_DIR || './data', clock = Date.now, trustProxy = process.env.TRUST_PROXY === '1' } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'mazer.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, name TEXT NOT NULL, recipe TEXT NOT NULL, score INTEGER NOT NULL, moves INTEGER NOT NULL, optimal INTEGER NOT NULL, elapsed INTEGER NOT NULL, created INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS scores_rank ON scores(score DESC, elapsed ASC); CREATE INDEX IF NOT EXISTS scores_maze ON scores(recipe, score DESC);`);
  const runs = new Map(), results = new Map(), limits = new Map();
  const expiry = 3600000;
  const cleanup = setInterval(() => { const now = clock(); for (const map of [runs, results]) for (const [id, value] of map) if (now - value.started > expiry) map.delete(id); for (const [key, value] of limits) if (now > value.until) limits.delete(key); }, 60000).unref();
  const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  async function body(req) { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 150000) { const e = new Error('Request too large.'); e.status = 413; throw e; } } try { return JSON.parse(raw); } catch { throw new Error('Invalid JSON.'); } }
  function limit(ip, kind, max) { const key = ip + ':' + kind, now = clock(), val = limits.get(key); if (!val || now >= val.until) { if (limits.size > 10000) return false; limits.set(key, { until: now + 600000, count: 1 }); return true; } return ++val.count <= max; }
  const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
  if (production && !existsSync('dist/index.html')) throw new Error('Run npm run build before starting production.');
  const root = resolve(production ? 'dist' : 'public');
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') return send(res, 200, { ok: true, version: '1.0.0' });
      if (url.pathname.startsWith('/api/')) {
        const origin = req.headers.origin;
        if (req.method !== 'GET' && origin && !['http://' + req.headers.host, 'https://' + req.headers.host].includes(origin)) return send(res, 403, { error: 'Cross-origin submissions are not allowed.' });
        if (req.method !== 'GET' && !req.headers['content-type']?.startsWith('application/json')) return send(res, 415, { error: 'Use application/json.' });
        const ip = trustProxy ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
        if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
          if (!limit(ip, 'read', 200)) return send(res, 429, { error: 'Please try again in a few minutes.' });
          const filter = url.searchParams.get('maze'); let rows;
          if (filter) { const normalized = encode(recipe({ ...Object.fromEntries(new URLSearchParams(filter)), v: 1 })); rows = db.prepare('SELECT * FROM scores WHERE recipe = ? ORDER BY score DESC, elapsed ASC, created ASC LIMIT 50').all(normalized); }
          else rows = db.prepare('SELECT * FROM scores ORDER BY score DESC, elapsed ASC, created ASC LIMIT 50').all();
          return send(res, 200, { scores: rows.map(row => ({ ...row, recipe: { ...Object.fromEntries(new URLSearchParams(row.recipe)), v: 1 } })) });
        }
        if (req.method === 'POST' && url.pathname === '/api/runs') {
          if (!limit(ip, 'start', 30) || runs.size >= 5000) return send(res, 429, { error: 'Too many runs. Please try again in a few minutes.' });
          const input = await body(req), r = recipe(input.recipe), id = randomUUID(); runs.set(id, { recipe: r, started: clock() }); return send(res, 201, { id });
        }
        if (req.method === 'POST' && url.pathname === '/api/finish') {
          if (!limit(ip, 'finish', 60)) return send(res, 429, { error: 'Please try again in a few minutes.' });
          const input = await body(req), run = runs.get(input.id);
          if (!run || clock() - run.started > expiry) return send(res, 410, { error: 'This ranked run expired. Start a new run.' });
          const maze = generate(run.recipe); if (!validPath(maze, input.path)) return send(res, 400, { error: 'This route does not complete the maze.' });
          const elapsed = Math.max(1, clock() - run.started), moves = input.path.length - 1;
          const value = { recipe: run.recipe, score: score(maze, moves, elapsed), moves, optimal: maze.optimal, elapsed, started: clock() };
          const token = randomUUID(); runs.delete(input.id); results.set(token, value); return send(res, 200, { token, ...value });
        }
        if (req.method === 'POST' && url.pathname === '/api/scores') {
          if (!limit(ip, 'save', 30)) return send(res, 429, { error: 'Please try again in a few minutes.' });
          const input = await body(req), result = results.get(input.token);
          if (!result || clock() - result.started > expiry) return send(res, 410, { error: 'This result expired or was already posted.' });
          if (typeof input.name !== 'string') return send(res, 400, { error: 'Enter a name.' });
          const name = input.name.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
          if (name.length < 1 || name.length > 24) return send(res, 400, { error: 'Use a name between 1 and 24 characters.' });
          const id = randomUUID(); db.prepare('INSERT INTO scores VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, name, encode(result.recipe), result.score, result.moves, result.optimal, result.elapsed, clock()); results.delete(input.token);
          return send(res, 201, { id });
        }
        return send(res, 404, { error: 'Not found.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Method not allowed.' });
      const path = decodeURIComponent(url.pathname), assetRoot = root.endsWith('/public') && path.startsWith('/src/') ? resolve('.') : root;
      const filename = resolve(assetRoot, '.' + (path === '/' ? '/index.html' : path));
      if (!filename.startsWith(assetRoot + '/') || /(?:^|\/)\./.test(path)) return send(res, 404, { error: 'Not found.' });
      // Development exposes only browser modules, never server files or data.
      if (assetRoot !== root && !['/src/maze.js', '/src/render.js', '/src/app.js'].includes(path)) return send(res, 404, { error: 'Not found.' });
      readFile(filename, (err, file) => { if (err) return send(res, 404, { error: 'Not found.' }); res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' })[extname(filename)] || 'text/plain; charset=utf-8', 'Cache-Control': path === '/sw.js' ? 'no-cache' : 'public, max-age=0, must-revalidate' }); res.end(req.method === 'HEAD' ? undefined : file); });
    } catch (error) { send(res, error.status || 400, { error: error.message || 'Request failed.' }); }
  });
  server.on('close', () => { clearInterval(cleanup); db.close(); });
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('server.js')) {
  const port = Number(process.env.PORT || 3000), server = createApp(); server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Mazer ready at http://${process.env.HOST || '127.0.0.1'}:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
