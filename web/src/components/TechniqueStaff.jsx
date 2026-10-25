import { useEffect, useRef } from "react";
import {
  Renderer, Stave, StaveNote, Formatter, Accidental, Annotation, AnnotationVerticalJustify,
} from "vexflow";
import { KEYS, LETTER_COLORS } from "../lib/notes.js";

// A technique pattern written out, with the fingering above the notes.
//
// Fingering is a scaffold, not decoration: the numbers show while the pattern
// is new and withdraw with the colours once it is under the hand. The app
// cannot see which finger you used — it prompts, and grades note order and
// evenness instead, which is what a teacher does between lessons.
//
// Long patterns are split across two systems — up on the first, back down on
// the second — rather than drawn as one very wide staff.
//
// This is a legibility decision, not a layout one. The SVG scales to the
// card's width, so a fifteen-note scale on one line renders at roughly a
// third the height of a single flashed note. In an app whose whole premise
// is large notation that is the wrong trade, and splitting at the apex is
// where a scale naturally breaks anyway.
// Beyond this many notes, one line renders too small to read comfortably.
const SPLIT_ABOVE = 9;

export default function TechniqueStaff({ exercise, showFingers, showColor, activeIdx = -1, verdicts }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.replaceChildren();
    const count = exercise.notes.length;
    // Split at the apex: everything up to and including the top note, then
    // the way back down.
    const lines = count > SPLIT_ABOVE
      ? [[0, Math.ceil(count / 2)], [Math.ceil(count / 2), count]]
      : [[0, count]];
    const perLine = Math.max(...lines.map(([from, to]) => to - from));
    const W = Math.max(320, 44 * perLine);
    const H = lines.length === 1 ? 150 : 270;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();
    const systemGroups = [];

    lines.forEach(([from, to], line) => {
      systemGroups.push(ctx.openGroup("technique-system"));
      const stave = new Stave(8, 30 + line * 120, W - 16);
      stave.addClef(exercise.clef);
      // The signature says it once at the front of each system, so the notes
      // below only draw the accidentals it does not already cover — the G
      // sharp of a harmonic minor, and nothing in a plain major scale.
      if (exercise.key && exercise.key !== "C") stave.addKeySignature(KEYS[exercise.key].vex);
      stave.setContext(ctx).draw();

      const staveNotes = exercise.notes.slice(from, to).map((n, offset) => {
        const i = from + offset;
        const sn = new StaveNote({ clef: n.clef, keys: [n.key], duration: "q" });
        if (n.written) sn.addModifier(new Accidental(n.written), 0);
        if (showColor) {
          const c = LETTER_COLORS[n.letter];
          sn.setStyle({ fillStyle: c, strokeStyle: c });
        }
        if (verdicts !== undefined) {
          const verdict = verdicts[i]?.verdict ?? "pending";
          const color = verdict === "ok" || verdict === "early" || verdict === "late"
            ? "#238636"
            : verdict === "wrong" || verdict === "missed"
              ? "#d61f3d"
              : i === activeIdx ? "#b77900" : "#394150";
          sn.setStyle({ fillStyle: color, strokeStyle: color });
        }
        if (showFingers) {
          const finger = new Annotation(String(exercise.fingers[i]))
            .setFont("Atkinson Hyperlegible, Helvetica, sans-serif", 13, "bold")
            .setVerticalJustification(AnnotationVerticalJustify.TOP);
          sn.addModifier(finger);
        }
        if (verdicts === undefined && i === activeIdx) {
          sn.setStyle({ fillStyle: "#d61f3d", strokeStyle: "#d61f3d" });
        }
        return sn;
      });
      Formatter.FormatAndDraw(ctx, stave, staveNotes);
      ctx.closeGroup();
    });

    const svg = div.querySelector("svg");
    // High octave ranges can make neighboring systems overlap. Measure each
    // system and move it down far enough to leave a readable gap. jsdom does
    // not implement getBBox(), so the original stave positions remain the
    // fallback when geometry measurement is unavailable.
    let previousBottom = null;
    systemGroups.forEach((group) => {
      if (typeof group.getBBox !== "function") return;
      try {
        const { y, height } = group.getBBox();
        if (![y, height].every(Number.isFinite) || height <= 0) return;
        if (previousBottom !== null) {
          const gap = 24;
          const shift = Math.max(0, previousBottom + gap - y);
          if (shift > 0) group.setAttribute("transform", `translate(0 ${shift})`);
          previousBottom = y + height + shift;
        } else {
          previousBottom = y + height;
        }
      } catch {
        // Leave this system at its nominal position if it cannot be measured.
      }
    });

    // VexFlow can place ledger lines, stems and finger annotations beyond the
    // nominal canvas. Fit the SVG to all rendered content, including any
    // translated systems. Keep the nominal viewBox if measurement is absent.
    let viewBox = `0 0 ${W} ${H}`;
    if (typeof svg.getBBox === "function") {
      try {
        const { x, y, width, height } = svg.getBBox();
        if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
          const padding = 8;
          const left = Math.min(0, x - padding);
          const top = Math.min(0, y - padding);
          const right = Math.max(W, x + width + padding);
          const bottom = Math.max(H, y + height + padding);
          viewBox = `${left} ${top} ${right - left} ${bottom - top}`;
        }
      } catch {
        // Keep the nominal bounds if the browser cannot measure the SVG yet.
      }
    }
    svg.setAttribute("viewBox", viewBox);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      `${exercise.name}, ${count} notes, fingering ${exercise.fingers.join(" ")}` +
        (verdicts === undefined
          ? ""
          : `, ${verdicts.filter(({ verdict }) => ["ok", "early", "late"].includes(verdict)).length} correct of ${count}`),
    );
  }, [exercise, showFingers, showColor, activeIdx, verdicts]);

  return <div ref={ref} className="staff" />;
}
