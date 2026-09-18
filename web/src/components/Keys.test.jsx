import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Keys from "./Keys.jsx";
import { LETTER_TO_MIDI, SHARP_TO_MIDI } from "../lib/notes.js";
import { setLocale } from "../lib/i18n.js";

const keys = () => screen.getAllByRole("button");

beforeEach(() => setLocale("en", "letters"));

describe("the natural keyboard", () => {
  it("shows exactly the seven naturals by default", () => {
    render(<Keys onAnswer={vi.fn()} />);
    expect(keys().map(b => b.textContent)).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
  });

  it("answers with the note's MIDI number, octave-independent", async () => {
    const onAnswer = vi.fn();
    render(<Keys onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: "G" }));
    expect(onAnswer).toHaveBeenCalledWith(LETTER_TO_MIDI.G, { pitchClassOnly: true });
  });

  it("labels keys in solfège when that is the setting", () => {
    setLocale("es", "solfege");
    render(<Keys onAnswer={vi.fn()} />);
    expect(keys().map(b => b.textContent)).toEqual(["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"]);
  });

  it("goes silent while an answer is being marked", async () => {
    const onAnswer = vi.fn();
    render(<Keys onAnswer={onAnswer} disabled />);
    for (const button of keys()) expect(button).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "C" }));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe("the black keys", () => {
  it("stays hidden for the reading drills", () => {
    render(<Keys onAnswer={vi.fn()} />);
    expect(keys()).toHaveLength(7);
  });

  it("appears when a drill can ask for an accidental", () => {
    render(<Keys onAnswer={vi.fn()} accidentals />);
    expect(keys()).toHaveLength(12);
    expect(keys().map(b => b.textContent)).toEqual([
      "C", "D", "E", "F", "G", "A", "B", "C♯", "D♯", "F♯", "G♯", "A♯",
    ]);
  });

  it("answers with the sharp's MIDI number", async () => {
    const onAnswer = vi.fn();
    render(<Keys onAnswer={onAnswer} accidentals />);
    await userEvent.click(screen.getByRole("button", { name: "F♯" }));
    expect(onAnswer).toHaveBeenCalledWith(SHARP_TO_MIDI.F, { pitchClassOnly: true });
  });

  it("makes every triad in the curriculum reachable without MIDI", () => {
    // The regression that prompted the black keys: D major and E major were
    // unanswerable on the only input iOS has.
    render(<Keys onAnswer={vi.fn()} accidentals />);
    const reachable = new Set(
      [...Object.values(LETTER_TO_MIDI), ...Object.values(SHARP_TO_MIDI)].map(m => m % 12),
    );
    for (const midi of [62, 66, 69, 64, 68, 71]) expect(reachable.has(midi % 12)).toBe(true);
  });

  it("marks sharps distinctly but keeps the natural's colour", () => {
    render(<Keys onAnswer={vi.fn()} accidentals />);
    const natural = screen.getByRole("button", { name: "F" });
    const sharp = screen.getByRole("button", { name: "F♯" });
    expect(sharp).toHaveClass("sharp");
    expect(natural).not.toHaveClass("sharp");
    expect(sharp.style.getPropertyValue("--key-color"))
      .toBe(natural.style.getPropertyValue("--key-color"));
  });

  it("labels sharps in solfège too", () => {
    setLocale("es", "solfege");
    render(<Keys onAnswer={vi.fn()} accidentals />);
    expect(screen.getByRole("button", { name: "Fa♯" })).toBeInTheDocument();
  });
});
