import { useEffect, useReducer, useRef, useState } from "react";
import Staff from "../components/Staff.jsx";
import Keys from "../components/Keys.jsx";
import { noteName } from "../lib/notes.js";
import { audioContext, chimeCorrect, chimeWrong, playMidi } from "../lib/audio.js";
import { startMicListener } from "../lib/pitch.js";
import { startMidiListener } from "../lib/midi.js";

// Which training wheels to show: explicit modes pin a level; "auto" uses the
// per-note SRS scaffold level (0 letters+colors, 1 colors, 2 plain).
function scaffoldFlags(mode, level) {
  const lvl = mode === "full" ? 0 : mode === "colors" ? 1 : mode === "plain" ? 2 : level;
  return { letters: lvl === 0, colors: lvl <= 1 };
}

// The exercise state machine: listen → feedback → (next | done).
function reducer(state, action) {
  switch (action.type) {
    case "wrong":
      return { ...state, firstTry: false, message: action.message };
    case "correct": {
      const ex = state.exercises[state.idx];
      const results = [...state.results, { item: ex.item, hit: state.firstTry }];
      return { ...state, phase: "feedback", results, message: action.message };
    }
    case "advance": {
      const idx = state.idx + 1;
      if (idx >= state.exercises.length) return { ...state, phase: "done" };
      return { ...state, idx, phase: "listen", firstTry: true, message: null };
    }
    default:
      return state;
  }
}

