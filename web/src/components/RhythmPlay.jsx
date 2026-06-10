import { useEffect, useRef, useState } from "react";
import { audioContext, click } from "../lib/audio.js";
import { rhythmName, t } from "../lib/i18n.js";

export const BPM = 80;
const COUNT_IN = 4;
const TOLERANCE_BEATS = 0.25; // ±187ms at 80bpm — generous on purpose for v1

const BEATS = { q: 1, h: 2, w: 4, 8: 0.5 };
export function onsetsOf(durations) {
  let t = 0;
  const onsets = [];
  for (const d of durations) {
    const rest = d.endsWith("r");
    if (!rest) onsets.push(t);
    t += BEATS[d.replace("r", "")];
  }
  return { onsets, totalBeats: t };
}

// One rhythm "take": count-in 4 clicks, then one bar where the user taps the
// pattern while the metronome keeps clicking. Scored on the audio clock.
// registerTap lets the parent route spacebar / MIDI hits into the active take.
export default function RhythmPlay({ exercise, onAttempt, registerTap }) {
  const [phase, setPhase] = useState("idle"); // idle | counting | tapping | scored
  const [beat, setBeat] = useState(0);
  const [verdicts, setVerdicts] = useState(null); // per-onset: ok | early | late | missed
  const take = useRef(null);
  const timers = useRef([]);

  const { onsets } = onsetsOf(exercise.durations);
  const spb = 60 / BPM;

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  useEffect(() => () => clearTimers(), []);
  useEffect(() => { setPhase("idle"); setVerdicts(null); }, [exercise]);

  function hearIt() {
    const ctx = audioContext();
    const t0 = ctx.currentTime + 0.2;
    for (let i = 0; i < COUNT_IN; i++) click(t0 + i * spb, i === 0);
    for (const onset of onsets) {
      // the pattern voiced as a higher, longer tone over the clicks
      const t = t0 + (COUNT_IN + onset) * spb;
      click(t, false);
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = "triangle"; osc.frequency.value = 880;
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g).connect(ctx.destination); osc.start(t); osc.stop(t + 0.3);
    }
    for (let i = 0; i < 4; i++) click(t0 + (COUNT_IN + i) * spb, i === 0);
  }

  function start() {
    if (phase === "counting" || phase === "tapping") return;
    const ctx = audioContext();
    ctx.resume?.();
    clearTimers();
    const t0 = ctx.currentTime + 0.25;
    for (let i = 0; i < COUNT_IN + 4; i++) click(t0 + i * spb, i % 4 === 0);
    // Map the audio clock onto performance.now() so tap timestamps compare.
    const perfT0 = performance.now() + (t0 - ctx.currentTime) * 1000;
    take.current = { perfT0, taps: [] };
    if (import.meta.env.DEV) window.__kvRhythm = { perfT0, spb, onsets, countIn: COUNT_IN };

    setPhase("counting");
    setVerdicts(null);
    for (let i = 0; i < COUNT_IN + 4; i++) {
      timers.current.push(setTimeout(() => setBeat(i % 4), perfT0 - performance.now() + i * spb * 1000));
    }
    timers.current.push(setTimeout(() => setPhase("tapping"), perfT0 - performance.now() + COUNT_IN * spb * 1000));
    timers.current.push(setTimeout(score, perfT0 - performance.now() + (COUNT_IN + 4) * spb * 1000 + 350));
  }

  function tap() {
    const t = take.current;
    if (!t) return;
    const beats = (performance.now() - t.perfT0) / 1000 / spb - COUNT_IN;
    if (beats > -0.5) t.taps.push(beats);
  }
  registerTap(tap);

  function score() {
    const taps = [...(take.current?.taps ?? [])];
    take.current = null;
    const result = onsets.map(onset => {
      let best = -1, bestDiff = Infinity;
      taps.forEach((tapBeat, i) => {
        const diff = Math.abs(tapBeat - onset);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      });
      if (best === -1 || bestDiff > TOLERANCE_BEATS) return "missed";
      const tapBeat = taps.splice(best, 1)[0];
      return Math.abs(tapBeat - onset) <= TOLERANCE_BEATS * 0.6
        ? "ok"
        : tapBeat < onset ? "early" : "late";
    });
    const extras = taps.length;
    const hit = extras === 0 && result.every(v => v !== "missed");
    setVerdicts({ perOnset: result, extras });
    setPhase("scored");
    onAttempt(hit);
  }

  return (
    <div className="rhythm-play">
      <p className="rhythm-meta">
        {rhythmName(exercise.name)} · {BPM} {t("bpm")}
        {phase === "counting" && <strong className="count"> — {beat + 1}</strong>}
        {phase === "tapping" && <strong className="count go"> — {t("GO")}</strong>}
      </p>
      {verdicts && (
        <p className="verdicts" aria-label="Timing per note">
          {verdicts.perOnset.map((v, i) => (
            <span key={i} className={`verdict ${v}`}>
              {v === "ok" ? "✓" : v === "missed" ? "✗" : v === "early" ? `◂ ${t("early")}` : `${t("late")} ▸`}
            </span>
          ))}
          {verdicts.extras > 0 && <span className="verdict missed">+{verdicts.extras} {t("extra")}</span>}
        </p>
      )}
      <div className="row">
        <button className="btn primary" onClick={start} disabled={phase === "counting" || phase === "tapping"}>
          {phase === "scored" || phase === "idle" ? t("▶ Count-in & tap") : t("▶ Counting…")}
        </button>
        <button className="btn" onClick={hearIt} disabled={phase === "counting" || phase === "tapping"}>
          {t("🔊 Hear it")}
        </button>
      </div>
      <button
        className="btn tap-pad"
        onPointerDown={tap}
        disabled={phase !== "counting" && phase !== "tapping"}
        aria-label="Tap the rhythm here"
      >
        {t("TAP — or spacebar, or any piano key")}
      </button>
    </div>
  );
}
