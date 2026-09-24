"""Turn a MusicXML file into the piece shape app/pieces.py holds.

A build-time tool, not a runtime path: repertoire is imported once, checked
over by a human, and pasted into pieces.py. It lives outside app/ for that
reason — the served application never parses XML, and never needs this
module or its dependency.

    python -m tools.import_musicxml minuet.musicxml --id minuet-g

Parsing is done with defusedxml. MusicXML comes from places like IMSLP and
MuseScore, so the input is untrusted, and the stdlib parser expands internal
entities (the "billion laughs" blow-up).

It reads the subset a beginner piano score actually uses: partwise scores,
measures, pitched notes and rests, durations via <divisions>, staff
assignment, dots, and fingering. Anything else — chords, multiple voices per
staff, ties, tuplets — is reported rather than guessed at, because a piece
that imports wrong is worse than one that does not import.
"""
import argparse
import json
import pathlib
import sys
from xml.etree import ElementTree as ET

from defusedxml import ElementTree as DefusedET

STEPS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


class Unsupported(Exception):
    """The file uses something this importer will not guess at."""


def _midi(pitch: ET.Element) -> int:
    step = pitch.findtext("step", "").strip().upper()
    if step not in STEPS:
        raise Unsupported(f"unknown pitch step {step!r}")
    octave = int(pitch.findtext("octave", "4"))
    alter = int(float(pitch.findtext("alter", "0") or 0))
    return (octave + 1) * 12 + STEPS[step] + alter


def _finger(note: ET.Element) -> int | None:
    text = note.findtext("notations/technical/fingering")
    if text is None:
        return None
    text = text.strip()
    return int(text) if text.isdigit() else None


def parse(xml: str, *, hands: tuple[str, str] = ("rh", "lh")) -> dict:
    """Parse a partwise MusicXML document into the internal piece shape."""
    root = DefusedET.fromstring(xml)
    if root.tag != "score-partwise":
        raise Unsupported(f"only score-partwise is supported, got {root.tag!r}")

    part = root.find("part")
    if part is None:
        raise Unsupported("no <part> in the score")

    divisions = None
    beats_per_bar = None
    beat_type = 4
    bars: list[dict] = []

    for measure in part.findall("measure"):
        attributes = measure.find("attributes")
        if attributes is not None:
            if (text := attributes.findtext("divisions")) is not None:
                divisions = int(text)
            time = attributes.find("time")
            if time is not None:
                beats_per_bar = int(time.findtext("beats", "4"))
                beat_type = int(time.findtext("beat-type", "4"))
        if divisions is None:
            raise Unsupported("the first measure must declare <divisions>")

        bar = {hand: [] for hand in hands}
        for note in measure.findall("note"):
            if note.find("chord") is not None:
                raise Unsupported(
                    f"measure {measure.get('number')}: chords are not supported — "
                    "write each voice out, or split the hands"
                )
            if note.find("tie") is not None or note.find("time-modification") is not None:
                raise Unsupported(
                    f"measure {measure.get('number')}: ties and tuplets are not supported"
                )

            duration = int(note.findtext("duration", "0"))
            # A beat is a quarter note in MusicXML's divisions, whatever the
            # time signature calls a beat.
            beats = duration / divisions
            staff = int(note.findtext("staff", "1"))
            if staff not in (1, 2):
                raise Unsupported(f"staff {staff} — only two staves are supported")
            hand = hands[staff - 1]

            if note.find("rest") is not None:
                bar[hand].append({"rest": True, "beats": beats})
                continue

            pitch = note.find("pitch")
            if pitch is None:
                raise Unsupported(f"measure {measure.get('number')}: a note with no pitch")
            entry = {"midi": _midi(pitch), "beats": beats}
            if (finger := _finger(note)) is not None:
                entry["finger"] = finger
            bar[hand].append(entry)

        bars.append(bar)

    if beats_per_bar is None:
        raise Unsupported("the score never declares a time signature")
    if beat_type != 4:
        raise Unsupported(f"only x/4 time signatures are supported, got {beats_per_bar}/{beat_type}")

    work = root.findtext("work/work-title") or root.findtext("movement-title") or "Untitled"
    composer = root.findtext("identification/creator[@type='composer']") or "Unknown"

    return {
        "title": work.strip(),
        "composer": composer.strip(),
        "key": "",
        "beatsPerBar": beats_per_bar,
        "tempo": 80,
        "bars": bars,
    }


def check(piece: dict) -> list[str]:
    """Everything an imported piece should satisfy before it is pasted in.

    Reported rather than raised: a human is reading this output, and knowing
    all four problems at once beats being told about them one run at a time.
    """
    problems = []
    for number, bar in enumerate(piece["bars"], start=1):
        for hand, notes in bar.items():
            if not notes:
                continue
            total = sum(n["beats"] for n in notes)
            if abs(total - piece["beatsPerBar"]) > 1e-6:
                problems.append(
                    f"bar {number} {hand}: {total} beats, expected {piece['beatsPerBar']}"
                )
            for note in notes:
                if not note.get("rest") and not 21 <= note["midi"] <= 108:
                    problems.append(f"bar {number} {hand}: midi {note['midi']} is off the keyboard")
                if "finger" not in note and not note.get("rest"):
                    problems.append(f"bar {number} {hand}: a note with no fingering")
    return problems


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("path", help="a .musicxml file")
    parser.add_argument("--id", dest="piece_id", help="the key to file it under in PIECES")
    parser.add_argument("--tempo", type=int, help="target tempo in bpm")
    args = parser.parse_args(argv)

    try:
        piece = parse(pathlib.Path(args.path).read_text(encoding="utf-8"))
    except (Unsupported, ET.ParseError) as err:
        print(f"cannot import {args.path}: {err}", file=sys.stderr)
        return 1

    if args.tempo:
        piece["tempo"] = args.tempo

    for problem in check(piece):
        print(f"warning: {problem}", file=sys.stderr)

    piece_id = args.piece_id or piece["title"].lower().replace(" ", "-")
    print(json.dumps({piece_id: piece}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
