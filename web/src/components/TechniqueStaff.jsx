import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Formatter, Annotation, AnnotationVerticalJustify } from "vexflow";
import { LETTER_COLORS } from "../lib/notes.js";

// A technique pattern written out, with the fingering above the notes.
//
// Fingering is a scaffold, not decoration: the numbers show while the pattern
// is new and withdraw with the colours once it is under the hand. The app
// cannot see which finger you used — it prompts, and grades note order and
// evenness instead, which is what a teacher does between lessons.
//
// A scale is fifteen notes, so this draws wider than the other staves and
// leans on the viewBox to scale it down rather than cramming.
export default function TechniqueStaff({ exercise, showFingers, showColor, activeIdx = -1 }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.replaceChildren();
    const count = exercise.notes.length;
    const W = Math.max(320, 44 * count), H = 150;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    const stave = new Stave(8, 30, W - 16);
    stave.addClef(exercise.clef);
    stave.setContext(ctx).draw();

    const staveNotes = exercise.notes.map((n, i) => {
      const sn = new StaveNote({ clef: n.clef, keys: [n.key], duration: "q" });
      if (showColor) {
        const c = LETTER_COLORS[n.letter];
        sn.setStyle({ fillStyle: c, strokeStyle: c });
      }
      if (showFingers) {
        const finger = new Annotation(String(exercise.fingers[i]))
          .setFont("Atkinson Hyperlegible, Helvetica, sans-serif", 13, "bold")
          .setVerticalJustification(AnnotationVerticalJustify.TOP);
        sn.addModifier(finger);
      }
      if (i === activeIdx) sn.setStyle({ fillStyle: "#d61f3d", strokeStyle: "#d61f3d" });
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
    svg.setAttribute(
      "aria-label",
      `${exercise.name}, ${count} notes, fingering ${exercise.fingers.join(" ")}`,
    );
  }, [exercise, showFingers, showColor, activeIdx]);

  return <div ref={ref} className="staff" />;
}
