"""The curriculum as data: note metadata and the skill tree.

An "item" is one note on one staff, keyed "clef:midi" (e.g. "treble:67").
"""

def _n(key, letter, midi, pos, pos_label):
    return {"key": key, "letter": letter, "midi": midi, "pos": pos, "pos_label": pos_label}


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

SKILL_NODES = [
    {
        "id": "guide",
        "title": "Guide notes",
        "blurb": "C and G — your two anchors. Everything else is steps away from them.",
        "clef": "treble",
        "midis": [60, 67],
    },
    {
        "id": "steps",
        "title": "C up to G",
        "blurb": "Fill in the steps between the guide notes.",
        "clef": "treble",
        "midis": [60, 62, 64, 65, 67],
    },
    {
        "id": "octave",
        "title": "The full octave",
        "blurb": "C4 to C5 — including the ledger-line C.",
        "clef": "treble",
        "midis": [60, 62, 64, 65, 67, 69, 71, 72],
    },
    {
        "id": "bass-guide",
        "title": "Bass guide notes",
        "blurb": "F3 — the line the bass clef wraps around — and middle C above.",
        "clef": "bass",
        "midis": [53, 60],
    },
    {
        "id": "bass-steps",
        "title": "F up to middle C",
        "blurb": "Steps from the F-line up to middle C.",
        "clef": "bass",
        "midis": [53, 55, 57, 59, 60],
    },
    {
        "id": "bass-octave",
        "title": "The bass octave",
        "blurb": "C3 to middle C — the left hand's home turf.",
        "clef": "bass",
        "midis": [48, 50, 52, 53, 55, 57, 59, 60],
    },
]

NODE_BY_ID = {n["id"]: n for n in SKILL_NODES}


def item_key(clef: str, midi: int) -> str:
    return f"{clef}:{midi}"


def node_items(node):
    """[(item_key, note-metadata-with-clef), ...] for one skill node."""
    out = []
    for midi in node["midis"]:
        meta = NOTES[node["clef"]][midi]
        out.append((item_key(node["clef"], midi), {**meta, "clef": node["clef"]}))
    return out
