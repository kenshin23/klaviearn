import { LETTER_COLORS, LETTER_TO_MIDI } from "../lib/notes.js";
import { noteLabel } from "../lib/i18n.js";

// Big colored note buttons — the universal answer fallback. Letters or
// solfège on the face; canonical letters underneath either way.
export default function Keys({ onAnswer, disabled }) {
  return (
    <div className="keys" role="group" aria-label="Answer with note names">
      {Object.keys(LETTER_TO_MIDI).map(letter => (
        <button
          key={letter}
          className="key"
          style={{ "--key-color": LETTER_COLORS[letter] }}
          disabled={disabled}
          onClick={() => onAnswer(LETTER_TO_MIDI[letter], { pitchClassOnly: true })}
        >
          {noteLabel(letter)}
        </button>
      ))}
    </div>
  );
}
