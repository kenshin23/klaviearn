/** Beats to a VexFlow duration, plus how many dots it needs. */
export function vexDuration(beats) {
  const table = [
    [4, "w", 0], [3, "h", 1], [2, "h", 0], [1.5, "q", 1],
    [1, "q", 0], [0.75, "8", 1], [0.5, "8", 0], [0.25, "16", 0],
  ];
  const match = table.find(([value]) => Math.abs(value - beats) < 1e-6);
  return match ? { duration: match[1], dots: match[2] } : { duration: "q", dots: 0 };
}

