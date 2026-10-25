import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArpeggioPractice from "./ArpeggioPractice.jsx";
import { makeArpeggio } from "../lib/arpeggios.js";
import { setLocale } from "../lib/i18n.js";

vi.mock("../components/TechniqueStaff.jsx", () => ({
  default: ({ activeIdx, showFingers, showColor }) => <div data-testid="staff" data-fingers={String(showFingers)} data-color={String(showColor)}>Active note {activeIdx}</div>,
}));
vi.mock("../lib/arpeggioClock.js", () => ({
  createArpeggioClock: vi.fn(options => ({ start: vi.fn().mockResolvedValue(undefined), stop: vi.fn(), record: vi.fn(), options })),
}));
vi.mock("../lib/midi.js", () => ({ startMidiListener: vi.fn(options => {
  globalThis.__midiOptions = options;
  options.onDevices?.(["Test keyboard"]);
  return vi.fn();
}) }));

const { createArpeggioClock } = await import("../lib/arpeggioClock.js");
const { startMidiListener } = await import("../lib/midi.js");

function Harness({ initial = {} }) {
  const [settings, setSettings] = useState(initial);
  return <ArpeggioPractice settings={settings} onSettings={setSettings} onHome={vi.fn()} />;
}

async function openSettings(user) {
  await user.click(screen.getByText("Settings"));
}

beforeEach(() => {
  setLocale("en", "letters");
  createArpeggioClock.mockClear();
  startMidiListener.mockClear();
  delete globalThis.__midiOptions;
});