export default function Session({ exercises, settings, onFinish, onHome }) {
  const [state, dispatch] = useReducer(reducer, {
    exercises,
    idx: 0,
    phase: "listen",
    firstTry: true,
    results: [],
    message: null,
  });
  const [mic, setMic] = useState({ status: "idle", hearing: null });
  const [midiDevices, setMidiDevices] = useState([]);
  const [reward, setReward] = useState(null);
  const micStopRef = useRef(null);

  const exercise = state.exercises[state.idx];

  // Input handlers read live state through this ref, so the mic/MIDI
  // listeners (wired once) never act on a stale exercise.
  const live = useRef(null);
  live.current = { state, settings, exercise };

  function answerNote(midi, { pitchClassOnly = false } = {}) {
    const { state, settings, exercise } = live.current;
    if (state.phase !== "listen" || exercise.drill !== "note") return;
    const target = exercise.midi;
    const hit = pitchClassOnly || !settings.strictOctave
      ? midi % 12 === target % 12
      : midi === target;
    if (hit) {
      chimeCorrect();
      dispatch({ type: "correct", message: `${exercise.letter} — correct!` });
    } else {
      chimeWrong();
      dispatch({ type: "wrong", message: `You played ${noteName(midi)}` });
    }
  }

  function answerPos(pos) {
    const { state, exercise } = live.current;
    if (state.phase !== "listen" || exercise.drill !== "linespace") return;
    if (pos === exercise.pos) {
      chimeCorrect();
      dispatch({ type: "correct", message: `Yes — ${exercise.posLabel}.` });
    } else {
      chimeWrong();
      dispatch({ type: "wrong", message: "Look again — is the notehead on a line, or between lines?" });
    }
  }

  // Auto-advance after the green moment.
  useEffect(() => {
    if (state.phase !== "feedback") return;
    const t = setTimeout(() => dispatch({ type: "advance" }), 900);
    return () => clearTimeout(t);
  }, [state.phase, state.idx]);

  // Session complete → hand results to the app; show XP/streak if it returns them.
  useEffect(() => {
    if (state.phase !== "done") return;
    Promise.resolve(onFinish(state.results)).then(setReward).catch(() => setReward(null));
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // MIDI: wired for the whole session.
  useEffect(() => startMidiListener({ onNote: answerNote, onDevices: setMidiDevices }), []);

  // Typing: letters answer the note drill; L / S answer line-or-space.
  useEffect(() => {
    const onKey = e => {
      const k = e.key.toUpperCase();
      if ("ABCDEFG".includes(k) && k.length === 1) {
        const midi = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 }[k];
        answerNote(midi, { pitchClassOnly: true });
      }
      if (k === "L") answerPos("line");
      if (k === "S") answerPos("space");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Mic lifecycle: started by a button (browsers require a gesture), stopped on unmount.
  async function startMic() {
    if (mic.status === "listening") return;
    try {
      const stop = await startMicListener({
        audioContext: audioContext(),
        onNote: answerNote,
        onHearing: h => setMic(m => ({ ...m, hearing: h })),
      });
      micStopRef.current = stop;
      setMic({ status: "listening", hearing: null });
    } catch (err) {
      setMic({ status: "error", hearing: null, error: err.message });
    }
  }
  useEffect(() => () => micStopRef.current?.(), []);

  if (state.phase === "done") {
    const ok = state.results.filter(r => r.hit).length;
    return (
      <main className="screen">
        <section className="card summary">
          <h2>Session complete</h2>
          <p className="big-score">{ok} / {state.results.length}</p>
          {reward && (
            <p className="reward">
              +{reward.xpGained} XP
              {reward.streakDays > 0 && ` · 🔥 ${reward.streakDays}-day streak`}
            </p>
          )}
          <div className="dots" aria-label="Results per exercise">
            {state.results.map((r, i) => (
              <span key={i} className={`dot ${r.hit ? "ok" : "bad"}`} />
            ))}
          </div>
        </section>
        <div className="row">
          <button className="btn primary" onClick={onHome}>Back to lessons</button>
        </div>
      </main>
    );
  }

  const scaffold = scaffoldFlags(settings.scaffold, exercise.level);

  return (
    <main className="screen">
      <div className="session-top">
        <button className="btn quiet" onClick={onHome} aria-label="End session and go home">✕ End</button>
        <div className="dots" aria-label={`Exercise ${state.idx + 1} of ${state.exercises.length}`}>
          {state.exercises.map((_, i) => {
            const r = state.results[i];
            const cls = r ? (r.hit ? "ok" : "bad") : i === state.idx ? "current" : "";
            return <span key={i} className={`dot ${cls}`} />;
          })}
        </div>
      </div>

      <section className={`card staff-card ${state.phase === "feedback" ? "flash-ok" : ""} ${state.message && state.phase === "listen" && !state.firstTry ? "flash-bad" : ""} size-${settings.staffSize}`}>
        <Staff
          exercise={exercise}
          showLetter={exercise.drill === "note" && scaffold.letters}
          showColor={exercise.drill === "note" && scaffold.colors}
        />
      </section>

      <p className="status" role="status">
        {state.message ??
          (exercise.drill === "note"
            ? "Play the note you see."
            : "Is this note on a line, or in a space?")}
        {mic.status === "listening" && (
          <span className="hearing">
            {mic.hearing ? `Hearing: ${noteName(mic.hearing.midi)}` : "Listening…"}
          </span>
        )}
      </p>

      {exercise.drill === "note" ? (
        <>
          <div className="row">
            <button
              className={`btn ${mic.status === "listening" ? "listening" : "primary"}`}
              onClick={startMic}
            >
              {mic.status === "listening" ? "🎤 Listening…" : "🎤 Start microphone"}
            </button>
            <button className="btn" onClick={() => playMidi(exercise.midi)}>
              🔊 Hear it
            </button>
          </div>
          <Keys onAnswer={answerNote} disabled={state.phase !== "listen"} />
        </>
      ) : (
        <div className="row linespace">
          <button className="btn answer" onClick={() => answerPos("line")}>
            ── Line ──
          </button>
          <button className="btn answer" onClick={() => answerPos("space")}>
            ‿ Space ‿
          </button>
        </div>
      )}

      <p className="inputs-status">
        {mic.status === "error" && `Microphone unavailable: ${mic.error}. `}
        {midiDevices === null
          ? "MIDI not supported in this browser — mic and buttons work."
          : midiDevices.length
            ? `MIDI: ${midiDevices.join(", ")}`
            : "MIDI: plug in a keyboard and it connects automatically."}
      </p>
    </main>
  );
}
