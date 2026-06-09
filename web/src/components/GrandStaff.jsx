import { useEffect, useRef } from "react";
import {
  Renderer, Stave, StaveNote, StaveConnector, Formatter,
  Annotation, AnnotationVerticalJustify,
} from "vexflow";
import { LETTER_COLORS } from "../lib/notes.js";

// Treble and bass braced together; the note lands on whichever staff the
// exercise says — reading WHICH staff is part of the skill.
export default function GrandStaff({ exercise, showLetter, showColor }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.replaceChildren();
    const W = 300, H = 240;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    const treble = new Stave(20, 20, W - 28);
    treble.addClef("treble");
    const bass = new Stave(20, 130, W - 28);
    bass.addClef("bass");
    treble.setContext(ctx).draw();
    bass.setContext(ctx).draw();
    new StaveConnector(treble, bass).setType("brace").setContext(ctx).draw();
    new StaveConnector(treble, bass).setType("singleLeft").setContext(ctx).draw();

    const staveNote = new StaveNote({
      clef: exercise.clef,
      keys: [exercise.key],
      duration: "w",
    });
    if (showColor) {
      const c = LETTER_COLORS[exercise.letter];
      staveNote.setStyle({ fillStyle: c, strokeStyle: c });
    }
    if (showLetter) {
      const ann = new Annotation(exercise.letter)
        .setFont("Fraunces, Georgia, serif", 12, "bold")
        .setVerticalJustification(
          exercise.clef === "bass" ? AnnotationVerticalJustify.TOP : AnnotationVerticalJustify.BOTTOM,
        );
      staveNote.addModifier(ann);
    }
    Formatter.FormatAndDraw(ctx, exercise.clef === "bass" ? bass : treble, [staveNote]);

    const svg = div.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "A whole note on the grand staff");
  }, [exercise, showLetter, showColor]);

  return <div ref={ref} className="staff" />;
}
