import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EarPrompt from "./EarPrompt.jsx";
import { setLocale } from "../lib/i18n.js";

beforeEach(() => setLocale("en", "letters"));

describe("the card an ear drill shows", () => {
  it("offers a replay, because the sound is the whole prompt", async () => {
    const onReplay = vi.fn();
    render(<EarPrompt beats={2} onReplay={onReplay} />);
    await userEvent.click(screen.getByRole("button", { name: "🔊 Play it again" }));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it("shows one dot per sound coming", () => {
    render(<EarPrompt beats={4} onReplay={vi.fn()} />);
    expect(document.querySelectorAll(".ear-beat")).toHaveLength(4);
  });

  it("shows no dots when there is nothing to count", () => {
    render(<EarPrompt beats={0} onReplay={vi.fn()} />);
    expect(document.querySelectorAll(".ear-beat")).toHaveLength(0);
  });

  it("says nothing a screen reader would read out as the answer", () => {
    render(<EarPrompt beats={3} onReplay={vi.fn()} />);
    // The glyph and the dots are decoration; only the button carries meaning.
    expect(document.querySelector(".ear-glyph")).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelector(".ear-beats")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("translates its replay button", () => {
    setLocale("es", "solfege");
    render(<EarPrompt beats={1} onReplay={vi.fn()} />);
    expect(screen.getByRole("button", { name: "🔊 Suena otra vez" })).toBeInTheDocument();
  });
});
