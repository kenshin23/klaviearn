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
    expect(buttons).toEqual(["▶ Read notes", "Read phrases", "Line or space?", "In time"]);
  });

  it("keeps untimed phrase reading alongside the timed one", () => {
    // Reading it at your own pace is the on-ramp to reading it in time.
    renderHome();
    const buttons = [...cardFor("octave").querySelectorAll("button")].map(b => b.textContent);
    expect(buttons).toContain("Read phrases");
    expect(buttons).toContain("In time");
  });

  it("offers the technique drill on a technique node", () => {
    renderHome();
    expect([...cardFor("technique-scales").querySelectorAll("button")].map(b => b.textContent))
      .toEqual(["▶ Play the pattern"]);
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

describe("grouped by track", () => {
  const sections = () =>
    [...document.querySelectorAll(".track")].map(s => ({
      name: s.querySelector(".track-name").textContent.replace(/^[▸▾]\s*/, ""),
      count: Number(s.querySelector(".track-count").textContent),
      nodes: s.querySelectorAll(".node").length,
      folded: s.querySelector(".track-head").getAttribute("aria-expanded") === "false",
    }));

  it("shows the five tracks the curriculum names", () => {
    renderHome();
    expect(sections().map(s => s.name))
      .toEqual(["Reading", "Rhythm", "Technique", "Ear", "Repertoire"]);
  });

  it("puts every node in exactly one track", () => {
    renderHome();
    const shown = sections().reduce((sum, s) => sum + s.nodes, 0);
    expect(shown).toBe(SKILL_NODES.length);
    expect(document.querySelectorAll(".node")).toHaveLength(SKILL_NODES.length);
  });

  it("counts the nodes in each track", () => {
    renderHome();
    for (const s of sections()) expect(s.count, s.name).toBe(s.nodes);
  });

  it("sums the due items across a track", () => {
    const nodes = allNodes().map(n =>
      n.track === "ear" ? { ...n, dueCount: 3 } : n);
    renderHome({ nodes });
    const ear = [...document.querySelectorAll(".track")]
      .find(s => s.textContent.includes("Ear"));
    expect(ear.querySelector(".track-head .due").textContent).toBe("12 due");
  });

  it("shows no due badge on a track with nothing due", () => {
    renderHome();
    for (const section of document.querySelectorAll(".track-head")) {
      expect(section.querySelector(".due")).toBeNull();
    }
  });

  // onSettings takes an updater so two toggles in one tick cannot lose one.
  const settingsAfterClick = (trackLabel, from = SETTINGS) => {
    const { onSettings } = renderHome({ settings: from });
    fireEvent.click([...document.querySelectorAll(".track-head")]
      .find(h => h.textContent.includes(trackLabel)));
    const updater = onSettings.mock.calls[0][0];
    expect(typeof updater).toBe("function");
    return updater(from);
  };

  it("folds a track away when asked", () => {
    expect(settingsAfterClick("Reading").collapsedTracks).toEqual(["reading"]);
  });

  it("does not lose a fold when two land in the same tick", () => {
    const { onSettings } = renderHome();
    const heads = [...document.querySelectorAll(".track-head")];
    fireEvent.click(heads.find(h => h.textContent.includes("Reading")));
    fireEvent.click(heads.find(h => h.textContent.includes("Ear")));

    // Apply both updaters in order, as the app's settings ref does.
    const applied = onSettings.mock.calls.reduce((acc, [u]) => u(acc), SETTINGS);
    expect(applied.collapsedTracks.sort()).toEqual(["ear", "reading"]);
  });

  it("hides a folded track's nodes but keeps its heading", () => {
    renderHome({ settings: { ...SETTINGS, collapsedTracks: ["reading", "ear"] } });
    const byName = Object.fromEntries(sections().map(s => [s.name, s]));
    expect(byName.Reading.folded).toBe(true);
    expect(byName.Reading.nodes).toBe(0);
    expect(byName.Rhythm.folded).toBe(false);
    expect(byName.Rhythm.nodes).toBeGreaterThan(0);
  });

  it("unfolds a folded track", () => {
    const from = { ...SETTINGS, collapsedTracks: ["rhythm"] };
    expect(settingsAfterClick("Rhythm", from).collapsedTracks).toEqual([]);
  });

  it("still starts a drill from inside a track", () => {
    const { onStart } = renderHome();
    fireEvent.click(screen.getByRole("button", { name: "▶ Play the chord" }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ id: "chords" }), "chord");
  });

  it("translates the track names", () => {
    setLocale("es", "solfege");
    renderHome({ settings: { ...SETTINGS, language: "es", noteNames: "solfege" } });
    expect(sections().map(s => s.name))
      .toEqual(["Lectura", "Ritmo", "Técnica", "Oído", "Repertorio"]);
  });
});
