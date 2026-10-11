import {
  generate,
  recipe,
  encode,
  decode,
  SHAPES,
  SIZES,
  LEVELS,
  pointFor,
  directional,
  score,
} from "./maze.js";
import { render, renderPaper, updateTrace, viewBox } from "./render.js";
import { paperLayout, paperDimensions, PASSAGE_MM } from "./paper.js";
const $ = (selector) => document.querySelector(selector),
  $$ = (selector) => [...document.querySelectorAll(selector)];
const state = {
  recipe: {
    v: 2,
    paper: "A4",
    orientation: "portrait",
    seed: "WANDER-001",
    shape: "square",
    size: "medium",
    level: "steady",
  },
  layout: paperLayout(),
  maze: null,
  playing: false,
  gameOpen: false,
  generation: 0,
  paused: false,
  input: "draw",
  rotationBlocked: false,
  busy: false,
  path: [],
  started: 0,
  run: null,
  result: null,
  practice: false,
  solution: false,
  filter: "global",
  challenge: null,
};
let toastTimeout, tick, pointer;
const names = {
  square: "Square",
  portrait: "Portrait",
  landscape: "Landscape",
  round: "Round",
  small: "Small",
  medium: "Medium",
  large: "Large",
  easy: "Easy",
  steady: "Steady",
  hard: "Hard",
};
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}
function localRead(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function localWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    toast(
      "This browser could not save locally. You can still export your maze.",
    );
    return false;
  }
}
function collection() {
  const raw = localRead("mazer-kept-v1", []);
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((item) => {
      try {
        return [
          {
            ...recipe(item),
            layout: paperLayout(item.v === 2 ? item : item.layout, item.shape),
          },
        ];
      } catch {
        return [];
      }
    })
    .slice(0, 100);
}
function time(ms, tenths = false) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}${tenths ? "." + Math.floor((ms % 1000) / 100) : ""}`;
}
async function api(path, data) {
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch("/api/" + path, {
      method: data ? "POST" : "GET",
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error || "The server could not complete that request.",
      );
    return result;
  } catch (error) {
    if (error.name === "AbortError" || error instanceof TypeError)
      throw new Error(
        "Can’t reach the leaderboard. Check your connection and try again.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function colors() {
  const css = getComputedStyle(document.documentElement);
  return {
    paper: css.getPropertyValue("--paper").trim(),
    ink: css.getPropertyValue("--ink").trim(),
    accent: css.getPropertyValue("--accent").trim(),
  };
}
function documentQuery(r = state.recipe, layout = state.layout) {
  const params = new URLSearchParams(encode(r));
  params.set("paper", layout.paper);
  params.set("orientation", layout.orientation);
  return params.toString();
}
function keptKey(item) {
  return documentQuery(
    item,
    paperLayout(item.v === 2 ? item : item.layout, item.shape),
  );
}
function writeURL() {
  const params = new URLSearchParams(documentQuery());
  if (state.challenge) {
    params.set("who", state.challenge.name);
    params.set("target", String(state.challenge.score));
  }
  history.replaceState(null, "", "?" + params);
}
function draw() {
  const svg = (
    state.gameOpen
      ? render
      : (maze, options) => renderPaper(maze, state.layout, options)
  )(state.maze, {
    ...colors(),
    path: state.path,
    player: state.playing,
    solution: state.solution,
  });
  const [width, height] = paperDimensions(state.layout);
  const stage = $("#maze-stage");
  stage.setAttribute(
    "aria-label",
    state.gameOpen
      ? "Maze gameplay. Draw through passages, tap adjacent cells or use arrow keys. Switch to Swipe for directional steps."
      : "Paper preview. Choose Play to begin.",
  );
  stage.style.aspectRatio = `${width} / ${height}`;
  if (state.gameOpen) {
    svg.setAttribute("data-maze-art", "");
    const box = viewBox(state.maze).split(" ").map(Number),
      area = $(".paper-preview").getBoundingClientRect(),
      scale = Math.min(area.width / box[2], area.height / box[3]);
    stage.style.width = `${box[2] * scale}px`;
    stage.style.height = `${box[3] * scale}px`;
  } else {
    stage.style.removeProperty("width");
    stage.style.removeProperty("height");
  }
  stage.dataset.orientation = state.layout.orientation;
  stage.replaceChildren(svg);
  for (const key of ["paper", "orientation"])
    $$(`button[data-${key}]`).forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset[key] === state.layout[key]),
      ),
    );
  $("#passage-note").textContent =
    state.recipe.v === 2
      ? `${PASSAGE_MM[state.recipe.size]} mm passages · ${state.maze.cells.length.toLocaleString()} cells. Bigger paper, more maze.`
      : "Original maze. Change a setting to use fixed-width passages.";
  $("#paper-dimensions").textContent = `${width} × ${height} mm`;
  $("#paper-summary").textContent =
    `${state.layout.paper} / ${state.layout.orientation.toUpperCase()}`;
  $("#print-summary").textContent =
    `${state.layout.paper} · ${names[state.layout.orientation]}`;
}
function load(r, { keepChallenge = false } = {}) {
  if (state.gameOpen || state.busy) return;
  state.recipe = recipe(r);
  if (r.v === 2) state.layout = paperLayout(r, r.shape);
  else if (r.layout) state.layout = paperLayout(r.layout, r.shape);
  state.maze = generate(state.recipe);
  state.path = [];
  state.solution = false;
  state.result = null;
  if (!keepChallenge) state.challenge = null;
  $("#seed").value = r.seed;
  for (const [attr, value] of [
    [
      "shape",
      ["portrait", "landscape"].includes(r.shape) ? "rectangle" : r.shape,
    ],
    ["size", r.size],
    ["level", r.level],
  ])
    $$(`[data-${attr}]`).forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset[attr] === value),
      ),
    );
  $("#difficulty-note").textContent = {
    easy: "A shorter wander. A gentle place to start.",
    steady: "A few wrong turns. Just enough wonder.",
    hard: "A longer way through. Follow your instincts.",
  }[r.level];
  $("#board-status").textContent = "READY TO WANDER";
  updateKeep();
  updateChallenge();
  draw();
  writeURL();
}
function updateChallenge() {
  $("#challenge-banner").hidden = !state.challenge;
  if (state.challenge)
    $("#challenge-copy").textContent =
      `${state.challenge.name} found their way with ${state.challenge.score.toLocaleString()} points. Your turn?`;
}
function updateKeep() {
  const kept = collection();
  $("#saved-count").textContent = kept.length;
  const active = kept.some((r) => keptKey(r) === documentQuery());
  $("#save").innerHTML = active ? "♥ <span>Kept</span>" : "♡ <span>Keep</span>";
  $("#save").setAttribute("aria-pressed", String(active));
}
function tab(name) {
  if (state.gameOpen || state.busy) {
    toast("Finish your run or go back to the creator first.");
    return;
  }
  $$("[data-tab]").forEach((button) => {
    if (button.dataset.tab === name)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  for (const id of ["create", "leaderboard", "saved"])
    $(`#${id}-view`).hidden = id !== name;
  if (name === "leaderboard") leaderboard();
  if (name === "saved") saved();
}
function setPlayUI(active) {
  document.body.classList.toggle("game-mode", active);
  $$("header, nav, footer, .page-intro, .lower-note").forEach((el) => {
    el.inert = active;
  });
  $("#game-close").hidden = !active;
  $("#creator-controls").hidden = active;
  $(".workspace").classList.toggle("playing", active);
  $("#maze-stage").classList.toggle("is-playing", active);
  $("#play-stats").hidden = !active;
  $("#preview-actions").hidden = active;
  $("#playing-actions").hidden = !active;
  $("#hint").textContent = "Show solution";
  $("#run-mode").textContent = state.practice ? "Practice" : "Ranked";
  $("#play-instructions").textContent =
    state.input === "draw"
      ? "Draw along passages. Continue from your trail or tap the next cell."
      : "Swipe anywhere to move one step. Arrow keys work too.";
}
let savedScroll = 0,
  expectedFullscreenExit = false;
