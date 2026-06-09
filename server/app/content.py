"""The curriculum as data: note metadata, rhythm patterns, and the skill tree.

Items are keyed "clef:midi" for notes (e.g. "treble:67") and "rhythm:<id>"
for rhythm patterns. Mirrored in web/src/lib/notes.js for guest mode.
"""

def _n(key, letter, midi, pos, pos_label):
    return {"key": key, "letter": letter, "midi": midi, "pos": pos, "posLabel": pos_label}


NOTES = {
    "treble": {
        60: _n("c/4", "C", 60, "line", "ledger line"),
        62: _n("d/4", "D", 62, "space", "space below the staff"),
        64: _n("e/4", "E", 64, "line", "bottom line"),
        65: _n("f/4", "F", 65, "space", "first space"),
        67: _n("g/4", "G", 67, "line", "second line"),
        69: _n("a/4", "A", 69, "space", "second space"),
        71: _n("b/4", "B", 71, "line", "middle line"),
        72: _n("c/5", "C", 72, "space", "third space"),
    },
    "bass": {
        48: _n("c/3", "C", 48, "space", "second space"),
        50: _n("d/3", "D", 50, "line", "middle line"),
        52: _n("e/3", "E", 52, "space", "third space"),
        53: _n("f/3", "F", 53, "line", "fourth line"),
        55: _n("g/3", "G", 55, "space", "top space"),
        57: _n("a/3", "A", 57, "line", "top line"),
        59: _n("b/3", "B", 59, "space", "space above the staff"),
        60: _n("c/4", "C", 60, "line", "ledger line above"),
    },
}

# One bar of 4/4 each. Durations use VexFlow codes; "qr"/"hr" are rests.
RHYTHM_PATTERNS = {
    "r-quarters":  {"name": "Four steady quarters",          "durations": ["q", "q", "q", "q"]},
    "r-half-2q":   {"name": "A half, then two quarters",     "durations": ["h", "q", "q"]},
    "r-2q-half":   {"name": "Two quarters, then a half",     "durations": ["q", "q", "h"]},
    "r-halves":    {"name": "Two halves",                    "durations": ["h", "h"]},
    "r-whole":     {"name": "One whole note",                "durations": ["w"]},
    "r-8ths-1":    {"name": "Eighth pairs, then quarters",   "durations": ["8", "8", "8", "8", "q", "q"]},
    "r-8ths-2":    {"name": "Eighths in the middle",         "durations": ["q", "8", "8", "q", "q"]},
    "r-8ths-3":    {"name": "Eighths on two and four",       "durations": ["q", "8", "8", "q", "8", "8"]},
    "r-rest-1":    {"name": "Rest on beat two",              "durations": ["q", "qr", "q", "q"]},
    "r-rest-2":    {"name": "Rest on beat three",            "durations": ["q", "q", "qr", "q"]},
    "r-rest-3":    {"name": "A half, a rest, a quarter",     "durations": ["h", "qr", "q"]},
}

SKILL_NODES = [
    {
        "id": "guide",
        "kind": "notes",
        "title": "Guide notes",
        "blurb": "C and G — your two anchors. Everything else is steps away from them.",
        "clef": "treble",
        "midis": [60, 67],
    },
    {
        "id": "steps",
        "kind": "notes",
        "title": "C up to G",
        "blurb": "Fill in the steps between the guide notes.",
        "clef": "treble",
        "midis": [60, 62, 64, 65, 67],
    },
    {
        "id": "octave",
        "kind": "notes",
        "title": "The full octave",
        "blurb": "C4 to C5 — including the ledger-line C.",
        "clef": "treble",
        "midis": [60, 62, 64, 65, 67, 69, 71, 72],
    },
    {
        "id": "bass-guide",
        "kind": "notes",
        "title": "Bass guide notes",
        "blurb": "F3 — the line the bass clef wraps around — and middle C above.",
        "clef": "bass",
        "midis": [53, 60],
    },
    {
        "id": "bass-steps",
        "kind": "notes",
        "title": "F up to middle C",
        "blurb": "Steps from the F-line up to middle C.",
        "clef": "bass",
        "midis": [53, 55, 57, 59, 60],
    },
    {
        "id": "bass-octave",
        "kind": "notes",
        "title": "The bass octave",
        "blurb": "C3 to middle C — the left hand's home turf.",
        "clef": "bass",
        "midis": [48, 50, 52, 53, 55, 57, 59, 60],
    },
    {
        "id": "rhythm-steady",
        "kind": "rhythm",
        "title": "Steady rhythms",
        "blurb": "Quarters, halves, and wholes — tap them against the metronome.",
        "patterns": ["r-quarters", "r-half-2q", "r-2q-half", "r-halves", "r-whole"],
    },
    {
        "id": "rhythm-eighths",
        "kind": "rhythm",
        "title": "Eighth notes",
        "blurb": "Two taps to a beat.",
        "patterns": ["r-8ths-1", "r-8ths-2", "r-8ths-3"],
    },
    {
        "id": "rhythm-rests",
        "kind": "rhythm",
        "title": "Rests",
        "blurb": "The notes you don't play matter too.",
        "patterns": ["r-rest-1", "r-rest-2", "r-rest-3"],
    },
]

NODE_BY_ID = {n["id"]: n for n in SKILL_NODES}


def item_key(clef: str, midi: int) -> str:
    return f"{clef}:{midi}"


def node_items(node):
    """[(item_key, exercise-metadata), ...] for one skill node."""
    if node.get("kind") == "rhythm":
        return [
            (
                f"rhythm:{pid}",
                {"name": RHYTHM_PATTERNS[pid]["name"], "durations": RHYTHM_PATTERNS[pid]["durations"]},
            )
            for pid in node["patterns"]
        ]
    out = []
    for midi in node["midis"]:
        meta = NOTES[node["clef"]][midi]
        out.append((item_key(node["clef"], midi), {**meta, "clef": node["clef"]}))
    return out