describe("arpeggio practice screen", () => {
  it("shows the exact sequence and available MIDI keyboard", () => {
    render(<Harness />);
    expect(screen.getByText("Settings").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Note and finger sequence").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Arpeggio speed trainer" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Note and finger sequence"));
    const sequence = screen.getByRole("list", { name: "Note and finger sequence" });
    expect(sequence.children).toHaveLength(makeArpeggio().midis.length);
    expect([...sequence.children].map(item => item.querySelector("span").textContent)).toEqual([
      "Db2", "Ab2", "Db3", "F3", "Ab3", "Db4", "F4", "Ab4", "F4",
      "Db4", "Ab3", "F3", "Db3", "Ab2", "Db2",
    ]);
    expect(screen.getByText(/^MIDI devices: Test keyboard$/)).toHaveClass("arpeggio-midi");
    expect(startMidiListener).toHaveBeenCalledTimes(1);
  });

  it("starts on a user action, routes MIDI input to the clock, and stops on Home", async () => {
    const user = userEvent.setup();
    const onHome = vi.fn();
    render(<ArpeggioPractice settings={{}} onSettings={vi.fn()} onHome={onHome} />);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    expect(await screen.findByRole("button", { name: "Stop" })).toBeInTheDocument();
    const clock = createArpeggioClock.mock.results[0].value;
    globalThis.__midiOptions.onNote(37);
    expect(clock.record).toHaveBeenCalledWith(37);
    fireEvent.click(screen.getByRole("button", { name: "← Home" }));
    expect(clock.stop).toHaveBeenCalled();
    expect(onHome).toHaveBeenCalled();
  });

  it("defaults to a click for each note and persists the selected click mode", async () => {
    const user = userEvent.setup();
    const settings = { arpeggioPractice: { clickMode: "four" } };
    const onSettings = vi.fn(updater => updater(settings));
    const { rerender } = render(<ArpeggioPractice settings={settings} onSettings={onSettings} />);
    await openSettings(user);
    const selector = screen.getByLabelText("Click subdivision");
    expect(selector).toHaveValue("four");

    await user.selectOptions(selector, "notes");
    expect(onSettings.mock.results[0].value.arpeggioPractice.clickMode).toBe("notes");
    rerender(<ArpeggioPractice settings={onSettings.mock.results[0].value} onSettings={onSettings} />);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    expect(createArpeggioClock.mock.results[0].value.options.subdivisions).toBe(makeArpeggio().midis.length);
  });

  it.each([["four", 4], ["beat", 1]])("uses %s click mode at %i subdivisions", async (clickMode, subdivisions) => {
    const user = userEvent.setup();
    render(<Harness initial={{ arpeggioPractice: { clickMode } }} />);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    expect(createArpeggioClock.mock.results[0].value.options.subdivisions).toBe(subdivisions);
  });

  it("defaults missing or invalid click modes to each note", () => {
    const { rerender } = render(<ArpeggioPractice settings={{}} onSettings={vi.fn()} />);
    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByLabelText("Click subdivision")).toHaveValue("notes");
    rerender(<ArpeggioPractice settings={{ arpeggioPractice: { clickMode: "invalid" } }} onSettings={vi.fn()} />);
    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByLabelText("Click subdivision")).toHaveValue("notes");
  });

  it("starts with one click per note when no click mode is saved", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    expect(createArpeggioClock.mock.results[0].value.options.subdivisions).toBe(makeArpeggio().midis.length);
  });

  it("advances saved speed after clean cycles and persists only bpm and best speed", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ arpeggioPractice: { cleanTarget: 2 } }} />);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    const { options } = createArpeggioClock.mock.results[0].value;
    expect(options.bpm).toBe(20);
    options.onCycle({ hit: true, bpm: 20, verdicts: [], extras: 0 });
    await waitFor(() => expect(screen.getByText("1/2")).toBeInTheDocument());
    options.onCycle({ hit: true, bpm: 20, verdicts: [], extras: 0 });
    await waitFor(() => expect(screen.getByText("21 cycles/min")).toBeInTheDocument());
    expect(screen.getByText("0/2")).toBeInTheDocument();
    expect(screen.getByText("20 cycles/min")).toBeInTheDocument();
    expect(screen.getByText("Clean cycle. Keep going.")).toBeInTheDocument();
  });

  it("resets clean streak after a miss without changing best speed", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ arpeggioPractice: {
      cleanTarget: 3, progress: { "db-major-lh:2": { bpm: 30, bestBpm: 25 } },
    } }} />);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    const { options } = createArpeggioClock.mock.results[0].value;
    options.onCycle({ hit: true, bpm: 30, verdicts: [], extras: 0 });
    await waitFor(() => expect(screen.getByText("1/3")).toBeInTheDocument());
    options.onCycle({ hit: false, bpm: 30, verdicts: [{ verdict: "missed" }], extras: 0 });
    await waitFor(() => expect(screen.getByText("0/3")).toBeInTheDocument());
    expect(screen.getByText("25 cycles/min")).toBeInTheDocument();
    expect(screen.getByText("Some notes were missed. Try the cycle again.")).toBeInTheDocument();
  });

  it("shows a useful error if the audio clock cannot start", async () => {
    const user = userEvent.setup();
    createArpeggioClock.mockImplementationOnce(() => ({ start: vi.fn().mockRejectedValue(new Error("blocked")), stop: vi.fn() }));
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The audio clock could not start.");
    expect(screen.getByRole("button", { name: "Start practice" })).toBeInTheDocument();
  });

  it("writes config without mutating the settings input", async () => {
    const user = userEvent.setup();
    const settings = { unrelated: "kept", arpeggioPractice: { octave: 2 } };
    const onSettings = vi.fn(updater => updater(settings));
    render(<ArpeggioPractice settings={settings} onSettings={onSettings} />);
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText("Starting octave"), "3");
    expect(settings.arpeggioPractice.octave).toBe(2);
    expect(onSettings).toHaveBeenCalledWith(expect.any(Function));
    expect(onSettings.mock.results[0].value).toMatchObject({ unrelated: "kept", arpeggioPractice: { octave: 3 } });
  });
});


