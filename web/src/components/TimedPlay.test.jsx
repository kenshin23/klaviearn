import { act, fireEvent, render, screen } from "@testing-library/react";
import TimedPlay, { BPM } from "./TimedPlay.jsx";
import { expectNotes, expectTaps } from "../lib/evaluator.js";
import { setLocale } from "../lib/i18n.js";

const SPB = (60 / BPM) * 1000; // one beat in ms
const COUNT_IN = 4;
const START_DELAY = 250; // the audio clock lead-in the component schedules

// The component reads performance.now() and schedules against it, so the two
// have to advance together or the timestamps it records are meaningless.
let now = 0;
const advance = ms => {
  now += ms;
  act(() => { vi.advanceTimersByTime(ms); });
};

function play(expected, props = {}) {
  const onAttempt = vi.fn();
  let record = null;
  render(
    <TimedPlay
      expected={expected}
      label="Test pattern"
      onAttempt={onAttempt}
      registerInput={fn => { record = fn; }}
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "▶ Count-in & play" }));
  advance(START_DELAY + COUNT_IN * SPB); // through the count-in
  return { onAttempt, record };
}

/** Play `midi` (or a bare tap) at a given beat of the take. */
function at(record, beat, midi, fromBeat) {
  advance((beat - fromBeat.value) * SPB);
  fromBeat.value = beat;
  record(midi);
}

beforeEach(() => {
  setLocale("en", "letters");
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("the take", () => {
  it("counts you in before it starts listening", () => {
    const expected = expectTaps(["q", "q", "q", "q"]);
    render(
      <TimedPlay expected={expected} label="x" onAttempt={vi.fn()} registerInput={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "▶ Count-in & play" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "▶ Count-in & play" }));
    expect(screen.getByRole("button", { name: "▶ Counting…" })).toBeDisabled();
    expect(document.querySelector(".count")).toBeInTheDocument();

    advance(START_DELAY + COUNT_IN * SPB);
    expect(document.querySelector(".count.go")).toBeInTheDocument();
  });

  it("shows the tempo it is running at", () => {
    render(<TimedPlay expected={[{ at: 0 }]} label="Four quarters" onAttempt={vi.fn()} registerInput={vi.fn()} />);
    expect(document.querySelector(".rhythm-meta").textContent).toContain("Four quarters");
    expect(document.querySelector(".rhythm-meta").textContent).toContain(`${BPM} bpm`);
  });

  it("scores a perfect take as a pass", () => {
    const expected = expectTaps(["q", "q", "q", "q"]);
    const { onAttempt, record } = play(expected);
    const beat = { value: 0 };
    for (const e of expected) at(record, e.at, undefined, beat);

    advance(SPB * 4 + 400); // run out the bar and the scoring tail
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ hit: true }));
    expect(document.querySelectorAll(".verdict.ok")).toHaveLength(4);
  });

  it("scores a silent take as a fail, every beat missed", () => {
    const expected = expectTaps(["q", "q", "q", "q"]);
    const { onAttempt } = play(expected);
    advance(SPB * 4 + 400);
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ hit: false }));
    expect(document.querySelectorAll(".verdict.missed")).toHaveLength(4);
  });

  it("reports taps nobody asked for", () => {
    const expected = expectTaps(["q", "q", "q", "q"]);
    const { record } = play(expected);
    const beat = { value: 0 };
    for (const e of expected) at(record, e.at, undefined, beat);
    at(record, 3.5, undefined, beat); // one extra

    advance(SPB * 4 + 400);
    expect(document.querySelector(".verdicts").textContent).toContain("+1 extra");
  });

  it("accepts a note played a little before the first beat", () => {
    // People anticipate; the component allows half a beat of lead-in. Driven
    // by stopping short of the end of the count-in rather than by rewinding.
    const expected = expectTaps(["q", "q", "q", "q"]);
    const onAttempt = vi.fn();
    let record = null;
    render(
      <TimedPlay expected={expected} label="x" onAttempt={onAttempt}
        registerInput={fn => { record = fn; }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "▶ Count-in & play" }));

    advance(START_DELAY + COUNT_IN * SPB - 0.1 * SPB);
    record();                 // a tenth of a beat early
    advance(0.1 * SPB);       // now on beat 0

    const beat = { value: 0 };
    for (const e of expected.slice(1)) at(record, e.at, undefined, beat);
    advance(SPB * 4 + 400);
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ hit: true }));
  });
});

