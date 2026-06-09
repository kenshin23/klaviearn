// Web MIDI: calls onNote(midi) for every note-on; onDevices(names[]) as
// devices come and go. Returns a cleanup function. No-ops where Web MIDI
// doesn't exist (Safari, iOS) — the caller shows the right message.
export function startMidiListener({ onNote, onDevices }) {
  if (!navigator.requestMIDIAccess) {
    onDevices?.(null); // null = unsupported, [] = supported but nothing plugged in
    return () => {};
  }
  let access;
  const wire = () => {
    const names = [];
    for (const input of access.inputs.values()) {
      names.push(input.name);
      input.onmidimessage = msg => {
        const [status, note, velocity] = msg.data;
        if ((status & 0xf0) === 0x90 && velocity > 0) onNote(note);
      };
    }
    onDevices?.(names);
  };
  navigator.requestMIDIAccess().then(
    a => { access = a; access.onstatechange = wire; wire(); },
    () => onDevices?.(null),
  );
  return () => {
    if (!access) return;
    access.onstatechange = null;
    for (const input of access.inputs.values()) input.onmidimessage = null;
  };
}
