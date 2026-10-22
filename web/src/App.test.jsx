import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";
import { SKILL_NODES } from "./lib/notes.js";

vi.mock("./lib/api.js", () => ({
  api: {
    me: vi.fn(), tree: vi.fn(), saveSettings: vi.fn(), stats: vi.fn(),
    startSession: vi.fn(), completeSession: vi.fn(), login: vi.fn(), register: vi.fn(),
    grades: vi.fn(),
  },
  getToken: vi.fn(),
  setToken: vi.fn(),
}));
// The staff renderers pull in VexFlow; App's job is routing, not notation.
vi.mock("./components/Staff.jsx", () => ({ default: () => <div data-testid="staff" /> }));
vi.mock("./components/ChordStaff.jsx", () => ({ default: () => <div data-testid="chord-staff" /> }));
vi.mock("./components/GrandStaff.jsx", () => ({ default: () => <div /> }));
vi.mock("./components/IntervalStaff.jsx", () => ({ default: () => <div /> }));
vi.mock("./components/PhraseStaff.jsx", () => ({ default: () => <div /> }));
vi.mock("./components/RhythmStaff.jsx", () => ({ default: () => <div /> }));

const { api, getToken, setToken } = await import("./lib/api.js");

const ME = { email: "a@b.com", settings: {}, xp: 120, streakDays: 4 };
const TREE = SKILL_NODES.map(n => ({ ...n, accuracy: null, dueCount: 0, mastery: 0 }));

const signedIn = () => {
  getToken.mockReturnValue("tok");
  api.me.mockResolvedValue(ME);
  api.tree.mockResolvedValue({ nodes: TREE });
};

const homeHeading = () => screen.findByRole("heading", { name: /Guide notes/ });

beforeEach(() => {
  localStorage.clear();
  getToken.mockReturnValue(null);
});

describe("choosing how to start", () => {
  it("offers login or guest practice with no token and no local state", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("goes straight to the lessons when a token works", async () => {
    signedIn();
    render(<App />);
    expect(await homeHeading()).toBeInTheDocument();
    expect(document.querySelector(".chips").textContent).toContain("120 XP");
  });

  it("falls back to the login screen when the token is rejected", async () => {
    getToken.mockReturnValue("stale");
    api.me.mockRejectedValue(new Error("Invalid or expired token"));
    api.tree.mockRejectedValue(new Error("Invalid or expired token"));

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(setToken).toHaveBeenCalledWith(null);
  });

  it("remembers a guest across reloads", async () => {
    localStorage.setItem("klaviearn.guest", "1");
    render(<App />);
    expect(await homeHeading()).toBeInTheDocument();
  });

  it("enters guest mode on request", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: /Practice without an account/ }));
    expect(await homeHeading()).toBeInTheDocument();
    expect(localStorage.getItem("klaviearn.guest")).toBe("1");
  });
});

describe("guest mode", () => {
  beforeEach(() => localStorage.setItem("klaviearn.guest", "1"));

  it("shows no XP chips and offers an account instead", async () => {
    render(<App />);
    await homeHeading();
    expect(document.querySelector(".chips")).toBeNull();
    expect(screen.getByRole("button", { name: /Create account/ })).toBeInTheDocument();
  });

  it("builds its own session without calling the server", async () => {
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getAllByRole("button", { name: "▶ Read notes" })[0]);

    expect(await screen.findByTestId("staff")).toBeInTheDocument();
    expect(api.startSession).not.toHaveBeenCalled();
  });

  it("saves progress to localStorage when a session ends", async () => {
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getAllByRole("button", { name: "▶ Read notes" })[0]);
    await screen.findByTestId("staff");

    // Answer everything wrong-then-right is slow; just end the session.
    await userEvent.click(screen.getByRole("button", { name: /End/ }));
    expect(await homeHeading()).toBeInTheDocument();
  });

  // Guest accuracy is derived from the local store into state rather than
  // read off the store during render, so this is the path that puts a badge
  // on the card at all.
  it("shows accuracy badges from progress saved locally", async () => {
    localStorage.setItem("klaviearn.v1", JSON.stringify({
      noteStats: { "treble:60": { seen: 3, correct: 3, streak: 3 },
                   "treble:67": { seen: 1, correct: 0, streak: 0 } },
      sessions: [],
      settings: {},
    }));

    render(<App />);
    const card = (await homeHeading()).closest(".node");
    // Three of four across the node's two guide notes.
    expect(card.querySelector(".acc")).toHaveTextContent("75%");
  });

  it("persists a settings change", async () => {
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getByRole("button", { name: /Settings/ }));
    await userEvent.selectOptions(screen.getByLabelText(/Staff size/), "huge");

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("klaviearn.v1")).settings.staffSize).toBe("huge"));
    expect(api.saveSettings).not.toHaveBeenCalled();
  });
});

