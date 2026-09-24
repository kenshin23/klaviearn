import { useEffect, useRef } from "react";
import {
  Renderer, Stave, StaveNote, StaveConnector, Voice, Formatter, Dot,
  Annotation, AnnotationVerticalJustify,
} from "vexflow";
import { LETTER_COLORS, noteSpec } from "../lib/notes.js";

// One bar of a piece on the grand staff.
//
// Both hands are always drawn — reading which staff a note belongs to is part
// of playing from a score — but only the hand being practised is inked. The
// other recedes, the way the upcoming notes of a phrase do, so you can see
// where you are without being asked to play it.
//
// Fingering is a scaffold here exactly as it is in the technique track: shown
// while the bar is new, withdrawn once it is under the hand.

const DIM = "#b3a98f"; // the hand you are not playing right now

/** Beats to a VexFlow duration, plus how many dots it needs. */
export function vexDuration(beats) {
  const table = [
    [4, "w", 0], [3, "h", 1], [2, "h", 0], [1.5, "q", 1],
    [1, "q", 0], [0.75, "8", 1], [0.5, "8", 0], [0.25, "16", 0],
  ];
  const match = table.find(([value]) => Math.abs(value - beats) < 1e-6);
  return match ? { duration: match[1], dots: match[2] } : { duration: "q", dots: 0 };
}

function buildVoice(notes, clef, beatsPerBar, { active, showFingers }) {
  const staveNotes = notes.map(note => {
    const { duration, dots } = vexDuration(note.beats);
    const spec = noteSpec(note.midi, clef);
    const staveNote = new StaveNote({
      clef,
      keys: [spec.key],
      duration: note.rest ? `${duration}r` : duration,
    });
    for (let i = 0; i < dots; i++) Dot.buildAndAttach([staveNote], { all: true });

    if (!active) {
      staveNote.setStyle({ fillStyle: DIM, strokeStyle: DIM });
    } else if (showFingers && note.finger) {
      const colour = LETTER_COLORS[spec.letter];
      staveNote.setStyle({ fillStyle: colour, strokeStyle: colour });
      staveNote.addModifier(
        new Annotation(String(note.finger))
          .setFont("Atkinson Hyperlegible, Helvetica, sans-serif", 12, "bold")
          .setVerticalJustification(
            clef === "bass" ? AnnotationVerticalJustify.BOTTOM : AnnotationVerticalJustify.TOP,
          ),
      );
    }
    return staveNote;
  });

  const voice = new Voice({ numBeats: beatsPerBar, beatValue: 4 }).setStrict(false);
  voice.addTickables(staveNotes);
  return voice;
}

export default function PassageStaff({ exercise, hands, showFingers }) {
  const ref = useRef(null);

  useEffect(() => {
    const div = ref.current;
    div.replaceChildren();
    const W = 320, H = 250;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    const treble = new Stave(20, 20, W - 30);
    treble.addClef("treble");
    const bass = new Stave(20, 135, W - 30);
    bass.addClef("bass");
    treble.setContext(ctx).draw();
    bass.setContext(ctx).draw();
    new StaveConnector(treble, bass).setType("brace").setContext(ctx).draw();
    new StaveConnector(treble, bass).setType("singleLeft").setContext(ctx).draw();

    const beats = exercise.beatsPerBar;
    const voices = [
      [buildVoice(exercise.rh, "treble", beats, {
        active: hands.includes("rh"), showFingers,
      }), treble],
      [buildVoice(exercise.lh, "bass", beats, {
        active: hands.includes("lh"), showFingers,
      }), bass],
    ];
    for (const [voice, stave] of voices) {
      new Formatter().joinVoices([voice]).format([voice], W - 80);
      voice.draw(ctx, stave);
    }

    const svg = div.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      `${exercise.title}, bar ${exercise.bar} of ${exercise.bars}`,
    );
  }, [exercise, hands, showFingers]);

  return <div ref={ref} className="staff" />;
}
