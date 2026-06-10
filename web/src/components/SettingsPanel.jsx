import { t } from "../lib/i18n.js";

export default function SettingsPanel({ settings, onChange }) {
  const set = patch => onChange({ ...settings, ...patch });
  return (
    <section className="settings card" aria-label={t("Settings")}>
      <h2>{t("Settings")}</h2>
      <label className="toggle">
        {t("Language")}
        <select
          value={settings.language}
          onChange={e =>
            // Language implies a naming convention; the next control can
            // still override it (e.g. Spanish UI with letter names).
            set({
              language: e.target.value,
              noteNames: e.target.value === "es" ? "solfege" : "letters",
            })
          }
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </label>
      <label className="toggle">
        {t("Note names")}
        <select value={settings.noteNames} onChange={e => set({ noteNames: e.target.value })}>
          <option value="letters">{t("Letters (C D E)")}</option>
          <option value="solfege">{t("Solfège (Do Re Mi)")}</option>
        </select>
      </label>
      <label className="toggle">
        {t("Training wheels")}
        <select value={settings.scaffold} onChange={e => set({ scaffold: e.target.value })}>
          <option value="auto">{t("Auto — fade as I master each note")}</option>
          <option value="full">{t("Always: note names + colors")}</option>
          <option value="colors">{t("Colors only")}</option>
          <option value="plain">{t("Plain notation")}</option>
        </select>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.strictOctave}
          onChange={e => set({ strictOctave: e.target.checked })}
        />
        {t("Strict octave (piano input must match the exact octave)")}
      </label>
      <label className="toggle">
        {t("Staff size")}
        <select value={settings.staffSize} onChange={e => set({ staffSize: e.target.value })}>
          <option value="medium">{t("Medium")}</option>
          <option value="large">{t("Large")}</option>
          <option value="huge">{t("Huge")}</option>
        </select>
      </label>
    </section>
  );
}
