import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Stats from "./Stats.jsx";
import { setLocale } from "../lib/i18n.js";

vi.mock("../lib/api.js", () => ({ api: { stats: vi.fn() } }));
const { api } = await import("../lib/api.js");

const EMPTY = { items: [], confusions: [], sessionCount: 0, xp: 0, streakDays: 0 };

function show(data = EMPTY) {
  api.stats.mockResolvedValue(data);
  const onHome = vi.fn();
  render(<Stats onHome={onHome} />);
  return { onHome };
}

beforeEach(() => setLocale("en", "letters"));

describe("loading", () => {
  it("shows a placeholder until the numbers arrive", () => {
    api.stats.mockReturnValue(new Promise(() => {}));
    render(<Stats onHome={vi.fn()} />);
    expect(document.querySelector(".status").textContent).toBe("…");
  });

  it("reports a failure instead of hanging", async () => {
    api.stats.mockRejectedValue(new Error("Network unreachable"));
    render(<Stats onHome={vi.fn()} />);
    expect(await screen.findByText("Network unreachable")).toBeInTheDocument();
  });

  it("goes back home", async () => {
    const { onHome } = show();
    await userEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(onHome).toHaveBeenCalled();
  });
});

describe("the headline numbers", () => {
  it("shows XP, streak, and session count", async () => {
    show({ ...EMPTY, xp: 320, streakDays: 6, sessionCount: 14 });
    await waitFor(() => expect(document.querySelector(".chips")).toBeTruthy());
    const chips = document.querySelector(".chips").textContent;
    expect(chips).toContain("320 XP");
    expect(chips).toContain("6");
    expect(chips).toContain("14");
  });
});

describe("item labels", () => {
  const withItem = item => show({
    ...EMPTY, items: [{ item, seen: 4, correct: 3, level: 0 }],
  });

  it("names a treble note by letter and position", async () => {
    withItem("treble:67");
    expect(await screen.findByText(/G — treble second line/)).toBeInTheDocument();
  });

  it("names a bass note", async () => {
    withItem("bass:53");
    expect(await screen.findByText(/F — bass fourth line/)).toBeInTheDocument();
  });

  it("marks a grand-staff item as such", async () => {
    withItem("grand:bass:53");
    expect(await screen.findByText(/grand staff/)).toBeInTheDocument();
  });

  it("names a rhythm pattern", async () => {
    withItem("rhythm:r-halves");
    expect(await screen.findByText("Two halves")).toBeInTheDocument();
  });

  it("names an interval", async () => {
    withItem("int:3");
    expect(await screen.findByText("Interval: 3rd")).toBeInTheDocument();
  });

  it("names a chord rather than showing its raw key", async () => {
    withItem("chord:C:maj");
    expect(await screen.findByText("C major")).toBeInTheDocument();
    expect(screen.queryByText("chord:C:maj")).not.toBeInTheDocument();
  });

  it("names a chord with an accidental in it", async () => {
    withItem("chord:D:maj");
    expect(await screen.findByText("D major")).toBeInTheDocument();
  });

  it("names a minor chord", async () => {
    withItem("chord:A:min");
    expect(await screen.findByText("A minor")).toBeInTheDocument();
  });

  it("names chords in Spanish solfège", async () => {
    setLocale("es", "solfege");
    withItem("chord:D:maj");
    expect(await screen.findByText("Re mayor")).toBeInTheDocument();
  });

  it("falls back to the raw key for something it does not recognise", async () => {
    withItem("mystery:99");
    expect(await screen.findByText("mystery:99")).toBeInTheDocument();
  });
});

describe("accuracy bars", () => {
  it("shows a percentage and the scaffold level per item", async () => {
    show({
      ...EMPTY,
      items: [
        { item: "treble:60", seen: 4, correct: 3, level: 0 },
        { item: "treble:67", seen: 10, correct: 10, level: 2 },
      ],
    });
    await screen.findByText("75%");
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("letters + colors")).toBeInTheDocument();
    expect(screen.getByText("plain notation")).toBeInTheDocument();
  });

  it("reads 0% rather than dividing by zero for an unseen item", async () => {
    show({ ...EMPTY, items: [{ item: "treble:60", seen: 0, correct: 0, level: 0 }] });
    expect(await screen.findByText("0%")).toBeInTheDocument();
  });

  it("prompts a first session when there is nothing yet", async () => {
    show();
    expect(await screen.findByText("Run a session first.")).toBeInTheDocument();
  });
});

describe("the confusion matrix", () => {
  it("says what you saw and what you played instead", async () => {
    show({
      ...EMPTY,
      confusions: [{ item: "treble:67", played: 65, count: 3 }],
    });
    const entry = await screen.findByRole("listitem");
    expect(entry.textContent).toContain("G — treble second line");
    expect(entry.textContent).toContain("F4");
    expect(entry.textContent).toContain("×3");
  });

  it("reports a chord confusion legibly", async () => {
    show({ ...EMPTY, confusions: [{ item: "chord:D:maj", played: 65, count: 2 }] });
    const entry = await screen.findByRole("listitem");
    expect(entry.textContent).toContain("D major");
    expect(entry.textContent).not.toContain("chord:D:maj");
  });

  it("says so when there are no wrong notes yet", async () => {
    show();
    expect(await screen.findByText(/No wrong notes recorded yet/)).toBeInTheDocument();
  });
});
