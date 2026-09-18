// Web MIDI. Two channels out of the same stream:
//   onNote(midi)     — every note-on, immediately (reading drills; no added latency)
//   onChord(midis[]) — note-ons grouped by a short window, sorted and deduped
//                      (playing drills; a triad arrives as one event)
// onDevices(names[]) fires as devices come and go. Returns a cleanup function.
// No-ops where Web MIDI doesn't exist (Safari, iOS) — the caller shows the
// right message.

// Long enough that a hand landing on a chord reads as one gesture, short
// enough that a deliberately broken chord still reads as separate events.
const CHORD_WINDOW_MS = 60;

export function startMidiListener({ onNote, onChord, onDevices, chordWindowMs = CHORD_WINDOW_MS }) {
  if (!navigator.requestMIDIAccess) {
    onDevices?.(null); // null = unsupported, [] = supported but nothing plugged in
    return () => {};
  }
  let access;

  // Chord buffer: the first note-on opens a window; everything inside it
  // flushes together. A note held past the window is not re-sent — only
  // note-ons collect.
  let pending = [];
  let timer = null;
  const flush = () => {
    timer = null;
    const group = pending;
    pending = [];
    if (group.length) onChord?.([...new Set(group)].sort((a, b) => a - b));
  };
  const collect = midi => {
    pending.push(midi);
    timer ??= setTimeout(flush, chordWindowMs);
  };

  const wire = () => {
    const names = [];
    for (const input of access.inputs.values()) {
      names.push(input.name);
      input.onmidimessage = msg => {
        const [status, note, velocity] = msg.data;
        if ((status & 0xf0) === 0x90 && velocity > 0) {
          onNote?.(note);
          if (onChord) collect(note);
        }
      };
    }
    onDevices?.(names);
  };
  navigator.requestMIDIAccess().then(
    a => { access = a; access.onstatechange = wire; wire(); },
    () => onDevices?.(null),
  );
  return () => {
    clearTimeout(timer);
    timer = null;
    pending = [];
    if (!access) return;
    access.onstatechange = null;
    for (const input of access.inputs.values()) input.onmidimessage = null;
  };
}
