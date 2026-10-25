import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import TechniqueStaff from "../components/TechniqueStaff.jsx";
import {
  advanceSpeed, ARPEGGIO_PRESETS, makeArpeggio, normalizePracticeSettings, speedKey, speedProgress,
  tempoForExercise,
} from "../lib/arpeggios.js";
import { createArpeggioClock } from "../lib/arpeggioClock.js";
import { t } from "../lib/i18n.js";
import { startMidiListener } from "../lib/midi.js";
import "./arpeggio-practice.css";

const bounded = (value, fallback, min, max) => Number.isFinite(value)
  ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
const boundedTempo = (value, fallback, min, max) => Number.isFinite(value)
  ? Math.min(max, Math.max(min, value)) : fallback;

function readConfig(settings) {
  return normalizePracticeSettings(settings?.arpeggioPractice);
}

function feedbackFor(result) {
  if (result.hit) return t("Clean cycle. Keep going.");
  if (result.extras > 0) return t("Extra notes. Play only the notes in the pattern.");
  const verdicts = result.verdicts ?? [];
  if (verdicts.some(item => item.verdict === "wrong")) return t("Wrong note or octave. Try the cycle again.");
  if (verdicts.some(item => item.verdict === "missed")) return t("Some notes were missed. Try the cycle again.");
  if (verdicts.some(item => item.verdict === "early" || item.verdict === "late")) {
    return t("Notes were off the beat. Follow the click.");
  }
  return t("Clean cycle. Keep going.");
}

