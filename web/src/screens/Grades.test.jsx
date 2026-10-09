import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Grades from "./Grades.jsx";
import { setLocale } from "../lib/i18n.js";

vi.mock("../lib/api.js", () => ({ api: { grades: vi.fn() } }));
const { api } = await import("../lib/api.js");

const requirement = (label, over = {}) => ({
  label, items: ["a", "b"], status: "not started", practised: 0, of: 2, accuracy: null, ...over,
});

const GRADE = {
  id: "foundation",
  title: "Foundation",
  blurb: "Before grade one.",
  sections: [
    { name: "Technique", requirements: [
      requirement("C position, both hands", { status: "secure", practised: 2, of: 2, accuracy: 1 }),
      requirement("C major scale", { status: "working", practised: 1, of: 2, accuracy: 0.75 }),
    ] },
    { name: "Reading", requirements: [requirement("Treble guide notes")] },
  ],
};

function show(grades = [GRADE]) {
  api.grades.mockResolvedValue({ grades });
  const onHome = vi.fn();
  render(<Grades onHome={onHome} />);
  return { onHome };
}

const rows = () => [...document.querySelectorAll(".requirement")];

beforeEach(() => setLocale("en", "letters"));

describe("loading", () => {
  it("shows a placeholder while it waits", () => {
    api.grades.mockReturnValue(new Promise(() => {}));
    render(<Grades onHome={vi.fn()} />);
    expect(document.querySelector(".status").textContent).toBe("…");
  });

  it("reports a failure instead of hanging", async () => {
    api.grades.mockRejectedValue(new Error("Network unreachable"));
    render(<Grades onHome={vi.fn()} />);
    expect(await screen.findByText("Network unreachable")).toBeInTheDocument();
  });

  it("goes back home", async () => {
    const { onHome } = show();
    await userEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(onHome).toHaveBeenCalled();
  });
});

describe("what a grade shows", () => {
  it("names the grade and its sections", async () => {
    show();
    expect(await screen.findByRole("heading", { name: "Foundation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Technique" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reading" })).toBeInTheDocument();
  });

  it("lists every requirement", async () => {
    show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows().map(r => r.querySelector(".req-label").textContent)).toEqual([
      "C position, both hands", "C major scale", "Treble guide notes",
    ]);
  });

  it("says where each one stands in words, not a number to compare", async () => {
    show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows().map(r => r.querySelector(".req-word").textContent))
      .toEqual(["Secure", "Working on it", "Not started"]);
  });

  it("marks the three states distinctly for a reader who cannot see colour", async () => {
    show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows().map(r => r.querySelector(".req-status").textContent)).toEqual(["✓", "◐", "○"]);
    expect(rows()[0]).toHaveClass("secure");
    expect(rows()[2]).toHaveClass("not-started");
  });

  it("shows how much of a requirement has been touched, once any has", async () => {
    show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows()[1].querySelector(".req-detail").textContent).toBe("1/2 · 75%");
  });

  it("shows no detail for something never practised", async () => {
    show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows()[2].querySelector(".req-detail")).toBeNull();
  });

  it("counts the secure requirements against the total", async () => {
    show();
    expect(await screen.findByText("1/3")).toBeInTheDocument();
  });

  it("renders several grades", async () => {
    show([GRADE, { ...GRADE, id: "grade-1", title: "Grade 1" }]);
    expect(await screen.findByRole("heading", { name: "Grade 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Foundation" })).toBeInTheDocument();
  });
});

describe("being straight about what these are", () => {
  it("says the levels are generic and not any exam board's", async () => {
    show();
    const note = await screen.findByText(/Generic levels/);
    expect(note.textContent).toMatch(/not any exam board's syllabus/);
  });

  it("names no exam board anywhere on the screen", async () => {
    show();
    await screen.findByRole("heading", { name: "Foundation" });
    expect(document.body.textContent).not.toMatch(/ABRSM|Trinity|Royal Schools/i);
  });

  it("translates into Spanish", async () => {
    setLocale("es", "solfege");
    show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows().map(r => r.querySelector(".req-word").textContent))
      .toEqual(["Seguro", "En ello", "Sin empezar"]);
    expect(screen.getByRole("heading", { name: "Técnica" })).toBeInTheDocument();
  });

  it("translates the requirement labels too, not just the headings", async () => {
    // A screen in two languages at once is worse than one in neither.
    setLocale("es", "solfege");
    show([{ ...GRADE, sections: [{ name: "Technique", requirements: [
      requirement("C position, both hands"),
      requirement("Treble guide notes"),
    ] }] }]);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows().map(r => r.querySelector(".req-label").textContent))
      .toEqual(["Posición de Do, ambas manos", "Notas guía en clave de Sol"]);
  });

  it("translates the grade's own title and blurb", async () => {
    setLocale("es", "solfege");
    show();
    expect(await screen.findByRole("heading", { name: "Iniciación" })).toBeInTheDocument();
  });

  it("keeps an untranslated label rather than dropping it", async () => {
    setLocale("es", "solfege");
    show([{ ...GRADE, sections: [{ name: "Technique", requirements: [
      requirement("Something nobody has written Spanish for"),
    ] }] }]);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0].querySelector(".req-label").textContent)
      .toBe("Something nobody has written Spanish for");
  });
});
