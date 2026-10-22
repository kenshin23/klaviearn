import { act, fireEvent, render, screen } from "@testing-library/react";
import Session from "./Session.jsx";
import { chordSpec, noteMeta, techniqueSpec } from "../lib/notes.js";
import { pieceItems } from "../lib/pieces.js";
import { KEYS } from "../lib/keys.js";
import { setLocale } from "../lib/i18n.js";

// The staff components are thin wrappers over VexFlow's SVG renderer. This
// suite is about the exercise state machine, so they are stubbed down to the
// props that decide what a learner sees.
vi.mock("../components/Staff.jsx", () => ({
  default: ({ exercise, showLetter, showColor }) => (
    <div
      data-testid="staff"
      data-letter={exercise.letter}
      data-show-letter={String(showLetter)}
      data-show-color={String(showColor)}
    />
  ),
}));
vi.mock("../components/ChordStaff.jsx", () => ({
  default: ({ exercise, showName, showColor }) => (
    <div
      data-testid="chord-staff"
      data-name={exercise.name}
      data-show-name={String(showName)}
      data-show-color={String(showColor)}
    />
  ),
}));
vi.mock("../components/GrandStaff.jsx", () => ({ default: () => <div data-testid="grand-staff" /> }));
vi.mock("../components/IntervalStaff.jsx", () => ({ default: () => <div data-testid="interval-staff" /> }));
vi.mock("../components/PhraseStaff.jsx", () => ({
  default: ({ currentIdx }) => <div data-testid="phrase-staff" data-current={currentIdx} />,
}));
vi.mock("../components/RhythmStaff.jsx", () => ({ default: () => <div data-testid="rhythm-staff" /> }));
vi.mock("../components/PassageStaff.jsx", () => ({
  default: ({ exercise, hands, showFingers }) => (
    <div
      data-testid="passage-staff"
      data-bar={exercise.bar}
      data-title={exercise.title}
      data-hands={hands.join("+")}
      data-show-fingers={String(showFingers)}
    />
  ),
}));
vi.mock("../components/TechniqueStaff.jsx", () => ({
  default: ({ exercise, showFingers, showColor }) => (
    <div
      data-testid="technique-staff"
      data-pattern={exercise.pattern}
      data-show-fingers={String(showFingers)}
      data-show-color={String(showColor)}
    />
  ),
}));

// Keep the audio module real except for the one call the ear drills are
// judged by: whether the exercise actually got sounded.
vi.mock("../lib/audio.js", async importOriginal => ({
  ...(await importOriginal()),
  playPlan: vi.fn(),
}));
const { playPlan } = await import("../lib/audio.js");

const SETTINGS = {
  scaffold: "auto",
  strictOctave: false,
  staffSize: "large",
  micSensitivity: "high",
  language: "en",
  noteNames: "letters",
};

const noteExercise = (midi = 60, over = {}) => ({
  item: `treble:${midi}`, drill: "note", level: 0, ...noteMeta("treble", midi), ...over,
});
const chordExercise = (root = 60, quality = "maj", over = {}) => ({
  item: `chord:C:maj`, drill: "chord", level: 0, ...chordSpec(root, quality), ...over,
});

function renderSession(exercises, { settings = SETTINGS, onFinish = vi.fn() } = {}) {
  const onHome = vi.fn();
  render(
    <Session exercises={exercises} settings={settings} onFinish={onFinish} onHome={onHome} />,
  );
  return { onFinish, onHome };
}

/** Click an on-screen key by its label. */
const play = label => fireEvent.click(screen.getByRole("button", { name: label }));

/** Run the feedback delay so the machine advances to the next exercise. */
const advance = () => act(() => { vi.advanceTimersByTime(2000); });

const statusText = () => document.querySelector(".status").textContent;
const pendingNotes = () =>
  [...document.querySelectorAll(".pending-note")].map(n => n.textContent);

