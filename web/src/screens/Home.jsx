import { useState } from "react";
import SettingsPanel from "../components/SettingsPanel.jsx";
import PasswordForm from "../components/PasswordForm.jsx";
import { nodeText, t, trackName } from "../lib/i18n.js";
import { TRACKS } from "../lib/notes.js";

// `nodes` carries optional server stats (accuracy, dueCount, mastery);
// guest mode passes the same shape with only accuracy filled in.
const DRILLS = {
  notes: [
    ["note", "▶ Read notes", "primary"],
    ["phrase", "Read phrases", ""],
    ["linespace", "Line or space?", ""],
    ["phrase-timed", "In time", ""],
  ],
  rhythm: [["rhythm", "▶ Tap the rhythm", "primary"]],
  intervals: [["interval", "▶ Name the interval", "primary"]],
  grand: [["note", "▶ Read notes", "primary"]],
  chords: [["chord", "▶ Play the chord", "primary"]],
  keys: [["key-name", "▶ Name the key", "primary"]],
  technique: [["technique", "▶ Play the pattern", "primary"]],
  piece: [
    ["piece-rh", "▶ Right hand", "primary"],
    ["piece-lh", "Left hand", ""],
    ["piece-both", "Hands together", ""],
  ],
  "ear-pitch": [["ear-pitch", "▶ Match the pitch", "primary"]],
  "ear-intervals": [["ear-interval", "▶ Name what you hear", "primary"]],
  "ear-chords": [["ear-chord", "▶ Major or minor?", "primary"]],
  "ear-phrases": [["ear-phrase", "▶ Play it back", "primary"]],
};

const ICONS = {
  rhythm: "𝅘𝅥𝅮 ", intervals: "⤢ ", chords: "🎹 ", technique: "✋ ",
  keys: "♯ ", piece: "🎼 ", grand: "𝄞𝄢 ",
  "ear-pitch": "👂 ", "ear-intervals": "👂 ", "ear-chords": "👂 ", "ear-phrases": "👂 ",
};

const iconFor = node => ICONS[node.kind] ?? (node.clef === "bass" ? "𝄢 " : "𝄞 ");

export default function Home({
  nodes, me, settings, onSettings, onStart, onStats, onGrades, onLogout, onSignup,
}) {
  const [showSettings, setShowSettings] = useState(false);

  // Twenty-two nodes in one list is a lot to scroll past to reach the one you
  // came for, so they sit under the five tracks the curriculum already has.
  // Which tracks are folded away is a display preference like any other, and
  // is kept with the rest of them.
  const collapsed = settings.collapsedTracks ?? [];
  // The updater form rather than a value: two toggles in one tick would both
  // read this render's `settings` and the second would undo the first.
  const toggleTrack = track =>
    onSettings(prev => {
      const folded = prev.collapsedTracks ?? [];
      return {
        ...prev,
        collapsedTracks: folded.includes(track)
          ? folded.filter(c => c !== track)
          : [...folded, track],
      };
    });

  const renderNode = node => (
    <section className="card node" key={node.id}>
      <div className="node-head">
        <h2>
          {iconFor(node)}
          {nodeText(node).title}
        </h2>
        <span className="node-stats">
          {node.dueCount > 0 && (
            <span className="due" aria-label={`${node.dueCount} ${t("due for review")}`}>
              {node.dueCount} {t(node.dueCount === 1 ? "due#one" : "due")}
            </span>
          )}
          {node.accuracy != null && (
            <span className="acc" aria-label={`Accuracy ${Math.round(node.accuracy * 100)} percent`}>
              {Math.round(node.accuracy * 100)}%
            </span>
          )}
        </span>
      </div>
      <p>{nodeText(node).blurb}</p>
      <div className="row">
        {DRILLS[node.kind ?? "notes"].map(([drill, label, cls]) => (
          <button key={drill} className={`btn ${cls}`} onClick={() => onStart(node, drill)}>
            {t(label)}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <main className="screen">
      <header className="hero">
        <h1>
          Klavi<span className="accent">earn</span>
        </h1>
        <p className="tagline">{t("Sight reading, one giant note at a time.")}</p>
        {me && (
          <p className="chips">
            <span className="chip">⭐ {me.xp} XP</span>
            <span className="chip">🔥 {me.streakDays}{t("-day streak")}</span>
          </p>
        )}
      </header>

      {TRACKS.map(([track, label]) => {
        const inTrack = nodes.filter(n => n.track === track);
        if (inTrack.length === 0) return null;
        const due = inTrack.reduce((sum, n) => sum + (n.dueCount ?? 0), 0);
        const folded = collapsed.includes(track);
        return (
          <section className="track" key={track}>
            <button
              className="track-head"
              onClick={() => toggleTrack(track)}
              aria-expanded={!folded}
            >
              <span className="track-name">{folded ? "▸" : "▾"} {trackName(label)}</span>
              <span className="track-stats">
                {due > 0 && (
                  <span className="due" aria-label={`${due} ${t("due for review")}`}>
                    {due} {t(due === 1 ? "due#one" : "due")}
                  </span>
                )}
                <span className="track-count">{inTrack.length}</span>
              </span>
            </button>
            {!folded && <div className="nodes">{inTrack.map(renderNode)}</div>}
          </section>
        );
      })}

      <div className="row">
        {onGrades && (
          <button className="btn quiet" onClick={onGrades}>{t("🎯 Grades")}</button>
        )}
        {onStats && (
          <button className="btn quiet" onClick={onStats}>{t("📊 My stats")}</button>
        )}
        <button className="btn quiet" onClick={() => setShowSettings(s => !s)}>
          {t("⚙ Settings")}
        </button>
        {onLogout && (
          <button className="btn quiet" onClick={onLogout}>{t("Log out")}</button>
        )}
        {onSignup && (
          <button className="btn quiet" onClick={onSignup}>
            {t("Create account to sync progress")}
          </button>
        )}
      </div>
      {showSettings && <SettingsPanel settings={settings} onChange={onSettings} />}
      {showSettings && onLogout && <PasswordForm />}
    </main>
  );
}