describe("signed in", () => {
  beforeEach(signedIn);

  it("asks the server for the session", async () => {
    api.startSession.mockResolvedValue([
      { item: "chord:C:maj", drill: "chord", level: 0, name: "C major", rootName: "C",
        quality: "maj", midis: [60, 64, 67], notes: [], clef: "treble" },
    ]);
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getByRole("button", { name: "▶ Play the chord" }));

    expect(await screen.findByTestId("chord-staff")).toBeInTheDocument();
    expect(api.startSession).toHaveBeenCalledWith("chords", "chord");
  });

  it("stays home when the server cannot build a session", async () => {
    api.startSession.mockRejectedValue(new Error("boom"));
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getAllByRole("button", { name: "▶ Read notes" })[0]);

    expect(await homeHeading()).toBeInTheDocument();
    expect(screen.queryByTestId("staff")).not.toBeInTheDocument();
  });

  it("saves settings to the server rather than localStorage", async () => {
    api.saveSettings.mockResolvedValue({ ok: true });
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getByRole("button", { name: /Settings/ }));
    await userEvent.selectOptions(screen.getByLabelText(/Staff size/), "huge");

    await waitFor(() =>
      expect(api.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ staffSize: "huge" })));
    expect(localStorage.getItem("klaviearn.v1")).toBeNull();
  });

  it("opens the stats screen", async () => {
    api.stats.mockResolvedValue({ items: [], confusions: [], sessionCount: 0, xp: 0, streakDays: 0 });
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getByRole("button", { name: /My stats/ }));
    expect(await screen.findByRole("heading", { name: "My stats" })).toBeInTheDocument();
  });

  it("offers the change-password form under settings", async () => {
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getByRole("button", { name: /Settings/ }));
    expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
  });

  it("logs out back to the login screen", async () => {
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(setToken).toHaveBeenCalledWith(null);
  });
});

describe("settings that change presentation", () => {
  it("applies the saved language on load", async () => {
    getToken.mockReturnValue("tok");
    api.me.mockResolvedValue({ ...ME, settings: { language: "es", noteNames: "solfege" } });
    api.tree.mockResolvedValue({ nodes: TREE });

    render(<App />);
    // "Tríadas" rather than "Notas guía", which also prefixes the bass node.
    expect(await screen.findByRole("heading", { name: /Tríadas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "▶ Toca el acorde" })).toBeInTheDocument();
  });
});

describe("grades", () => {
  it("is offered to members and reachable", async () => {
    signedIn();
    api.grades.mockResolvedValue({ grades: [] });
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getByRole("button", { name: /Grades/ }));
    expect(await screen.findByRole("heading", { name: "Grades" })).toBeInTheDocument();
  });

  it("is not offered to a guest, who has no server to read progress from", async () => {
    localStorage.setItem("klaviearn.guest", "1");
    render(<App />);
    await homeHeading();
    expect(screen.queryByRole("button", { name: /Grades/ })).not.toBeInTheDocument();
  });

  it("comes back home", async () => {
    signedIn();
    api.grades.mockResolvedValue({ grades: [] });
    render(<App />);
    await homeHeading();
    await userEvent.click(screen.getByRole("button", { name: /Grades/ }));
    await screen.findByRole("heading", { name: "Grades" });
    await userEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(await homeHeading()).toBeInTheDocument();
  });
});
