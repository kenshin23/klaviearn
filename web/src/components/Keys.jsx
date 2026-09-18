import { LETTER_COLORS, LETTER_TO_MIDI, SHARP_TO_MIDI } from "../lib/notes.js";
import { noteLabel } from "../lib/i18n.js";

// Big colored note buttons — the universal answer fallback, and the only
// input on iOS. Letters or solfège on the face; canonical letters underneath
// either way.
//
// `accidentals` adds the five black keys. Off by default: the reading drills
// only ever ask for naturals, and five extra buttons is five more things to
// scan. The chord drill turns them on, because without them a chord with a
// sharp in it would be answerable on MIDI only.
export default function Keys({ onAnswer, disabled, accidentals = false }) {
  const key = (letter, midi, sharp) => (
    <button
      key={`${letter}${sharp ? "#" : ""}`}
      className={`key${sharp ? " sharp" : ""}`}
      style={{ "--key-color": LETTER_COLORS[letter] }}
      disabled={disabled}
      onClick={() => onAnswer(midi, { pitchClassOnly: true })}
    >
      {noteLabel(letter)}{sharp ? "♯" : ""}
    </button>
  );

  return (
    <div className="keys" role="group" aria-label="Answer with note names">
      {Object.entries(LETTER_TO_MIDI).map(([letter, midi]) => key(letter, midi, false))}
      {accidentals &&
        Object.entries(SHARP_TO_MIDI).map(([letter, midi]) => key(letter, midi, true))}
    </div>
  );
}
