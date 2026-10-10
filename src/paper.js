// Physical paper geometry. v1 uses presentation only; v2 includes it in the recipe.
export const PAPERS = Object.freeze({
  A6: [105, 148],
  A5: [148, 210],
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
});
export function paperLayout(input = {}, shape = "square") {
  const paper = input.paper ?? "A4";
  const orientation =
    input.orientation ?? (shape === "landscape" ? "landscape" : "portrait");
  if (
    !Object.hasOwn(PAPERS, paper) ||
    !["portrait", "landscape"].includes(orientation)
  )
    throw new Error("Choose a supported paper size and orientation.");
  return { paper, orientation };
}
export function paperDimensions(input) {
  const layout = paperLayout(input),
    [width, height] = PAPERS[layout.paper];
  return layout.orientation === "landscape" ? [height, width] : [width, height];
}

// Maze size means density: more cells use narrower passages, at every paper size.
export const PASSAGE_MM = Object.freeze({ small: 14, medium: 10, large: 7 });
export function paperMetrics(input) {
  const [width, height] = paperDimensions(input);
  return {
    width,
    height,
    margin: 8,
    header: 20,
    footer: 22,
    availableWidth: width - 16,
    availableHeight: height - 42,
  };
}
export function physicalMaze(input) {
  const area = paperMetrics(input),
    pitch = PASSAGE_MM[input.size];
  if (!pitch) throw new Error("Choose a supported maze size.");
  const cols = Math.floor(area.availableWidth / pitch - 0.3),
    rows = Math.floor(area.availableHeight / pitch - 0.3);
  if (input.shape === "round")
    return {
      pitch,
      radius: Math.floor(
        Math.min(area.availableWidth, area.availableHeight) / (2 * pitch) -
          0.15,
      ),
    };
  const side = Math.min(cols, rows);
  return {
    pitch,
    cols: input.shape === "square" ? side : cols,
    rows: input.shape === "square" ? side : rows,
  };
}
