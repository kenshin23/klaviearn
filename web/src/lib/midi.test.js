import { startMidiListener } from "./midi.js";

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

/** A stand-in for a connected USB piano. */
function fakeMidiAccess(deviceNames = ["Fake Piano"]) {
  const inputs = new Map(
    deviceNames.map((name, i) => [String(i), { name, onmidimessage: null }]),
  );
  const access = { inputs, onstatechange: null };
  navigator.requestMIDIAccess = vi.fn(() => Promise.resolve(access));
  return access;
}

const send = (input, note, { status = NOTE_ON, velocity = 100 } = {}) =>
  input.onmidimessage({ data: [status, note, velocity] });

/** Let the requestMIDIAccess promise settle so inputs are wired. */
const wired = () => Promise.resolve();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete navigator.requestMIDIAccess;
});

describe("when the browser has no Web MIDI (Safari, iOS)", () => {
  it("reports null devices rather than throwing", () => {
    navigator.requestMIDIAccess = undefined;
    const onDevices = vi.fn();
    const stop = startMidiListener({ onNote: vi.fn(), onDevices });
    expect(onDevices).toHaveBeenCalledWith(null);
    expect(() => stop()).not.toThrow();
  });

  it("distinguishes unsupported (null) from supported-but-empty ([])", async () => {
    fakeMidiAccess([]);
    const onDevices = vi.fn();
    startMidiListener({ onNote: vi.fn(), onDevices });
    await wired();
    expect(onDevices).toHaveBeenCalledWith([]);
  });

  it("reports null when access is refused", async () => {
    navigator.requestMIDIAccess = vi.fn(() => Promise.reject(new Error("denied")));
    const onDevices = vi.fn();
    startMidiListener({ onNote: vi.fn(), onDevices });
    await wired();
    expect(onDevices).toHaveBeenCalledWith(null);
  });
});

describe("single notes", () => {
  it("reports every note-on immediately", async () => {
    const access = fakeMidiAccess();
    const onNote = vi.fn();
    startMidiListener({ onNote });
    await wired();

    send(access.inputs.get("0"), 60);
    expect(onNote).toHaveBeenCalledWith(60);
  });

  it("names the connected devices", async () => {
    fakeMidiAccess(["Yamaha P-45", "Launchkey"]);
    const onDevices = vi.fn();
    startMidiListener({ onNote: vi.fn(), onDevices });
    await wired();
    expect(onDevices).toHaveBeenCalledWith(["Yamaha P-45", "Launchkey"]);
  });

  it("ignores note-offs", async () => {
    const access = fakeMidiAccess();
    const onNote = vi.fn();
    startMidiListener({ onNote });
    await wired();

    send(access.inputs.get("0"), 60, { status: NOTE_OFF });
    expect(onNote).not.toHaveBeenCalled();
  });

  it("ignores a note-on with zero velocity (a running-status note-off)", async () => {
    const access = fakeMidiAccess();
    const onNote = vi.fn();
    startMidiListener({ onNote });
    await wired();

    send(access.inputs.get("0"), 60, { velocity: 0 });
    expect(onNote).not.toHaveBeenCalled();
  });

  it("listens on every connected device", async () => {
    const access = fakeMidiAccess(["A", "B"]);
    const onNote = vi.fn();
    startMidiListener({ onNote });
    await wired();

    send(access.inputs.get("0"), 60);
    send(access.inputs.get("1"), 64);
    expect(onNote.mock.calls.flat()).toEqual([60, 64]);
  });
});

describe("chord buffering", () => {
  async function listen(opts = {}) {
    const access = fakeMidiAccess();
    const onChord = vi.fn();
    const onNote = vi.fn();
    const stop = startMidiListener({ onNote, onChord, ...opts });
    await wired();
    return { input: access.inputs.get("0"), onChord, onNote, stop };
  }

  it("groups notes struck together into one sorted chord", async () => {
    const { input, onChord } = await listen();

    send(input, 67);
    send(input, 60);
    send(input, 64);
    expect(onChord).not.toHaveBeenCalled(); // window still open

    vi.advanceTimersByTime(60);
    expect(onChord).toHaveBeenCalledTimes(1);
    expect(onChord).toHaveBeenCalledWith([60, 64, 67]);
  });

  it("keeps notes played further apart as separate events", async () => {
    const { input, onChord } = await listen();

    send(input, 60);
    vi.advanceTimersByTime(60);
    send(input, 64);
    vi.advanceTimersByTime(60);

    expect(onChord.mock.calls).toEqual([[[60]], [[64]]]);
  });

  it("splits a chord at the window boundary", async () => {
    const { input, onChord } = await listen();

    send(input, 60);
    vi.advanceTimersByTime(59);
    send(input, 64); // just inside
    vi.advanceTimersByTime(1);
    expect(onChord).toHaveBeenCalledWith([60, 64]);

    send(input, 67);
    vi.advanceTimersByTime(60);
    expect(onChord).toHaveBeenLastCalledWith([67]);
  });

  it("dedupes a note repeated inside the window", async () => {
    const { input, onChord } = await listen();

    send(input, 60);
    send(input, 60);
    send(input, 64);
    vi.advanceTimersByTime(60);

    expect(onChord).toHaveBeenCalledWith([60, 64]);
  });

  it("honours a custom window", async () => {
    const { input, onChord } = await listen({ chordWindowMs: 200 });

    send(input, 60);
    vi.advanceTimersByTime(100);
    send(input, 64);
    vi.advanceTimersByTime(100);

    expect(onChord).toHaveBeenCalledWith([60, 64]);
  });

  it("still reports each note immediately on the single-note channel", async () => {
    const { input, onNote } = await listen();

    send(input, 60);
    send(input, 64);
    expect(onNote.mock.calls.flat()).toEqual([60, 64]); // before any timer runs
  });

  it("buffers nothing when the caller wants no chords", async () => {
    const access = fakeMidiAccess();
    const onNote = vi.fn();
    startMidiListener({ onNote });
    await wired();

    send(access.inputs.get("0"), 60);
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    expect(onNote).toHaveBeenCalledWith(60);
  });
});

describe("cleanup", () => {
  it("detaches the message handlers", async () => {
    const access = fakeMidiAccess();
    const onNote = vi.fn();
    const stop = startMidiListener({ onNote });
    await wired();

    stop();
    expect(access.inputs.get("0").onmidimessage).toBeNull();
    expect(access.onstatechange).toBeNull();
  });

  it("does not deliver a chord buffered before it stopped", async () => {
    const access = fakeMidiAccess();
    const onChord = vi.fn();
    const stop = startMidiListener({ onNote: vi.fn(), onChord });
    await wired();

    send(access.inputs.get("0"), 60);
    stop();
    vi.advanceTimersByTime(200);

    expect(onChord).not.toHaveBeenCalled();
  });

  it("is safe to call before access resolves", async () => {
    fakeMidiAccess();
    const stop = startMidiListener({ onNote: vi.fn() });
    expect(() => stop()).not.toThrow();
    await wired();
  });
});

describe("device changes", () => {
  it("rewires when a piano is plugged in later", async () => {
    const access = fakeMidiAccess([]);
    const onNote = vi.fn();
    const onDevices = vi.fn();
    startMidiListener({ onNote, onDevices });
    await wired();

    access.inputs.set("late", { name: "Late Piano", onmidimessage: null });
    access.onstatechange();

    expect(onDevices).toHaveBeenLastCalledWith(["Late Piano"]);
    send(access.inputs.get("late"), 72);
    expect(onNote).toHaveBeenCalledWith(72);
  });
});
