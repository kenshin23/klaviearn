import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import TechniqueStaff from "../components/TechniqueStaff.jsx";
import {
  advanceSpeed, ARPEGGIO_PRESETS, makeArpeggio, speedKey, speedProgress,
} from "../lib/arpeggios.js";
import { createArpeggioClock } from "../lib/arpeggioClock.js";
import { t } from "../lib/i18n.js";
import { startMidiListener } from "../lib/midi.js";
import "./arpeggio-practice.css";

const validConfig = value => value && typeof value === "object" && !Array.isArray(value);
const bounded = (value, fallback, min, max) => Number.isFinite(value)
  ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

function readConfig(settings) {
  const raw = validConfig(settings?.arpeggioPractice) ? settings.arpeggioPractice : {};
  const presetId = ARPEGGIO_PRESETS.some(preset => preset.id === raw.presetId)
    ? raw.presetId : ARPEGGIO_PRESETS[0].id;
  return {
    presetId,
    octave: bounded(raw.octave, 2, 1, 4),
    stepBpm: bounded(raw.stepBpm, 1, 1, 10),
    cleanTarget: bounded(raw.cleanTarget, 5, 1, 20),
    clickMode: ["beat", "four", "notes"].includes(raw.clickMode) ? raw.clickMode : "notes",
    progress: validConfig(raw.progress) ? raw.progress : {},
  };
}

function feedbackFor(result) {
  if (result.hit) return t("Clean cycle. Keep going.");
  if (result.extras > 0) return t("Extra notes. Keep the pattern to 16 notes.");
  const verdicts = result.verdicts ?? [];
  if (verdicts.some(item => item.verdict === "wrong")) return t("Wrong note or octave. Try the cycle again.");
  if (verdicts.some(item => item.verdict === "missed")) return t("Some notes were missed. Try the cycle again.");
  if (verdicts.some(item => item.verdict === "early" || item.verdict === "late")) {
    return t("Notes were off the beat. Follow the click.");
  }
  return t("Clean cycle. Keep going.");
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
  const [cleanStreak, setCleanStreak] = useState(0);
  const clockRef = useRef(null);
  const stopMidiRef = useRef(null);
  const liveRef = useRef(null);
  const streakRef = useRef({ key, streak: 0 });
  const runtimeRef = useRef({ key, ...progress });
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    if (runtimeRef.current.key !== key) {
      streakRef.current = { key, streak: 0 };
      setCleanStreak(0);
    }
    runtimeRef.current = { key, bpm: progress.bpm, bestBpm: progress.bestBpm, streak: 0 };
  }, [key, progress.bpm, progress.bestBpm]);

  const persistConfig = useCallback(patch => {
    onSettings(previous => {
      const old = readConfig(previous);
      return {
        ...previous,
        arpeggioPractice: { ...old, ...patch, progress: old.progress },
      };
    });
  }, [onSettings]);

  const persistCycle = useCallback((result, bpm) => {
    const live = liveRef.current;
    if (!live) return bpm;
    if (streakRef.current.key !== live.key) streakRef.current = { key: live.key, streak: 0 };
    const previous = {
      ...runtimeRef.current,
      bpm: bounded(result.bpm, runtimeRef.current.bpm, 5, 120),
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
    onSettings(current => {
      const old = readConfig(current);
      return {
        ...current,
        arpeggioPractice: {
          ...old,
          progress: { ...old.progress, [live.key]: { bpm: next.bpm, bestBpm: next.bestBpm } },
        },
      };
    });
    return next.bpm;
  }, [onSettings]);

  useLayoutEffect(() => {
    liveRef.current = { config, key, persistCycle };
  }, [config, key, persistCycle]);

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
    const clock = createArpeggioClock({
      exercise,
      bpm: progress.bpm,
      subdivisions: config.clickMode === "four" ? 4
        : config.clickMode === "beat" ? 1 : exercise.midis.length,
      onCycle: result => isCurrent() ? liveRef.current?.persistCycle(result, result.bpm) : undefined,
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
  const duration = 60 / currentBpm;
  const notesPerSecond = exercise.midis.length / duration;
  const showColor = settings.scaffold !== "plain";
  const showFingers = settings.scaffold !== "plain" && settings.scaffold !== "colors";
  const staffSize = ["medium", "large", "huge"].includes(settings.staffSize) ? settings.staffSize : "large";
  const phaseText = phase.name === "counting"
    ? `${t("Get ready")}: ${phase.count}`
    : phase.name === "playing" ? t("Playing") : t("Stopped");

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
          <label>{t("Starting speed (cycles/min)")}
            <input type="number" min="5" max="120" step="1" value={progress.bpm} disabled={running}
              onChange={event => {
                const bpm = bounded(Number(event.target.value), 20, 5, 120);
                onSettings(previous => {
                  const old = readConfig(previous);
                  return { ...previous, arpeggioPractice: { ...old, progress: {
                    ...old.progress, [key]: { bestBpm: speedProgress(old.progress[key]).bestBpm, bpm },
                  } } };
                });
              }} />
          </label>
          <label>{t("Speed increase (cycles/min)")}
            <input type="number" min="1" max="10" step="1" value={config.stepBpm} disabled={running}
              onChange={event => persistConfig({ stepBpm: bounded(Number(event.target.value), 1, 1, 10) })} />
          </label>
          <label>{t("Clean cycles to increase")}
            <input type="number" min="1" max="20" step="1" value={config.cleanTarget} disabled={running}
              onChange={event => persistConfig({ cleanTarget: bounded(Number(event.target.value), 5, 1, 20) })} />
          </label>
          </div>
        </details>

        <h2 id="arp-pattern-title">{t(preset.name)} · {t(preset.hand === "rh" ? "right hand" : "left hand")}</h2>
        <div className={`staff-card size-${staffSize}`}>
          <TechniqueStaff exercise={exercise} showFingers={showFingers} showColor={showColor} activeIdx={activeIdx} />
        </div>
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
          <div><span>{t("Current speed")}</span><strong>{currentBpm} {t("cycles/min")}</strong></div>
          <div><span>{t("Cycle duration")}</span><strong>{duration.toFixed(2)} {t("seconds")}</strong></div>
          <div><span>{t("Notes per second")}</span><strong>{notesPerSecond.toFixed(2)}</strong></div>
          <div><span>{t("Clean cycles")}</span><strong>{cleanStreak}/{config.cleanTarget}</strong></div>
          <div><span>{t("Best confirmed speed")}</span><strong>{progress.bestBpm || "—"} {progress.bestBpm ? t("cycles/min") : ""}</strong></div>
        </div>

        <div className="arpeggio-controls">
          {!running ? <button type="button" className="arpeggio-primary" onClick={start}>{t("Start practice")}</button>
            : <button type="button" onClick={stop}>{t("Stop")}</button>}
          <label className="arpeggio-subdivision">{t("Click subdivision")}
            <select value={config.clickMode} disabled={running} onChange={event => {
              const clickMode = ["beat", "four", "notes"].includes(event.target.value) ? event.target.value : "notes";
              persistConfig({ clickMode });
            }}>
              <option value="beat">{t("Beat")}</option><option value="four">{t("Four subdivisions")}</option>
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
