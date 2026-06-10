import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Formatter, Annotation, AnnotationVerticalJustify } from "vexflow";
import { LETTER_COLORS } from "../lib/notes.js";
import { noteLabel } from "../lib/i18n.js";

const DONE_INK = "#9a9078";   // already played: receded into the paper
const AHEAD_INK = "#cdc4ab";  // coming up: visible but quiet

// A short phrase read left to right; the active note carries the scaffolds.
export default function PhraseStaff({ notes, currentIdx, scaffold }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.replaceChildren();
    const W = 340, H = 150;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    const stave = new Stave(8, 30, W - 16);
    stave.addClef(notes[0].clef);
    stave.setContext(ctx).draw();

    const staveNotes = notes.map((n, i) => {
      const sn = new StaveNote({ clef: n.clef, keys: [n.key], duration: "q" });
      if (i < currentIdx) {
        sn.setStyle({ fillStyle: DONE_INK, strokeStyle: DONE_INK });
      } else if (i === currentIdx) {
        if (scaffold.colors) {
          const c = LETTER_COLORS[n.letter];
          sn.setStyle({ fillStyle: c, strokeStyle: c });
        }
        if (scaffold.letters) {
          const label = noteLabel(n.letter);
          const ann = new Annotation(label)
            .setFont("Fraunces, Georgia, serif", label.length > 1 ? 11 : 13, "bold")
            .setVerticalJustification(AnnotationVerticalJustify.BOTTOM);
          sn.addModifier(ann);
        }
      } else {
        sn.setStyle({ fillStyle: AHEAD_INK, strokeStyle: AHEAD_INK });
      }
      return sn;
    });
    Formatter.FormatAndDraw(ctx, stave, staveNotes);

    const svg = div.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `A ${notes.length}-note phrase, note ${currentIdx + 1} active`);
  }, [notes, currentIdx, scaffold.letters, scaffold.colors]);

  return <div ref={ref} className="staff" />;
}
