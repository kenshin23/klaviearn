import { useState } from "react";
import { SKILL_NODES } from "../lib/notes.js";
import { nodeAccuracy } from "../lib/storage.js";
import SettingsPanel from "../components/SettingsPanel.jsx";

export default function Home({ state, settings, onSettings, onStart }) {
  const [showSettings, setShowSettings] = useState(false);
  const sessionCount = state.sessions.length;

  return (
    <main className="screen">
      <header className="hero">
        <h1>
          Klavi<span className="accent">earn</span>
        </h1>
        <p className="tagline">Sight reading, one giant note at a time.</p>
        {sessionCount > 0 && (
          <p className="streak">{sessionCount} session{sessionCount === 1 ? "" : "s"} practiced</p>
        )}
      </header>

      <div className="nodes">
        {SKILL_NODES.map(node => {
          const acc = nodeAccuracy(state, node);
          return (
            <section className="card node" key={node.id}>
              <div className="node-head">
                <h2>{node.title}</h2>
                {acc !== null && (
                  <span className="acc" aria-label={`Accuracy ${Math.round(acc * 100)} percent`}>
                    {Math.round(acc * 100)}%
                  </span>
                )}
              </div>
              <p>{node.blurb}</p>
              <div className="row">
                <button className="btn primary" onClick={() => onStart(node, "note")}>
                  ▶ Read notes
                </button>
                <button className="btn" onClick={() => onStart(node, "linespace")}>
                  Line or space?
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <div className="row">
        <button className="btn quiet" onClick={() => setShowSettings(s => !s)}>
          ⚙ Settings
        </button>
      </div>
      {showSettings && <SettingsPanel settings={settings} onChange={onSettings} />}
    </main>
  );
}
