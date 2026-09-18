import { fireEvent, render, screen } from "@testing-library/react";
import Home from "./Home.jsx";
import { SKILL_NODES } from "../lib/notes.js";
import { setLocale } from "../lib/i18n.js";

const SETTINGS = {
  scaffold: "auto", strictOctave: false, staffSize: "large",
  micSensitivity: "high", language: "en", noteNames: "letters",
};

const allNodes = () => SKILL_NODES.map(n => ({ ...n, accuracy: null, dueCount: 0, mastery: 0 }));

function renderHome(over = {}) {
  const props = {
    nodes: allNodes(), me: null, settings: SETTINGS,
    onSettings: vi.fn(), onStart: vi.fn(), onStats: null, onLogout: null, onSignup: null,
    ...over,
  };
  render(<Home {...props} />);
  return props;
}

const cardFor = id => {
  const node = SKILL_NODES.find(n => n.id === id);
  const heading = screen.getByRole("heading", { name: new RegExp(node.title) });
  return heading.closest(".node");
};

beforeEach(() => setLocale("en", "letters"));

describe("the lesson list", () => {
  it("shows every skill node", () => {
    renderHome();
    expect(document.querySelectorAll(".node")).toHaveLength(SKILL_NODES.length);
    for (const node of SKILL_NODES) {
      expect(screen.getByRole("heading", { name: new RegExp(node.title) })).toBeInTheDocument();
    }
  });

  it("offers the reading drills on a note node", () => {
    renderHome();
    const buttons = [...cardFor("octave").querySelectorAll("button")].map(b => b.textContent);
    expect(buttons).toEqual(["▶ Read notes", "Read phrases", "Line or space?"]);
  });

  it("offers the chord drill on the triads node", () => {
    renderHome();
    const buttons = [...cardFor("chords").querySelectorAll("button")].map(b => b.textContent);
    expect(buttons).toEqual(["▶ Play the chord"]);
  });

  it.each([
    ["rhythm-steady", "▶ Tap the rhythm"],
    ["intervals", "▶ Name the interval"],
    ["grand", "▶ Read notes"],
  ])("offers the right drill on %s", (id, label) => {
    renderHome();
    expect([...cardFor(id).querySelectorAll("button")].map(b => b.textContent)).toEqual([label]);
  });

  it("gives every node at least one way to start", () => {
    renderHome();
    for (const node of SKILL_NODES) {
      expect(cardFor(node.id).querySelectorAll("button").length).toBeGreaterThan(0);
    }
  });

  it("starts the drill you pick", () => {
    const { onStart } = renderHome();
    fireEvent.click(screen.getAllByRole("button", { name: "▶ Play the chord" })[0]);
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ id: "chords" }),
      "chord",
    );
  });
});

describe("progress badges", () => {
  it("hides accuracy until there is some", () => {
    renderHome();
    expect(document.querySelectorAll(".acc")).toHaveLength(0);
  });

  it("shows accuracy as a percentage", () => {
    const nodes = allNodes().map(n => n.id === "guide" ? { ...n, accuracy: 0.834 } : n);
    renderHome({ nodes });
    expect(cardFor("guide").querySelector(".acc").textContent).toBe("83%");
  });

  it("shows a due count, singular and plural", () => {
    const nodes = allNodes().map(n =>
      n.id === "guide" ? { ...n, dueCount: 1 } : n.id === "octave" ? { ...n, dueCount: 4 } : n);
    renderHome({ nodes });
    expect(cardFor("guide").querySelector(".due").textContent).toBe("1 due");
    expect(cardFor("octave").querySelector(".due").textContent).toBe("4 due");
  });

  it("shows XP and streak only when signed in", () => {
    renderHome();
    expect(document.querySelector(".chips")).toBeNull();

    renderHome({ me: { xp: 250, streakDays: 7 } });
    expect(document.querySelector(".chips").textContent).toContain("250 XP");
    expect(document.querySelector(".chips").textContent).toContain("7");
  });
});

describe("account controls", () => {
  it("offers signup to a guest and logout to a member", () => {
    const onSignup = vi.fn();
    renderHome({ onSignup });
    expect(screen.getByRole("button", { name: /Create account/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });

  it("shows stats only when they exist server-side", () => {
    renderHome();
    expect(screen.queryByRole("button", { name: /My stats/ })).not.toBeInTheDocument();

    renderHome({ onStats: vi.fn() });
    expect(screen.getByRole("button", { name: /My stats/ })).toBeInTheDocument();
  });

  it("toggles the settings panel", () => {
    renderHome();
    expect(document.querySelector(".settings")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    expect(document.querySelector(".settings")).toBeInTheDocument();
  });
});

describe("Spanish", () => {
  it("translates node titles and drill buttons", () => {
    setLocale("es", "solfege");
    renderHome({ settings: { ...SETTINGS, language: "es", noteNames: "solfege" } });
    expect(screen.getByRole("heading", { name: /Tríadas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "▶ Toca el acorde" })).toBeInTheDocument();
  });
});
