import { act, fireEvent, render, screen } from "@testing-library/react";
import Session from "./Session.jsx";
import { chordSpec, noteMeta } from "../lib/notes.js";
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
