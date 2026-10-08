"""SM-2-flavored spaced repetition plus scaffold fading.

Every first-try answer updates the item's schedule. Scaffold level rises
(fewer training wheels) after every 4 consecutive first-try hits, and drops
one level on a miss — per item, so a shaky note keeps its colors while a
solid one goes plain.
"""
import random
from datetime import timedelta

from sqlalchemy import select

from .content import NOTES, chord_spec, node_items
from .models import ItemSRS, utcnow
from .pieces import bar_tempo

SESSION_LENGTH = 10
PHRASE_COUNT = 5
PHRASE_NOTES = 4
TECHNIQUE_LENGTH = 4  # a scale is 15 notes; ten takes of one would be a chore
PIECE_LENGTH = 8      # bars per session — enough that a weak one recurs

# How many exercises a drill asks for when the caller does not say. The
# branches below all honour `length`; they used to hardcode these, which made
# an explicit length silently do nothing.
DRILL_LENGTHS = {
    "phrase": PHRASE_COUNT,
    "phrase-timed": PHRASE_COUNT,
    "ear-phrase": PHRASE_COUNT,
    "technique": TECHNIQUE_LENGTH,
    "key-name": SESSION_LENGTH,
    "piece-rh": PIECE_LENGTH,
    "piece-lh": PIECE_LENGTH,
    "piece-both": PIECE_LENGTH,
}
HITS_PER_LEVEL = 4
MAX_LEVEL = 2  # 0 letters+colors, 1 colors only, 2 plain notation


def get_or_create(db, user_id: int, item_key: str) -> ItemSRS:
    srs = db.scalar(
        select(ItemSRS).where(ItemSRS.user_id == user_id, ItemSRS.item_key == item_key)
    )
    if srs is None:
        # Explicit values: column defaults only apply at INSERT, and we
        # mutate this object before any flush happens.
        srs = ItemSRS(
            user_id=user_id, item_key=item_key,
            ease=2.5, interval_days=0.0, due_at=utcnow(),
            reps=0, lapses=0, streak=0, level=0, seen=0, correct=0,
        )
        db.add(srs)
    return srs


INTERVAL_CAP_DAYS = 30


def record_review(srs: ItemSRS, hits: list[bool]) -> None:
    """One session = one review per item, however often the item appeared.

    The schedule (ease/interval/due) moves once per review — applying SM-2
    per answer would compound the interval several times in one sitting.
    Accuracy counters and the scaffold streak still track every answer.
    """
    srs.seen += len(hits)
    srs.correct += sum(hits)
    if all(hits):
        srs.streak += sum(hits)
        srs.reps += 1
        if srs.reps == 1:
            srs.interval_days = 1
        elif srs.reps == 2:
            srs.interval_days = 3
        else:
            srs.interval_days = min(INTERVAL_CAP_DAYS, srs.interval_days * srs.ease)
        srs.ease = min(3.0, srs.ease + 0.05)
        srs.level = max(srs.level, min(MAX_LEVEL, srs.streak // HITS_PER_LEVEL))
    else:
        srs.streak = 0
        srs.reps = 0
        srs.lapses += hits.count(False)
        srs.interval_days = 0
        srs.ease = max(1.3, srs.ease - 0.2)
        srs.level = max(0, srs.level - 1)
    srs.due_at = utcnow() + timedelta(days=srs.interval_days)


def _weight(srs: ItemSRS | None, now) -> float:
    if srs is None or srs.seen == 0:
        return 2.5  # new notes get introduced eagerly
    miss_rate = 1 - srs.correct / srs.seen
    w = 1 + miss_rate * 3 - min(srs.streak, 5) * 0.15
    overdue_days = (now - srs.due_at).total_seconds() / 86400
    if overdue_days > 0:
        w += min(2.0, 0.5 + overdue_days * 0.5)  # due items push to the front
    return max(0.2, w)


def build_session(db, user_id: int, node: dict, drill: str, length: int | None = None):
    now = utcnow()
    if length is None:
        length = DRILL_LENGTHS.get(drill, SESSION_LENGTH)
    items = node_items(node)
    states = {
        s.item_key: s
        for s in db.scalars(
            select(ItemSRS).where(
                ItemSRS.user_id == user_id,
                ItemSRS.item_key.in_([k for k, _ in items]),
            )
        )
    }
    pool = [
        {
            "item": key,
            "meta": meta,
            "weight": _weight(states.get(key), now),
            "level": states[key].level if key in states else 0,
        }
        for key, meta in items
    ]

    def pick(prev):
        candidates = [c for c in pool if c["item"] != prev] if len(pool) > 1 else pool
        total = sum(c["weight"] for c in candidates)
        r = random.uniform(0, total)
        for c in candidates:
            r -= c["weight"]
            if r <= 0:
                return c
        return candidates[-1]

    if drill in ("interval", "ear-interval"):
        # Two notes on the treble staff; name the distance. The base note is
        # random so the answer is the shape, not a memorized picture.
        scale = sorted(NOTES["treble"].keys())
        exercises = []
        prev = None
        for _ in range(length):
            p = pick(prev)
            prev = p["item"]
            size = p["meta"]["size"]
            base = random.randint(0, len(scale) - size)
            pair = [
                {**NOTES["treble"][scale[base]], "clef": "treble"},
                {**NOTES["treble"][scale[base + size - 1]], "clef": "treble"},
            ]
            exercises.append(
                {"item": p["item"], "drill": drill, "level": p["level"],
                 "size": size, "name": p["meta"]["name"], "notes": pair,
                 "midis": [n["midi"] for n in pair]}
            )
        return exercises

    if drill.startswith("piece-"):
        # Bars are the items, so the weighting the SRS already does IS the
        # section looping: the bar you keep fumbling comes back on its own.
        # Tempo comes from the bar's own level — slow while it is new.
        from .pieces import PIECES

        exercises, prev = [], None
        for _ in range(length):
            p = pick(prev)
            prev = p["item"]
            exercises.append(
                {
                    "item": p["item"], "drill": drill, "level": p["level"],
                    "bpm": bar_tempo(PIECES[p["meta"]["piece"]], p["level"]),
                    **p["meta"],
                }
            )
        return exercises

    if drill == "technique":
        exercises, prev = [], None
        for _ in range(length):
            p = pick(prev)
            prev = p["item"]
            exercises.append(
                {"item": p["item"], "drill": drill, "level": p["level"], **p["meta"]}
            )
        return exercises

    if drill == "ear-chord":
        # A fresh root each time: the answer has to be the quality you hear,
        # not a chord you have memorised the pitch of.
        exercises, prev = [], None
        for _ in range(length):
            p = pick(prev)
            prev = p["item"]
            root = random.choice(node["roots"])
            exercises.append(
                {"item": p["item"], "drill": drill, "level": p["level"],
                 **chord_spec(root, p["meta"]["quality"])}
            )
        return exercises

    if drill in ("phrase", "ear-phrase", "phrase-timed"):
        # Micro sight-reading: 5 phrases of 4 notes, read left to right.
        exercises = []
        for _ in range(length):
            notes, prev = [], None
            for _ in range(PHRASE_NOTES):
                p = pick(prev)
                prev = p["item"]
                notes.append({"item": p["item"], "level": p["level"], **p["meta"]})
            exercises.append(
                {"drill": drill, "level": min(n["level"] for n in notes), "notes": notes,
                 "midis": [n["midi"] for n in notes]}
            )
        return exercises

    exercises, prev = [], None
    for _ in range(length):
        p = pick(prev)
        prev = p["item"]
        exercises.append({"item": p["item"], "drill": drill, "level": p["level"], **p["meta"]})
    return exercises