describe("pitched takes", () => {
  it("passes a scale played in order", () => {
    const expected = expectNotes([60, 62, 64]);
    const { onAttempt, record } = play(expected);
    const beat = { value: 0 };
    for (const e of expected) at(record, e.at, e.midis[0], beat);

    advance(SPB * 4 + 400);
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ hit: true }));
    expect(document.querySelectorAll(".verdict.ok")).toHaveLength(3);
  });

  it("names the note you played instead of the one asked for", () => {
    const expected = expectNotes([60, 62, 64]);
    const { onAttempt, record } = play(expected);
    const beat = { value: 0 };
    at(record, 0, 60, beat);
    at(record, 1, 65, beat); // F instead of D
    at(record, 2, 64, beat);

    advance(SPB * 4 + 400);
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ hit: false }));
    expect(document.querySelector(".verdict.wrong").textContent).toBe("F4");
  });

  it("runs long enough for a pattern longer than a bar", () => {
    // A one-octave scale is 15 beats; the take must not stop after four.
    const expected = expectNotes([60, 62, 64, 65, 67, 69, 71, 72]);
    const { onAttempt, record } = play(expected);
    const beat = { value: 0 };
    for (const e of expected) at(record, e.at, e.midis[0], beat);

    advance(SPB * 4 + 400);
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ hit: true }));
  });
});

describe("the input surface", () => {
  it("offers a tap pad only when asked", () => {
    render(<TimedPlay expected={[{ at: 0 }]} label="x" onAttempt={vi.fn()} registerInput={vi.fn()} tapPad />);
    expect(screen.getByRole("button", { name: "Tap the rhythm here" })).toBeInTheDocument();
  });

  it("hides the tap pad for a pitched drill, where you play the piano", () => {
    render(<TimedPlay expected={expectNotes([60])} label="x" onAttempt={vi.fn()} registerInput={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Tap the rhythm here" })).not.toBeInTheDocument();
  });

  it("ignores input before the take has started", () => {
    let record = null;
    const onAttempt = vi.fn();
    render(
      <TimedPlay expected={[{ at: 0 }]} label="x" onAttempt={onAttempt}
        registerInput={fn => { record = fn; }} />,
    );
    expect(() => record(60)).not.toThrow();
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it("offers a preview that does not score anything", () => {
    const onAttempt = vi.fn();
    render(<TimedPlay expected={expectNotes([60])} label="x" onAttempt={onAttempt} registerInput={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "🔊 Hear it" }));
    advance(SPB * 10);
    expect(onAttempt).not.toHaveBeenCalled();
  });
});

describe("starting over", () => {
  it("clears the previous verdicts when the exercise changes", () => {
    const first = expectTaps(["q", "q", "q", "q"]);
    const { rerender } = render(
      <TimedPlay expected={first} label="x" onAttempt={vi.fn()} registerInput={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "▶ Count-in & play" }));
    advance(START_DELAY + COUNT_IN * SPB + SPB * 4 + 400);
    expect(document.querySelector(".verdicts")).toBeInTheDocument();

    rerender(<TimedPlay expected={expectTaps(["h", "h"])} label="x" onAttempt={vi.fn()} registerInput={vi.fn()} />);
    expect(document.querySelector(".verdicts")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "▶ Count-in & play" })).toBeEnabled();
  });

  it("lets you take it again after scoring", () => {
    const expected = expectTaps(["q", "q", "q", "q"]);
    const { onAttempt } = play(expected);
    advance(SPB * 4 + 400);
    expect(onAttempt).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "▶ Count-in & play" }));
    advance(START_DELAY + COUNT_IN * SPB + SPB * 4 + 400);
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });
});

describe("what the parent is told", () => {
  it("hands back the whole scored take, not just a pass or fail", () => {
    const expected = expectNotes([60, 62]);
    const { onAttempt, record } = play(expected);
    const beat = { value: 0 };
    at(record, 0, 60, beat);
    at(record, 1, 65, beat); // F instead of D

    advance(SPB * 3 + 400);
    const scored = onAttempt.mock.calls[0][0];
    expect(scored.hit).toBe(false);
    expect(scored.verdicts.map(v => v.verdict)).toEqual(["ok", "wrong"]);
    expect(scored.verdicts[1].played).toBe(65);
    expect(scored.extras).toBe(0);
  });
});
