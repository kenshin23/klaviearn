import { useEffect, useRef } from "react";
import { Renderer, Stave } from "vexflow";

// A key signature on an empty grand staff, and nothing else.
//
// The drill is "count the sharps or flats and name the key", so the staff is
// deliberately bare: no notes to read the key off, and both clefs because a
// signature is written on both and the shapes differ between them.
export default function KeySignatureStaff({ exercise }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.replaceChildren();
    const W = 300, H = 230;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    for (const [clef, y] of [["treble", 20], ["bass", 120]]) {
      const stave = new Stave(20, y, W - 40);
      stave.addClef(clef);
      stave.addKeySignature(exercise.vex);
      stave.setContext(ctx).draw();
    }

    const svg = div.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.setAttribute("role", "img");
    // Deliberately does NOT name the key: that is the answer.
    const count = exercise.sharps || exercise.flats;
    const kind = exercise.sharps ? "sharp" : "flat";
    svg.setAttribute(
      "aria-label",
      count === 0
        ? "A key signature with no sharps or flats"
        : `A key signature with ${count} ${kind}${count === 1 ? "" : "s"}`,
    );
  }, [exercise]);

  return <div ref={ref} className="staff" />;
}
