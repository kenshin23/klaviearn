import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Formatter, Beam } from "vexflow";

// One bar of rhythm on a percussion staff, big.
export default function RhythmStaff({ durations }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.replaceChildren();
    const W = 320, H = 140;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    const stave = new Stave(8, 25, W - 16);
    stave.addClef("percussion").addTimeSignature("4/4");
    stave.setContext(ctx).draw();

    const notes = durations.map(
      d => new StaveNote({ clef: "percussion", keys: ["b/4"], duration: d })
    );
    const beams = Beam.generateBeams(notes);
    Formatter.FormatAndDraw(ctx, stave, notes);
    beams.forEach(b => b.setContext(ctx).draw());

    const svg = div.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "A one-bar rhythm");
  }, [durations]);

  return <div ref={ref} className="staff" />;
}
