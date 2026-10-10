import { paperDimensions } from "./paper.js";
const NS = "http://www.w3.org/2000/svg";
export function element(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
const fmt = (n) => Number(n.toFixed(4));
const polar = (r, angle) =>
  `${fmt(Math.cos(angle) * r)},${fmt(Math.sin(angle) * r)}`;
function arc(r, a, b) {
  return `M${polar(r, a)} A${r},${r} 0 ${b - a > Math.PI ? 1 : 0} 1 ${polar(r, b)}`;
}
export function viewBox(maze) {
  return maze.radius
    ? `${-maze.radius - 0.8} ${-maze.radius - 0.8} ${(maze.radius + 0.8) * 2} ${(maze.radius + 0.8) * 2}`
    : `-.8 -.8 ${maze.cols + 1.6} ${maze.rows + 1.6}`;
}
export function walls(maze) {
  let d = "";
  const line = (x1, y1, x2, y2) => {
    d += `M${x1},${y1}L${x2},${y2}`;
  };
  const open = (a, b) => maze.passages[a].includes(b);
  if (maze.radius) {
    for (let ring = 1; ring < maze.rings.length; ring++) {
      const ids = maze.rings[ring],
        prev = maze.rings[ring - 1],
        n = ids.length;
      for (let s = 0; s < n; s++) {
        const a = (s / n) * Math.PI * 2,
          b = ((s + 1) / n) * Math.PI * 2;
        if (!open(ids[s], prev[Math.floor((s * prev.length) / n)]))
          d += arc(ring, a, b);
        if (!open(ids[s], ids[(s + n - 1) % n]))
          d += `M${polar(ring, a)} L${polar(ring + 1, a)}`;
        if (ring === maze.rings.length - 1 && ids[s] !== maze.end)
          d += arc(ring + 1, a, b);
      }
    }
    return d;
  }
  for (const cell of maze.cells) {
    const x = cell.col,
      y = cell.row,
      id = cell.id;
    if (y === 0 && id !== maze.start) line(x, y, x + 1, y);
    if (x === 0) line(x, y, x, y + 1);
    if (x === maze.cols - 1 || !open(id, id + 1)) line(x + 1, y, x + 1, y + 1);
    if (y === maze.rows - 1 ? id !== maze.end : !open(id, id + maze.cols))
      line(x, y + 1, x + 1, y + 1);
  }
  return d;
}
export function routeData(maze, path) {
  return path
    .map((id, i) => `${i ? "L" : "M"}${maze.cells[id].x},${maze.cells[id].y}`)
    .join("");
}
export function render(
  maze,
  {
    path = [],
    solution = false,
    player = false,
    paper = "#fffcf5",
    ink = "#29352c",
    accent = "#c5dba4",
  } = {},
) {
  const svg = element("svg", {
    viewBox: viewBox(maze),
    xmlns: NS,
    role: "img",
    "aria-label": `${maze.recipe.shape} maze, ${maze.cells.length} cells. Entrance marked A, finish marked B.`,
    width: 900,
    height: 900,
  });
  const title = element("title");
  title.textContent = "Mazer · " + maze.recipe.seed;
  svg.append(title);
  const [x, y, w, h] = viewBox(maze).split(" ").map(Number);
  svg.setAttribute("width", String(Math.round((900 * w) / Math.max(w, h))));
  svg.setAttribute("height", String(Math.round((900 * h) / Math.max(w, h))));
  svg.append(element("rect", { x, y, width: w, height: h, fill: paper }));
  if (solution)
    svg.append(
      element("path", {
        d: routeData(maze, maze.solution),
        fill: "none",
        stroke: "#bd644d",
        "stroke-width": 0.15,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    );
  svg.append(
    element("path", {
      d: walls(maze),
      fill: "none",
      stroke: ink,
      "stroke-width": 0.065,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  );
  const trace = element("path", {
    id: "trace",
    d: routeData(maze, path),
    fill: "none",
    stroke: "#7c9c5c",
    "stroke-width": 0.18,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    opacity: 0.75,
  });
  svg.append(trace);
  for (const [id, label] of [
    [maze.start, "A"],
    [maze.end, "B"],
  ]) {
    const cell = maze.cells[id];
    svg.append(
      element("circle", {
        cx: cell.x,
        cy: cell.y,
        r: 0.33,
        fill: label === "A" ? accent : ink,
      }),
    );
    const text = element("text", {
      x: cell.x,
      y: cell.y + 0.12,
      "text-anchor": "middle",
      "font-size": 0.33,
      "font-family": "Arial,sans-serif",
      "font-weight": 700,
      fill: label === "A" ? ink : paper,
    });
    text.textContent = label;
    svg.append(text);
  }
  const pos = maze.cells[path.at(-1) ?? maze.start];
  svg.append(
    element("circle", {
      id: "player",
      cx: pos.x,
      cy: pos.y,
      r: 0.24,
      fill: "#e9a385",
      stroke: ink,
      "stroke-width": 0.045,
      visibility: player ? "visible" : "hidden",
    }),
  );
  return svg;
}
export function updateTrace(svg, maze, path) {
  svg.querySelector("#trace").setAttribute("d", routeData(maze, path));
  const c = maze.cells[path.at(-1)];
  const p = svg.querySelector("#player");
  p.setAttribute("cx", c.x);
  p.setAttribute("cy", c.y);
}

// The preview and every export use this same physical sheet layout.
export function renderPaper(maze, layout, options = {}) {
  const [width, height] = paperDimensions(layout);
  const scale = Math.min(width, height) / 210;
  const margin = 12 * scale,
    header = 35 * scale,
    footer = 35 * scale;
  const ink = options.ink ?? "#29352c",
    paper = options.paper ?? "#fffcf5";
  const svg = element("svg", {
    xmlns: NS,
    viewBox: `0 0 ${width} ${height}`,
    width: `${width}mm`,
    height: `${height}mm`,
    role: "img",
    "aria-label": `${layout.paper} ${layout.orientation} sheet with ${maze.recipe.shape} maze`,
    "data-paper": layout.paper,
    "data-orientation": layout.orientation,
  });
  svg.append(element("rect", { width, height, fill: paper }));
  svg.append(
    element("rect", {
      x: 4 * scale,
      y: 4 * scale,
      width: width - 8 * scale,
      height: height - 8 * scale,
      rx: 3 * scale,
      fill: "none",
      stroke: ink,
      "stroke-opacity": 0.28,
      "stroke-width": 0.3 * scale,
    }),
  );
  function text(value, x, y, size, attrs = {}) {
    const node = element("text", {
      x,
      y,
      fill: ink,
      "font-family": "Arial,Helvetica,sans-serif",
      "font-size": Math.max(size * scale, 2.2),
      ...attrs,
    });
    node.textContent = value;
    svg.append(node);
    return node;
  }
  text("MAZER", margin, 20 * scale, 7, {
    "font-weight": 700,
    "letter-spacing": 1.1 * scale,
  });
  text("A little lost. A lot of possibility.", margin, 27 * scale, 2.4);
  const art = render(maze, options);
  art.setAttribute("data-maze-art", "");
  art.setAttribute("x", margin);
  art.setAttribute("y", header);
  art.setAttribute("width", width - 2 * margin);
  art.setAttribute("height", height - header - footer);
  svg.append(art);
  text("Find your way from A to B.", margin, height - 26 * scale, 3);
  const line = text("", margin, height - 19.5 * scale, 2.8);
  const label = (value) => value[0].toUpperCase() + value.slice(1);
  for (const [id, value] of [
    [
      "stat-shape",
      ["portrait", "landscape"].includes(maze.recipe.shape)
        ? "Rectangle"
        : label(maze.recipe.shape),
    ],
    [
      "stat-size",
      maze.radius
        ? `${maze.rings.length - 1} rings`
        : `${maze.cols} × ${maze.rows}`,
    ],
    ["stat-level", label(maze.recipe.level)],
  ]) {
    if (line.childNodes.length) line.append(document.createTextNode(" · "));
    const span = element("tspan", { id });
    span.textContent = value;
    line.append(span);
  }
  text(`MAZE / ${maze.recipe.seed}`, margin, height - 13 * scale, 2.8, {
    id: "maze-label",
  });
  text(
    `${layout.paper} · ${label(layout.orientation)} · ${width} × ${height} mm`,
    margin,
    height - 6.5 * scale,
    2.5,
    { "fill-opacity": 0.7 },
  );
  return svg;
}
