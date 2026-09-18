import { useEffect, useReducer, useRef, useState } from "react";
import Staff from "../components/Staff.jsx";
import GrandStaff from "../components/GrandStaff.jsx";
import IntervalStaff from "../components/IntervalStaff.jsx";
import PhraseStaff from "../components/PhraseStaff.jsx";
import ChordStaff from "../components/ChordStaff.jsx";
import EarPrompt from "../components/EarPrompt.jsx";
import RhythmStaff from "../components/RhythmStaff.jsx";
import RhythmPlay from "../components/RhythmPlay.jsx";
import Keys from "../components/Keys.jsx";
import { chordLabel, noteLabel, noteName, posLabel, t } from "../lib/i18n.js";
import { audioContext, chimeCorrect, chimeWrong, tick, playChord, playMidi, playPlan } from "../lib/audio.js";
import { playbackPlan, planBeats } from "../lib/ear.js";
import { startMicListener } from "../lib/pitch.js";
import { startMidiListener } from "../lib/midi.js";

// Which scaffold level applies: explicit modes pin one, "auto" follows the
// item's own SRS level. The reading drills spend it on letters and colours
// (0 letters+colors, 1 colors, 2 plain); the ear drills spend it on how hard
// the exercise is to listen to — see lib/ear.js.
function scaffoldLevel(settings, exercise) {
  const { scaffold: mode } = settings;
  if (mode === "full") return 0;
  if (mode === "colors") return 1;
  if (mode === "plain") return 2;
  return exercise?.level ?? 0;
}

const scaffoldFlags = level => ({ letters: level === 0, colors: level <= 1 });

const isEarDrill = exercise => Boolean(exercise?.drill?.startsWith("ear-"));

