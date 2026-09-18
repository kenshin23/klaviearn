import { t } from "../lib/i18n.js";

// What an ear drill shows instead of a staff: nothing to read.
//
// The card still needs to fill the space the notation would have, and to say
// plainly that listening is the task — so a large, high-contrast glyph and a
// replay button you cannot miss. The dots count the sounds coming, which
// tells you how much to hold on to without giving away what.
export default function EarPrompt({ beats, onReplay }) {
  return (
    <div className="ear-prompt">
      <span className="ear-glyph" aria-hidden="true">
        ♪
      </span>
      <div className="ear-beats" aria-hidden="true">
        {Array.from({ length: beats }, (_, i) => (
          <span key={i} className="ear-beat" />
        ))}
      </div>
      <button className="btn primary ear-replay" onClick={onReplay}>
        {t("🔊 Play it again")}
      </button>
    </div>
  );
}
