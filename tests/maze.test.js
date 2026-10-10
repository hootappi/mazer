import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  generate,
  shortest,
  validPath,
  encode,
  decode,
  recipe,
  score,
  SHAPES,
  SIZES,
  LEVELS,
  pointFor,
  directional,
} from "../src/maze.js";
test("all shapes/sizes/difficulties are connected trees with valid reproducible routes", () => {
  let count = 0;
  for (const shape of SHAPES)
    for (const size of SIZES)
      for (const level of LEVELS)
        for (let seed = 0; seed < 8; seed++) {
          const r = { v: 1, shape, size, level, seed: String(seed) },
            maze = generate(r);
          assert.equal(
            maze.passages.reduce((n, p) => n + p.length, 0),
            (maze.cells.length - 1) * 2,
          );
          const seen = new Set([maze.start]),
            q = [maze.start];
          for (let i = 0; i < q.length; i++)
            for (const next of maze.passages[q[i]])
              if (!seen.has(next)) {
                seen.add(next);
                q.push(next);
              }
          assert.equal(seen.size, maze.cells.length);
          assert(validPath(maze, maze.solution));
          assert.deepEqual(maze.solution, shortest(maze));
          assert.deepEqual(generate(decode(encode(r))).passages, maze.passages);
          for (const c of maze.cells)
            assert.equal(pointFor(maze, c.x, c.y), c.id);
          count++;
        }
  console.log(`Verified ${count} maze combinations`);
});
test("difficulty selects ordered route complexity for the same seed and topology", () => {
  for (const shape of SHAPES)
    for (const size of SIZES) {
      const r = { v: 1, shape, size, seed: "difficulty" };
      const lengths = LEVELS.map((level) => generate({ ...r, level }).optimal);
      assert(lengths[0] <= lengths[1] && lengths[1] <= lengths[2]);
    }
});
test("recipe validation rejects unsupported, oversized and malformed links", () => {
  const base = {
    v: 1,
    seed: "good",
    shape: "square",
    size: "small",
    level: "easy",
  };
  for (const change of [
    { v: 2 },
    { shape: "triangle" },
    { size: "huge" },
    { level: "bad" },
    { seed: "<script>" },
    { seed: "a".repeat(33) },
    { seed: "" },
  ])
    assert.throws(() => recipe({ ...base, ...change }));
});
test("score rewards pace and efficiency, and replay validation rejects illegal routes", () => {
  const maze = generate({
    v: 1,
    seed: "test",
    shape: "square",
    size: "small",
    level: "easy",
  });
  assert(score(maze, maze.optimal, 1000) > score(maze, maze.optimal, 5000));
  assert(
    score(maze, maze.optimal, 1000) > score(maze, maze.optimal + 20, 1000),
  );
  assert(score(maze, maze.optimal, 0) <= 10000);
  assert(!validPath(maze, [maze.start, maze.end]));
  assert(!validPath(maze, [maze.start, -1, maze.end]));
  assert(!validPath(maze, [maze.start]));
  assert(!validPath(maze, [...maze.solution, maze.start]));
  const next = maze.solution[1],
    a = maze.cells[maze.start],
    b = maze.cells[next];
  assert.equal(
    directional(maze, maze.start, Math.sign(b.x - a.x), Math.sign(b.y - a.y)),
    next,
  );
});
test("v1 maze fingerprint remains frozen for existing shared links", () => {
  const hashes = SHAPES.map((shape) =>
    createHash("sha256")
      .update(
        JSON.stringify(
          generate({
            v: 1,
            seed: "WANDER-001",
            shape,
            size: "medium",
            level: "steady",
          }).passages,
        ),
      )
      .digest("hex"),
  );
  assert.deepEqual(hashes, [
    "aa768a9077ee2e75fb3efdd9dce48330326779a1f409b3843e75d37c7fa4d627",
    "eeccafc34bb47731533b2f2812144a04462a1be52964507c15ecb99904b18760",
    "67737f7f33f717788259f2be471aa399a7a403a54ca70df9010af75772424233",
    "e6014ec16af5ba5a6b51ee94a381c446f0b01738c26921799c0dcf63ac8cb418",
  ]);
});
