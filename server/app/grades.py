"""Graded practice: a goal to aim a curriculum at.

A grade adds no machinery. It is a list of requirements, each naming SRS
items that already exist, and the readiness view is those items' recorded
state read back. The four parts of a piano exam are already the app's tracks,
so this populates what is there rather than building anything new.

Two things to be clear about, because they shape the data:

Levels here are GENERIC early-grade targets, not any exam board's syllabus.
Requirements — which scales, how many octaves, which hands — are facts and
perfectly encodable, but they change between syllabus cycles, so these are a
sensible starting shape to be corrected against whichever syllabus a learner
is actually working to. Nothing here claims alignment with, or endorsement
by, any exam board.

Set pieces are not shipped and cannot be: an exam board's editions carry
copyrighted fingering and editorial marks, and much of a modern list is in
copyright outright. The MusicXML importer is the route — a learner imports a
score they own, for their own practice, and the app distributes nothing. So
the piece requirements below name the app's own repertoire.
"""

# How well an item has to be known before a requirement counts as secure.
SECURE_LEVEL = 1        # at least one scaffold withdrawn
SECURE_ACCURACY = 0.8


def _scales(*keys, hands=("rh", "lh")):
    return [f"tech:scale:{k}:{h}" for k in keys for h in hands]


def _arpeggios(*keys, hands=("rh", "lh")):
    return [f"tech:arp:{k}:{h}" for k in keys for h in hands]


def _bars(piece_id, count):
    return [f"piece:{piece_id}:b{n}" for n in range(1, count + 1)]


GRADES = [
    {
        "id": "foundation",
        "title": "Foundation",
        "blurb": "Before grade one: five fingers, one key, and notes you can name on sight.",
        "sections": [
            {
                "name": "Technique",
                "requirements": [
                    {"label": "C position, both hands",
                     "items": ["tech:5finger:rh", "tech:5finger:lh"]},
                    {"label": "C major scale, hands separately",
                     "items": _scales("C")},
                ],
            },
            {
                "name": "Reading",
                "requirements": [
                    {"label": "Treble guide notes", "items": ["treble:60", "treble:67"]},
                    {"label": "Bass guide notes", "items": ["bass:53", "bass:60"]},
                    {"label": "Line or space", "items": ["treble:64", "treble:65"]},
                ],
            },
            {
                "name": "Rhythm",
                "requirements": [
                    {"label": "Quarters, halves and wholes",
                     "items": ["rhythm:r-quarters", "rhythm:r-halves", "rhythm:r-whole"]},
                ],
            },
            {
                "name": "Ear",
                "requirements": [
                    {"label": "Match a pitch you hear",
                     "items": ["ear:60", "ear:62", "ear:64", "ear:65", "ear:67"]},
                ],
            },
        ],
    },
    {
        "id": "grade-1",
        "title": "Grade 1",
        "blurb": "Five keys, both clefs, a piece with two hands, and an ear for the difference.",
        "sections": [
            {
                "name": "Scales and arpeggios",
                "requirements": [
                    {"label": "Scales: C, G, D, F major, hands separately",
                     "items": _scales("C", "G", "D", "F")},
                    {"label": "Scale: A harmonic minor, hands separately",
                     "items": _scales("Am")},
                    {"label": "Arpeggios: C, G, D, F major, hands separately",
                     "items": _arpeggios("C", "G", "D", "F")},
                    {"label": "Arpeggio: A minor, hands separately",
                     "items": _arpeggios("Am")},
                ],
            },
            {
                "name": "Pieces",
                "requirements": [
                    {"label": "Ode to Joy, hands together", "items": _bars("ode-to-joy", 8)},
                    {"label": "Mary Had a Little Lamb, hands together",
                     "items": _bars("mary-lamb", 8)},
                ],
            },
            {
                "name": "Sight-reading",
                "requirements": [
                    {"label": "The treble octave",
                     "items": [f"treble:{m}" for m in (60, 62, 64, 65, 67, 69, 71, 72)]},
                    {"label": "The bass octave",
                     "items": [f"bass:{m}" for m in (48, 50, 52, 53, 55, 57, 59, 60)]},
                    {"label": "Intervals by sight", "items": ["int:2", "int:3", "int:4", "int:5"]},
                    {"label": "Key signatures to one sharp or flat",
                     "items": ["key:C", "key:G", "key:F"]},
                ],
            },
            {
                "name": "Aural",
                "requirements": [
                    {"label": "Intervals by ear",
                     "items": ["ear:int:2", "ear:int:3", "ear:int:4", "ear:int:5"]},
                    {"label": "Major or minor",
                     "items": ["ear:qual:maj", "ear:qual:min"]},
                    {"label": "Play back a phrase",
                     "items": [f"ear:{m}" for m in (60, 62, 64, 65, 67, 69, 71, 72)]},
                ],
            },
        ],
    },
]

GRADE_BY_ID = {g["id"]: g for g in GRADES}


def requirement_items(grade: dict) -> list[str]:
    return [item for section in grade["sections"]
            for requirement in section["requirements"]
            for item in requirement["items"]]


def readiness(items: list[str], states: dict) -> dict:
    """How a requirement stands, from the SRS rows the learner already has.

    "working" rather than a percentage because the useful question is which
    requirement to practise next, not how close a number is to another number.
    """
    seen = [states[item] for item in items if item in states and states[item].seen > 0]
    if not seen:
        return {"status": "not started", "practised": 0, "of": len(items), "accuracy": None}

    accuracy = sum(s.correct for s in seen) / sum(s.seen for s in seen)
    secure = all(
        item in states
        and states[item].seen > 0
        and states[item].level >= SECURE_LEVEL
        and states[item].correct / states[item].seen >= SECURE_ACCURACY
        for item in items
    )
    return {
        "status": "secure" if secure else "working",
        "practised": len(seen),
        "of": len(items),
        "accuracy": accuracy,
    }
