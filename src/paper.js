// Paper belongs to presentation, not the v1 maze identity or score.
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
