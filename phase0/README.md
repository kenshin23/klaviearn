# Klaviearn — Phase 0 spike

One page, no backend: a giant note on a treble staff; play it on your piano.

## Run

```bash
python3 -m http.server 8000 --directory phase0
```

Then open **http://localhost:8000** in **Chrome** (Safari has no Web MIDI).
The mic needs `localhost` or HTTPS — `http.server` on localhost qualifies.
Works offline: VexFlow is vendored in this folder.

## Inputs (all active at once)

- **Microphone** — click *Start microphone*, allow access, play the travel
  piano. Single notes only; the "Hearing: …" readout shows live detection,
  which helps you find a good piano-to-mic distance/volume.
- **MIDI** — plug the P125 into the Mac via USB; it connects automatically
  (class-compliant, no driver).
- **Buttons / typing A–G** — quick sanity check on any device.

## Settings

- **Letter names / Note colors** — the scaffolds from DESIGN.md.
- **Strict octave** — off by default: any octave counts. Mic detection
  sometimes jumps an octave on the attack of a note, and octave errors are
  harmless with this off. Turn it on with MIDI for honest practice.

## Known spike limitations

- Mic: chords and very quiet playing won't detect; background noise can fool it.
- Note range is C4–C5 treble only (C4 gives you a taste of ledger lines).
- No persistence — the score resets on reload.