// The exercise state machine: listen → feedback → (next | done).
// `results` is one entry per SRS item (a phrase contributes several);
// `exDots` is one boolean per exercise for the progress dots.
function reducer(state, action) {
  switch (action.type) {
    case "wrong":
      return {
        ...state,
        firstTry: false,
        wrongPlayed: state.wrongPlayed ?? action.played ?? null,
        message: action.message,
      };
    case "correct":
      return {
        ...state,
        phase: "feedback",
        results: [...state.results, ...action.entries],
        exDots: [...state.exDots, action.entries.every(e => e.hit)],
        message: action.message,
      };
    case "advance": {
      const idx = state.idx + 1;
      if (idx >= state.exercises.length) return { ...state, phase: "done" };
      return { ...state, idx, phase: "listen", firstTry: true, wrongPlayed: null, message: null };
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
    wrongPlayed: null,
    results: [],
    exDots: [],
    message: null,
  });
  const [mic, setMic] = useState({ status: "idle", hearing: null });
  const [midiDevices, setMidiDevices] = useState([]);
  const [reward, setReward] = useState(null);
  const [phrase, setPhrase] = useState({ idx: 0, misses: {} });
  // Notes collected so far for the current chord. The ref is the source of
  // truth — MIDI can deliver several note-ons before React re-renders, and
  // reading a half-updated set back through live.current would drop notes.
  // `pcOnly` sticks once a note arrives from an input that can't express an
  // octave (on-screen keys), so the whole chord compares by pitch class.
  const [chord, setChord] = useState({ played: [], pcOnly: false });
  const chordRef = useRef({ played: [], pcOnly: false });
  const setChordBoth = next => { chordRef.current = next; setChord(next); };
  const clearChord = () => setChordBoth({ played: [], pcOnly: false });
  const micStopRef = useRef(null);
  const tapRef = useRef(null);

  const exercise = state.exercises[state.idx];
  useEffect(() => setPhrase({ idx: 0, misses: {} }), [state.idx]);
  useEffect(clearChord, [state.idx]);

  // Input handlers read live state through this ref, so the mic/MIDI
  // listeners (wired once) never act on a stale exercise.
  const live = useRef(null);
  live.current = { state, settings, exercise, phrase };

  function matches(midi, target, pitchClassOnly) {
    return pitchClassOnly || !live.current.settings.strictOctave
      ? midi % 12 === target % 12
      : midi === target;
  }

  // A chord is answered as a SET, however it arrives: three keys struck
  // together (one onChord event), rolled one at a time (three events), or
  // tapped on screen. Notes accumulate until enough distinct pitches are in
  // hand, then the whole set is graded at once.
  function answerChord(midis, { pitchClassOnly = false } = {}) {
    const { state, settings, exercise } = live.current;
    if (state.phase !== "listen" || exercise.drill !== "chord") return;

    const held = chordRef.current;
    const played = [...new Set([...held.played, ...midis])];
    const pcOnly = held.pcOnly || pitchClassOnly || !settings.strictOctave;
    const fold = m => (pcOnly ? m % 12 : m);
    const target = new Set(exercise.midis.map(fold));
    const heard = new Set(played.map(fold));

    if (heard.size < target.size) {
      tick(); // still building the chord — acknowledge without grading
      setChordBoth({ played, pcOnly });
      return;
    }
    clearChord();
    if (heard.size === target.size && [...target].every(pitch => heard.has(pitch))) {
      chimeCorrect();
      dispatch({
        type: "correct",
        entries: [{ item: exercise.item, hit: state.firstTry, played: state.wrongPlayed }],
        message: `${chordLabel(exercise.rootName, exercise.quality)} ${t("— correct!")}`,
      });
    } else {
      chimeWrong();
      const stray = played.find(m => !target.has(fold(m)));
      dispatch({
        type: "wrong",
        played: stray ?? null,
        message: `${t("You played")} ${played.map(noteName).join(" · ")}`,
      });
    }
  }

  function answerNote(midi, { pitchClassOnly = false } = {}) {
    const { state, exercise, phrase } = live.current;
    if (state.phase !== "listen") return;

    if (exercise.drill === "chord") {
      answerChord([midi], { pitchClassOnly });
      return;
    }

    if (exercise.drill === "rhythm") {
      tapRef.current?.(); // a piano key is a perfectly good drumstick
      return;
    }

    if (exercise.drill === "phrase" || exercise.drill === "ear-phrase") {
      const current = exercise.notes[phrase.idx];
      if (matches(midi, current.midi, pitchClassOnly)) {
        if (phrase.idx + 1 >= exercise.notes.length) {
          chimeCorrect();
          const entries = exercise.notes.map((n, i) => ({
            item: n.item,
            hit: !(i in phrase.misses),
            played: phrase.misses[i] ?? null,
          }));
          dispatch({ type: "correct", entries, message: t("Phrase complete!") });
        } else {
          tick();
          setPhrase(p => ({ ...p, idx: p.idx + 1 }));
        }
      } else {
        chimeWrong();
        setPhrase(p => ({ ...p, misses: { [p.idx]: p.misses[p.idx] ?? midi, ...p.misses } }));
        dispatch({ type: "wrong", played: midi, message: `${t("You played")} ${noteName(midi)}` });
      }
      return;
    }

    if (exercise.drill !== "note" && exercise.drill !== "ear-pitch") return;
    if (matches(midi, exercise.midi, pitchClassOnly)) {
      chimeCorrect();
      dispatch({
        type: "correct",
        entries: [{ item: exercise.item, hit: state.firstTry, played: state.wrongPlayed }],
        message: `${noteLabel(exercise.letter)} ${t("— correct!")}`,
      });
    } else {
      chimeWrong();
      dispatch({ type: "wrong", played: midi, message: `${t("You played")} ${noteName(midi)}` });
    }
  }

  function answerPos(pos) {
    const { state, exercise } = live.current;
    if (state.phase !== "listen" || exercise.drill !== "linespace") return;
    if (pos === exercise.pos) {
      chimeCorrect();
      dispatch({
        type: "correct",
        entries: [{ item: exercise.item, hit: state.firstTry, played: null }],
        message: `${t("Yes —")} ${posLabel(exercise.posLabel)}.`,
      });
    } else {
      chimeWrong();
      dispatch({ type: "wrong", message: t("Look again — is the notehead on a line, or between lines?") });
    }
  }

  function answerInterval(size) {
    const { state, exercise } = live.current;
    if (state.phase !== "listen") return;
    if (exercise.drill !== "interval" && exercise.drill !== "ear-interval") return;
    if (size === exercise.size) {
      chimeCorrect();
      dispatch({
        type: "correct",
        entries: [{ item: exercise.item, hit: state.firstTry, played: null }],
        message: `${t("Yes —")} ${t(`a ${exercise.name}`)}.`,
      });
    } else {
      chimeWrong();
      dispatch({ type: "wrong", message: t("Look at the gap between the noteheads and try again.") });
    }
  }

  function answerQuality(quality) {
    const { state, exercise } = live.current;
    if (state.phase !== "listen" || exercise.drill !== "ear-chord") return;
    if (quality === exercise.quality) {
      chimeCorrect();
      dispatch({
        type: "correct",
        entries: [{ item: exercise.item, hit: state.firstTry, played: null }],
        // Name the chord it actually was: the point is to attach the sound to
        // something, and "major" alone teaches less than "that was F major".
        message: `${t("Yes —")} ${chordLabel(exercise.rootName, exercise.quality)}.`,
      });
    } else {
      chimeWrong();
      dispatch({ type: "wrong", message: t("Listen to the middle note — is it bright or dark?") });
    }
  }

  function rhythmAttempt(hit) {
    const { state, exercise } = live.current;
    if (state.phase !== "listen") return;
    if (hit) {
      chimeCorrect();
      dispatch({
        type: "correct",
        entries: [{ item: exercise.item, hit: state.firstTry, played: null }],
        message: t("Locked in!"),
      });
    } else {
      chimeWrong();
      dispatch({ type: "wrong", message: t("Not quite — check the timing marks and go again.") });
    }
  }

  // The ear drills draw nothing, so the playback is the prompt: sound it as
  // soon as the exercise arrives, and again whenever asked.
  const earPlan = isEarDrill(exercise) ? playbackPlan(exercise, scaffoldLevel(settings, exercise)) : null;
  const replay = () => { if (earPlan) playPlan(earPlan); };
  useEffect(() => {
    if (!isEarDrill(state.exercises[state.idx])) return;
    const ex = state.exercises[state.idx];
    playPlan(playbackPlan(ex, scaffoldLevel(settings, ex)));
  }, [state.idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance after the green moment (longer for rhythm: read the verdicts).
  useEffect(() => {
    if (state.phase !== "feedback") return;
    const delay = exercise.drill === "rhythm" ? 1600 : 900;
    const t = setTimeout(() => dispatch({ type: "advance" }), delay);
    return () => clearTimeout(t);
  }, [state.phase, state.idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Session complete → hand results to the app; show XP/streak if it returns them.
  useEffect(() => {
    if (state.phase !== "done") return;
    Promise.resolve(onFinish(state.results)).then(setReward).catch(() => setReward(null));
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // MIDI: wired once for the whole session; routes into the active drill.
  // onNote fires immediately (no added latency for reading drills) and is
  // ignored during chord drills, which grade the buffered onChord set instead.
  useEffect(
    () =>
      startMidiListener({
        onNote: midi => {
          if (live.current.exercise.drill !== "chord") answerNote(midi);
        },
        onChord: midis => answerChord(midis),
        onDevices: setMidiDevices,
      }),
    [],
  );

  // Typing: letters for pitches, L/S for line-or-space, space/enter taps rhythm.
  useEffect(() => {
    const onKey = e => {
      const k = e.key.toUpperCase();
      if ("ABCDEFG".includes(k) && k.length === 1) {
        const midi = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 }[k];
        answerNote(midi, { pitchClassOnly: true });
      }
      if (k === "L") answerPos("line");
      if (k === "S") answerPos("space");
      if ("2345".includes(k) && k.length === 1) answerInterval(Number(k));
      if ((e.key === " " || e.key === "Enter") && live.current.exercise.drill === "rhythm") {
        e.preventDefault();
        tapRef.current?.();
      }
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
        sensitivity: settings.micSensitivity,
      });
      micStopRef.current = stop;
      setMic({ status: "listening", hearing: null });
    } catch (err) {
      setMic({ status: "error", hearing: null, error: err.message });
    }
  }
  useEffect(() => () => micStopRef.current?.(), []);

  if (state.phase === "done") {
    const ok = state.exDots.filter(Boolean).length;
    return (
      <main className="screen">
        <section className="card summary">
          <h2>{t("Session complete")}</h2>
          <p className="big-score">{ok} / {state.exDots.length}</p>
          {reward && (
            <p className="reward">
              +{reward.xpGained} XP
              {reward.streakDays > 0 && ` · 🔥 ${reward.streakDays}${t("-day streak")}`}
            </p>
          )}
          <div className="dots" aria-label="Results per exercise">
            {state.exDots.map((hit, i) => (
              <span key={i} className={`dot ${hit ? "ok" : "bad"}`} />
            ))}
          </div>
        </section>
        <div className="row">
          <button className="btn primary" onClick={onHome}>{t("Back to lessons")}</button>
        </div>
      </main>
    );
  }

  const scaffold = scaffoldFlags(scaffoldLevel(settings, exercise));
  // Drills answered by playing a pitch: they all want the keyboard, and the
  // reading ones also want the mic and a "hear it" button.
  const isPitchDrill = ["note", "phrase", "ear-pitch", "ear-phrase"].includes(exercise.drill);
  const isReadingPitchDrill = exercise.drill === "note" || exercise.drill === "phrase";

  return (
    <main className="screen">
      <div className="session-top">
        <button className="btn quiet" onClick={onHome} aria-label="End session and go home">{t("✕ End")}</button>
        <div className="dots" aria-label={`Exercise ${state.idx + 1} of ${state.exercises.length}`}>
          {state.exercises.map((_, i) => {
            const cls = i < state.exDots.length
              ? (state.exDots[i] ? "ok" : "bad")
              : i === state.idx ? "current" : "";
            return <span key={i} className={`dot ${cls}`} />;
          })}
        </div>
      </div>

      <section className={`card staff-card ${state.phase === "feedback" ? "flash-ok" : ""} ${state.message && state.phase === "listen" && !state.firstTry ? "flash-bad" : ""} size-${settings.staffSize}`}>
        {isEarDrill(exercise) ? (
          <EarPrompt beats={planBeats(earPlan)} onReplay={replay} />
        ) : exercise.drill === "phrase" ? (
          <PhraseStaff notes={exercise.notes} currentIdx={phrase.idx} scaffold={scaffold} />
        ) : exercise.drill === "rhythm" ? (
          <RhythmStaff durations={exercise.durations} />
        ) : exercise.drill === "interval" ? (
          <IntervalStaff notes={exercise.notes} />
        ) : exercise.drill === "chord" ? (
          <ChordStaff
            exercise={exercise}
            showName={scaffold.letters}
            showColor={scaffold.colors}
          />
        ) : exercise.grand ? (
          <GrandStaff
            exercise={exercise}
            showLetter={scaffold.letters}
            showColor={scaffold.colors}
          />
        ) : (
          <Staff
            exercise={exercise}
            showLetter={exercise.drill === "note" && scaffold.letters}
            showColor={exercise.drill === "note" && scaffold.colors}
          />
        )}
      </section>

      <p className="status" role="status">
        {state.message ??
          t({
            note: "Play the note you see.",
            phrase: "Play the phrase, left to right.",
            linespace: "Is this note on a line, or in a space?",
            rhythm: "Tap this rhythm with the metronome.",
            interval: "How far apart are these notes?",
            chord: "Play all three notes together.",
            "ear-pitch": "Play the note you just heard.",
            "ear-interval": "How far apart were those two notes?",
            "ear-chord": "Was that major or minor?",
            "ear-phrase": "Play those four notes back.",
          }[exercise.drill])}
        {mic.status === "listening" && (
          <span className="hearing">
            {mic.hearing == null
              ? t("Listening…")
              : mic.hearing.tooQuiet
                ? t("Hearing something — too quiet. Play louder or move closer.")
                : `${t("Hearing:")} ${noteName(mic.hearing.midi)}`}
          </span>
        )}
      </p>

      {isPitchDrill && (
        <>
          <div className="row">
            <button
              className={`btn ${mic.status === "listening" ? "listening" : "primary"}`}
              onClick={startMic}
            >
              {mic.status === "listening" ? t("🎤 Listening…") : t("🎤 Start microphone")}
            </button>
            {/* Not on the ear drills: "hear it" there would be the answer.
                EarPrompt's replay sounds the exercise instead. */}
            {isReadingPitchDrill && (
              <button
                className="btn"
                onClick={() =>
                  playMidi(exercise.drill === "phrase" ? exercise.notes[phrase.idx].midi : exercise.midi)
                }
              >
                {t("🔊 Hear it")}
              </button>
            )}
          </div>
          <Keys onAnswer={answerNote} disabled={state.phase !== "listen"} />
        </>
      )}

      {exercise.drill === "ear-chord" && (
        <div className="row linespace">
          <button className="btn answer" onClick={() => answerQuality("maj")}>
            {t("☀ Major")}
          </button>
          <button className="btn answer" onClick={() => answerQuality("min")}>
            {t("☾ Minor")}
          </button>
        </div>
      )}

      {exercise.drill === "chord" && (
        <>
          <div className="row">
            <button className="btn" onClick={() => playChord(exercise.midis)}>
              {t("🔊 Hear the chord")}
            </button>
            {chord.played.length > 0 && (
              <button className="btn quiet" onClick={clearChord}>
                {t("Clear")}
              </button>
            )}
          </div>
          <p className="pending" role="status">
            {chord.played.length > 0 && (
              <>
                {t("Playing:")}{" "}
                {chord.played.map(m => (
                  <span key={m} className="pending-note">{noteName(m)}</span>
                ))}
              </>
            )}
          </p>
          <Keys onAnswer={answerNote} disabled={state.phase !== "listen"} accidentals />
        </>
      )}

      {exercise.drill === "linespace" && (
        <div className="row linespace">
          <button className="btn answer" onClick={() => answerPos("line")}>{t("── Line ──")}</button>
          <button className="btn answer" onClick={() => answerPos("space")}>{t("‿ Space ‿")}</button>
        </div>
      )}

      {(exercise.drill === "interval" || exercise.drill === "ear-interval") && (
        <div className="row">
          {[2, 3, 4, 5].map(size => (
            <button key={size} className="btn answer" onClick={() => answerInterval(size)}>
              {t({ 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" }[size])}
            </button>
          ))}
        </div>
      )}

      {exercise.drill === "rhythm" && (
        <RhythmPlay
          exercise={exercise}
          onAttempt={rhythmAttempt}
          registerTap={fn => { tapRef.current = fn; }}
        />
      )}

      <p className="inputs-status">
        {mic.status === "error" && `${t("Microphone unavailable:")} ${mic.error}. `}
        {midiDevices === null
          ? t("MIDI not supported in this browser — mic and buttons work.")
          : midiDevices.length
            ? `${t("MIDI:")} ${midiDevices.join(", ")}`
            : t("MIDI: plug in a keyboard and it connects automatically.")}
      </p>
    </main>
  );
}