function orientationMatches() {
  return (
    !matchMedia("(pointer: coarse)").matches ||
    (innerWidth > innerHeight ? "landscape" : "portrait") ===
      state.layout.orientation
  );
}
function updateOrientation() {
  state.rotationBlocked = state.gameOpen && !orientationMatches();
  $("#rotate-prompt").hidden = !state.rotationBlocked;
  $("#rotate-copy").textContent =
    `Turn your device to ${state.layout.orientation}.`;
  $("#ready-yes").disabled = state.rotationBlocked || state.busy;
  $("#ready-rotate").hidden = !state.rotationBlocked;
  $("#ready-rotate").textContent = $("#rotate-copy").textContent;
  if (state.rotationBlocked) pointer = null;
}
function start() {
  if (state.busy || state.gameOpen) return;
  savedScroll = scrollY;
  state.generation++;
  state.gameOpen = true;
  state.paused = false;
  state.path = [state.maze.start];
  state.result = null;
  state.solution = false;
  setPlayUI(true);
  draw();
  $("#timer").textContent = "00:00.0";
  $("#moves").textContent = "0";
  updateOrientation();
  $("#ready-dialog").showModal();
}
function useNativeFullscreen() {
  // iPadOS can identify itself as a Mac, including when a trackpad is attached.
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return !ios && !matchMedia("(pointer: coarse)").matches;
}
async function begin() {
  if (state.busy || state.playing || state.rotationBlocked || !state.gameOpen)
    return;
  const generation = state.generation;
  state.busy = true;
  $("#ready-yes").disabled = true;
  $("#play").disabled = true;
  // A fullscreen element enters the browser's top layer. Close readiness first
  // so promoting fullscreen can never cover the YES button or its modal backdrop.
  $("#ready-dialog").close();
  $("#run-mode").textContent = "Starting…";
  if (useNativeFullscreen())
    document.documentElement
      .requestFullscreen?.()
      .then(() => {
        if (!state.gameOpen || generation !== state.generation) {
          if (document.fullscreenElement) {
            expectedFullscreenExit = true;
            document.exitFullscreen().catch(() => {});
          }
        }
      })
      .catch(() => {});
  try {
    const run = await api("runs", { recipe: state.recipe });
    if (generation !== state.generation) return;
    state.run = run.id;
    state.practice = false;
  } catch (error) {
    if (generation !== state.generation) return;
    state.run = null;
    state.practice = true;
    toast(error.message + " Starting an unranked practice run.");
  }
  if (!state.gameOpen || generation !== state.generation) return;
  state.busy = false;
  $("#ready-dialog").close();
  $("#play").disabled = false;
  state.playing = true;
  state.result = null;
  state.solution = false;
  state.path = [state.maze.start];
  state.started = performance.now();
  setPlayUI(true);
  draw();
  $("#maze-stage").focus({ preventScroll: true });
  $("#moves").textContent = "0";
  $("#timer").textContent = "00:00.0";
  $("#board-status").textContent = "FOLLOW YOUR CURIOSITY";
  clearInterval(tick);
  tick = setInterval(() => {
    $("#timer").textContent = time(performance.now() - state.started, true);
  }, 100);
}
function stop() {
  state.generation++;
  $("#play").disabled = false;
  state.gameOpen = false;
  state.paused = false;
  state.rotationBlocked = false;
  pointer = null;
  $("#ready-dialog").close();
  $("#pause-dialog").close();
  $("#rotate-prompt").hidden = true;
  state.playing = false;
  state.busy = false;
  clearInterval(tick);
  state.run = null;
  state.solution = false;
  state.path = [];
  setPlayUI(false);
  draw();
  $("#board-status").textContent = "READY TO WANDER";
  if (document.fullscreenElement) {
    expectedFullscreenExit = true;
    document.exitFullscreen().catch(() => {});
  }
  window.scrollTo(0, savedScroll);
}
function move(id) {
  if (
    !state.playing ||
    state.paused ||
    state.rotationBlocked ||
    state.busy ||
    id < 0 ||
    id === state.path.at(-1)
  )
    return;
  if (!state.maze.passages[state.path.at(-1)].includes(id)) return;
  state.path.push(id);
  if (state.path.length >= 25000) {
    toast("That’s a very long wander. Start a fresh run.");
    stop();
    return;
  }
  updateTrace($("#maze-stage svg"), state.maze, state.path);
  $("#moves").textContent = state.path.length - 1;
  if (id === state.maze.end) finish();
}
async function finish() {
  if (state.busy) return;
  const generation = state.generation;
  state.busy = true;
  state.playing = false;
  clearInterval(tick);
  pointer = null;
  const elapsed = Math.max(1, performance.now() - state.started),
    moves = state.path.length - 1;
  state.result = {
    recipe: state.recipe,
    score: score(state.maze, moves, elapsed),
    moves,
    optimal: state.maze.optimal,
    elapsed,
    token: null,
  };
  if (state.run && !state.practice) {
    try {
      const result = await api("finish", { id: state.run, path: state.path });
      if (generation !== state.generation) return;
      state.result = result;
    } catch (error) {
      if (generation !== state.generation) return;
      toast(error.message + " Your result is saved as practice.");
      state.practice = true;
    }
  }
  state.busy = false;
  state.run = null;
  $("#timer").textContent = time(state.result.elapsed, true);
  $("#board-status").textContent = "FOUND YOUR WAY";
  $("#maze-stage").classList.remove("is-playing");
  $("#result-score").replaceChildren(
    document.createTextNode(state.result.score.toLocaleString()),
    Object.assign(document.createElement("span"), { textContent: "POINTS" }),
  );
  const detail = $("#result-detail");
  detail.replaceChildren();
  for (const [value, label] of [
    [time(state.result.elapsed, true), "TIME"],
    [String(moves), "MOVES"],
    [
      Math.round((state.result.optimal / moves) * 100) + "%",
      "ROUTE EFFICIENCY",
    ],
  ]) {
    const div = document.createElement("div");
    div.textContent = value;
    div.append(
      Object.assign(document.createElement("small"), { textContent: label }),
    );
    detail.append(div);
  }
  $("#result-status").textContent = state.result.token
    ? state.challenge
      ? `Your challenge: ${state.result.score >= state.challenge.score ? "you matched or beat" : "you’re chasing"} ${state.challenge.name}’s ${state.challenge.score.toLocaleString()} points.`
      : "Your route is verified. Add a name to join the leaderboard."
    : "Practice run. Enjoy the result; this one won’t be posted to the leaderboard.";
  $("#name-form").hidden = !state.result.token;
  $("#player-name").value = localRead("mazer-name", "");
  $("#post-score").disabled = false;
  localWrite("mazer-last-result", {
    recipe: state.recipe,
    score: state.result.score,
    elapsed: state.result.elapsed,
    moves,
  });
  draw();
  $("#result-dialog").showModal();
}
function coordinate(event) {
  const svg = $("#maze-stage svg[data-maze-art]"),
    point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.getScreenCTM().inverse(),
    );
  return { x: point.x, y: point.y };
}
$("#maze-stage").addEventListener("pointerdown", (event) => {
  if (
    !state.playing ||
    state.paused ||
    state.rotationBlocked ||
    state.busy ||
    !event.isPrimary
  )
    return;
  event.preventDefault();
  $("#maze-stage").setPointerCapture(event.pointerId);
  const p = coordinate(event),
    id = pointFor(state.maze, p.x, p.y),
    previous = state.path.lastIndexOf(id);
  if (state.input === "draw" && id >= 0) {
    if (previous >= 0) {
      const backtrack = state.path.slice(previous, -1).reverse();
      for (const step of backtrack) move(step);
    } else move(id);
  }
  pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    last: p,
    trace: state.input === "draw" && id >= 0,
    used: false,
  };
});
$("#maze-stage").addEventListener("pointermove", (event) => {
  if (
    !pointer ||
    pointer.id !== event.pointerId ||
    !state.playing ||
    state.paused ||
    state.rotationBlocked
  )
    return;
  event.preventDefault();
  const p = coordinate(event);
  if (pointer.trace) {
    const prev = pointer.last,
      samples = Math.min(
        100,
        Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / 0.12),
      );
    for (let s = 1; s <= samples && state.playing; s++)
      move(
        pointFor(
          state.maze,
          prev.x + ((p.x - prev.x) * s) / samples,
          prev.y + ((p.y - prev.y) * s) / samples,
        ),
      );
    if (pointer) pointer.last = p;
  } else if (!pointer.used) {
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    if (Math.hypot(dx, dy) > 18) {
      pointer.used = true;
      move(
        directional(
          state.maze,
          state.path.at(-1),
          Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0,
          Math.abs(dy) >= Math.abs(dx) ? Math.sign(dy) : 0,
        ),
      );
    }
  }
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  $("#maze-stage").addEventListener(type, () => {
    pointer = null;
  });
$("#maze-stage").addEventListener("keydown", (event) => {
  const direction = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    a: [-1, 0],
    d: [1, 0],
    w: [0, -1],
    s: [0, 1],
  }[event.key];
  if (direction && state.playing && !state.paused && !state.rotationBlocked) {
    event.preventDefault();
    move(directional(state.maze, state.path.at(-1), ...direction));
  }
});
async function leaderboard() {
  const list = $("#leader-list");
  list.replaceChildren(
    Object.assign(document.createElement("p"), {
      className: "empty",
      textContent: "Finding the way finders…",
    }),
  );
  const filter = state.filter;
  try {
    const result = await api(
      "leaderboard" +
        (filter === "maze"
          ? "?maze=" + encodeURIComponent(encode(state.recipe))
          : ""),
    );
    if (filter !== state.filter) return;
    list.replaceChildren();
    if (!result.scores.length) {
      list.append(
        Object.assign(document.createElement("p"), {
          className: "empty",
          textContent: "An open path. Be the first to leave your name here.",
        }),
      );
      return;
    }
    result.scores.forEach((entry, index) => {
      const row = document.createElement("button");
      row.className = "leader-row";
      row.setAttribute(
        "aria-label",
        `Challenge ${entry.name} on maze ${entry.recipe.seed}, ${entry.score} points`,
      );
      const rank = Object.assign(document.createElement("span"), {
        className: "leader-rank",
        textContent: String(index + 1).padStart(2, "0"),
      });
      const identity = document.createElement("span");
      identity.append(
        Object.assign(document.createElement("strong"), {
          className: "leader-name",
          textContent: entry.name,
        }),
        Object.assign(document.createElement("span"), {
          className: "leader-maze",
          textContent: `${entry.recipe.seed} · ${names[entry.recipe.shape]} / ${names[entry.recipe.size]} / ${names[entry.recipe.level]}${entry.recipe.v === 2 ? ` · ${entry.recipe.paper} ${entry.recipe.orientation}` : ""} · ${time(entry.elapsed)}`,
        }),
      );
      const points = Object.assign(document.createElement("span"), {
        className: "leader-score",
        textContent: entry.score.toLocaleString(),
      });
      points.append(
        Object.assign(document.createElement("small"), {
          textContent: "POINTS",
        }),
      );
      const challenge = Object.assign(document.createElement("span"), {
        className: "leader-challenge",
        textContent: "Take this path ↗",
      });
      row.append(rank, identity, points, challenge);
      row.addEventListener("click", () => {
        stop();
        state.challenge = { name: entry.name, score: entry.score };
        state.layout = paperLayout(
          { paper: state.layout.paper },
          entry.recipe.shape,
        );
        load(entry.recipe, { keepChallenge: true });
        tab("create");
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast("Same maze. Your turn to find a way.");
      });
      list.append(row);
    });
  } catch (error) {
    list.replaceChildren(
      Object.assign(document.createElement("p"), {
        className: "empty",
        textContent: error.message,
      }),
    );
  }
}
function saved() {
  const list = $("#saved-list");
  list.replaceChildren();
  const kept = collection();
  if (!kept.length) {
    list.append(
      Object.assign(document.createElement("p"), {
        className: "empty",
        textContent: "Found a maze you love? Tap Keep to save it here.",
      }),
    );
    return;
  }
  for (const r of kept) {
    const card = Object.assign(document.createElement("article"), {
        className: "saved-card",
      }),
      open = Object.assign(document.createElement("button"), {
        className: "saved-open",
      });
    open.append(
      render(generate(r), colors()),
      Object.assign(document.createElement("strong"), { textContent: r.seed }),
      Object.assign(document.createElement("span"), {
        textContent: `${r.layout.paper} ${names[r.layout.orientation]} · ${names[r.shape]} · ${names[r.size]} · ${names[r.level]}`,
      }),
    );
    open.addEventListener("click", () => {
      load(r);
      tab("create");
    });
    const remove = Object.assign(document.createElement("button"), {
      className: "saved-remove",
      textContent: "Remove from your collection",
    });
    remove.addEventListener("click", () => {
      if (
        localWrite(
          "mazer-kept-v1",
          collection().filter((item) => keptKey(item) !== keptKey(r)),
        )
      ) {
        updateKeep();
        saved();
      }
    });
    card.append(open, remove);
    list.append(card);
  }
}
function download(blob, extension) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `mazer-${state.recipe.seed}-${state.recipe.shape}-${state.recipe.level}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportSVG(print = false) {
  return renderPaper(state.maze, state.layout, {
    solution: $("#export-solution").checked,
    ...(print
      ? { paper: "#ffffff", ink: "#222222", accent: "#eeeeee" }
      : colors()),
  });
}
async function png() {
  const svg = exportSVG(),
    blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    }),
    url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const box = svg.viewBox.baseVal,
      scale = 2400 / Math.max(box.width, box.height),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(box.width * scale);
    canvas.height = Math.round(box.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const result = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!result) throw new Error("Could not create the image.");
    download(result, "png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
function printMaze() {
  const [width, height] = paperDimensions(state.layout);
  const frame = document.createElement("iframe");
  frame.className = "print-frame";
  frame.style.cssText = "position:fixed;width:1px;height:1px;left:-9999px;";
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(
    "<!doctype html><html><head><title>Mazer printable maze</title></head><body></body></html>",
  );
  doc.close();
  const style = doc.createElement("style");
  // Keep the sheet at its exact physical size outside document flow to avoid
  // an extra page caused by rounding at the page boundary.
  style.textContent = `@page{size:${width}mm ${height}mm;margin:0}html,body{margin:0;padding:0;width:${width}mm;height:${height - 0.2}mm}svg{display:block;position:absolute;top:0;left:0;width:${width}mm;height:${height}mm;break-inside:avoid}`;
  doc.head.append(style);
  doc.body.append(doc.importNode(exportSVG(true), true));
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  }, 250);
}
function share() {
  const params = new URLSearchParams(documentQuery());
  if (state.result && state.result.token && !state.practice) {
    params.set(
      "who",
      $("#player-name").value.trim().slice(0, 24) || "A friend",
    );
    params.set("target", String(state.result.score));
  }
  $("#share-link").value = location.origin + "/?" + params;
  $("#share-dialog").showModal();
}
$$("[data-tab]").forEach((button) =>
  button.addEventListener("click", () => tab(button.dataset.tab)),
);
for (const key of ["shape", "size", "level"])
  $$(`button[data-${key}]`).forEach((button) =>
    button.addEventListener("click", () => {
      const value =
        key === "shape" && button.dataset.shape === "rectangle"
          ? state.layout.orientation
          : button.dataset[key];
      load({ ...state.recipe, v: 2, ...state.layout, [key]: value });
    }),
  );
for (const key of ["paper", "orientation"])
  $$(`button[data-${key}]`).forEach((button) =>
    button.addEventListener("click", () => {
      if (state.gameOpen || state.busy) return;
      state.layout = paperLayout({
        ...state.layout,
        [key]: button.dataset[key],
      });
      load({
        ...state.recipe,
        v: 2,
        ...state.layout,
        shape: ["portrait", "landscape"].includes(state.recipe.shape)
          ? state.layout.orientation
          : state.recipe.shape,
      });
    }),
  );
$("#seed-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    load({
      ...state.recipe,
      v: 2,
      ...state.layout,
      seed: $("#seed").value.trim(),
    });
  } catch (error) {
    toast(error.message);
  }
});
$("#generate").addEventListener("click", () =>
  load({
    ...state.recipe,
    v: 2,
    ...state.layout,
    seed: "M-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
  }),
);
$("#save").addEventListener("click", () => {
  const kept = collection(),
    exists = kept.some((r) => keptKey(r) === documentQuery());
  if (!exists && kept.length >= 100) {
    toast("Your collection has 100 mazes. Export or remove one to make room.");
    return;
  }
  if (
    localWrite(
      "mazer-kept-v1",
      exists
        ? kept.filter((r) => keptKey(r) !== documentQuery())
        : [{ ...state.recipe, layout: state.layout }, ...kept],
    )
  ) {
    updateKeep();
    toast(
      exists
        ? "Removed from your collection."
        : "A little world, kept on this device.",
    );
  }
});
$("#play").addEventListener("click", start);
$("#ready-yes").addEventListener("click", begin);
$("#ready-stop").addEventListener("click", stop);
$("#rotate-stop").addEventListener("click", stop);
$(".paper-preview").addEventListener(
  "touchmove",
  (event) => {
    if (state.gameOpen) event.preventDefault();
  },
  { passive: false },
);
window.addEventListener(
  "wheel",
  (event) => {
    if (state.gameOpen) event.preventDefault();
  },
  { passive: false },
);
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    for (const dialog of $$("dialog[open]")) {
      dialog.close();
      dialog.showModal();
    }
  }
  if (!document.fullscreenElement) {
    if (expectedFullscreenExit) expectedFullscreenExit = false;
    else if (state.gameOpen) stop();
  }
});
$("#ready-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  stop();
});
$("#pause").addEventListener("click", () => {
  if (!state.playing || state.busy) return;
  state.paused = true;
  pointer = null;
  $("#pause-dialog").showModal();
});
$("#resume").addEventListener("click", () => {
  state.paused = false;
  $("#pause-dialog").close();
  $("#maze-stage").focus({ preventScroll: true });
});
$("#pause-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  $("#resume").click();
});
for (const id of ["pause-stop", "pause-restart"])
  $("#" + id).addEventListener("click", () => {
    stop();
    if (id === "pause-restart") start();
  });
$$("[data-input]").forEach((button) =>
  button.addEventListener("click", () => {
    state.input = button.dataset.input;
    pointer = null;
    $$("[data-input]").forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
    $("#play-instructions").textContent =
      state.input === "draw"
        ? "Draw along passages. Continue from your trail or tap the next cell."
        : "Swipe anywhere to move one step. Arrow keys work too.";
  }),
);
window.addEventListener("resize", () => {
  if (state.gameOpen) {
    updateOrientation();
    draw();
  }
});
$("#result-dialog").addEventListener("close", () => {
  if (
    state.gameOpen &&
    !state.playing &&
    !$("#ready-dialog").open &&
    !$("#result-dialog").open
  )
    stop();
});
$("#game-close").addEventListener("click", stop);
$("#exit-play").addEventListener("click", stop);
$("#restart").addEventListener("click", () => {
  stop();
  start();
});
$("#hint").addEventListener("click", () => {
  if (!state.playing || state.busy) return;
  state.practice = true;
  state.run = null;
  state.solution = !state.solution;
  $("#run-mode").textContent = "Practice";
  $("#hint").textContent = state.solution ? "Hide solution" : "Show solution";
  draw();
  toast("Solution revealed. This run is now unranked practice.");
});
$("#export").addEventListener("click", () => $("#export-dialog").showModal());
$("#share").addEventListener("click", share);
$("#share-result").addEventListener("click", () => {
  $("#result-dialog").close();
  stop();
  share();
});
$$("[data-close]").forEach((button) =>
  button.addEventListener("click", () => $("#" + button.dataset.close).close()),
);
$("#download-svg").addEventListener("click", () =>
  download(
    new Blob([new XMLSerializer().serializeToString(exportSVG())], {
      type: "image/svg+xml",
    }),
    "svg",
  ),
);
$("#download-json").addEventListener("click", () =>
  download(
    new Blob(
      [JSON.stringify({ ...state.recipe, layout: state.layout }, null, 2)],
      {
        type: "application/json",
      },
    ),
    "json",
  ),
);
$("#download-png").addEventListener("click", () =>
  png().catch((error) => toast(error.message)),
);
$("#print-maze").addEventListener("click", printMaze);
$("#copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#share-link").value);
    toast("Copied. A friend’s next detour is ready.");
  } catch {
    $("#share-link").focus();
    $("#share-link").select();
    toast("Select and copy the link above.");
  }
});
$("#dismiss-challenge").addEventListener("click", () => {
  if (state.gameOpen || state.busy) return;
  state.challenge = null;
  load(state.recipe);
});
for (const [id, filter] of [
  ["global-scores", "global"],
  ["maze-scores", "maze"],
])
  $("#" + id).addEventListener("click", () => {
    state.filter = filter;
    $("#global-scores").setAttribute(
      "aria-pressed",
      String(filter === "global"),
    );
    $("#maze-scores").setAttribute("aria-pressed", String(filter === "maze"));
    leaderboard();
  });
$("#refresh-scores").addEventListener("click", leaderboard);
$("#name-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.result?.token) return;
  $("#post-score").disabled = true;
  try {
    await api("scores", {
      token: state.result.token,
      name: $("#player-name").value,
    });
    localWrite("mazer-name", $("#player-name").value.trim());
    $("#name-form").hidden = true;
    $("#result-status").textContent =
      "Your name is on the board. Invite someone to take this path.";
    toast("Posted. Your maze is ready to challenge.");
  } catch (error) {
    toast(error.message);
    $("#post-score").disabled = false;
  }
});
$("#result-leaderboard").addEventListener("click", () => {
  $("#result-dialog").close();
  stop();
  tab("leaderboard");
});
$("#play-again").addEventListener("click", () => {
  $("#result-dialog").close();
  stop();
  start();
});
const themes = ["paper", "night", "blue"];
let theme = localRead("mazer-theme", "paper");
if (!themes.includes(theme)) theme = "paper";
document.documentElement.dataset.theme = theme;
$("#theme-toggle").addEventListener("click", () => {
  theme = themes[(themes.indexOf(theme) + 1) % themes.length];
  document.documentElement.dataset.theme = theme;
  localWrite("mazer-theme", theme);
  draw();
  if (!$("#saved-view").hidden) saved();
  toast(
    { paper: "Warm paper", night: "After hours", blue: "Blue hour" }[theme],
  );
});
try {
  if (location.search) {
    state.recipe = decode(location.search);
    const p = new URLSearchParams(location.search);
    state.layout = paperLayout(
      {
        paper: p.get("paper") ?? undefined,
        orientation: p.get("orientation") ?? undefined,
      },
      state.recipe.shape,
    );
    const target = Number(p.get("target")),
      who = p.get("who");
    if (who && target >= 0 && target <= 10000 && p.has("target"))
      state.challenge = { name: who.slice(0, 24), score: Math.round(target) };
  }
} catch {
  toast(
    "That link contains unsupported settings. Using the default paper layout.",
  );
}
load(state.recipe, { keepChallenge: true });
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
