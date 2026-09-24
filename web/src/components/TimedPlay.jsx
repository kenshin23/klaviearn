import { useEffect, useRef, useState } from "react";
import { audioContext, click, tone } from "../lib/audio.js";
import { midiToFreq } from "../lib/notes.js";
import { score } from "../lib/evaluator.js";
import { noteName, t } from "../lib/i18n.js";

export const BPM = 80; // default practice tempo — evenness before speed
const COUNT_IN = 4;
const TAIL_MS = 350; // grace after the last beat before scoring

/**
 * One timed "take": count in, run the metronome, collect what was played, and
 * score it through the shared evaluator.
 *
 * This is the app's only clock. The rhythm drill uses it with pitch-less
 * expectations (any key is a tap); the technique and timed-phrase drills pass
 * the notes they want. `registerInput` lets the parent route MIDI, the
 * on-screen keys and the spacebar into whichever take is running — it is
 * called with the MIDI number played, or nothing for a bare tap.
 *
 * onAttempt receives the whole scored take, not just a pass/fail: a phrase
 * needs to know which note fell over so the right item takes the hit.
 */
export default function TimedPlay({
  expected,
  label,
  onAttempt,
  registerInput,
  bpm = BPM,
  strictOctave = false,
  tolerance,
  tapPad = false,
}) {
  const [phase, setPhase] = useState("idle"); // idle | counting | playing | scored
  const [beat, setBeat] = useState(0);
  const [result, setResult] = useState(null);
  const take = useRef(null);
  const timers = useRef([]);

  const spb = 60 / bpm;
  const lastBeat = expected.length ? expected[expected.length - 1].at : 0;
  const totalBeats = Math.ceil(lastBeat + 1);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);
  useEffect(() => {
    clearTimers();
    take.current = null;
    setPhase("idle");
    setResult(null);
  }, [expected]);

  /** Sound the exercise so you know what you are aiming at. */
  function hearIt() {
    const ctx = audioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.2;
    for (let i = 0; i < COUNT_IN + totalBeats; i++) click(t0 + i * spb, i % 4 === 0);
    for (const event of expected) {
      const at = t0 + (COUNT_IN + event.at) * spb;
      if (event.midis?.length) {
        for (const midi of event.midis) tone(midiToFreq(midi), 0.45, "triangle", at - ctx.currentTime, 0.2);
      } else {
        // A rhythm has no pitch, so voice it as one clear tone over the clicks.
        tone(880, 0.25, "triangle", at - ctx.currentTime, 0.25);
      }
    }
  }

  function start() {
    if (phase === "counting" || phase === "playing") return;
    const ctx = audioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    clearTimers();

    const audioT0 = ctx.currentTime + 0.25;
    for (let i = 0; i < COUNT_IN + totalBeats; i++) click(audioT0 + i * spb, i % 4 === 0);

    // Map the audio clock onto performance.now() so input timestamps compare
    // against the clicks the player actually hears.
    const perfT0 = performance.now() + (audioT0 - ctx.currentTime) * 1000;
    take.current = { perfT0, played: [] };
    setPhase("counting");
    setResult(null);

    const after = beats => perfT0 - performance.now() + beats * spb * 1000;
    for (let i = 0; i < COUNT_IN + totalBeats; i++) {
      timers.current.push(setTimeout(() => setBeat(i % 4), after(i)));
    }
    timers.current.push(setTimeout(() => setPhase("playing"), after(COUNT_IN)));
    timers.current.push(setTimeout(finish, after(COUNT_IN + totalBeats) + TAIL_MS));
  }

  function record(midi) {
    const current = take.current;
    if (!current) return;
    const at = (performance.now() - current.perfT0) / 1000 / spb - COUNT_IN;
    // A little before the first beat still counts: people anticipate.
    if (at > -0.5) current.played.push({ at, midi });
  }
  registerInput(record);

  function finish() {
    const played = take.current?.played ?? [];
    take.current = null;
    const scored = score(expected, played, { strictOctave, tolerance });
    setResult(scored);
    setPhase("scored");
    onAttempt(scored);
  }

  const busy = phase === "counting" || phase === "playing";

  return (
    <div className="rhythm-play">
      <p className="rhythm-meta">
        {label} · {bpm} {t("bpm")}
        {phase === "counting" && <strong className="count"> — {beat + 1}</strong>}
        {phase === "playing" && <strong className="count go"> — {t("GO")}</strong>}
      </p>

      {result && (
        <p className="verdicts" aria-label="Timing per note">
          {result.verdicts.map((v, i) => (
            <span key={i} className={`verdict ${v.verdict}`}>
              {v.verdict === "ok" && "✓"}
              {v.verdict === "missed" && "✗"}
              {v.verdict === "early" && `◂ ${t("early")}`}
              {v.verdict === "late" && `${t("late")} ▸`}
              {v.verdict === "wrong" && (v.played == null ? "✗" : noteName(v.played))}
            </span>
          ))}
          {result.extras > 0 && (
            <span className="verdict missed">+{result.extras} {t("extra")}</span>
          )}
        </p>
      )}

      <div className="row">
        <button className="btn primary" onClick={start} disabled={busy}>
          {busy ? t("▶ Counting…") : t("▶ Count-in & play")}
        </button>
        <button className="btn" onClick={hearIt} disabled={busy}>
          {t("🔊 Hear it")}
        </button>
      </div>

      {tapPad && (
        <button
          className="btn tap-pad"
          onPointerDown={() => record()}
          disabled={!busy}
          aria-label="Tap the rhythm here"
        >
          {t("TAP — or spacebar, or any piano key")}
        </button>
      )}
    </div>
  );
}
