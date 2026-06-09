export default function SettingsPanel({ settings, onChange }) {
  const set = patch => onChange({ ...settings, ...patch });
  return (
    <section className="settings card" aria-label="Settings">
      <h2>Settings</h2>
      <label className="toggle">
        Training wheels
        <select
          value={settings.scaffold}
          onChange={e => set({ scaffold: e.target.value })}
        >
          <option value="auto">Auto — fade as I master each note</option>
          <option value="full">Always: letters + colors</option>
          <option value="colors">Colors only</option>
          <option value="plain">Plain notation</option>
        </select>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.strictOctave}
          onChange={e => set({ strictOctave: e.target.checked })}
        />
        Strict octave (piano input must match the exact octave)
      </label>
      <label className="toggle">
        Staff size
        <select
          value={settings.staffSize}
          onChange={e => set({ staffSize: e.target.value })}
        >
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="huge">Huge</option>
        </select>
      </label>
    </section>
  );
}