function noteName(midi) {
  if (!Number.isFinite(midi)) return "—";
  const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function passSummary(result, fallbackTotal) {
  const verdicts = Array.isArray(result?.verdicts) ? result.verdicts : [];
  const correct = Number.isFinite(result?.correct)
    ? result.correct
    : verdicts.filter(item => ["ok", "early", "late"].includes(item?.verdict)).length;
  const total = Number.isFinite(result?.total) ? result.total : (verdicts.length || fallbackTotal);
  const percent = Number.isFinite(result?.percent)
    ? result.percent : (total ? Math.round(correct / total * 100) : 0);
  const wrong = Number.isFinite(result?.wrong) ? result.wrong
    : verdicts.filter(item => item?.verdict === "wrong").length;
  const missed = Number.isFinite(result?.missed) ? result.missed
    : verdicts.filter(item => item?.verdict === "missed").length;
  return { ...result, verdicts, correct, total, percent, wrong, missed };
}

export default function ArpeggioPractice({ settings = {}, onSettings = () => {}, onHome = () => {} }) {
  const config = useMemo(() => readConfig(settings), [settings]);
  const preset = ARPEGGIO_PRESETS.find(item => item.id === config.presetId) ?? ARPEGGIO_PRESETS[0];
  const exercise = useMemo(() => makeArpeggio(preset, config.octave), [preset, config.octave]);
  const key = speedKey(preset.id, config.octave);
  const progress = speedProgress(config.progress[key]);
  const [running, setRunning] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [phase, setPhase] = useState({ name: "idle", count: null });
  const [midiDevices, setMidiDevices] = useState([]);
  const [startError, setStartError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [livePass, setLivePass] = useState(null);
  const [lastPass, setLastPass] = useState(null);
  const [cleanStreak, setCleanStreak] = useState(0);
  const clockRef = useRef(null);
  const stopMidiRef = useRef(null);
  const liveRef = useRef(null);
  const streakRef = useRef({ key, streak: 0 });
  const runtimeRef = useRef({ key, ...progress });
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const feedbackKeyRef = useRef(key);

  useLayoutEffect(() => {
    if (runtimeRef.current.key !== key) {
      streakRef.current = { key, streak: 0 };
      setCleanStreak(0);
    }
    runtimeRef.current = { key, bpm: progress.bpm, bestBpm: progress.bestBpm, streak: 0 };
  }, [key, progress.bpm, progress.bestBpm]);

  useLayoutEffect(() => {
    if (feedbackKeyRef.current === key) return;
    feedbackKeyRef.current = key;
    setFeedback("");
    setLivePass(null);
    setLastPass(null);
  }, [key]);

  const persistConfig = useCallback(patch => {
    onSettings(previous => {
      const old = readConfig(previous);
      return {
        ...previous,
        arpeggioPractice: { ...old, ...patch, tempoUnit: "note-bpm", progress: old.progress },
      };
    });
  }, [onSettings]);

  const persistCycle = useCallback((result, bpm) => {
    const live = liveRef.current;
    if (!live) return bpm;
    if (streakRef.current.key !== live.key) streakRef.current = { key: live.key, streak: 0 };
    const previous = {
      ...runtimeRef.current,
      bpm: boundedTempo(result.bpm, runtimeRef.current.bpm, 20, 1800),
      streak: streakRef.current.streak,
    };
    const next = advanceSpeed(previous, result.hit, {
      stepBpm: live.config.stepBpm,
      cleanTarget: live.config.cleanTarget,
    });
    runtimeRef.current = { key: live.key, ...next };
    streakRef.current = { key: live.key, streak: next.streak };
    setCleanStreak(next.streak);
    setFeedback(feedbackFor(result));
    setLastPass(passSummary(result, live?.exercise?.midis?.length ?? 0));
    onSettings(current => {
      const old = readConfig(current);
      return {
        ...current,
        arpeggioPractice: {
          ...old,
          tempoUnit: "note-bpm",
          progress: { ...old.progress, [live.key]: { bpm: next.bpm, bestBpm: next.bestBpm } },
        },
      };
    });
    return next.bpm;
  }, [onSettings]);

  useLayoutEffect(() => {
    liveRef.current = { config, key, persistCycle, exercise };
  }, [config, key, persistCycle, exercise]);

  useEffect(() => {
    mountedRef.current = true;
    stopMidiRef.current = startMidiListener({
      onNote: midi => clockRef.current?.record(midi),
      onDevices: setMidiDevices,
    });
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      busyRef.current = false;
      const clock = clockRef.current;
      clockRef.current = null;
      clock?.stop();
      stopMidiRef.current?.();
      stopMidiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  });

  function stop() {
    generationRef.current += 1;
    busyRef.current = false;
    const clock = clockRef.current;
    clockRef.current = null;
    clock?.stop();
    streakRef.current = { key, streak: 0 };
    setCleanStreak(0);
    setRunning(false);
    setActiveIdx(-1);
    setPhase({ name: "idle", count: null });
  }

  function goHome() {
    stop();
    onHome();
  }

  async function start() {
    if (busyRef.current) return;
    busyRef.current = true;
    const generation = ++generationRef.current;
    const isCurrent = () => mountedRef.current && generationRef.current === generation;
    streakRef.current = { key, streak: 0 };
    setCleanStreak(0);
    setRunning(true);
    setStartError("");
    setFeedback("");
    setLastPass(null);
    setLivePass({ verdicts: exercise.midis.map(() => ({ verdict: "pending" })),
      correct: 0, total: exercise.midis.length, percent: 0, extras: 0, lastInput: null });
    const tempo = tempoForExercise(progress.bpm, exercise);
    const clock = createArpeggioClock({
      exercise,
      bpm: tempo.cycleBpm,
      countInSeconds: tempo.countInSeconds,
      subdivisions: config.clickMode === "four" ? 4
        : config.clickMode === "beat" ? 1 : exercise.midis.length,
      onCycle: result => {
        if (!isCurrent()) return undefined;
        const current = liveRef.current;
        if (!current) return undefined;
        const noteBpm = result.bpm * current.exercise.midis.length;
        return current.persistCycle({ ...result, bpm: noteBpm }, noteBpm)
          / current.exercise.midis.length;
      },
      onFeedback: snapshot => { if (isCurrent()) setLivePass(passSummary(snapshot, exercise.midis.length)); },
      onStep: index => { if (isCurrent()) setActiveIdx(index); },
      onPhase: (name, count) => {
        if (!isCurrent()) return;
        if (name === "idle") stop();
        else setPhase({ name, count: count ?? null });
      },
    });
    clockRef.current = clock;
    try {
      await clock.start();
      if (!isCurrent()) clock.stop();
    } catch {
      if (!isCurrent()) return;
      busyRef.current = false;
      generationRef.current += 1;
      clock.stop();
      clockRef.current = null;
      setRunning(false);
      setStartError(t("The audio clock could not start. Check your audio settings and try again."));
    }
  }

  const currentBpm = progress.bpm;
  const tempo = tempoForExercise(currentBpm, exercise);
  const duration = tempo.cycleSeconds;
  const notesPerSecond = currentBpm / 60;
  const showColor = settings.scaffold !== "plain";
  const showFingers = settings.scaffold !== "plain" && settings.scaffold !== "colors";
  const staffSize = ["medium", "large", "huge"].includes(settings.staffSize) ? settings.staffSize : "large";
  const phaseText = phase.name === "counting"
    ? `${t("Get ready")}: ${phase.count}`
    : phase.name === "playing" ? t("Playing") : t("Stopped");
  const reviewPass = running ? livePass : (lastPass ?? livePass);
  const reviewTitle = running ? "This pass"
    : lastPass ? "Last pass" : livePass ? "Interrupted pass" : "Waiting for a pass";
  const statusLabel = verdict => ({
    pending: t("Pending"), ok: t("Correct"), early: t("Correct, early"), late: t("Correct, late"),
    wrong: t("Wrong pitch or octave"), missed: t("Missed"),
  }[verdict] ?? t("Pending"));
  const diagnostic = livePass?.lastInput;
  const diagnosticExpected = diagnostic && exercise.notes[diagnostic.index]
    ? `${exercise.notes[diagnostic.index].letter}${exercise.notes[diagnostic.index].acc}${Math.floor(diagnostic.expectedMidi / 12) - 1}`
    : noteName(diagnostic?.expectedMidi);
  const diagnosticPlayed = noteName(diagnostic?.midi);

  return (
    <main className="arpeggio-page">
      <header className="arpeggio-header">
        <button type="button" className="arpeggio-home" onClick={goHome}>{t("← Home")}</button>
        <div>
          <p className="arpeggio-eyebrow">{t("Technique practice")}</p>
          <h1>{t("Arpeggio speed trainer")}</h1>
        </div>
      </header>

      <section className="arpeggio-card" aria-labelledby="arp-pattern-title">
        <details className="arpeggio-settings">
          <summary>{t("Settings")}</summary>
          <div className="arpeggio-config">
          <label>{t("Pattern")}
            <select value={preset.id} disabled={running} onChange={event => {
              const presetId = ARPEGGIO_PRESETS.some(item => item.id === event.target.value)
                ? event.target.value : ARPEGGIO_PRESETS[0].id;
              persistConfig({ presetId });
            }}>
              {ARPEGGIO_PRESETS.map(item => <option key={item.id} value={item.id}>{t(item.name)}</option>)}
            </select>
          </label>
          <label>{t("Starting octave")}
            <select value={config.octave} disabled={running} onChange={event => {
              const octave = bounded(Number(event.target.value), 2, 1, 4);
              persistConfig({ octave });
            }}>
              {[1, 2, 3, 4].map(octave => <option key={octave} value={octave}>{octave}</option>)}
            </select>
          </label>
          <label>{t("Note tempo (BPM)")}
            <input type="number" min="20" max="1800" step="0.5" value={progress.bpm} disabled={running}
              onChange={event => {
                const bpm = boundedTempo(Number(event.target.value), 20, 20, 1800);
                onSettings(previous => {
                  const old = readConfig(previous);
                  return { ...previous, arpeggioPractice: { ...old, tempoUnit: "note-bpm", progress: {
                    ...old.progress, [key]: { bestBpm: speedProgress(old.progress[key]).bestBpm, bpm },
                  } } };
                });
              }} />
          </label>
          <label>{t("Tempo increase (BPM)")}
            <input type="number" min="0.5" max="60" step="0.5" value={config.stepBpm} disabled={running}
              onChange={event => persistConfig({ stepBpm: boundedTempo(Number(event.target.value), 4, 0.5, 60) })} />
          </label>
          <label>{t("Clean passes to increase")}
            <input type="number" min="1" max="20" step="1" value={config.cleanTarget} disabled={running}
              onChange={event => persistConfig({ cleanTarget: bounded(Number(event.target.value), 5, 1, 20) })} />
          </label>
          </div>
        </details>

        <h2 id="arp-pattern-title">{t(preset.name)} · {t(preset.hand === "rh" ? "right hand" : "left hand")}</h2>
        <div className={`staff-card size-${staffSize}`}>
          <TechniqueStaff exercise={exercise} showFingers={showFingers} showColor={showColor} activeIdx={activeIdx}
            verdicts={reviewPass?.verdicts ?? exercise.midis.map(() => ({ verdict: "pending" }))} />
        </div>
        <section className="arpeggio-pass-feedback" aria-label={t("Pass feedback")}>
          <div className="arpeggio-pass-summaries">
            {(running || !lastPass) && <p><strong>{t(reviewTitle)}</strong> {livePass
              ? <>{livePass.correct}/{livePass.total} · {livePass.percent}% · {livePass.missed ?? 0} {t("missed")} · {livePass.wrong ?? 0} {t("wrong")} · {livePass.extras ?? 0} {t("extra")}</>
              : null}</p>}
            {(running || lastPass) && <p><strong>{t("Last pass")}</strong> {lastPass
              ? <>{lastPass.correct}/{lastPass.total} · {lastPass.percent}% · {lastPass.missed ?? 0} {t("missed")} · {lastPass.wrong ?? 0} {t("wrong")} · {lastPass.extras ?? 0} {t("extra")}</>
              : t("No completed pass yet")}</p>}
          </div>
          <p className="arpeggio-note-feedback-label">{t(reviewTitle)}</p>
          <p className="arpeggio-feedback-legend">{t("Green: correct note within timing window. Red: wrong pitch or octave, or missed.")}</p>
          <ol className="arpeggio-note-feedback" aria-label={t("Note by note feedback")}>
            {exercise.notes.map((note, index) => {
              const expected = `${note.letter}${note.acc}${Math.floor(note.midi / 12) - 1}`;
              const verdict = reviewPass?.verdicts?.[index]?.verdict ?? "pending";
              const symbol = ["ok", "early", "late"].includes(verdict) ? "✓"
                : ["wrong", "missed"].includes(verdict) ? "×" : "·";
              const label = `${t("Note")} ${index + 1}, ${expected}: ${statusLabel(verdict)}`;
              return <li key={`${index}-${note.midi}`} className={`is-${verdict}`} aria-label={label} title={label}>
                <span className="arpeggio-note-index">{index + 1}</span>
                <span className="arpeggio-note-mark" aria-hidden="true">{symbol}</span>
              </li>;
            })}
          </ol>
          <p className="arpeggio-diagnostic" aria-live="polite">
            {diagnostic
              ? diagnostic.phase === "counting"
                ? <>{t("Count-in input")} · {t("Expected")} {diagnosticExpected} · {t("Played")} {diagnosticPlayed}</>
                : <>{t("Expected")} {diagnosticExpected} · {t("Played")} {diagnosticPlayed} · {diagnostic.offsetMs >= 0 ? "+" : ""}{Math.round(diagnostic.offsetMs)} ms</>
              : t("Waiting for MIDI input")}
          </p>
        </section>
        <details className="arpeggio-sequence-panel">
          <summary>{t("Note and finger sequence")}</summary>
          <ol className="arpeggio-sequence" aria-label={t("Note and finger sequence")}>
            {exercise.notes.map((note, index) => (
              <li key={`${index}-${note.midi}`} className={activeIdx === index ? "is-active" : ""}>
                <span>{note.letter}{note.acc}{Math.floor(note.midi / 12) - 1}</span>{showFingers && <span>{t("finger")} {exercise.fingers[index]}</span>}
              </li>
            ))}
          </ol>
        </details>

        <div className="arpeggio-stats" aria-label={t("Practice stats")}>
          <div><span>{t("Current speed")}</span><strong>{currentBpm} {t("bpm")}</strong></div>
          <div><span>{t("Pass duration")}</span><strong>{duration.toFixed(2)} {t("seconds")}</strong></div>
          <div><span>{t("Notes per second")}</span><strong>{notesPerSecond.toFixed(2)}</strong></div>
          <div><span>{t("Clean passes")}</span><strong>{cleanStreak}/{config.cleanTarget}</strong></div>
          <div><span>{t("Best confirmed speed")}</span><strong>{progress.bestBpm || "—"} {progress.bestBpm ? t("bpm") : ""}</strong></div>
        </div>

        <div className="arpeggio-controls">
          {!running ? <button type="button" className="arpeggio-primary" onClick={start}>{t("Start practice")}</button>
            : <button type="button" onClick={stop}>{t("Stop")}</button>}
          <label className="arpeggio-subdivision">{t("Click subdivision")}
            <select value={config.clickMode} disabled={running} onChange={event => {
              const clickMode = ["beat", "four", "notes"].includes(event.target.value) ? event.target.value : "notes";
              persistConfig({ clickMode });
            }}>
              <option value="beat">{t("Whole pass")}</option><option value="four">{t("Four clicks per pass")}</option>
              <option value="notes">{t("Each note")}</option>
            </select>
          </label>
          <span className="arpeggio-phase" aria-live="polite">{phaseText}</span>
        </div>
        {startError && <p className="arpeggio-error" role="alert">{startError}</p>}
        <p className="arpeggio-feedback" aria-live="polite" aria-atomic="true">{feedback}</p>
        <div className="arpeggio-midi" aria-live="polite">
          {midiDevices === null ? t("MIDI input is not supported in this browser.")
            : midiDevices.length === 0 ? t("No MIDI device found. Connect a keyboard to practice.")
              : <>{t("MIDI devices")}: {midiDevices.join(", ")}</>}
          <p>{t("Play the exact notes and octaves shown. Finger use cannot be detected.")}</p>
        </div>
      </section>
    </main>
  );
}
