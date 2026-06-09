// Single-note pitch detection via autocorrelation. No dependencies.
// Good enough for one piano note at a time in a reasonably quiet room.

function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.012) return -1; // too quiet

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  buf = buf.slice(r1, r2);
  SIZE = buf.length;

  const c = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE - i; j++) c[i] += buf[j] * buf[j + i];

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  if (maxpos <= 0) return -1;

  let T0 = maxpos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  return sampleRate / T0;
}

// Starts the mic and calls onNote(midi) once per played note: a reading must
// be stable for 3 frames (~150 ms), and a decaying piano tone won't re-fire —
// the same pitch only triggers again after a moment of silence.
export async function startMicListener({ audioContext, onNote, onHearing }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const buf = new Float32Array(analyser.fftSize);
  let stable = null, count = 0, lastAccepted = null, silentFrames = 0;

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    const freq = autoCorrelate(buf, audioContext.sampleRate);
    if (freq < 0) {
      stable = null;
      count = 0;
      if (++silentFrames > 4) lastAccepted = null;
      onHearing?.(null);
      return;
    }
    silentFrames = 0;
    const midi = Math.round(69 + 12 * Math.log2(freq / 440));
    onHearing?.({ midi, freq });
    if (midi === stable) count++;
    else { stable = midi; count = 1; }
    if (count === 3 && midi !== lastAccepted) {
      lastAccepted = midi;
      onNote(midi);
    }
  }, 50);

  return () => {
    clearInterval(timer);
    stream.getTracks().forEach(t => t.stop());
  };
}
