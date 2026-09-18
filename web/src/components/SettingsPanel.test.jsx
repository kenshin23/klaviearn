import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPanel from "./SettingsPanel.jsx";
import { DEFAULT_SETTINGS } from "../lib/storage.js";
import { setLocale } from "../lib/i18n.js";

const SETTINGS = { ...DEFAULT_SETTINGS, language: "en", noteNames: "letters" };

function show(over = {}) {
  const onChange = vi.fn();
  render(<SettingsPanel settings={{ ...SETTINGS, ...over }} onChange={onChange} />);
  return { onChange };
}

const select = name => screen.getByLabelText(new RegExp(name));

beforeEach(() => setLocale("en", "letters"));

describe("the knobs", () => {
  it("offers every display setting", () => {
    show();
    for (const label of [
      /Language/, /Note names/, /Training wheels/, /Strict octave/,
      /Microphone sensitivity/, /Staff size/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("shows the current value of each setting", () => {
    show({ scaffold: "colors", staffSize: "huge", micSensitivity: "low" });
    expect(select("Training wheels")).toHaveValue("colors");
    expect(select("Staff size")).toHaveValue("huge");
    expect(select("Microphone sensitivity")).toHaveValue("low");
  });

  it("offers all four training-wheel modes", () => {
    show();
    const values = [...select("Training wheels").options].map(o => o.value);
    expect(values).toEqual(["auto", "full", "colors", "plain"]);
  });

  it("passes a change up with the rest of the settings intact", async () => {
    const { onChange } = show();
    await userEvent.selectOptions(select("Staff size"), "huge");
    expect(onChange).toHaveBeenCalledWith({ ...SETTINGS, staffSize: "huge" });
  });

  it("toggles strict octave", async () => {
    const { onChange } = show({ strictOctave: false });
    await userEvent.click(select("Strict octave"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ strictOctave: true }));
  });
});

describe("language and note names", () => {
  it("switches Spanish to solfège by default", async () => {
    const { onChange } = show();
    await userEvent.selectOptions(select("Language"), "es");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ language: "es", noteNames: "solfege" }),
    );
  });

  it("switches English back to letters", async () => {
    const { onChange } = show({ language: "es", noteNames: "solfege" });
    await userEvent.selectOptions(select("Language"), "en");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en", noteNames: "letters" }),
    );
  });

  it("lets note names be overridden independently of the language", async () => {
    const { onChange } = show({ language: "es", noteNames: "solfege" });
    await userEvent.selectOptions(select("Note names"), "letters");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ language: "es", noteNames: "letters" }),
    );
  });

  it("translates its own labels", () => {
    setLocale("es", "solfege");
    show({ language: "es", noteNames: "solfege" });
    expect(screen.getByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ayudas visuales/)).toBeInTheDocument();
  });
});
