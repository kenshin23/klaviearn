import { useState } from "react";
import { api, setToken } from "../lib/api.js";
import { t } from "../lib/i18n.js";

export default function Auth({ onAuthed, onGuest }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fn = mode === "login" ? api.login : api.register;
      const res = await fn(email, password);
      setToken(res.token);
      onAuthed();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <header className="hero">
        <h1>
          Klavi<span className="accent">earn</span>
        </h1>
        <p className="tagline">{t("Sight reading, one giant note at a time.")}</p>
      </header>

      <form className="card auth-form" onSubmit={submit}>
        <h2>{mode === "login" ? t("Welcome back") : t("Create your account")}</h2>
        <label>
          {t("Email")}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          {t("Password")}
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "…" : mode === "login" ? t("Log in") : t("Sign up")}
        </button>
        <button
          type="button"
          className="btn quiet"
          onClick={() => { setMode(m => (m === "login" ? "register" : "login")); setError(null); }}
        >
          {mode === "login" ? t("New here? Create an account") : t("Have an account? Log in")}
        </button>
      </form>

      <button className="btn quiet" onClick={onGuest}>
        {t("Practice without an account (progress stays on this device)")}
      </button>
    </main>
  );
}
