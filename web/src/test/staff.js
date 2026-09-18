// Helpers for reading what VexFlow actually drew.
//
// VexFlow renders to SVG, so the output is inspectable: noteheads are
// <g class="vf-notehead"> carrying the scaffold colour as a fill attribute,
// annotations are <g class="vf-annotation"><text>, and glyphs without a
// wrapper class (accidentals, ledger lines) show up as bare <path>s.
import { expect } from "vitest";

export const svgOf = container => container.querySelector("svg");

export const noteheads = container => [
  ...svgOf(container).querySelectorAll("g.vf-notehead"),
];

/**
 * The effective scaffold colour of each notehead, in drawing order.
 *
 * Where the colour lands depends on how the component set it: a whole-note
 * style (Staff, GrandStaff, PhraseStaff) paints the enclosing vf-stavenote,
 * while a per-key style (ChordStaff, which colours a triad note by note)
 * paints the vf-notehead itself. Walk outwards so either reads the same.
 */
export const headColors = container =>
  noteheads(container).map(head => {
    for (let el = head; el && el.tagName !== "svg"; el = el.parentElement) {
      const fill = el.getAttribute("fill");
      if (fill && fill !== "none") return fill;
    }
    return null;
  });

export const annotations = container =>
  [...svgOf(container).querySelectorAll("g.vf-annotation text")].map(t => t.textContent);

export const staveCount = container => svgOf(container).querySelectorAll("g.vf-stave").length;

/** Every drawn path. Accidentals and ledger lines have no class of their own,
 *  so they are counted rather than selected — compare two renderings that
 *  differ by exactly one glyph. */
export const glyphCount = container => svgOf(container).querySelectorAll("path").length;

export const clefShape = container =>
  svgOf(container).querySelector("g.vf-clef path")?.getAttribute("d");

/**
 * The sizing contract every staff shares: draw at a fixed size, then hand
 * scaling to the viewBox so lines and noteheads thicken with the card.
 * VexFlow's resize() writes inline width/height in px, which would override
 * the CSS and cap the notation at its drawing size — the components strip
 * them, and this asserts they did.
 */
export function expectScalesWithItsCard(container, { width, height }) {
  const svg = svgOf(container);
  expect(svg).toBeTruthy();
  expect(svg.getAttribute("viewBox")).toBe(`0 0 ${width} ${height}`);
  expect(svg.hasAttribute("width")).toBe(false);
  expect(svg.hasAttribute("height")).toBe(false);
  expect(svg.style.width).toBe("100%");
  expect(svg.style.height).toBe("auto");
}

/** Screen readers get a description, not a wall of unlabelled paths. */
export function expectDescribedForScreenReaders(container, pattern) {
  const svg = svgOf(container);
  expect(svg.getAttribute("role")).toBe("img");
  expect(svg.getAttribute("aria-label")).toMatch(pattern);
}
