"""Spaced repetition: scheduling, scaffold fading, and session building."""
from datetime import timedelta

import pytest

from app import srs
from app.content import NODE_BY_ID, NOTES
from app.models import ItemSRS, utcnow


def make_item(**overrides) -> ItemSRS:
    """A freshly introduced item, matching get_or_create's explicit defaults."""
    defaults = {
        "user_id": 1, "item_key": "treble:60", "ease": 2.5, "interval_days": 0.0,
        "due_at": utcnow(), "reps": 0, "lapses": 0, "streak": 0,
        "level": 0, "seen": 0, "correct": 0,
    }
    return ItemSRS(**{**defaults, **overrides})


# --- record_review: the schedule ---------------------------------------------

def test_first_three_reviews_walk_the_fixed_ladder():
    item = make_item()
    srs.record_review(item, [True])
    assert (item.reps, item.interval_days) == (1, 1)
    srs.record_review(item, [True])
    assert (item.reps, item.interval_days) == (2, 3)
    srs.record_review(item, [True])
    # From the third review on, the interval multiplies by the current ease.
    assert item.reps == 3
    assert item.interval_days == pytest.approx(3 * 2.60)


def test_ease_creeps_up_on_success_and_is_capped():
    item = make_item(ease=2.98)
    srs.record_review(item, [True])
    assert item.ease == pytest.approx(3.0)
    srs.record_review(item, [True])
    assert item.ease == pytest.approx(3.0)  # capped, not 3.05


def test_ease_drops_on_a_miss_and_has_a_floor():
    item = make_item(ease=1.4)
    srs.record_review(item, [False])
    assert item.ease == pytest.approx(1.3)
    srs.record_review(item, [False])
    assert item.ease == pytest.approx(1.3)


def test_interval_is_capped():
    item = make_item(reps=9, interval_days=29.0, ease=3.0, streak=40)
    srs.record_review(item, [True])
    assert item.interval_days == srs.INTERVAL_CAP_DAYS


def test_a_miss_resets_the_schedule_and_makes_the_item_due_now():
    item = make_item(reps=5, interval_days=20.0, streak=9, level=2)
    before = utcnow()
    srs.record_review(item, [False])
    assert item.reps == 0
    assert item.interval_days == 0
    assert item.streak == 0
    assert item.lapses == 1
    assert item.due_at >= before


def test_due_date_follows_the_interval():
    item = make_item()
    srs.record_review(item, [True])
    assert item.due_at - utcnow() > timedelta(hours=23)


def test_one_review_moves_the_schedule_once_however_many_answers():
    """Four hits in a sitting is one review, not four — otherwise a single
    session would compound the interval to weeks."""
    many = make_item()
    srs.record_review(many, [True, True, True, True])
    once = make_item()
    srs.record_review(once, [True])
    assert many.interval_days == once.interval_days
    assert many.reps == once.reps == 1
    # ...but every answer still counts toward accuracy.
    assert (many.seen, many.correct) == (4, 4)
    assert (once.seen, once.correct) == (1, 1)


def test_a_mixed_sitting_counts_as_a_miss():
    item = make_item()
    srs.record_review(item, [True, False, True])
    assert item.seen == 3
    assert item.correct == 2
    assert item.lapses == 1
    assert item.streak == 0
    assert item.interval_days == 0


# --- record_review: scaffold fading ------------------------------------------

def test_the_pedagogical_constants_are_what_the_curriculum_assumes():
    """Literal values on purpose.

    Tests that derive their expectations from the constant they are checking
    cannot notice the constant changing — so pin the numbers here, and let a
    deliberate change to them be a visible one.
    """
    assert srs.HITS_PER_LEVEL == 4
    assert srs.MAX_LEVEL == 2, "L0 letters+colours, L1 colours, L2 plain"
    assert srs.SESSION_LENGTH == 10
    assert srs.PHRASE_COUNT == 5
    assert srs.PHRASE_NOTES == 4


def test_scaffolds_fade_after_four_consecutive_hits():
    item = make_item()
    for _ in range(3):
        srs.record_review(item, [True])
    assert item.level == 0, "still on full training wheels"
    srs.record_review(item, [True])  # the fourth
    assert item.level == 1, "colours only"
    for _ in range(4):
        srs.record_review(item, [True])
    assert item.level == 2, "plain notation after eight"


def test_scaffold_level_is_capped():
    item = make_item()
    for _ in range(40):
        srs.record_review(item, [True])
    assert item.level == 2


