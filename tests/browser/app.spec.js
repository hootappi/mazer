import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.nativeRequestFullscreen = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = undefined;
  });
});
async function play(page) {
  await page.locator("#play").click();
  await page.locator("#ready-yes").click();
  await expect(page.locator("#ready-dialog")).not.toBeVisible();
  await expect(page.locator("#run-mode")).toHaveText(/^(Ranked|Practice)$/);
}
async function details(page) {
  return page.evaluate(async () => {
    const { decode, generate } = await import("/src/maze.js");
    return generate(decode(location.search));
  });
}
async function solveWithPointer(page) {
  const maze = await details(page);
  const coords = await page.evaluate(
    (path) => {
      const svg = document.querySelector("#maze-stage svg[data-maze-art]"),
        matrix = svg.getScreenCTM();
      return path.map((c) => {
        const p = new DOMPoint(c.x, c.y).matrixTransform(matrix);
        return { x: p.x, y: p.y };
      });
    },
    maze.solution.map((id) => maze.cells[id]),
  );
  await page.mouse.move(coords[0].x, coords[0].y);
  await page.mouse.down();
  for (const p of coords.slice(1))
    await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.mouse.up();
}
test("create shapes, keep, export, print, share and resize without overflow", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#maze-stage > svg")).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-create.png`,
    fullPage: true,
  });
  for (const shape of ["rectangle", "round", "square"]) {
    await page.locator(`[data-shape="${shape}"]`).click();
    await expect(page.locator("#stat-shape")).toHaveText(
      shape[0].toUpperCase() + shape.slice(1),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.locator("#seed").fill("BROWSER");
  await page.locator("#seed-form button").click();
  await expect(page.locator("#maze-label")).toContainText("BROWSER");
  await page.locator("#save").click();
  await expect(page.locator("#saved-count")).toHaveText("1");
  await page.reload();
  await expect(page.locator("#saved-count")).toHaveText("1");
  await page.locator("#export").click();
  for (const [id, ext] of [
    ["download-svg", ".svg"],
    ["download-png", ".png"],
    ["download-json", ".json"],
  ]) {
    const next = page.waitForEvent("download");
    await page.locator("#" + id).click();
    const file = await next;
    expect(file.suggestedFilename().endsWith(ext)).toBeTruthy();
    expect(await file.failure()).toBeNull();
    await file.saveAs(`test-results/${info.project.name}${ext}`);
  }
  await page.locator("#print-maze").click();
  await page.waitForTimeout(400);
  const print = page
    .frames()
    .filter((f) => f !== page.mainFrame())
    .at(-1);
  expect(await print.locator("body > svg").count()).toBe(1);
  await expect(print.locator("#maze-label")).toContainText("BROWSER");
  await page.locator('[data-close="export-dialog"]').click();
  await page.locator("#share").click();
  const link = await page.locator("#share-link").inputValue();
  await page.locator('[data-close="share-dialog"]').click();
  await page.goto(link);
  await expect(page.locator("#maze-label")).toContainText("BROWSER");
  await page.locator("#theme-toggle").click();
  await page.locator("#theme-toggle").click();
  await page.locator("#theme-toggle").click();
  await page.locator('[data-tab="saved"]').click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page.locator(".saved-open").click();
  await expect(page.locator("#create-view")).toBeVisible();
  expect(errors).toEqual([]);
});
test("trace actual route, submit a name and challenge the same leaderboard board", async ({
  page,
}, info) => {
  await page.goto(
    "/?v=1&seed=TEST-" +
      info.project.name +
      "&shape=square&size=small&level=easy",
  );
  await play(page);
  await expect(page.locator("#run-mode")).toHaveText("Ranked");
  await solveWithPointer(page);
  await expect(page.locator("#result-dialog")).toBeVisible();
  await expect(page.locator("#result-status")).toContainText("verified");
  const player = "P-" + info.project.name + "-" + Date.now().toString(36);
  await page.locator("#player-name").fill(player);
  await page.locator("#post-score").click();
  await expect(page.locator("#name-form")).toBeHidden();
  await page.screenshot({
    path: `test-results/${info.project.name}-result.png`,
  });
  await page.locator("#result-leaderboard").click();
  const row = page.locator(".leader-row").filter({ hasText: player });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator("#challenge-copy")).toContainText(player);
  await expect(page.locator("#seed")).toHaveValue("TEST-" + info.project.name);
});
test("round trace works and hints make a run unranked", async ({ page }) => {
  await page.goto("/?v=1&seed=ROUND&shape=round&size=small&level=easy");
  await play(page);
  await solveWithPointer(page);
  await expect(page.locator("#result-dialog")).toBeVisible();
  await expect(page.locator("#result-status")).toContainText("verified");
  await page.locator("#play-again").click();
  await page.locator("#ready-yes").click();
  await expect(page.locator("#ready-dialog")).not.toBeVisible();
  await expect(page.locator("#run-mode")).toHaveText(/^(Ranked|Practice)$/);
  await page.locator("#hint").click();
  await expect(page.locator("#run-mode")).toHaveText("Practice");
  await page.locator("#exit-play").click();
  await expect(page.locator("#creator-controls")).toBeVisible();
});
test("keyboard moves, swipe moves and offline practice remain usable", async ({
  page,
}) => {
  await page.goto("/?v=1&seed=KEYBOARD&shape=square&size=small&level=easy");
  await play(page);
  const maze = await details(page);
  const a = maze.cells[maze.solution[0]],
    b = maze.cells[maze.solution[1]],
    key = b.x > a.x ? "ArrowRight" : "ArrowDown";
  await page.locator("#maze-stage").press(key);
  await expect(page.locator("#moves")).toHaveText("1");
  await page.locator("#exit-play").click();
  await page.route("**/api/runs", (route) => route.abort());
  await play(page);
  await expect(page.locator("#run-mode")).toHaveText("Practice");
  await page.locator("#exit-play").click();
});

