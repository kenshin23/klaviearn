import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { gradeText, requirementLabel, t } from "../lib/i18n.js";

// What a grade's worth of requirements looks like against what you have
// actually practised.
//
// There is no new progress here: every line is SRS state the app already
// recorded, read back against a list. The useful question a learner asks of
// this screen is "what should I practise next", so a requirement reads as one
// of three words rather than a percentage to compare against another
// percentage.
const STATUS_LABEL = {
  "not started": "Not started",
  working: "Working on it",
  secure: "Secure",
};

function Requirement({ requirement }) {
  const { status, practised, of, accuracy } = requirement;
  return (
    <li className={`requirement ${status.replace(" ", "-")}`}>
      <span className="req-status" aria-hidden="true">
        {status === "secure" ? "✓" : status === "working" ? "◐" : "○"}
      </span>
      <span className="req-label">{requirementLabel(requirement.label)}</span>
      <span className="req-state">
        <span className="req-word">{t(STATUS_LABEL[status])}</span>
        {status !== "not started" && (
          <span className="req-detail">
            {practised}/{of}
            {accuracy != null && ` · ${Math.round(accuracy * 100)}%`}
          </span>
        )}
      </span>
    </li>
  );
}

export default function Grades({ onHome }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.grades().then(setData).catch(e => setError(e.message));
  }, []);

  return (
    <main className="screen">
      <div className="session-top">
        <button className="btn quiet" onClick={onHome}>{t("← Back")}</button>
        <h2 style={{ margin: 0 }}>{t("Grades")}</h2>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="status">…</p>}

      {data?.grades.map(grade => {
        const all = grade.sections.flatMap(s => s.requirements);
        const secure = all.filter(r => r.status === "secure").length;
        const text = gradeText(grade);
        return (
          <section className="card grade" key={grade.id}>
            <div className="node-head">
              <h2>{text.title}</h2>
              <span className="node-stats">
                <span className="acc" aria-label={`${secure} of ${all.length} secure`}>
                  {secure}/{all.length}
                </span>
              </span>
            </div>
            <p>{text.blurb}</p>

            {grade.sections.map(section => (
              <div className="grade-section" key={section.name}>
                <h3>{t(section.name)}</h3>
                <ul className="requirements">
                  {section.requirements.map(requirement => (
                    <Requirement key={requirement.label} requirement={requirement} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}

      {data && (
        <p className="muted grade-note">
          {t("Generic levels, not any exam board's syllabus — correct them against whichever one you are working to.")}
        </p>
      )}
    </main>
  );
}
