"""Authored repertoire.

A note range can express a drill but not a piece, so pieces are data rather
than generated: bars, two hands, fingering, a target tempo. This is the shape
`tools.import_musicxml` writes, so imported repertoire lands here looking the
same as the hand-authored kind.

A note is {midi, beats, finger}; a rest is {rest: True, beats}. Beats rather
than notation codes because the evaluator thinks in beats, and the renderer
can map back the other way.

Both pieces below sit inside one five-finger position in each hand (C4-G4
right, C3-G3 left), so the fingering is the honest position fingering the
technique track teaches rather than something invented to fit.

The left hands are simple beginner harmonisations, not transcriptions.
"""

# Fingering in C position: thumb on C in each hand.
_RH = {60: 1, 62: 2, 64: 3, 65: 4, 67: 5}
_LH = {48: 5, 50: 4, 52: 3, 53: 2, 55: 1}


def _rh(*pairs):
    """(midi, beats) pairs, fingered from the right-hand C position."""
    return [{"midi": m, "beats": b, "finger": _RH[m]} for m, b in pairs]


def _lh(*pairs):
    return [{"midi": m, "beats": b, "finger": _LH[m]} for m, b in pairs]


def _bar(rh, lh):
    return {"rh": rh, "lh": lh}


E, D, C, F, G = 64, 62, 60, 65, 67   # right hand, C4 octave
C3, G3 = 48, 55                       # left hand roots


PIECES = {
    "ode-to-joy": {
        "title": "Ode to Joy",
        "composer": "Beethoven",
        "key": "C major",
        "beatsPerBar": 4,
        "tempo": 96,
        "bars": [
            _bar(_rh((E, 1), (E, 1), (F, 1), (G, 1)), _lh((C3, 4))),
            _bar(_rh((G, 1), (F, 1), (E, 1), (D, 1)), _lh((G3, 4))),
            _bar(_rh((C, 1), (C, 1), (D, 1), (E, 1)), _lh((C3, 4))),
            _bar(_rh((E, 1.5), (D, 0.5), (D, 2)), _lh((G3, 4))),
            _bar(_rh((E, 1), (E, 1), (F, 1), (G, 1)), _lh((C3, 4))),
            _bar(_rh((G, 1), (F, 1), (E, 1), (D, 1)), _lh((G3, 4))),
            _bar(_rh((C, 1), (C, 1), (D, 1), (E, 1)), _lh((C3, 4))),
            _bar(_rh((D, 1.5), (C, 0.5), (C, 2)), _lh((C3, 4))),
        ],
    },
    "mary-lamb": {
        "title": "Mary Had a Little Lamb",
        "composer": "Traditional",
        "key": "C major",
        "beatsPerBar": 4,
        "tempo": 88,
        "bars": [
            _bar(_rh((E, 1), (D, 1), (C, 1), (D, 1)), _lh((C3, 4))),
            _bar(_rh((E, 1), (E, 1), (E, 2)), _lh((C3, 4))),
            _bar(_rh((D, 1), (D, 1), (D, 2)), _lh((G3, 4))),
            _bar(_rh((E, 1), (G, 1), (G, 2)), _lh((C3, 4))),
            _bar(_rh((E, 1), (D, 1), (C, 1), (D, 1)), _lh((C3, 4))),
            _bar(_rh((E, 1), (E, 1), (E, 1), (E, 1)), _lh((C3, 4))),
            _bar(_rh((D, 1), (D, 1), (E, 1), (D, 1)), _lh((G3, 4))),
            _bar(_rh((C, 4),), _lh((C3, 4))),
        ],
    },
}

HANDS = {"piece-rh": ("rh",), "piece-lh": ("lh",), "piece-both": ("rh", "lh")}

# How fast a bar is asked for depends on how well it is known — the same
# ladder the colours and the ear track use, spent on tempo. A bar you have
# never played comes at 60% of the piece's tempo; a mastered one comes at it.
TEMPO_STEPS = (0.6, 0.8, 1.0)
MIN_TEMPO = 50


def bar_key(piece_id: str, bar_number: int) -> str:
    """One SRS item per bar — the unit "which bar do I keep fumbling" needs."""
    return f"piece:{piece_id}:b{bar_number}"


def bar_tempo(piece: dict, level: int) -> int:
    step = TEMPO_STEPS[max(0, min(level, len(TEMPO_STEPS) - 1))]
    return max(MIN_TEMPO, round(piece["tempo"] * step))


def bar_beats(bar: dict, hand: str) -> float:
    return sum(note["beats"] for note in bar.get(hand, []))


def piece_items(piece_id: str):
    """[(item key, bar metadata), ...] — one entry per bar of the piece."""
    piece = PIECES[piece_id]
    return [
        (
            bar_key(piece_id, number),
            {
                "piece": piece_id,
                "title": piece["title"],
                "composer": piece["composer"],
                "bar": number,
                "bars": len(piece["bars"]),
                "beatsPerBar": piece["beatsPerBar"],
                "tempo": piece["tempo"],
                "rh": bar["rh"],
                "lh": bar["lh"],
            },
        )
        for number, bar in enumerate(piece["bars"], start=1)
    ]
