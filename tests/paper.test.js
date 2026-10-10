import test from "node:test";
import assert from "node:assert/strict";
import {
  paperLayout,
  paperDimensions,
  PAPERS,
  paperMetrics,
  PASSAGE_MM,
} from "../src/paper.js";
import {
  encode,
  decode,
  generate,
  recipe,
  validPath,
  pointFor,
} from "../src/maze.js";
test("ISO paper dimensions support A6 through A2 in both orientations", () => {
  for (const [paper, dims] of Object.entries(PAPERS)) {
    assert.deepEqual(paperDimensions({ paper, orientation: "portrait" }), dims);
    assert.deepEqual(
      paperDimensions({ paper, orientation: "landscape" }),
      [...dims].reverse(),
    );
  }
  assert.throws(() => paperLayout({ paper: "A0" }));
  assert.throws(() => paperLayout({ orientation: "diagonal" }));
});
test("paper presentation preserves old maze identity and geometry", () => {
  const r = {
    v: 1,
    seed: "OLD-LINK",
    shape: "landscape",
    size: "medium",
    level: "hard",
  };
  assert.deepEqual(paperLayout(undefined, r.shape), {
    paper: "A4",
    orientation: "landscape",
  });
  const query = encode(r) + "&paper=A6&orientation=portrait";
  assert.deepEqual(decode(query), r);
  assert.deepEqual(generate(decode(query)).passages, generate(r).passages);
});

test("v2 keeps physical passage widths and grows topology across every paper, shape and density", () => {
  let combinations = 0;
  for (const shape of ["square", "portrait", "landscape", "round"])
    for (const size of ["small", "medium", "large"])
      for (const orientation of ["portrait", "landscape"]) {
        if (["portrait", "landscape"].includes(shape) && shape !== orientation)
          continue;
        let previousCells = 0;
        for (const paper of Object.keys(PAPERS)) {
          const r = { v: 2, seed: "PHYSICAL", shape, size, paper, orientation };
          const lengths = [];
          for (const level of ["easy", "steady", "hard"]) {
            const maze = generate({ ...r, level });
            assert(maze.cells.length > previousCells);
            assert(validPath(maze, maze.solution));
            assert.equal(
              maze.passages.reduce((n, links) => n + links.length, 0),
              2 * (maze.cells.length - 1),
            );
            for (const cell of maze.cells)
              assert.equal(pointFor(maze, cell.x, cell.y), cell.id);
            assert.deepEqual(
              generate(decode(encode(maze.recipe))).passages,
              maze.passages,
            );
            const { availableWidth, availableHeight } = paperMetrics(r),
              pitch = PASSAGE_MM[size];
            const width = maze.radius
              ? 2 * (maze.radius + 0.15)
              : maze.cols + 0.3;
            const height = maze.radius ? width : maze.rows + 0.3;
            assert(width * pitch <= availableWidth);
            assert(height * pitch <= availableHeight);
            assert(maze.cells.length < 8000);
            lengths.push(maze.optimal);
            combinations++;
          }
          assert(lengths[0] <= lengths[1] && lengths[1] <= lengths[2]);
          previousCells = generate({ ...r, level: "easy" }).cells.length;
        }
      }
  console.log(`Verified ${combinations} physical maze combinations`);
});
test("v2 recipes identify physical boards and reject mismatched or unsupported paper settings", () => {
  const r = {
    v: 2,
    seed: "BOARD",
    shape: "portrait",
    size: "medium",
    level: "steady",
    paper: "A6",
    orientation: "portrait",
  };
  assert.deepEqual(decode(encode(r)), r);
  assert.notEqual(encode(r), encode({ ...r, paper: "A2" }));
  for (const change of [
    { paper: undefined },
    { paper: "A0" },
    { orientation: "landscape" },
    { v: 3 },
  ])
    assert.throws(() => recipe({ ...r, ...change }));
});
