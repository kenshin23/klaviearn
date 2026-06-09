import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { NOTES, RHYTHM_PATTERNS, noteName } from "../lib/notes.js";

function itemLabel(item) {
  if (item.startsWith("rhythm:")) {
    return RHYTHM_PATTERNS[item.slice(7)]?.name ?? item;
  }
  if (item.startsWith("int:")) {
    return `Interval: ${{ 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" }[item.slice(4)] ?? item.slice(4)}`;
  }
  const grand = item.startsWith("grand:");
  const [clef, midi] = (grand ? item.slice(6) : item).split(":");
  const meta = NOTES[clef]?.[midi];
  return meta ? `${meta.letter} — ${grand ? "grand staff, " : ""}${clef} ${meta.posLabel}` : item;
}

const WHEELS = ["letters + colors", "colors only", "plain notation"];

export default function Stats({ onHome }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.stats().then(setData).catch(e => setError(e.message));
  }, []);

  return (
    <main className="screen">
      <div className="session-top">
        <button className="btn quiet" onClick={onHome}>← Back</button>
        <h2 style={{ margin: 0 }}>My stats</h2>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="status">…</p>}

      {data && (
        <>
          <p className="chips">
            <span className="chip">⭐ {data.xp} XP</span>
            <span className="chip">🔥 {data.streakDays}-day streak</span>
            <span className="chip">{data.sessionCount} sessions</span>
          </p>

          <section className="card stats-block">
            <h2>Trouble spots</h2>
            {data.confusions.length === 0 ? (
              <p className="muted">No wrong notes recorded yet. Either you're perfect, or it's early days.</p>
            ) : (
              <ul className="confusions">
                {data.confusions.map((c, i) => (
                  <li key={i}>
                    Seeing <strong>{itemLabel(c.item)}</strong>, you played{" "}
                    <strong>{noteName(c.played)}</strong>
                    <span className="count-badge">×{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card stats-block">
            <h2>Every note you've met</h2>
            {data.items.length === 0 ? (
              <p className="muted">Run a session first.</p>
            ) : (
              <ul className="item-bars">
                {data.items.map(it => {
                  const acc = it.seen ? Math.round((it.correct / it.seen) * 100) : 0;
                  return (
                    <li key={it.item}>
                      <span className="item-name">{itemLabel(it.item)}</span>
                      <span className="bar-track" aria-label={`${acc} percent accurate over ${it.seen} answers`}>
                        <span className="bar-fill" style={{ width: `${acc}%` }} />
                      </span>
                      <span className="item-acc">{acc}%</span>
                      <span className="item-level">{WHEELS[it.level]}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
