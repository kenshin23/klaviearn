import { LETTER_COLORS, LETTER_TO_MIDI } from "../lib/notes.js";

// Big colored letter buttons — the universal answer fallback.
export default function Keys({ onAnswer, disabled }) {
  return (
    <div className="keys" role="group" aria-label="Answer with note letters">
      {Object.keys(LETTER_TO_MIDI).map(letter => (
        <button
          key={letter}
          className="key"
          style={{ "--key-color": LETTER_COLORS[letter] }}
          disabled={disabled}
          onClick={() => onAnswer(LETTER_TO_MIDI[letter], { pitchClassOnly: true })}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}
