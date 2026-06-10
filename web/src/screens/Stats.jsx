import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { NOTES, RHYTHM_PATTERNS } from "../lib/notes.js";
import { noteLabel, noteName, posLabel, rhythmName, t } from "../lib/i18n.js";

function itemLabel(item) {
  if (item.startsWith("rhythm:")) {
    const name = RHYTHM_PATTERNS[item.slice(7)]?.name;
    return name ? rhythmName(name) : item;
  }
  if (item.startsWith("int:")) {
    const size = item.slice(4);
    return `${t("Interval:")} ${t({ 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" }[size] ?? size)}`;
  }
  const grand = item.startsWith("grand:");
  const [clef, midi] = (grand ? item.slice(6) : item).split(":");
  const meta = NOTES[clef]?.[midi];
  if (!meta) return item;
  return `${noteLabel(meta.letter)} — ${grand ? t("grand staff,") + " " : ""}${t(clef)} ${posLabel(meta.posLabel)}`;
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
        <button className="btn quiet" onClick={onHome}>{t("← Back")}</button>
        <h2 style={{ margin: 0 }}>{t("My stats")}</h2>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="status">…</p>}

      {data && (
        <>
          <p className="chips">
            <span className="chip">⭐ {data.xp} XP</span>
            <span className="chip">🔥 {data.streakDays}{t("-day streak")}</span>
            <span className="chip">{data.sessionCount} {t("sessions")}</span>
          </p>

          <section className="card stats-block">
            <h2>{t("Trouble spots")}</h2>
            {data.confusions.length === 0 ? (
              <p className="muted">{t("No wrong notes recorded yet. Either you're perfect, or it's early days.")}</p>
            ) : (
              <ul className="confusions">
                {data.confusions.map((c, i) => (
                  <li key={i}>
                    {t("Seeing")} <strong>{itemLabel(c.item)}</strong>, {t("you played")}{" "}
                    <strong>{noteName(c.played)}</strong>
                    <span className="count-badge">×{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card stats-block">
            <h2>{t("Every note you've met")}</h2>
            {data.items.length === 0 ? (
              <p className="muted">{t("Run a session first.")}</p>
            ) : (
              <ul className="item-bars">
                {data.items.map(it => {
                  const acc = it.seen ? Math.round((it.correct / it.seen) * 100) : 0;
                  return (
                    <li key={it.item}>
                      <span className="item-name">{itemLabel(it.item)}</span>
                      <span className="bar-track" aria-label={`${acc}%`}>
                        <span className="bar-fill" style={{ width: `${acc}%` }} />
                      </span>
                      <span className="item-acc">{acc}%</span>
                      <span className="item-level">{t(WHEELS[it.level])}</span>
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
