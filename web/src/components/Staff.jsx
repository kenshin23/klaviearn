import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Formatter, Annotation, AnnotationVerticalJustify } from "vexflow";
import { LETTER_COLORS } from "../lib/notes.js";

// One giant note on a treble staff. Size comes from the SVG viewBox: we draw
// at 280×150 and let it fill the card, so staff lines and noteheads thicken
// proportionally. (VexFlow's context.scale() is unreliable, and resize()
// sets inline px styles that override CSS — learned in Phase 0.)
export default function Staff({ note, showLetter, showColor }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.innerHTML = "";
    const W = 280, H = 150;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    const stave = new Stave(8, 30, W - 16);
    stave.addClef("treble");
    stave.setContext(ctx).draw();

    const staveNote = new StaveNote({ clef: "treble", keys: [note.key], duration: "w" });
    if (showColor) {
      const c = LETTER_COLORS[note.letter];
      staveNote.setStyle({ fillStyle: c, strokeStyle: c });
    }
    if (showLetter) {
      const ann = new Annotation(note.letter)
        .setFont("Fraunces, Georgia, serif", 13, "bold")
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
    svg.setAttribute("aria-label", `A whole note on the treble staff`);
  }, [note, showLetter, showColor]);

  return <div ref={ref} className="staff" />;
}
