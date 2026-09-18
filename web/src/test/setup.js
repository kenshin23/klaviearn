import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// jsdom has no Web Audio, no Web MIDI, and no getUserMedia. Every drill in the
// app touches at least one of them, so stub them here rather than in each test.

class FakeAudioParam {
  constructor() { this.value = 0; }
  setValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
}

class FakeNode {
  constructor() {
    this.frequency = new FakeAudioParam();
    this.gain = new FakeAudioParam();
    this.type = "sine";
  }
  connect(next) { return next ?? this; }
  disconnect() {}
  start() {}
  stop() {}
}

export class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = new FakeNode();
    this.state = "running";
  }
  createOscillator() { return new FakeNode(); }
  createGain() { return new FakeNode(); }
  createAnalyser() {
    return Object.assign(new FakeNode(), {
      fftSize: 2048,
      getFloatTimeDomainData: buf => buf.fill(0),
    });
  }
  createMediaStreamSource() { return new FakeNode(); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

vi.stubGlobal("AudioContext", FakeAudioContext);
vi.stubGlobal("webkitAudioContext", FakeAudioContext);

// Not defined by default: absence is meaningful (it is what Safari/iOS looks
// like), so individual tests opt in by assigning navigator.requestMIDIAccess.
if (!("requestMIDIAccess" in navigator)) {
  Object.defineProperty(navigator, "requestMIDIAccess", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}
