import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Accidental, Formatter, Annotation, AnnotationVerticalJustify } from "vexflow";
import { LETTER_COLORS } from "../lib/notes.js";
import { chordLabel } from "../lib/i18n.js";

// One triad as a single stacked whole note. Same sizing trick as Staff.jsx:
// draw at 280×150 and let the viewBox scale it, so lines and noteheads
// thicken proportionally with the card.
//
// Scaffolds here are per-notehead colors plus the chord's name underneath —
// not per-note letters. Three letters stacked inside a chord is exactly the
// crowding this app exists to avoid.
export default function ChordStaff({ exercise, showName, showColor }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.replaceChildren();
    const W = 280, H = 150;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    const stave = new Stave(8, 30, W - 16);
    stave.addClef(exercise.clef);
    stave.setContext(ctx).draw();

    const staveNote = new StaveNote({
      clef: exercise.clef,
      keys: exercise.notes.map(n => n.key),
      duration: "w",
    });
    exercise.notes.forEach((n, i) => {
      if (n.acc) staveNote.addModifier(new Accidental(n.acc), i);
      if (showColor) {
        const c = LETTER_COLORS[n.letter];
        staveNote.setKeyStyle(i, { fillStyle: c, strokeStyle: c });
      }
    });
    if (showName) {
      const label = chordLabel(exercise.rootName, exercise.quality);
      const ann = new Annotation(label)
        .setFont("Fraunces, Georgia, serif", 11, "bold")
        .setVerticalJustification(AnnotationVerticalJustify.BOTTOM);
      staveNote.addModifier(ann);
    }
    Formatter.FormatAndDraw(ctx, stave, [staveNote]);

    const svg = div.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${exercise.name} chord on the ${exercise.clef} staff`);
  }, [exercise, showName, showColor]);

  return <div ref={ref} className="staff" />;
}
