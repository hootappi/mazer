import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createApp } from "../server.js";
import { generate, encode } from "../src/maze.js";
test("ranked runs validate routes, save names once, persist and filter challenges", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mazer-api-"));
  let now = 10000;
  let app = createApp({ dataDir: dir, clock: () => now });
  const open = async () => {
    app.listen(0, "127.0.0.1");
    await once(app, "listening");
    return `http://127.0.0.1:${app.address().port}`;
  };
  let url = await open();
  const post = (path, body, options = {}) =>
    fetch(url + "/api/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...options },
      body: JSON.stringify(body),
    });
  const close = () => new Promise((resolve) => app.close(resolve));
  try {
    const r = {
        v: 1,
        seed: "api-test",
        shape: "round",
        size: "small",
        level: "easy",
      },
      maze = generate(r);
    assert.equal((await post("runs", { recipe: { ...r, v: 2 } })).status, 400);
    assert.equal(
      (await post("runs", { recipe: r }, { Origin: "https://evil.example" }))
        .status,
      403,
    );
    const start = await (await post("runs", { recipe: r })).json();
    assert.equal(
      (await post("finish", { id: start.id, path: [maze.start, maze.end] }))
        .status,
      400,
    );
    now += 15000;
    const finish = await (
      await post("finish", { id: start.id, path: maze.solution })
    ).json();
    assert.equal(finish.elapsed, 15000);
    assert.equal(
      (await post("finish", { id: start.id, path: maze.solution })).status,
      410,
    );
    assert.equal(
      (await post("scores", { token: finish.token, name: "" })).status,
      400,
    );
    assert.equal(
      (await post("scores", { token: finish.token, name: "<b>Ada</b>" }))
        .status,
      201,
    );
    assert.equal(
      (await post("scores", { token: finish.token, name: "Again" })).status,
      410,
    );
    const scores = await (await fetch(url + "/api/leaderboard")).json();
    assert.equal(scores.scores.length, 1);
    assert.equal(scores.scores[0].name, "<b>Ada</b>");
    assert.deepEqual(scores.scores[0].recipe, r);
    assert.equal(
      (
        await (
          await fetch(
            url +
              "/api/leaderboard?maze=" +
              encodeURIComponent(encode({ ...r, seed: "other" })),
          )
        ).json()
      ).scores.length,
      0,
    );
    const physical = { ...r, v: 2, paper: "A6", orientation: "portrait" };
    const physicalMaze = generate(physical);
    const physicalRun = await (await post("runs", { recipe: physical })).json();
    now += 10000;
    const physicalResult = await (
      await post("finish", { id: physicalRun.id, path: physicalMaze.solution })
    ).json();
    assert.deepEqual(physicalResult.recipe, physical);
    assert.equal(
      (
        await post("scores", {
          token: physicalResult.token,
          name: "Paper player",
        })
      ).status,
      201,
    );
    const physicalBoard = await (
      await fetch(
        url + "/api/leaderboard?maze=" + encodeURIComponent(encode(physical)),
      )
    ).json();
    assert.equal(physicalBoard.scores.length, 1);
    assert.deepEqual(physicalBoard.scores[0].recipe, physical);
    await close();
    app = createApp({ dataDir: dir, clock: () => now });
    url = await open();
    assert.equal(
      (await (await fetch(url + "/api/leaderboard")).json()).scores.length,
      2,
    );
    const exp = await (await post("runs", { recipe: r })).json();
    now += 3600001;
    assert.equal(
      (await post("finish", { id: exp.id, path: maze.solution })).status,
      410,
    );
    assert.equal((await fetch(url + "/server.js")).status, 404);
    assert.equal((await fetch(url + "/data/mazer.sqlite")).status, 404);
    const health = await fetch(url + "/health");
    assert.equal(health.status, 200);
    assert.match(
      health.headers.get("content-security-policy"),
      /script-src 'self'/,
    );
    for (let i = 0; i < 30; i++) await post("runs", { recipe: r });
    assert.equal((await post("runs", { recipe: r })).status, 429);
  } finally {
    await close();
    await rm(dir, { recursive: true, force: true });
  }
});
