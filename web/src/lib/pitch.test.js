import { startMicListener } from "./pitch.js";

const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;

/**
 * A microphone that "hears" a pure tone.
 *
 * The real graph is source -> gain -> analyser; only the analyser's buffer
 * matters here, so the fake writes a sine wave straight into it. `setTone`
 * changes what the next frame hears; amplitude 0 is silence.
 */
function fakeMic({ freq = 440, amplitude = 0.3 } = {}) {
  let current = { freq, amplitude };
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };

  navigator.mediaDevices = { getUserMedia: vi.fn(() => Promise.resolve(stream)) };

  const node = () => ({ connect: next => next ?? node(), disconnect() {} });
  const analyser = {
    ...node(),
    fftSize: FFT_SIZE,
    getFloatTimeDomainData(buf) {
      for (let i = 0; i < buf.length; i++) {
        buf[i] = current.amplitude * Math.sin((2 * Math.PI * current.freq * i) / SAMPLE_RATE);
      }
    },
  };
  const audioContext = {
    sampleRate: SAMPLE_RATE,
    createMediaStreamSource: () => node(),
    createGain: () => ({ ...node(), gain: { value: 1 } }),
    createAnalyser: () => analyser,
  };

  return {
    audioContext,
    track,
    setTone: (f, a = 0.3) => { current = { freq: f, amplitude: a }; },
    silence: () => { current = { freq: 0, amplitude: 0 }; },
  };
}

/** Advance N detection frames (the listener polls every 50ms). */
const frames = n => vi.advanceTimersByTime(50 * n);

async function listen(mic, opts = {}) {
  const onNote = vi.fn();
  const onHearing = vi.fn();
  const stop = await startMicListener({
    audioContext: mic.audioContext, onNote, onHearing, ...opts,
  });
  return { onNote, onHearing, stop };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  delete navigator.mediaDevices;
});

describe("starting up", () => {
  it("asks for a raw microphone stream", async () => {
    const mic = fakeMic();
    await listen(mic);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  });

  it("turns off the browser's audio processing, which mangles piano tone", async () => {
    const mic = fakeMic();
    await listen(mic);
    const { audio } = navigator.mediaDevices.getUserMedia.mock.calls[0][0];
    expect(audio.autoGainControl).toBe(false);
    expect(audio.noiseSuppression).toBe(false);
  });

  it("propagates a refused permission instead of failing silently", async () => {
    navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.reject(new Error("Permission denied"))),
    };
    await expect(startMicListener({ audioContext: {}, onNote: vi.fn() }))
      .rejects.toThrow("Permission denied");
  });
});

describe("hearing a note", () => {
  it("reports the pitch it is hearing every frame", async () => {
    const mic = fakeMic({ freq: 440 });
    const { onHearing } = await listen(mic);
    frames(1);
    expect(onHearing).toHaveBeenCalledWith(expect.objectContaining({ midi: 69 }));
  });

  it("accepts a note only once it has held steady", async () => {
    const mic = fakeMic({ freq: 440 });
    const { onNote } = await listen(mic);

    frames(2);
    expect(onNote).not.toHaveBeenCalled();
    frames(1);
    expect(onNote).toHaveBeenCalledExactlyOnceWith(69);
  });

  it.each([
    [261.63, 60],
    [440, 69],
    [523.25, 72],
    [329.63, 64],
  ])("maps %f Hz to MIDI %i", async (freq, midi) => {
    const mic = fakeMic({ freq });
    const { onNote } = await listen(mic);
    frames(3);
    expect(onNote).toHaveBeenCalledWith(midi);
  });

  it("tolerates a piano being slightly out of tune", async () => {
    const mic = fakeMic({ freq: 445 }); // ~20 cents sharp of A440
    const { onNote } = await listen(mic);
    frames(3);
    expect(onNote).toHaveBeenCalledWith(69);
  });

  it("does not re-fire while the same note rings on", async () => {
    const mic = fakeMic({ freq: 440 });
    const { onNote } = await listen(mic);
    frames(10);
    expect(onNote).toHaveBeenCalledTimes(1);
  });

  it("restarts the count when the pitch changes mid-note", async () => {
    const mic = fakeMic({ freq: 440 });
    const { onNote } = await listen(mic);
    frames(2);
    mic.setTone(261.63);
    frames(2);
    expect(onNote).not.toHaveBeenCalled();
    frames(1);
    expect(onNote).toHaveBeenCalledExactlyOnceWith(60);
  });

  it("accepts the same note again after a gap of silence", async () => {
    const mic = fakeMic({ freq: 440 });
    const { onNote } = await listen(mic);
    frames(3);
    expect(onNote).toHaveBeenCalledTimes(1);

    mic.silence();
    frames(6);          // more than the 4-frame silence threshold
    mic.setTone(440);
    frames(3);
    expect(onNote).toHaveBeenCalledTimes(2);
  });
});

describe("silence and quiet playing", () => {
  it("reports nothing when the room is quiet", async () => {
    const mic = fakeMic({ amplitude: 0 });
    const { onNote, onHearing } = await listen(mic);
    frames(5);
    expect(onNote).not.toHaveBeenCalled();
    expect(onHearing).toHaveBeenCalledWith(null);
  });

  it("says 'too quiet' rather than 'wrong note' for an audible but faint signal", async () => {
    // Between 35% of the floor and the floor itself.
    const mic = fakeMic({ freq: 440, amplitude: 0.003 });
    const { onNote, onHearing } = await listen(mic, { sensitivity: "high" });
    frames(3);
    expect(onHearing).toHaveBeenCalledWith({ tooQuiet: true });
    expect(onNote).not.toHaveBeenCalled();
  });

  it("hears a faint note on high sensitivity that low sensitivity misses", async () => {
    const quiet = 0.02; // rms ~0.014: above the high floor, below the low one

    const loudEnough = fakeMic({ freq: 440, amplitude: quiet });
    const high = await listen(loudEnough, { sensitivity: "high" });
    frames(3);
    expect(high.onNote).toHaveBeenCalledWith(69);
    high.stop();

    const tooQuiet = fakeMic({ freq: 440, amplitude: quiet });
    const low = await listen(tooQuiet, { sensitivity: "low" });
    frames(3);
    expect(low.onNote).not.toHaveBeenCalled();
  });

  it("falls back to high sensitivity for an unknown setting", async () => {
    const mic = fakeMic({ freq: 440, amplitude: 0.02 });
    const { onNote } = await listen(mic, { sensitivity: "nonsense" });
    frames(3);
    expect(onNote).toHaveBeenCalledWith(69);
  });
});

describe("stopping", () => {
  it("releases the microphone and stops polling", async () => {
    const mic = fakeMic({ freq: 440 });
    const { onNote, stop } = await listen(mic);

    stop();
    expect(mic.track.stop).toHaveBeenCalled();

    frames(20);
    expect(onNote).not.toHaveBeenCalled();
  });
});
