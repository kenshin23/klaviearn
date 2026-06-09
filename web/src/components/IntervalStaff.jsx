import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Formatter } from "vexflow";

// Two plain notes — no colors or letters on purpose: this drill trains
// seeing the DISTANCE, and letter scaffolds would turn it into arithmetic.
export default function IntervalStaff({ notes }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.replaceChildren();
    const W = 280, H = 150;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    const stave = new Stave(8, 30, W - 16);
    stave.addClef(notes[0].clef);
    stave.setContext(ctx).draw();

    const staveNotes = notes.map(
      n => new StaveNote({ clef: n.clef, keys: [n.key], duration: "h" })
    );
    Formatter.FormatAndDraw(ctx, stave, staveNotes);

    const svg = div.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Two notes forming an interval");
  }, [notes]);

  return <div ref={ref} className="staff" />;
}
