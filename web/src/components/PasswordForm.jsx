import { useState } from "react";
import { api } from "../lib/api.js";
import { t } from "../lib/i18n.js";

// Change-password form for logged-in users (shown under Settings).
export default function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState({ status: "idle" });

  async function submit(e) {
    e.preventDefault();
    setState({ status: "busy" });
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setState({ status: "done" });
    } catch (err) {
      setState({ status: "error", message: err.message });
    }
  }

  return (
    <form className="card auth-form" onSubmit={submit}>
      <h2>{t("Change password")}</h2>
      <label>
        {t("Current password")}
        <input
          type="password"
          value={current}
          onChange={e => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        {t("New password (at least 8 characters)")}
        <input
          type="password"
          value={next}
          onChange={e => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      {state.status === "error" && <p className="form-error" role="alert">{t(state.message)}</p>}
      {state.status === "done" && <p className="form-ok" role="status">{t("Password updated.")}</p>}
      <button className="btn primary" type="submit" disabled={state.status === "busy"}>
        {state.status === "busy" ? "…" : t("Change password")}
      </button>
    </form>
  );
}