describe("arpeggio session controls", () => {
  it("edits bounded tempo while preserving best speed and other patterns", () => {
    const settings = { arpeggioPractice: { progress: {
      "db-major-lh:2": { bpm: 30, bestBpm: 45 }, other: { bpm: 60, bestBpm: 55 },
    } } };
    const onSettings = vi.fn(updater => updater(settings));
    render(<ArpeggioPractice settings={settings} onSettings={onSettings} />);
    fireEvent.click(screen.getByText("Settings"));
    const tempo = screen.getByLabelText("Starting speed (cycles/min)");
    fireEvent.change(tempo, { target: { value: "200" } });
    expect(onSettings.mock.results[0].value.arpeggioPractice.progress).toEqual({
      "db-major-lh:2": { bpm: 120, bestBpm: 45 }, other: { bpm: 60, bestBpm: 55 },
    });
    fireEvent.change(tempo, { target: { value: "1" } });
    expect(onSettings.mock.results[1].value.arpeggioPractice.progress["db-major-lh:2"].bpm).toBe(5);
  });

  it("counts consecutive callbacks before a render and reports accepted timing as clean", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openSettings(user);
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    const { options } = createArpeggioClock.mock.results[0].value;
    await act(async () => {
      for (let index = 0; index < 5; index++) {
        options.onCycle({ hit: true, bpm: 20, verdicts: [{ verdict: "early" }], extras: 0 });
      }
    });
    expect(screen.getByLabelText("Starting speed (cycles/min)")).toHaveValue(21);
    expect(screen.getByText("20 cycles/min")).toBeInTheDocument();
    expect(screen.getByText("0/5")).toBeInTheDocument();
    expect(screen.getByText("Clean cycle. Keep going.")).toBeInTheDocument();
  });

  it("requires a new full clean streak after stopping and restarting", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openSettings(user);
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    const first = createArpeggioClock.mock.results[0].value;
    await act(async () => {
      for (let index = 0; index < 4; index++) first.options.onCycle({ hit: true, bpm: 20 });
    });
    expect(screen.getByText("4/5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByText("0/5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    const second = createArpeggioClock.mock.results[1].value;
    await act(async () => {
      first.options.onCycle({ hit: true, bpm: 20 });
      second.options.onCycle({ hit: true, bpm: 20 });
    });
    expect(screen.getByText("1/5")).toBeInTheDocument();
    expect(screen.getByLabelText("Starting speed (cycles/min)")).toHaveValue(20);
  });

  it("locks a pending start and cancels it on Home without accepting late callbacks", async () => {
    let resume;
    const clock = { start: vi.fn(() => new Promise(resolve => { resume = resolve; })), stop: vi.fn() };
    createArpeggioClock.mockImplementationOnce(options => { clock.options = options; return clock; });
    const onHome = vi.fn();
    render(<ArpeggioPractice settings={{}} onSettings={vi.fn()} onHome={onHome} />);
    fireEvent.click(screen.getByText("Settings"));
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    expect(screen.getByLabelText("Starting speed (cycles/min)")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Start practice" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← Home" }));
    expect(clock.stop).toHaveBeenCalled();
    expect(onHome).toHaveBeenCalledOnce();
    await act(async () => { resume(); clock.options.onPhase("playing"); });
    expect(screen.getByRole("button", { name: "Start practice" })).toBeInTheDocument();
    expect(screen.getByText("Stopped")).toBeInTheDocument();
    expect(createArpeggioClock).toHaveBeenCalledOnce();
  });

  it("cancels pending audio start on unmount", async () => {
    let resume;
    const clock = { start: vi.fn(() => new Promise(resolve => { resume = resolve; })), stop: vi.fn() };
    createArpeggioClock.mockImplementationOnce(() => clock);
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    unmount();
    expect(clock.stop).toHaveBeenCalled();
    await act(async () => { resume(); });
    expect(clock.stop).toHaveBeenCalledTimes(2);
  });

  it("unlocks controls when the clock stops after lag", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openSettings(user);
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    const { options } = createArpeggioClock.mock.results[0].value;
    await act(async () => { options.onPhase("idle"); });
    expect(screen.getByRole("button", { name: "Start practice" })).toBeInTheDocument();
    expect(screen.getByLabelText("Starting speed (cycles/min)")).toBeEnabled();
    expect(screen.getByText("Stopped")).toBeInTheDocument();
  });
});


it.each([
  ["plain", false, false], ["colors", false, true], ["full", true, true], ["auto", true, true],
])("honors %s scaffold and requested staff size", (scaffold, fingers, color) => {
  render(<Harness initial={{ scaffold, staffSize: "huge" }} />);
  expect(screen.getByTestId("staff")).toHaveAttribute("data-fingers", String(fingers));
  expect(screen.getByTestId("staff")).toHaveAttribute("data-color", String(color));
  expect(screen.getByTestId("staff").parentElement).toHaveClass("staff-card", "size-huge");
  fireEvent.click(screen.getByText("Note and finger sequence"));
  const sequence = screen.getByRole("list", { name: "Note and finger sequence" });
  expect(sequence.children[0]).toHaveTextContent("Db2");
  expect(sequence.textContent.includes("finger")).toBe(fingers);
});