test("actual touch tracing crosses passages and directional swipes move one step", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "desktop",
    "Touch input applies to phone and iPad projects.",
  );
  await page.goto("/?v=1&seed=TOUCH&shape=square&size=small&level=easy");
  await play(page);
  const maze = await details(page),
    session = await page.context().newCDPSession(page);
  const coords = await page.evaluate(
    (path) => {
      const svg = document.querySelector("#maze-stage svg[data-maze-art]"),
        matrix = svg.getScreenCTM();
      return path.map((c) => {
        const p = new DOMPoint(c.x, c.y).matrixTransform(matrix);
        return { x: p.x, y: p.y };
      });
    },
    maze.solution.slice(0, 2).map((id) => maze.cells[id]),
  );
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...coords[0], id: 0 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...coords[1], id: 0 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator("#moves")).toHaveText("1");
  const c = maze.cells[maze.solution[1]],
    next = maze.cells[maze.solution[2]],
    box = await page.locator("#maze-stage").boundingBox(),
    origin = { x: box.x + 8, y: box.y + 8 },
    dest = {
      x: origin.x + Math.sign(next.x - c.x) * 28,
      y: origin.y + Math.sign(next.y - c.y) * 28,
    };
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...origin, id: 0 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...dest, id: 0 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator("#moves")).toHaveText("2");
});
test("service worker restores creation offline and falls back to practice", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "allow" }),
    page = await context.newPage();
  try {
    await page.goto("/?v=1&seed=OFFLINE&shape=round&size=small&level=easy");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          ),
        );
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#maze-stage > svg")).toBeVisible();
    await page.locator("#generate").click();
    await expect(page.locator("#seed")).not.toHaveValue("OFFLINE");
    await play(page);
    await expect(page.locator("#run-mode")).toHaveText("Practice");
  } finally {
    await context.close();
  }
});

