/**
 * The path of a hollow lozenge `w` wide and `h` tall centred on (cx, cy),
 * for a hairline stroke: the points sit half a pixel in from the extents,
 * so a stroke of 1 stays crisp. The finials of OrnateRule and the gathering
 * marks (GatheringMark) are drawn with it.
 */
export function lozengePath(cx: number, cy: number, w: number, h: number): string {
  const rx = (w - 1) / 2;
  const ry = (h - 1) / 2;
  return `M${cx} ${cy - ry}L${cx + rx} ${cy}L${cx} ${cy + ry}L${cx - rx} ${cy}Z`;
}