def test_a_miss_puts_one_training_wheel_back_on():
    item = make_item(level=2, streak=8)
    srs.record_review(item, [False])
    assert item.level == 1
    srs.record_review(item, [False])
    assert item.level == 0
    srs.record_review(item, [False])
    assert item.level == 0, "never below full scaffold"


def test_levels_do_not_go_backwards_on_a_win():
    item = make_item(level=2, streak=0)
    srs.record_review(item, [True])
    assert item.level == 2


# --- _weight: what a session picks -------------------------------------------

def test_unseen_items_are_introduced_eagerly():
    now = utcnow()
    assert srs._weight(None, now) == 2.5
    assert srs._weight(make_item(seen=0), now) == 2.5


def test_a_missed_item_outweighs_a_mastered_one():
    now = utcnow()
    shaky = make_item(seen=10, correct=2, streak=0, due_at=now)
    solid = make_item(seen=10, correct=10, streak=5, due_at=now)
    assert srs._weight(shaky, now) > srs._weight(solid, now)


def test_overdue_items_push_to_the_front():
    now = utcnow()
    base = {"seen": 10, "correct": 8, "streak": 2}
    fresh = make_item(**base, due_at=now + timedelta(days=1))
    overdue = make_item(**base, due_at=now - timedelta(days=5))
    assert srs._weight(overdue, now) > srs._weight(fresh, now)


def test_the_overdue_bonus_is_bounded():
    now = utcnow()
    base = {"seen": 10, "correct": 8, "streak": 2}
    late = srs._weight(make_item(**base, due_at=now - timedelta(days=5)), now)
    ancient = srs._weight(make_item(**base, due_at=now - timedelta(days=900)), now)
    assert ancient == late


def test_weight_never_reaches_zero():
    now = utcnow()
    perfect = make_item(seen=100, correct=100, streak=99, due_at=now + timedelta(days=30))
    assert srs._weight(perfect, now) >= 0.2


# --- build_session -----------------------------------------------------------

@pytest.mark.parametrize(
    ("node_id", "drill", "count"),
    [
        ("octave", "note", srs.SESSION_LENGTH),
        ("octave", "linespace", srs.SESSION_LENGTH),
        ("octave", "phrase", srs.PHRASE_COUNT),
        ("rhythm-eighths", "rhythm", srs.SESSION_LENGTH),
        ("intervals", "interval", srs.SESSION_LENGTH),
        ("grand", "note", srs.SESSION_LENGTH),
        ("chords", "chord", srs.SESSION_LENGTH),
    ],
)
def test_session_length_per_drill(db, user_id, node_id, drill, count):
    exercises = srs.build_session(db, user_id, NODE_BY_ID[node_id], drill)
    assert len(exercises) == count


def test_every_exercise_names_its_drill_and_item(db, user_id):
    for node_id, drill in [("octave", "note"), ("chords", "chord"), ("intervals", "interval")]:
        for ex in srs.build_session(db, user_id, NODE_BY_ID[node_id], drill):
            assert ex["drill"] == drill
            assert ex["item"]
            assert ex["level"] == 0


def test_the_same_item_never_appears_twice_in_a_row(db, user_id):
    exercises = srs.build_session(db, user_id, NODE_BY_ID["octave"], "note", length=40)
    items = [e["item"] for e in exercises]
    assert all(a != b for a, b in zip(items, items[1:], strict=False))


def test_chord_exercises_carry_a_playable_triad(db, user_id):
    for ex in srs.build_session(db, user_id, NODE_BY_ID["chords"], "chord"):
        assert len(ex["midis"]) == 3
        assert len(ex["notes"]) == 3
        assert ex["midis"] == sorted(ex["midis"]), "root position, low to high"
        assert ex["rootName"] and ex["quality"] in ("maj", "min")


def test_phrase_exercises_are_four_notes_with_no_immediate_repeats(db, user_id):
    for ex in srs.build_session(db, user_id, NODE_BY_ID["octave"], "phrase"):
        notes = ex["notes"]
        assert len(notes) == srs.PHRASE_NOTES
        assert all(a["item"] != b["item"] for a, b in zip(notes, notes[1:], strict=False))
        assert all(n["midi"] in NOTES["treble"] for n in notes)


def test_interval_exercises_span_the_named_distance(db, user_id):
    scale = sorted(NOTES["treble"])
    for ex in srs.build_session(db, user_id, NODE_BY_ID["intervals"], "interval"):
        low, high = (n["midi"] for n in ex["notes"])
        assert scale.index(high) - scale.index(low) == ex["size"] - 1
        assert low in scale and high in scale


