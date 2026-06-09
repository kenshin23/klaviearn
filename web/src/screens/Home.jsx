import { useState } from "react";
import SettingsPanel from "../components/SettingsPanel.jsx";

// `nodes` carries optional server stats (accuracy, dueCount, mastery);
// guest mode passes the same shape with only accuracy filled in.
const DRILLS = {
  notes: [
    ["note", "▶ Read notes", "primary"],
    ["phrase", "Read phrases", ""],
    ["linespace", "Line or space?", ""],
  ],
  rhythm: [["rhythm", "▶ Tap the rhythm", "primary"]],
  intervals: [["interval", "▶ Name the interval", "primary"]],
  grand: [["note", "▶ Read notes", "primary"]],
};

export default function Home({ nodes, me, settings, onSettings, onStart, onStats, onLogout, onSignup }) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <main className="screen">
      <header className="hero">
        <h1>
          Klavi<span className="accent">earn</span>
        </h1>
        <p className="tagline">Sight reading, one giant note at a time.</p>
        {me && (
          <p className="chips">
            <span className="chip">⭐ {me.xp} XP</span>
            <span className="chip">🔥 {me.streakDays}-day streak</span>
          </p>
        )}
      </header>

      <div className="nodes">
        {nodes.map(node => (
          <section className="card node" key={node.id}>
            <div className="node-head">
              <h2>
                {node.kind === "rhythm" ? "𝅘𝅥𝅮 "
                  : node.kind === "intervals" ? "⤢ "
                  : node.kind === "grand" ? "𝄞𝄢 "
                  : node.clef === "bass" ? "𝄢 " : "𝄞 "}
                {node.title}
              </h2>
              <span className="node-stats">
                {node.dueCount > 0 && (
                  <span className="due" aria-label={`${node.dueCount} notes due for review`}>
                    {node.dueCount} due
                  </span>
                )}
                {node.accuracy != null && (
                  <span className="acc" aria-label={`Accuracy ${Math.round(node.accuracy * 100)} percent`}>
                    {Math.round(node.accuracy * 100)}%
                  </span>
                )}
              </span>
            </div>
            <p>{node.blurb}</p>
            <div className="row">
              {DRILLS[node.kind ?? "notes"].map(([drill, label, cls]) => (
                <button key={drill} className={`btn ${cls}`} onClick={() => onStart(node, drill)}>
                  {label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="row">
        {onStats && (
          <button className="btn quiet" onClick={onStats}>📊 My stats</button>
        )}
        <button className="btn quiet" onClick={() => setShowSettings(s => !s)}>
          ⚙ Settings
        </button>
        {onLogout && (
          <button className="btn quiet" onClick={onLogout}>Log out</button>
        )}
        {onSignup && (
          <button className="btn quiet" onClick={onSignup}>
            Create account to sync progress
          </button>
        )}
      </div>
      {showSettings && <SettingsPanel settings={settings} onChange={onSettings} />}
    </main>
  );
}