test("portrait PNG keeps proportions and landscape print fits one A4 page", async ({
  page,
  browser,
}, info) => {
  await page.goto(
    "/?v=1&seed=EXPORT&shape=portrait&size=small&level=easy&paper=A4&orientation=portrait",
  );
  await page.locator("#export").click();
  const pending = page.waitForEvent("download");
  await page.locator("#download-png").click();
  const file = await pending;
  const bytes = await readFile(await file.path());
  expect(bytes.readUInt32BE(16)).toBeLessThan(bytes.readUInt32BE(20));
  await page.locator('[data-close="export-dialog"]').click();
  await page.locator('button[data-orientation="landscape"]').click();
  await page.locator("#export").click();
  await page.locator("#print-maze").click();
  await page.waitForTimeout(400);
  const frame = page
      .frames()
      .filter((f) => f !== page.mainFrame())
      .at(-1),
    html = await frame.locator("html").evaluate((el) => el.outerHTML),
    printPage = await browser.newPage();
  try {
    await printPage.setContent(html);
    const pdf = await printPage.pdf({ preferCSSPageSize: true });
    expect(
      (pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
    ).toBe(1);
  } finally {
    await printPage.close();
  }
  if (info.project.name === "phone") {
    await page.locator('[data-close="export-dialog"]').click();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
});

test("paper workflow matches preview, sharing, saved layout and physical print size", async ({
  page,
  browser,
}, info) => {
  await page.goto("/");
  const legends = await page
    .locator("#creator-controls legend")
    .allTextContents();
  expect(legends.map((text) => text.replace(/\s+/g, " ").trim())).toEqual([
    "01 Choose paper size",
    "02 Choose orientation",
    "03 Choose a shape",
    "04 Make room to wander",
    "05 How do you want to get lost?",
  ]);
  await expect(page.locator("#play")).toContainText("PLAY");
  for (const paper of ["A6", "A5", "A4", "A3", "A2"])
    for (const orientation of ["portrait", "landscape"]) {
      await page.locator(`button[data-paper="${paper}"]`).click();
      await page.locator(`button[data-orientation="${orientation}"]`).click();
      const sheet = page.locator("#maze-stage > svg");
      await expect(sheet).toHaveAttribute("data-paper", paper);
      await expect(sheet).toHaveAttribute("data-orientation", orientation);
      const box = await sheet.boundingBox();
      expect(
        orientation === "portrait"
          ? box.height > box.width
          : box.width > box.height,
      ).toBeTruthy();
      const metadata = await page.locator("#maze-label").boundingBox();
      expect(metadata.y).toBeGreaterThan(box.y + box.height * 0.8);
      expect(metadata.x).toBeLessThan(box.x + box.width * 0.2);
      const actions = await page.locator("#preview-actions").boundingBox();
      expect(actions.y).toBeGreaterThanOrEqual(box.y + box.height);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
  await page.locator('[data-shape="rectangle"]').click();
  await expect(page.locator("#stat-shape")).toHaveText("Rectangle");
  expect(new URL(page.url()).searchParams.get("shape")).toBe("landscape");
  await page.locator('button[data-orientation="portrait"]').click();
  expect(new URL(page.url()).searchParams.get("shape")).toBe("portrait");
  await page.locator('button[data-paper="A6"]').click();
  await page.locator("#save").click();
  await page.locator("#share").click();
  const link = await page.locator("#share-link").inputValue();
  await page.locator('[data-close="share-dialog"]').click();
  await page.goto(link);
  await expect(page.locator('button[data-paper="A6"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator('button[data-orientation="portrait"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator('button[data-paper="A2"]').click();
  await page.locator('[data-tab="saved"]').click();
  await page.locator(".saved-open").click();
  await expect(page.locator('button[data-paper="A6"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.screenshot({
    path: `test-results/${info.project.name}-paper-portrait.png`,
    fullPage: true,
  });
  for (const [paper, orientation] of [
    ["A6", "portrait"],
    ["A2", "landscape"],
  ]) {
    await page.locator(`button[data-paper="${paper}"]`).click();
    await page.locator(`button[data-orientation="${orientation}"]`).click();
    await page.locator("#export").click();
    const pending = page.waitForEvent("download");
    await page.locator("#download-svg").click();
    const svgFile = await pending;
    const svgText = await readFile(await svgFile.path(), "utf8");
    expect(svgText).toContain('data-paper="' + paper + '"');
    expect(svgText).toContain("MAZE /");
    await page.locator("#print-maze").click();
    await page.waitForTimeout(400);
    const frame = page
        .frames()
        .filter((f) => f !== page.mainFrame())
        .at(-1),
      html = await frame.locator("html").evaluate((el) => el.outerHTML),
      printPage = await browser.newPage();
    try {
      await printPage.setContent(html);
      const printedPitch = await printPage
        .locator("svg[data-maze-art]")
        .evaluate((svg) => (svg.getScreenCTM().a * 25.4) / 96);
      expect(printedPitch).toBeCloseTo(10, 2);
      const pdf = await printPage.pdf({ preferCSSPageSize: true });
      const text = pdf.toString("latin1");
      expect((text.match(/\/Type \/Page\b/g) || []).length).toBe(1);
      const dims = text.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
      expect(dims).not.toBeNull();
      const expected = paper === "A6" ? [105, 148] : [594, 420];
      // Chromium rounds paper dimensions to device pixels (up to one PDF point).
      expect(
        Math.abs(Number(dims[1]) - (expected[0] * 72) / 25.4),
      ).toBeLessThan(1);
      expect(
        Math.abs(Number(dims[2]) - (expected[1] * 72) / 25.4),
      ).toBeLessThan(1);
    } finally {
      await printPage.close();
    }
    await page.locator('[data-close="export-dialog"]').click();
  }
  await page.screenshot({
    path: `test-results/${info.project.name}-paper-landscape.png`,
    fullPage: true,
  });
});

test("paper size adds cells with constant millimetre passage widths and v2 ranked challenges", async ({
  page,
}, info) => {
  await page.goto(
    `/?v=2&seed=PAPER-${info.project.name}&shape=square&size=medium&level=easy&paper=A6&orientation=portrait`,
  );
  const measure = () =>
    page.evaluate(async () => {
      const { generate, decode } = await import("/src/maze.js");
      const maze = generate(decode(location.search)),
        svg = document.querySelector("#maze-stage svg[data-maze-art]");
      return {
        cells: maze.cells.length,
        pitch: svg.width.baseVal.value / svg.viewBox.baseVal.width,
        rows: maze.rows,
        cols: maze.cols,
      };
    });
  const small = await measure();
  expect(small.pitch).toBeCloseTo(10, 5);
  await page.locator('button[data-paper="A2"]').click();
  const huge = await measure();
  expect(huge.pitch).toBeCloseTo(10, 5);
  expect(huge.cells).toBeGreaterThan(small.cells * 10);
  await expect(page.locator("#passage-note")).toContainText("10 mm passages");
  await page.locator('button[data-paper="A6"]').click();
  expect(await measure()).toEqual(small);
  await play(page);
  await solveWithPointer(page);
  await expect(page.locator("#result-dialog")).toBeVisible();
  await expect(page.locator("#result-status")).toContainText("verified");
  const name = `Paper-${info.project.name}-${Date.now().toString(36)}`;
  await page.locator("#player-name").fill(name);
  await page.locator("#post-score").click();
  await expect(page.locator("#name-form")).toBeHidden();
  await page.locator("#result-leaderboard").click();
  await page
    .getByRole("button", {
      name: `Challenge ${name} on maze PAPER-${info.project.name}`,
      exact: false,
    })
    .click();
  expect(new URL(page.url()).searchParams.get("v")).toBe("2");
  expect(new URL(page.url()).searchParams.get("paper")).toBe("A6");
  expect(await measure()).toEqual(small);
});

test("immersive readiness, pause, trail drawing, restart and stop keep the page locked", async ({
  page,
}, info) => {
  await page.goto("/?v=1&seed=IMMERSIVE&shape=square&size=small&level=easy");
  let starts = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/runs")) starts++;
  });
  await page.locator("#play").click();
  await expect(page.locator("#ready-dialog")).toBeVisible();
  await page.waitForTimeout(350);
  await expect(page.locator("#timer")).toHaveText("00:00.0");
  expect(starts).toBe(0);
  expect(
    await page.locator(".maze-panel").evaluate((el) => {
      const b = el.getBoundingClientRect();
      return (
        b.x === 0 &&
        b.y === 0 &&
        Math.abs(b.width - innerWidth) < 1 &&
        Math.abs(b.height - innerHeight) < 1
      );
    }),
  ).toBeTruthy();
  await page.locator("#ready-yes").click();
  await expect(page.locator("#ready-dialog")).not.toBeVisible();
  await expect(page.locator("#run-mode")).toHaveText(/^(Ranked|Practice)$/);
  expect(starts).toBe(1);
  const scroll = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 500);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.locator("#pause").click();
  await expect(page.locator("#pause-dialog")).toBeVisible();
  await page.evaluate(() =>
    document
      .querySelector("#maze-stage")
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
  );
  await expect(page.locator("#moves")).toHaveText("0");
  await page.locator("#resume").click();
  const maze = await details(page);
  const coords = await page.evaluate(
    (cells) => {
      const m = document
        .querySelector("#maze-stage svg[data-maze-art]")
        .getScreenCTM();
      return cells.map((c) => {
        const p = new DOMPoint(c.x, c.y).matrixTransform(m);
        return { x: p.x, y: p.y };
      });
    },
    maze.solution.slice(0, 4).map((id) => maze.cells[id]),
  );
  // Tap the next cell, then draw from the earlier trail: legal backtracking is counted.
  await page.mouse.click(coords[1].x, coords[1].y);
  await expect(page.locator("#moves")).toHaveText("1");
  await page.mouse.move(coords[0].x, coords[0].y);
  await page.mouse.down();
  for (const p of coords.slice(1))
    await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator("#moves")).toHaveText("5");
  await page.screenshot({
    path: `test-results/${info.project.name}-immersive.png`,
  });
  await page.locator("#restart").click();
  await expect(page.locator("#ready-dialog")).toBeVisible();
  await expect(page.locator("#timer")).toHaveText("00:00.0");
  await page.locator("#ready-stop").click();
  await expect(page.locator("#creator-controls")).toBeVisible();
  expect(
    await page
      .locator("body")
      .evaluate((el) => el.classList.contains("game-mode")),
  ).toBeFalsy();
});

test("phone orientation prompts gate readiness and block input after rotation", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "desktop",
    "Rotation guidance applies to touch devices.",
  );
  await page.goto(
    "/?v=2&seed=ROTATE&shape=landscape&size=small&level=easy&paper=A6&orientation=landscape",
  );
  await page.locator("#play").click();
  await expect(page.locator("#ready-rotate")).toHaveText(
    "Turn your device to landscape.",
  );
  await expect(page.locator("#ready-yes")).toBeDisabled();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#ready-yes")).toBeEnabled();
  await page.locator("#ready-yes").click();
  await expect(page.locator("#ready-dialog")).not.toBeVisible();
  await expect(page.locator("#run-mode")).toHaveText(/^(Ranked|Practice)$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#rotate-prompt")).toBeVisible();
  await page.evaluate(() =>
    document
      .querySelector("#maze-stage")
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
  );
  await expect(page.locator("#moves")).toHaveText("0");
  await page.locator("#rotate-stop").click();
  await page.locator('button[data-orientation="portrait"]').click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("#play").click();
  await expect(page.locator("#ready-rotate")).toHaveText(
    "Turn your device to portrait.",
  );
  await page.locator("#ready-stop").click();
});

test("native fullscreen can restart and exit without cancelling the next ready step", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Native fullscreen integration is checked on desktop Chrome.",
  );
  await page.goto("/?v=1&seed=FULLSCREEN&shape=square&size=small&level=easy");
  await page.evaluate(() => {
    Element.prototype.requestFullscreen = window.nativeRequestFullscreen;
  });
  await page.locator("#play").click();
  await expect(page.locator("#ready-dialog")).toBeVisible();
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBeFalsy();
  expect(
    await page.locator("#ready-yes").evaluate((el) => {
      const b = el.getBoundingClientRect();
      return (
        document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === el
      );
    }),
  ).toBeTruthy();
  await page.locator("#ready-yes").click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await expect(page.locator("#ready-dialog")).not.toBeVisible();
  await expect(page.locator("#run-mode")).toHaveText(/^(Ranked|Practice)$/);
  await page.locator("#restart").click();
  await expect(page.locator("#ready-dialog")).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator("#ready-dialog")).toBeVisible();
  await page.locator("#ready-stop").click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await expect(page.locator("#creator-controls")).toBeVisible();
});

