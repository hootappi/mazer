import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
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
      const svg = document.querySelector("#maze-stage svg"),
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
  await expect(page.locator("#maze-stage svg")).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-create.png`,
    fullPage: true,
  });
  for (const shape of ["portrait", "landscape", "round", "square"]) {
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
  const print = page.frames().find((f) => f !== page.mainFrame());
  expect(await print.locator("svg").count()).toBe(1);
  await expect(print.locator("header")).toContainText("BROWSER");
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
  await page.locator("#play").click();
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
  await page.locator("#play").click();
  await solveWithPointer(page);
  await expect(page.locator("#result-dialog")).toBeVisible();
  await expect(page.locator("#result-status")).toContainText("verified");
  await page.locator("#play-again").click();
  await page.locator("#hint").click();
  await expect(page.locator("#run-mode")).toHaveText("Practice");
  await page.locator("#exit-play").click();
  await expect(page.locator("#creator-controls")).toBeVisible();
});
test("keyboard moves, swipe moves and offline practice remain usable", async ({
  page,
}) => {
  await page.goto("/?v=1&seed=KEYBOARD&shape=square&size=small&level=easy");
  await page.locator("#play").click();
  const maze = await details(page);
  const a = maze.cells[maze.solution[0]],
    b = maze.cells[maze.solution[1]],
    key = b.x > a.x ? "ArrowRight" : "ArrowDown";
  await page.locator("#maze-stage").press(key);
  await expect(page.locator("#moves")).toHaveText("1");
  await page.locator("#exit-play").click();
  await page.route("**/api/runs", (route) => route.abort());
  await page.locator("#play").click();
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
  await page.locator("#play").click();
  const maze = await details(page),
    session = await page.context().newCDPSession(page);
  const coords = await page.evaluate(
    (path) => {
      const svg = document.querySelector("#maze-stage svg"),
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
    await expect(page.locator("#maze-stage svg")).toBeVisible();
    await page.locator("#generate").click();
    await expect(page.locator("#seed")).not.toHaveValue("OFFLINE");
    await page.locator("#play").click();
    await expect(page.locator("#run-mode")).toHaveText("Practice");
  } finally {
    await context.close();
  }
});

test("portrait PNG keeps proportions and landscape print fits one A4 page", async ({
  page,
  browser,
}, info) => {
  await page.goto("/?v=1&seed=EXPORT&shape=portrait&size=small&level=easy");
  await page.locator("#export").click();
  const pending = page.waitForEvent("download");
  await page.locator("#download-png").click();
  const file = await pending;
  const bytes = await readFile(await file.path());
  expect(bytes.readUInt32BE(16)).toBeLessThan(bytes.readUInt32BE(20));
  await page.locator('[data-close="export-dialog"]').click();
  await page.locator('[data-shape="landscape"]').click();
  await page.locator("#export").click();
  await page.locator("#print-maze").click();
  await page.waitForTimeout(400);
  const frame = page.frames().find((f) => f !== page.mainFrame()),
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
