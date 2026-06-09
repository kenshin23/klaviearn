import { midiToFreq } from "./notes.js";

let actx;
export const audioContext = () =>
  (actx ??= new (window.AudioContext || window.webkitAudioContext)());

export function tone(freq, dur, type = "triangle", when = 0, vol = 0.25) {
  const ctx = audioContext();
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const chimeCorrect = () => {
  tone(1046.5, 0.15, "sine");
  tone(1318.5, 0.25, "sine", 0.12);
};
export const chimeWrong = () => tone(110, 0.3, "square", 0, 0.12);
export const playMidi = m => tone(midiToFreq(m), 0.9, "triangle");
