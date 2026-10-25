import { audioContext, click, perfTimeFor } from "./audio.js";
import { scoreCycle } from "./arpeggios.js";

const TICK_MS = 20;
const LOOKAHEAD_SECONDS = 0.1;
const MAX_LAG_SECONDS = 0.5;

export function createArpeggioClock({ exercise, bpm = 20, onCycle = () => undefined,
  onStep = () => {}, onPhase = () => {}, subdivisions = 4 }) {
  if (!exercise || !Array.isArray(exercise.midis) || exercise.midis.length < 2) {
    throw new TypeError("An arpeggio exercise with at least two notes is required");
  }
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError("bpm must be positive");
  if (!Number.isInteger(subdivisions) || subdivisions < 1) {
    throw new RangeError("subdivisions must be a positive integer");
  }
  let running = false, timer = null, ctx, generation = 0, pending = null;
  let anchorAudio, anchorPerf, playStart, cycleStart, duration, currentBpm;
  let countClick, subdivision, boundaryScheduled, lastUpdate, lastStep, lastPhase, lastCount;
  let played = [], upcoming = [];
  const tolerance = 0.35 / exercise.midis.length;
  const phase = (name, count) => {
    if (lastPhase === name && lastCount === count) return;
    lastPhase = name; lastCount = count; onPhase(name, count);
  };
  const step = index => {
    if (lastStep === index) return;
    lastStep = index; onStep(index);
  };
  function stop() {
    generation++;
    pending = null;
    if (timer !== null) clearInterval(timer);
    timer = null;
    const wasRunning = running;
    running = false;
    played = []; upcoming = [];
    if (wasRunning) { phase("idle"); step(-1); }
  }
  const healthy = () => {
    const now = performance.now();
    if (now - lastUpdate > MAX_LAG_SECONDS * 1000
      || Math.abs(ctx.currentTime - (anchorAudio + (now - anchorPerf) / 1000)) > MAX_LAG_SECONDS) {
      stop(); return false;
    }
    lastUpdate = now;
    return true;
  };
  const finishThrough = now => {
    while (running && now >= cycleStart + duration) {
      const boundary = cycleStart + duration;
      const result = scoreCycle(exercise, played.map(note => ({
        midi: note.midi, at: (note.at - cycleStart) / duration,
      })));
      const next = onCycle({ ...result, bpm: currentBpm });
      if (!running) return;
      if (Number.isFinite(next) && next > 0) currentBpm = next;
      cycleStart = boundary;
      duration = 60 / currentBpm;
      played = upcoming; upcoming = [];
      // The boundary itself is independent of the next tempo and may already
      // have been scheduled. Interior clicks wait for the scoring decision.
      subdivision = boundaryScheduled ? 1 : 0;
      boundaryScheduled = false;
    }
  };
  const schedule = now => {
    const end = now + LOOKAHEAD_SECONDS;
    const countDuration = playStart - anchorAudio;
    while (countClick < 4 && anchorAudio + countClick * countDuration / 4 < end) {
      click(anchorAudio + countClick * countDuration / 4, countClick === 0);
      countClick++;
    }
    while (subdivision < subdivisions && cycleStart + subdivision * duration / subdivisions < end) {
      click(cycleStart + subdivision * duration / subdivisions, subdivision === 0);
      subdivision++;
    }
    if (!boundaryScheduled && cycleStart + duration < end) {
      click(cycleStart + duration, true);
      boundaryScheduled = true;
    }
  };
  const update = () => {
    if (!running || !healthy()) return;
    const now = ctx.currentTime;
    finishThrough(now);
    if (!running) return;
    schedule(now);
    if (now < playStart) {
      phase("counting", Math.max(1, Math.min(4,
        Math.floor((now - anchorAudio) / ((playStart - anchorAudio) / 4)) + 1)));
      step(-1);
    } else {
      phase("playing");
      step(Math.min(exercise.midis.length - 1,
        Math.floor((now - cycleStart) / duration * exercise.midis.length)));
    }
  };
  function start() {
    if (pending) return pending;
    if (running) return Promise.resolve();
    const token = ++generation;
    ctx = audioContext();
    pending = (async () => {
      if (ctx.state === "suspended") await ctx.resume();
      if (token !== generation) return;
      if (ctx.state !== "running") throw new Error("Audio context did not start");
      anchorAudio = ctx.currentTime + 0.05;
      anchorPerf = perfTimeFor(ctx, anchorAudio);
      currentBpm = bpm; duration = 60 / bpm;
      playStart = anchorAudio + duration; cycleStart = playStart;
      countClick = 0; subdivision = 0; boundaryScheduled = false;
      played = []; upcoming = [];
      lastPhase = "idle"; lastCount = null; lastStep = null;
      running = true; lastUpdate = performance.now();
      timer = setInterval(update, TICK_MS);
      update();
    })().finally(() => { if (token === generation) pending = null; });
    return pending;
  }
  function record(midi, at = performance.now()) {
    if (!running || !Number.isFinite(midi) || !Number.isFinite(at) || !healthy()) return;
    const eventAudio = anchorAudio + (at - anchorPerf) / 1000;
    finishThrough(ctx.currentTime);
    if (!running) return;
    if (eventAudio < cycleStart - duration * tolerance) return;
    const boundary = cycleStart + duration;
    if (eventAudio >= boundary - duration * tolerance) {
      // Keep absolute onsets: promotion can change the upcoming cycle's
      // tolerance and normalization after this anticipatory attack arrives.
      if (eventAudio <= boundary + duration * tolerance) upcoming.push({ midi, at: eventAudio });
    } else {
      played.push({ midi, at: eventAudio });
    }
  }
  return { start, stop, record };
}