test("readiness stays clickable and fullscreen rejection cannot block starting", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Fullscreen rejection is checked once; fallback layout is covered on every profile.",
  );
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = function () {
      window.readyWasOpenAtFullscreenRequest =
        document.querySelector("#ready-dialog").open;
      return Promise.reject(new Error("Fullscreen unavailable"));
    };
  });
  await page.goto("/?v=1&seed=READY-LAYER&shape=square&size=small&level=easy");
  await page.locator("#play").click();
  await expect(page.locator("#ready-dialog")).toBeVisible();
  expect(
    await page.evaluate(() => window.readyWasOpenAtFullscreenRequest),
  ).toBeUndefined();
  await page.locator("#ready-yes").click();
  await expect(page.locator("#run-mode")).toHaveText("Ranked");
  expect(
    await page.evaluate(() => window.readyWasOpenAtFullscreenRequest),
  ).toBe(false);
  await expect(page.locator("#ready-dialog")).not.toBeVisible();
  await expect(page.locator("#run-mode")).toHaveText(/^(Ranked|Practice)$/);
  await page.locator("#exit-play").click();
});

test("touch gameplay keeps downward swipes in the board and exits using the corner X", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "desktop",
    "Real touch gestures apply to phone and iPad profiles.",
  );
  await page.addInitScript(() => {
    window.nativeFullscreenCalls = 0;
    Element.prototype.requestFullscreen = function () {
      window.nativeFullscreenCalls++;
      return Promise.resolve();
    };
  });
  await page.goto("/?v=1&seed=IOS-0&shape=square&size=small&level=easy");
  await play(page);
  expect(await page.evaluate(() => window.nativeFullscreenCalls)).toBe(0);
  await page.locator('[data-input="swipe"]').click();
  const maze = await details(page);
  expect(maze.cells[maze.solution[1]].row).toBe(1);
  const box = await page.locator("#maze-stage").boundingBox(),
    start = { x: box.x + box.width / 2, y: box.y + box.height / 2 - 20 },
    end = { x: start.x, y: start.y + 55 },
    session = await page.context().newCDPSession(page);
  const scroll = await page.evaluate(() => scrollY);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 0 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...end, id: 0 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator("#moves")).toHaveText("1");
  await expect(page.locator("body")).toHaveClass(/game-mode/);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.screenshot({
    path: `test-results/${info.project.name}-touch-close.png`,
  });
  await page.getByRole("button", { name: "Exit game", exact: true }).click();
  await expect(page.locator("#creator-controls")).toBeVisible();
  await expect(page.locator("#game-close")).toBeHidden();
});

test("iPadOS desktop identity also avoids native fullscreen", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Simulate iPad with a fine pointer and Mac identity once.",
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    window.nativeFullscreenCalls = 0;
    Element.prototype.requestFullscreen = function () {
      window.nativeFullscreenCalls++;
      return Promise.resolve();
    };
  });
  await page.goto("/?v=1&seed=IPAD-MAC&shape=square&size=small&level=easy");
  await play(page);
  expect(await page.evaluate(() => window.nativeFullscreenCalls)).toBe(0);
  await page.locator("#game-close").click();
  await expect(page.locator("#creator-controls")).toBeVisible();
});
