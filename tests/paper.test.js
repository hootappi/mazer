import test from "node:test";
import assert from "node:assert/strict";
import { paperLayout, paperDimensions, PAPERS } from "../src/paper.js";
import { encode, decode, generate } from "../src/maze.js";
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
