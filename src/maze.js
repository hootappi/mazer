// The generator version is part of every recipe. Keep v1 stable for old links.
export const SHAPES = ['square', 'portrait', 'landscape', 'round'];
export const SIZES = ['small', 'medium', 'large'];
export const LEVELS = ['easy', 'steady', 'hard'];
export function recipe(input) {
  if (!input || input.v !== 1 || !SHAPES.includes(input.shape) || !SIZES.includes(input.size) || !LEVELS.includes(input.level) || typeof input.seed !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(input.seed)) throw new Error('This maze recipe is not supported.');
  return { v: 1, seed: input.seed, shape: input.shape, size: input.size, level: input.level };
}
export function encode(input) { return new URLSearchParams(recipe(input)).toString(); }
export function decode(text) { const p = Object.fromEntries(new URLSearchParams(text)); return recipe({ ...p, v: Number(p.v) }); }
export function random(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function topology(r) {
  const index = SIZES.indexOf(r.size), cells = [], neighbors = [], rings = [];
  const add = (cell) => { cell.id = cells.length; cells.push(cell); neighbors.push([]); return cell.id; };
  const join = (a, b) => { if (!neighbors[a].includes(b)) neighbors[a].push(b); if (!neighbors[b].includes(a)) neighbors[b].push(a); };
  if (r.shape === 'round') {
    const count = [4, 6, 9][index];
    add({ ring: 0, sector: 0, sectors: 1, x: 0, y: 0 }); rings.push([0]);
    for (let ring = 1; ring <= count; ring++) {
      const n = 8 * 2 ** Math.floor(Math.log2(ring)), ids = [];
      for (let s = 0; s < n; s++) {
        const angle = (s + .5) / n * Math.PI * 2;
        ids.push(add({ ring, sector: s, sectors: n, x: Math.cos(angle) * (ring + .5), y: Math.sin(angle) * (ring + .5) }));
      }
      rings.push(ids);
      for (let s = 0; s < n; s++) { join(ids[s], ids[(s + 1) % n]); join(ids[s], rings[ring - 1][Math.floor(s * rings[ring - 1].length / n)]); }
    }
    return { cells, neighbors, rings, radius: count + 1, start: 0, end: rings[count][Math.floor(rings[count].length * .125)] };
  }
  let cols = [8, 12, 18][index], rows = cols;
  if (r.shape === 'portrait') rows = Math.round(cols * 1.5);
  if (r.shape === 'landscape') cols = Math.round(cols * 1.5);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) add({ x: x + .5, y: y + .5, row: y, col: x });
  for (const cell of cells) { if (cell.col > 0) join(cell.id, cell.id - 1); if (cell.row > 0) join(cell.id, cell.id - cols); }
  return { cells, neighbors, cols, rows, start: 0, end: cells.length - 1 };
}
export function shortest(maze, start = maze.start, end = maze.end) {
  const previous = new Int32Array(maze.cells.length).fill(-1), queue = [start]; previous[start] = start;
  for (let i = 0; i < queue.length && previous[end] < 0; i++) for (const n of maze.passages[queue[i]]) if (previous[n] < 0) { previous[n] = queue[i]; queue.push(n); }
  if (previous[end] < 0) return [];
  const path = [end]; while (path.at(-1) !== start) path.push(previous[path.at(-1)]); return path.reverse();
}
export function generate(input) {
  const r = recipe(input), topo = topology(r), candidates = [];
  for (let attempt = 0; attempt < 16; attempt++) {
    const rng = random(`${r.seed}:${r.shape}:${r.size}:1:${attempt}`), passages = topo.cells.map(() => []), visited = new Set([topo.start]), stack = [topo.start];
    while (stack.length) {
      const at = stack.at(-1), options = topo.neighbors[at].filter(n => !visited.has(n));
      if (!options.length) { stack.pop(); continue; }
      const next = options[Math.floor(rng() * options.length)]; passages[at].push(next); passages[next].push(at); visited.add(next); stack.push(next);
    }
    const candidate = { ...topo, passages, recipe: r }; candidate.solution = shortest(candidate); candidates.push(candidate);
  }
  candidates.sort((a, b) => a.solution.length - b.solution.length);
  const maze = candidates[{ easy: 0, steady: 7, hard: 15 }[r.level]];
  maze.deadEnds = maze.passages.filter(p => p.length === 1).length;
  maze.optimal = maze.solution.length - 1;
  return maze;
}
export function validPath(maze, path) {
  return Array.isArray(path) && path.length >= 2 && path.length <= 25000 && path[0] === maze.start && path.at(-1) === maze.end && path.every((id, i) => Number.isInteger(id) && id >= 0 && id < maze.cells.length && (i === 0 || maze.passages[path[i - 1]].includes(id)));
}
export function score(maze, moves, elapsedMs) {
  if (!Number.isInteger(moves) || moves < maze.optimal || !Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Invalid score inputs.');
  const efficiency = maze.optimal / moves;
  const pace = Math.max(.1, 1 / (1 + elapsedMs / (maze.optimal * 1500)));
  return Math.round(10000 * efficiency * (.6 + .4 * pace));
}
export function pointFor(maze, x, y) {
  if (maze.recipe.shape !== 'round') {
    const col = Math.floor(x), row = Math.floor(y); return col >= 0 && col < maze.cols && row >= 0 && row < maze.rows ? row * maze.cols + col : -1;
  }
  const distance = Math.hypot(x, y), ring = Math.floor(distance);
  if (ring < 1) return 0;
  if (ring >= maze.rings.length) return -1;
  const theta = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
  return maze.rings[ring][Math.floor(theta / (2 * Math.PI) * maze.rings[ring].length)];
}
export function directional(maze, at, dx, dy) {
  const a = maze.cells[at]; let best = -1, alignment = .35;
  for (const n of maze.passages[at]) { const b = maze.cells[n], vx = b.x - a.x, vy = b.y - a.y, dot = (vx * dx + vy * dy) / Math.hypot(vx, vy); if (dot > alignment) { best = n; alignment = dot; } }
  return best;
}