def test_sessions_report_each_items_current_scaffold_level(db, user_id):
    mastered = srs.get_or_create(db, user_id, "treble:60")
    for _ in range(srs.HITS_PER_LEVEL):
        srs.record_review(mastered, [True])
    db.commit()

    exercises = srs.build_session(db, user_id, NODE_BY_ID["guide"], "note", length=30)
    levels = {e["item"]: e["level"] for e in exercises}
    assert levels["treble:60"] == 1, "mastered note has shed a scaffold"
    assert levels["treble:67"] == 0, "the other note keeps its training wheels"


def test_get_or_create_is_idempotent(db, user_id):
    first = srs.get_or_create(db, user_id, "treble:64")
    db.commit()
    second = srs.get_or_create(db, user_id, "treble:64")
    assert first is second
    assert second.ease == 2.5 and second.level == 0


# --- The ear track -----------------------------------------------------------

@pytest.mark.parametrize(
    ("node_id", "drill", "count"),
    [
        ("ear-pitch", "ear-pitch", srs.SESSION_LENGTH),
        ("ear-intervals", "ear-interval", srs.SESSION_LENGTH),
        ("ear-chords", "ear-chord", srs.SESSION_LENGTH),
        ("ear-phrases", "ear-phrase", srs.PHRASE_COUNT),
    ],
)
def test_ear_session_length(db, user_id, node_id, drill, count):
    assert len(srs.build_session(db, user_id, NODE_BY_ID[node_id], drill)) == count


def test_every_ear_exercise_carries_something_to_play(db, user_id):
    """These drills draw nothing, so the audio payload is the whole exercise."""
    for node_id, drill in [
        ("ear-pitch", "ear-pitch"),
        ("ear-intervals", "ear-interval"),
        ("ear-chords", "ear-chord"),
        ("ear-phrases", "ear-phrase"),
    ]:
        for ex in srs.build_session(db, user_id, NODE_BY_ID[node_id], drill):
            midis = ex["midis"] if "midis" in ex else [ex["midi"]]
            assert midis, f"{drill} has nothing to play"
            assert all(21 <= m <= 108 for m in midis), f"{drill} is off the keyboard"
            assert ex["drill"] == drill


def test_the_ear_interval_drill_reuses_the_reading_drills_shapes(db, user_id):
    scale = sorted(NOTES["treble"])
    for ex in srs.build_session(db, user_id, NODE_BY_ID["ear-intervals"], "ear-interval"):
        low, high = ex["midis"]
        assert scale.index(high) - scale.index(low) == ex["size"] - 1
        assert ex["item"] == f"ear:int:{ex['size']}"


def test_the_quality_drill_moves_the_root_around(db, user_id):
    """A fixed root would let you answer from absolute pitch, not from the third."""
    exercises = srs.build_session(db, user_id, NODE_BY_ID["ear-chords"], "ear-chord", length=60)
    assert len({ex["root"] for ex in exercises}) > 1
    for ex in exercises:
        assert ex["item"] == f"ear:qual:{ex['quality']}"
        assert len(ex["midis"]) == 3


def test_the_quality_drill_builds_the_triad_its_item_names(db, user_id):
    for ex in srs.build_session(db, user_id, NODE_BY_ID["ear-chords"], "ear-chord", length=30):
        root, third, fifth = ex["midis"]
        assert fifth - root == 7
        assert third - root == (4 if ex["quality"] == "maj" else 3)


def test_ear_phrases_are_four_notes_from_the_ear_pool(db, user_id):
    pool = {f"ear:{m}" for m in NODE_BY_ID["ear-phrases"]["midis"]}
    for ex in srs.build_session(db, user_id, NODE_BY_ID["ear-phrases"], "ear-phrase"):
        assert len(ex["notes"]) == srs.PHRASE_NOTES
        assert ex["midis"] == [n["midi"] for n in ex["notes"]]
        assert all(n["item"] in pool for n in ex["notes"])


def test_ear_exercises_report_their_scaffold_level(db, user_id):
    """Level drives how hard the drill is to LISTEN to, so it has to arrive.

    Every item is mastered rather than one, so the assertion does not depend
    on a weighted draw happening to include the one that was.
    """
    node = NODE_BY_ID["ear-pitch"]
    assert all(ex["level"] == 0 for ex in srs.build_session(db, user_id, node, "ear-pitch"))

    for midi in node["midis"]:
        item = srs.get_or_create(db, user_id, f"ear:{midi}")
        for _ in range(srs.HITS_PER_LEVEL):
            srs.record_review(item, [True])
    db.commit()

    exercises = srs.build_session(db, user_id, node, "ear-pitch", length=20)
    assert exercises
    assert all(ex["level"] == 1 for ex in exercises)