beforeEach(() => {
  setLocale("en", "letters");
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("the note drill", () => {
  it("prompts for the note on the staff", () => {
    renderSession([noteExercise(60)]);
    expect(screen.getByTestId("staff")).toHaveAttribute("data-letter", "C");
    expect(statusText()).toContain("Play the note you see");
  });

  it("accepts the right note and confirms it by name", () => {
    renderSession([noteExercise(60), noteExercise(64)]);
    play("C");
    expect(statusText()).toContain("C");
    expect(statusText()).toContain("correct");
  });

  it("names what you played when it is wrong, and lets you retry", () => {
    renderSession([noteExercise(60)]);
    play("D");
    expect(statusText()).toContain("You played D4");

    play("C");
    expect(statusText()).toContain("correct");
  });

  it("advances to the next exercise after the feedback moment", () => {
    renderSession([noteExercise(60), noteExercise(64)]);
    play("C");
    advance();
    expect(screen.getByTestId("staff")).toHaveAttribute("data-letter", "E");
  });

  it("reports a first-try answer as a hit and a retried one as a miss", () => {
    const { onFinish } = renderSession([noteExercise(60), noteExercise(64)]);
    play("C");            // first try — hit
    advance();
    play("C");            // wrong for E
    play("E");            // right on the second try — miss
    advance();

    expect(onFinish).toHaveBeenCalledWith([
      { item: "treble:60", hit: true, played: null },
      { item: "treble:64", hit: false, played: 60 },
    ]);
  });

  it("shows one progress dot per exercise", () => {
    renderSession([noteExercise(60), noteExercise(64), noteExercise(67)]);
    expect(document.querySelectorAll(".session-top .dot")).toHaveLength(3);
  });

  it("offers only the seven naturals — no drill here asks for a black key", () => {
    renderSession([noteExercise(60)]);
    expect(document.querySelectorAll(".keys .key")).toHaveLength(7);
  });
});

describe("training wheels", () => {
  it.each([
    ["full", 0, "true", "true"],
    ["colors", 0, "false", "true"],
    ["plain", 0, "false", "false"],
  ])("mode %s pins the scaffold", (scaffold, level, letter, color) => {
    renderSession([noteExercise(60, { level })], { settings: { ...SETTINGS, scaffold } });
    const staff = screen.getByTestId("staff");
    expect(staff).toHaveAttribute("data-show-letter", letter);
    expect(staff).toHaveAttribute("data-show-color", color);
  });

  it.each([
    [0, "true", "true"],
    [1, "false", "true"],
    [2, "false", "false"],
  ])("auto follows the item's own level %i", (level, letter, color) => {
    renderSession([noteExercise(60, { level })]);
    const staff = screen.getByTestId("staff");
    expect(staff).toHaveAttribute("data-show-letter", letter);
    expect(staff).toHaveAttribute("data-show-color", color);
  });
});

describe("the chord drill", () => {
  it("asks for the whole chord at once and shows the black keys", () => {
    renderSession([chordExercise()]);
    expect(statusText()).toContain("Play all three notes together");
    expect(document.querySelectorAll(".keys .key")).toHaveLength(12);
  });

  it("collects notes one at a time without grading early", () => {
    renderSession([chordExercise()]);

    play("C");
    expect(pendingNotes()).toEqual(["C4"]);
    play("E");
    expect(pendingNotes()).toEqual(["C4", "E4"]);
    expect(statusText()).toContain("Play all three notes together");
  });

  it("marks the chord correct once the third note lands", () => {
    renderSession([chordExercise()]);
    play("C");
    play("E");
    play("G");
    expect(statusText()).toContain("C major");
    expect(statusText()).toContain("correct");
    expect(pendingNotes()).toEqual([]);
  });

  it("accepts the notes in any order — a chord is a set", () => {
    renderSession([chordExercise()]);
    play("G");
    play("C");
    play("E");
    expect(statusText()).toContain("correct");
  });

  it("rejects a wrong chord and names every note played", () => {
    renderSession([chordExercise()]);
    play("C");
    play("D");
    play("F");
    expect(statusText()).toContain("You played C4 · D4 · F4");
    expect(pendingNotes()).toEqual([], "cleared so the next attempt starts fresh");
  });

  it("lets a retry succeed after a wrong chord", () => {
    const { onFinish } = renderSession([chordExercise()]);
    play("C"); play("D"); play("F");
    play("C"); play("E"); play("G");
    advance();
    expect(onFinish).toHaveBeenCalledWith([
      { item: "chord:C:maj", hit: false, played: 62 },
    ]);
  });

  it("clears collected notes on demand", () => {
    renderSession([chordExercise()]);
    play("C");
    play("E");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(pendingNotes()).toEqual([]);
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("forgets a half-built chord when the exercise changes", () => {
    renderSession([chordExercise(), chordExercise(65, "maj", { item: "chord:F:maj" })]);
    play("C");
    play("E");
    play("G");
    advance();
    expect(pendingNotes()).toEqual([]);
  });

  it("needs the black keys for a chord with a sharp in it", () => {
    // D major = D F# A. Playing F natural must not pass.
    renderSession([chordExercise(62, "maj", { item: "chord:D:maj" })]);
    play("D"); play("F"); play("A");
    expect(statusText()).toContain("You played");

    play("D"); play("F♯"); play("A");
    expect(statusText()).toContain("D major");
    expect(statusText()).toContain("correct");
  });

  it("scaffolds with the chord name and colours, not per-note letters", () => {
    renderSession([chordExercise(60, "maj", { level: 0 })]);
    expect(screen.getByTestId("chord-staff")).toHaveAttribute("data-show-name", "true");
    expect(screen.getByTestId("chord-staff")).toHaveAttribute("data-show-color", "true");
  });

  it("names the chord in Spanish solfège", () => {
    setLocale("es", "solfege");
    renderSession([chordExercise()], {
      settings: { ...SETTINGS, language: "es", noteNames: "solfege" },
    });
    play("Do"); play("Mi"); play("Sol");
    expect(statusText()).toContain("Do mayor");
  });
});

describe("the chord drill with a real piano", () => {
  function fakePiano() {
    const input = { name: "Fake Piano", onmidimessage: null };
    const access = { inputs: new Map([["0", input]]), onstatechange: null };
    navigator.requestMIDIAccess = vi.fn(() => Promise.resolve(access));
    return input;
  }

  afterEach(() => { delete navigator.requestMIDIAccess; });

  const strike = (input, midis) =>
    midis.forEach(m => input.onmidimessage({ data: [0x90, m, 100] }));

  it("grades a triad struck as one gesture", async () => {
    const input = fakePiano();
    renderSession([chordExercise()]);
    await act(async () => {});           // let requestMIDIAccess resolve

    act(() => {
      strike(input, [60, 64, 67]);
      vi.advanceTimersByTime(60);        // close the chord window
    });
    expect(statusText()).toContain("correct");
  });

  it("grades a triad rolled one note at a time the same way", async () => {
    const input = fakePiano();
    renderSession([chordExercise()]);
    await act(async () => {});

    for (const midi of [60, 64, 67]) {
      act(() => {
        strike(input, [midi]);
        vi.advanceTimersByTime(60);
      });
    }
    expect(statusText()).toContain("correct");
  });

  it("accepts a chord played in a different octave when octaves are loose", async () => {
    const input = fakePiano();
    renderSession([chordExercise()]);
    await act(async () => {});

    act(() => {
      strike(input, [72, 76, 79]);       // C major an octave up
      vi.advanceTimersByTime(60);
    });
    expect(statusText()).toContain("correct");
  });

  it("plays single notes through the note drill without chord buffering", async () => {
    const input = fakePiano();
    renderSession([noteExercise(60)]);
    await act(async () => {});

    act(() => strike(input, [60]));      // no timer advance needed
    expect(statusText()).toContain("correct");
  });
});

describe("the other drills still work", () => {
  it("asks line or space and marks the answer", () => {
    renderSession([{ ...noteExercise(60), drill: "linespace" }]);
    expect(statusText()).toContain("line, or in a space");
    fireEvent.click(screen.getByRole("button", { name: /Line/ }));
    expect(statusText()).toContain("ledger line");
  });

  it("marks a wrong line-or-space answer", () => {
    renderSession([{ ...noteExercise(60), drill: "linespace" }]);
    fireEvent.click(screen.getByRole("button", { name: /Space/ }));
    expect(statusText()).toContain("Look again");
  });

  it("asks for the interval size", () => {
    renderSession([{
      item: "int:3", drill: "interval", level: 0, size: 3, name: "3rd",
      notes: [noteMeta("treble", 60), noteMeta("treble", 64)],
    }]);
    expect(screen.getByTestId("interval-staff")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "3rd" }));
    expect(statusText()).toContain("a 3rd");
  });

  it("walks a phrase note by note", () => {
    renderSession([{
      drill: "phrase", level: 0,
      notes: [60, 64, 67, 72].map(m => ({ item: `treble:${m}`, level: 0, ...noteMeta("treble", m) })),
    }]);
    expect(screen.getByTestId("phrase-staff")).toHaveAttribute("data-current", "0");
    play("C");
    expect(screen.getByTestId("phrase-staff")).toHaveAttribute("data-current", "1");
    play("E"); play("G"); play("C");
    expect(statusText()).toContain("Phrase complete");
  });
});

describe("finishing", () => {
  it("summarises the session and hands the results up", () => {
    const { onFinish } = renderSession([noteExercise(60), noteExercise(64)]);
    play("C");
    advance();
    play("E");
    advance();

    expect(screen.getByText("Session complete")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("shows XP and the streak when the server returns them", async () => {
    const onFinish = vi.fn(() => Promise.resolve({ xpGained: 45, streakDays: 3 }));
    renderSession([noteExercise(60)], { onFinish });
    play("C");
    advance();
    await act(async () => {});

    expect(screen.getByText(/\+45 XP/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("still shows the summary when there is no reward to report", async () => {
    const onFinish = vi.fn(() => Promise.reject(new Error("offline")));
    renderSession([noteExercise(60)], { onFinish });
    play("C");
    advance();
    await act(async () => {});

    expect(screen.getByText("Session complete")).toBeInTheDocument();
  });

  it("goes home from the summary", () => {
    const { onHome } = renderSession([noteExercise(60)]);
    play("C");
    advance();
    fireEvent.click(screen.getByRole("button", { name: "Back to lessons" }));
    expect(onHome).toHaveBeenCalled();
  });
});

describe("typing as input", () => {
  it("answers a note with its letter key", () => {
    renderSession([noteExercise(60)]);
    fireEvent.keyDown(document, { key: "c" });
    expect(statusText()).toContain("correct");
  });

  it("answers line-or-space with L and S", () => {
    renderSession([{ ...noteExercise(60), drill: "linespace" }]);
    fireEvent.keyDown(document, { key: "l" });
    expect(statusText()).toContain("ledger line");
  });

  it("builds a chord from typed letters", () => {
    renderSession([chordExercise()]);
    for (const key of ["c", "e", "g"]) fireEvent.keyDown(document, { key });
    expect(statusText()).toContain("correct");
  });
});


// --- The ear track ----------------------------------------------------------

const earPitch = (midi = 67, over = {}) => ({
  item: `ear:${midi}`, drill: "ear-pitch", level: 0, ...noteMeta("treble", midi), ...over,
});
const earInterval = (over = {}) => ({
  item: "ear:int:3", drill: "ear-interval", level: 0, size: 3, name: "3rd",
  midis: [60, 64], notes: [noteMeta("treble", 60), noteMeta("treble", 64)], ...over,
});
const earChord = (root = 60, quality = "maj", over = {}) => ({
  item: `ear:qual:${quality}`, drill: "ear-chord", level: 0,
  ...chordSpec(root, quality), ...over,
});
const earPhrase = (over = {}) => ({
  drill: "ear-phrase", level: 0,
  notes: [60, 64, 67, 72].map(m => ({ item: `ear:${m}`, level: 0, ...noteMeta("treble", m) })),
  midis: [60, 64, 67, 72], ...over,
});

describe("what an ear drill shows", () => {
  it("draws no staff at all — that is the point", () => {
    renderSession([earPitch()]);
    for (const id of ["staff", "chord-staff", "interval-staff", "phrase-staff", "rhythm-staff"]) {
      expect(screen.queryByTestId(id), id).not.toBeInTheDocument();
    }
  });

  it("offers a replay button instead", () => {
    renderSession([earPitch()]);
    expect(screen.getByRole("button", { name: "🔊 Play it again" })).toBeInTheDocument();
  });

  it("does not offer 'hear it', which would be the answer", () => {
    renderSession([earPitch()]);
    expect(screen.queryByRole("button", { name: "🔊 Hear it" })).not.toBeInTheDocument();
  });

  it("still offers 'hear it' on the reading drills", () => {
    renderSession([noteExercise(60)]);
    expect(screen.getByRole("button", { name: "🔊 Hear it" })).toBeInTheDocument();
  });

  it("counts the sounds coming without saying what they are", () => {
    renderSession([earPhrase()]);
    expect(document.querySelectorAll(".ear-beat")).toHaveLength(4);
  });
});

describe("sounding the exercise", () => {
  it("plays it as soon as it arrives — the sound is the prompt", () => {
    renderSession([earPitch(67)]);
    expect(playPlan).toHaveBeenCalledTimes(1);
    expect(playPlan.mock.calls[0][0].flatMap(s => s.midis)).toContain(67);
  });

  it("plays again on request", () => {
    renderSession([earPitch()]);
    playPlan.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "🔊 Play it again" }));
    expect(playPlan).toHaveBeenCalledTimes(1);
  });

  it("plays the next exercise when the session advances", () => {
    renderSession([earPitch(60), earPitch(67)]);
    playPlan.mockClear();
    play("C");
    advance();
    expect(playPlan).toHaveBeenCalledTimes(1);
    expect(playPlan.mock.calls[0][0].flatMap(s => s.midis)).toContain(67);
  });

  it("sounds a reference note first while the item is new", () => {
    renderSession([earPitch(67, { level: 0 })]);
    expect(playPlan.mock.calls[0][0]).toHaveLength(2);
  });

  it("drops the reference once the item is mastered", () => {
    renderSession([earPitch(67, { level: 2 })]);
    expect(playPlan.mock.calls[0][0]).toHaveLength(1);
  });

  it("does not sound anything on a reading drill", () => {
    renderSession([noteExercise(60)]);
    expect(playPlan).not.toHaveBeenCalled();
  });
});

describe("matching a pitch by ear", () => {
  it("asks you to play what you heard", () => {
    renderSession([earPitch()]);
    expect(statusText()).toContain("Play the note you just heard");
    expect(document.querySelectorAll(".keys .key")).toHaveLength(7);
  });

  it("accepts the right note and names it", () => {
    renderSession([earPitch(67)]);
    play("G");
    expect(statusText()).toContain("G");
    expect(statusText()).toContain("correct");
  });

  it("names what you played when it is wrong", () => {
    renderSession([earPitch(67)]);
    play("F");
    expect(statusText()).toContain("You played F4");
  });

  it("records the ear item, not the reading one", () => {
    const { onFinish } = renderSession([earPitch(67)]);
    play("G");
    advance();
    expect(onFinish).toHaveBeenCalledWith([{ item: "ear:67", hit: true, played: null }]);
  });
});

describe("intervals by ear", () => {
  it("offers the interval buttons and no staff", () => {
    renderSession([earInterval()]);
    expect(statusText()).toContain("How far apart");
    expect(screen.getByRole("button", { name: "3rd" })).toBeInTheDocument();
    expect(screen.queryByTestId("interval-staff")).not.toBeInTheDocument();
  });

  it("grades the answer", () => {
    renderSession([earInterval()]);
    fireEvent.click(screen.getByRole("button", { name: "2nd" }));
    expect(statusText()).toContain("Look at the gap");

    fireEvent.click(screen.getByRole("button", { name: "3rd" }));
    expect(statusText()).toContain("a 3rd");
  });
});

describe("major or minor", () => {
  it("offers exactly two answers", () => {
    renderSession([earChord()]);
    expect(statusText()).toContain("major or minor");
    expect(screen.getByRole("button", { name: "☀ Major" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "☾ Minor" })).toBeInTheDocument();
  });

  it("names the chord it actually was when you get it right", () => {
    renderSession([earChord(65, "maj")]);
    fireEvent.click(screen.getByRole("button", { name: "☀ Major" }));
    expect(statusText()).toContain("F major");
  });

  it("points at the third when you get it wrong", () => {
    renderSession([earChord(60, "min")]);
    fireEvent.click(screen.getByRole("button", { name: "☀ Major" }));
    expect(statusText()).toContain("middle note");
  });

  it("grades a minor chord", () => {
    renderSession([earChord(62, "min")]);
    fireEvent.click(screen.getByRole("button", { name: "☾ Minor" }));
    expect(statusText()).toContain("D minor");
  });

  it("records one item per quality, not per chord", () => {
    const { onFinish } = renderSession([earChord(65, "maj")]);
    fireEvent.click(screen.getByRole("button", { name: "☀ Major" }));
    advance();
    expect(onFinish).toHaveBeenCalledWith([
      { item: "ear:qual:maj", hit: true, played: null },
    ]);
  });
});

describe("playing a phrase back", () => {
  it("walks the notes without drawing them", () => {
    renderSession([earPhrase()]);
    expect(statusText()).toContain("Play those four notes back");
    expect(screen.queryByTestId("phrase-staff")).not.toBeInTheDocument();

    play("C"); play("E"); play("G"); play("C");
    expect(statusText()).toContain("Phrase complete");
  });

  it("reports a miss on the note you fumbled", () => {
    const { onFinish } = renderSession([earPhrase()]);
    play("C");
    play("D");   // wrong: should be E
    play("E");
    play("G"); play("C");
    advance();
    const results = onFinish.mock.calls[0][0];
    expect(results.find(r => r.item === "ear:64")).toMatchObject({ hit: false, played: 62 });
    expect(results.find(r => r.item === "ear:60")).toMatchObject({ hit: true });
  });
});

describe("the ear track in Spanish", () => {
  it("translates the prompts and the quality buttons", () => {
    setLocale("es", "solfege");
    renderSession([earChord(60, "maj")], {
      settings: { ...SETTINGS, language: "es", noteNames: "solfege" },
    });
    expect(statusText()).toContain("mayor o menor");
    fireEvent.click(screen.getByRole("button", { name: "☀ Mayor" }));
    expect(statusText()).toContain("Do mayor");
  });
});


// --- Technique and timed playing --------------------------------------------

const SPB = (60 / 80) * 1000;
const COUNT_IN = 4;
const START_DELAY = 250;

const technique = (pattern = "arp:C:rh", over = {}) => ({
  item: `tech:${pattern}`, drill: "technique", level: 0, ...techniqueSpec(pattern), ...over,
});
const timedPhrase = (over = {}) => ({
  drill: "phrase-timed", level: 0,
  notes: [60, 64, 67, 72].map(m => ({ item: `treble:${m}`, level: 0, ...noteMeta("treble", m) })),
  midis: [60, 64, 67, 72], ...over,
});

/** Run a take: count in, play the given notes on the beat, then score. */
function take(midis) {
  fireEvent.click(screen.getByRole("button", { name: "▶ Count-in & play" }));
  act(() => { vi.advanceTimersByTime(START_DELAY + COUNT_IN * SPB); });
  for (let i = 0; i < midis.length; i++) {
    if (i > 0) act(() => { vi.advanceTimersByTime(SPB); });
    fireEvent.keyDown(document, { key: NAMES[midis[i] % 12] });
  }
  act(() => { vi.advanceTimersByTime(SPB * (midis.length + 2) + 500); });
}
const NAMES = { 0: "c", 2: "d", 4: "e", 5: "f", 7: "g", 9: "a", 11: "b" };

describe("the technique drill", () => {
  it("draws the pattern with its fingering while it is new", () => {
    renderSession([technique("arp:C:rh", { level: 0 })]);
    const staff = screen.getByTestId("technique-staff");
    expect(staff).toHaveAttribute("data-pattern", "arp:C:rh");
    expect(staff).toHaveAttribute("data-show-fingers", "true");
    expect(statusText()).toContain("Play it evenly, with the fingering shown");
  });

  it("withdraws the fingering once the pattern is mastered", () => {
    renderSession([technique("arp:C:rh", { level: 2 })]);
    expect(screen.getByTestId("technique-staff")).toHaveAttribute("data-show-fingers", "false");
  });

  it("counts you in and offers a preview", () => {
    renderSession([technique()]);
    expect(screen.getByRole("button", { name: "▶ Count-in & play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🔊 Hear it" })).toBeInTheDocument();
  });

  it("gives you a keyboard, not a tap pad — you play the notes", () => {
    renderSession([technique()]);
    expect(document.querySelectorAll(".keys .key")).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "Tap the rhythm here" })).not.toBeInTheDocument();
  });

  it("passes a take played in order and in time", () => {
    const { onFinish } = renderSession([technique("arp:C:rh")]);
    take(techniqueSpec("arp:C:rh").midis);
    expect(statusText()).toContain("Locked in");
    advance();
    expect(onFinish).toHaveBeenCalledWith([
      { item: "tech:arp:C:rh", hit: true, played: null },
    ]);
  });

  it("fails a take that plays the wrong notes", () => {
    renderSession([technique("arp:C:rh")]);
    take([60, 62, 64, 65, 62, 60, 62]);
    expect(statusText()).toContain("Not quite");
  });
});

describe("timed phrase reading", () => {
  it("still draws the phrase, now against the metronome", () => {
    renderSession([timedPhrase()]);
    expect(screen.getByTestId("phrase-staff")).toBeInTheDocument();
    expect(statusText()).toContain("in time with the metronome");
    expect(screen.getByRole("button", { name: "▶ Count-in & play" })).toBeInTheDocument();
  });

  it("passes a phrase played in time and credits every note", () => {
    const { onFinish } = renderSession([timedPhrase()]);
    take([60, 64, 67, 72]);
    expect(statusText()).toContain("In time");
    advance();
    expect(onFinish).toHaveBeenCalledWith([
      { item: "treble:60", hit: true, played: null },
      { item: "treble:64", hit: true, played: null },
      { item: "treble:67", hit: true, played: null },
      { item: "treble:72", hit: true, played: null },
    ]);
  });

  it("blames only the note that was fumbled", () => {
    const { onFinish } = renderSession([timedPhrase()]);
    take([60, 62, 67, 72]); // D instead of E on beat 2
    advance();
    const results = onFinish.mock.calls[0]?.[0];
    expect(results).toBeUndefined(); // a failed take does not end the exercise
    expect(statusText()).toContain("Not quite");
  });

  it("leaves the untimed phrase drill alone", () => {
    renderSession([{
      drill: "phrase", level: 0,
      notes: [60, 64, 67, 72].map(m => ({ item: `treble:${m}`, level: 0, ...noteMeta("treble", m) })),
    }]);
    expect(statusText()).toContain("Play the phrase, left to right");
    expect(screen.queryByRole("button", { name: "▶ Count-in & play" })).not.toBeInTheDocument();
  });
});

describe("the verdicts stay on screen", () => {
  // Regression: `expected` was built inline in render, so every re-render
  // handed TimedPlay a new array identity and its reset effect wiped the
  // scored take. The per-note verdicts are the whole point of a timed drill —
  // they flashed and vanished before anyone could read them.
  it("survives the re-render that scoring itself causes (technique)", () => {
    renderSession([technique("arp:C:rh")]);
    take(techniqueSpec("arp:C:rh").midis);
    expect(document.querySelectorAll(".verdict").length).toBeGreaterThan(0);
  });

  it("survives it for a failed take too, where they matter most", () => {
    renderSession([technique("arp:C:rh")]);
    take([60, 62, 64, 65, 62, 60, 62]);
    expect(statusText()).toContain("Not quite");
    expect(document.querySelectorAll(".verdict").length).toBeGreaterThan(0);
  });

  // The other half of the same contract. Verdicts have to persist through
  // the re-render that scoring causes, and then NOT persist into the next
  // exercise. That used to be TimedPlay resetting itself whenever `expected`
  // changed identity — which is exactly what made the churn above so easy to
  // trip over. It is a key on TimedPlay now, so the next exercise simply gets
  // a new one; remove that key and the verdicts follow the learner forward.
  it("do not follow the session into the next exercise", () => {
    renderSession([technique("arp:C:rh"), technique("scale:C:rh")]);
    take(techniqueSpec("arp:C:rh").midis);
    expect(document.querySelectorAll(".verdict").length).toBeGreaterThan(0);

    advance();
    expect(screen.getByTestId("technique-staff")).toHaveAttribute("data-pattern", "scale:C:rh");
    expect(document.querySelectorAll(".verdict")).toHaveLength(0);
  });

  it("survives for the rhythm drill", () => {
    renderSession([{
      item: "rhythm:r-quarters", drill: "rhythm", level: 0,
      name: "Four steady quarters", durations: ["q", "q", "q", "q"],
    }]);
    fireEvent.click(screen.getByRole("button", { name: "▶ Count-in & play" }));
    act(() => { vi.advanceTimersByTime(START_DELAY + COUNT_IN * SPB + SPB * 5 + 500); });
    expect(document.querySelectorAll(".verdict").length).toBeGreaterThan(0);
  });
});


// --- Repertoire -------------------------------------------------------------

const bar = (drill, pieceId = "ode-to-joy", n = 1, over = {}) => {
  const [item, meta] = pieceItems(pieceId)[n - 1];
  return { item, drill, level: 0, bpm: 60, ...meta, ...over };
};

/** Run a piece take at the bar's own tempo. */
function takeBar(midis, bpm = 60) {
  const spb = (60 / bpm) * 1000;
  fireEvent.click(screen.getByRole("button", { name: "▶ Count-in & play" }));
  act(() => { vi.advanceTimersByTime(250 + 4 * spb); });
  for (let i = 0; i < midis.length; i++) {
    if (i > 0) act(() => { vi.advanceTimersByTime(spb); });
    fireEvent.keyDown(document, { key: NAMES[midis[i] % 12] });
  }
  act(() => { vi.advanceTimersByTime(spb * (midis.length + 2) + 600); });
}

describe("practising a piece", () => {
  it("draws the bar on the grand staff, naming where you are", () => {
    renderSession([bar("piece-rh", "ode-to-joy", 4)]);
    const staff = screen.getByTestId("passage-staff");
    expect(staff).toHaveAttribute("data-bar", "4");
    expect(staff).toHaveAttribute("data-title", "Ode to Joy");
    expect(statusText()).toContain("right hand");
  });

  it.each([
    ["piece-rh", "rh"],
    ["piece-lh", "lh"],
    ["piece-both", "rh+lh"],
  ])("marks %s as playing %s", (drill, hands) => {
    renderSession([bar(drill)]);
    expect(screen.getByTestId("passage-staff")).toHaveAttribute("data-hands", hands);
  });

  it.each([[0, "true"], [1, "true"], [2, "false"]])(
    "shows the fingering at level %i: %s", (level, shown) => {
      renderSession([bar("piece-rh", "ode-to-joy", 1, { level })]);
      expect(screen.getByTestId("passage-staff")).toHaveAttribute("data-show-fingers", shown);
    });

  it("counts you in at the tempo the bar asks for", () => {
    renderSession([bar("piece-rh", "ode-to-joy", 1, { bpm: 58 })]);
    expect(document.querySelector(".rhythm-meta").textContent).toContain("58 bpm");
    expect(document.querySelector(".rhythm-meta").textContent).toContain("bar 1/8");
  });

  it("passes a right-hand bar played correctly", () => {
    const { onFinish } = renderSession([bar("piece-rh", "ode-to-joy", 1)]);
    takeBar([64, 64, 65, 67]); // E E F G
    expect(statusText()).toContain("Locked in");
    advance();
    expect(onFinish).toHaveBeenCalledWith([
      { item: "piece:ode-to-joy:b1", hit: true, played: null },
    ]);
  });

  it("asks only for the left hand on the left-hand drill", () => {
    renderSession([bar("piece-lh", "ode-to-joy", 1)]);
    takeBar([60]); // the single bass note, as a pitch class
    expect(statusText()).toContain("Locked in");
  });

  it("asks for both hands together on the hands-together drill", () => {
    renderSession([bar("piece-both", "ode-to-joy", 1)]);
    takeBar([64, 64, 65, 67]); // right hand only — the bass note is missing
    expect(statusText()).toContain("Not quite");
    expect(document.querySelectorAll(".verdict.missed").length).toBeGreaterThan(0);
  });

  it("keeps the verdicts up so you can see which beat fell over", () => {
    renderSession([bar("piece-rh", "ode-to-joy", 1)]);
    takeBar([64, 62, 65, 67]); // D instead of E on beat 2
    expect(document.querySelectorAll(".verdict").length).toBe(4);
    expect(document.querySelector(".verdict.wrong")).toBeInTheDocument();
  });
});


// --- Key signatures ---------------------------------------------------------

const keyExercise = (keyId = "G", over = {}) => ({
  item: `key:${keyId}`, drill: "key-name", level: 0,
  ...KEYS[keyId], keyId, ...over,
});

describe("naming a key signature", () => {
  it("shows a bare staff and the eight answers", () => {
    renderSession([keyExercise("G")]);
    expect(statusText()).toContain("Which key is this?");
    expect([...document.querySelectorAll(".btn.answer")].map(b => b.textContent))
      .toEqual(["C", "G", "D", "A", "E", "F", "B♭", "E♭"]);
  });

  it("draws no notes to read the answer off", () => {
    renderSession([keyExercise("D")]);
    expect(document.querySelectorAll(".staff svg g.vf-notehead")).toHaveLength(0);
  });

  it("accepts the right key and names it in full", () => {
    const { onFinish } = renderSession([keyExercise("G")]);
    fireEvent.click(screen.getByRole("button", { name: "G" }));
    expect(statusText()).toContain("G major");
    advance();
    expect(onFinish).toHaveBeenCalledWith([{ item: "key:G", hit: true, played: null }]);
  });

  it("names a flat key properly", () => {
    renderSession([keyExercise("Bb")]);
    fireEvent.click(screen.getByRole("button", { name: "B♭" }));
    expect(statusText()).toContain("B flat major");
  });

  it("nudges you to count rather than telling you the answer", () => {
    renderSession([keyExercise("D")]);
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    expect(statusText()).toContain("2 sharps");
    expect(statusText()).not.toContain("D major");
  });

  it("counts flats when the key has flats", () => {
    renderSession([keyExercise("Eb")]);
    fireEvent.click(screen.getByRole("button", { name: "C" }));
    expect(statusText()).toContain("3 flats");
  });

  it("says there is nothing there for C major", () => {
    renderSession([keyExercise("C")]);
    fireEvent.click(screen.getByRole("button", { name: "G" }));
    expect(statusText()).toContain("Nothing at the front");
  });

  it("lets a retry succeed", () => {
    renderSession([keyExercise("F")]);
    fireEvent.click(screen.getByRole("button", { name: "C" }));
    fireEvent.click(screen.getByRole("button", { name: "F" }));
    expect(statusText()).toContain("F major");
  });

  it("uses solfège for the answers in Spanish", () => {
    setLocale("es", "solfege");
    renderSession([keyExercise("G")], {
      settings: { ...SETTINGS, language: "es", noteNames: "solfege" },
    });
    expect(screen.getByRole("button", { name: "Sol" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sol" }));
    expect(statusText()).toContain("Sol mayor");
  });
});
