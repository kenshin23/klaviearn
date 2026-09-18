"""The API surface: profile, settings, skill tree, sessions, and stats."""
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.content import NODE_BY_ID, SKILL_NODES, node_items
from app.models import Attempt, ItemSRS, SessionRecord, utcnow
from app.routes import DEFAULT_SETTINGS
from app.srs import SESSION_LENGTH


def items_of(node_id):
    return [key for key, _ in node_items(NODE_BY_ID[node_id])]


def start(client, node_id, drill):
    return client.post("/api/sessions", json={"node_id": node_id, "drill": drill})


def complete(client, node_id, drill, results):
    return client.post(
        "/api/sessions/complete",
        json={"node_id": node_id, "drill": drill, "results": results},
    )


# --- /me and settings --------------------------------------------------------

def test_me_reports_a_fresh_profile(auth_client):
    body = auth_client.get("/api/me").json()
    assert body["email"] == "pianist@example.com"
    assert body["xp"] == 0
    assert body["streakDays"] == 0
    assert body["settings"] == DEFAULT_SETTINGS


def test_settings_round_trip(auth_client):
    saved = {"scaffold": "colors", "strictOctave": True, "staffSize": "huge", "language": "es"}
    assert auth_client.put("/api/me/settings", json=saved).status_code == 200
    assert auth_client.get("/api/me").json()["settings"] == {**DEFAULT_SETTINGS, **saved}


def test_saved_settings_layer_over_the_defaults(auth_client):
    auth_client.put("/api/me/settings", json={"staffSize": "medium"})
    settings = auth_client.get("/api/me").json()["settings"]
    assert settings["staffSize"] == "medium"
    assert settings["scaffold"] == DEFAULT_SETTINGS["scaffold"]


def test_settings_are_per_user(client, auth_client):
    auth_client.put("/api/me/settings", json={"staffSize": "huge"})
    other = client.post(
        "/api/auth/register", json={"email": "other@example.com", "password": "another passphrase"}
    ).json()["token"]
    settings = client.get("/api/me", headers={"Authorization": f"Bearer {other}"}).json()["settings"]
    assert settings == DEFAULT_SETTINGS


# --- /tree -------------------------------------------------------------------

def test_tree_lists_every_node_with_progress_fields(auth_client):
    nodes = auth_client.get("/api/tree").json()["nodes"]
    assert [n["id"] for n in nodes] == [n["id"] for n in SKILL_NODES]
    for node in nodes:
        assert node["accuracy"] is None, "nothing practised yet"
        assert node["dueCount"] == 0
        assert node["mastery"] == 0
        assert node["title"] and node["blurb"]


def test_tree_reflects_practice(auth_client):
    keys = items_of("guide")
    complete(auth_client, "guide", "note", [{"item": k, "hit": True} for k in keys])

    node = next(n for n in auth_client.get("/api/tree").json()["nodes"] if n["id"] == "guide")
    assert node["accuracy"] == 1.0
    assert node["dueCount"] == 0, "just answered — scheduled a day out"


def test_tree_counts_items_that_have_come_due(auth_client, db, user_id):
    complete(auth_client, "guide", "note", [{"item": "treble:60", "hit": True}])
    srs_row = db.scalar(select(ItemSRS).where(ItemSRS.item_key == "treble:60"))
    srs_row.due_at = utcnow() - timedelta(days=2)
    db.commit()

    node = next(n for n in auth_client.get("/api/tree").json()["nodes"] if n["id"] == "guide")
    assert node["dueCount"] == 1


def test_tree_requires_authentication(client):
    assert client.get("/api/tree").status_code in (401, 403)


# --- Starting a session ------------------------------------------------------

@pytest.mark.parametrize(
    ("node_id", "drill"),
    [
        ("guide", "note"),
        ("octave", "linespace"),
        ("octave", "phrase"),
        ("bass-octave", "note"),
        ("rhythm-steady", "rhythm"),
        ("intervals", "interval"),
        ("grand", "note"),
        ("chords", "chord"),
    ],
)
def test_every_node_and_drill_pairing_builds_a_session(auth_client, node_id, drill):
    r = start(auth_client, node_id, drill)
    assert r.status_code == 200
    exercises = r.json()["exercises"]
    assert exercises
    valid = set(items_of(node_id))
    for ex in exercises:
        assert ex["drill"] == drill
        if drill == "phrase":
            assert all(n["item"] in valid for n in ex["notes"])
        else:
            assert ex["item"] in valid


def test_starting_an_unknown_node_is_a_404(auth_client):
    assert start(auth_client, "no-such-node", "note").status_code == 404


@pytest.mark.parametrize(
    ("node_id", "drill"),
    [("chords", "note"), ("octave", "chord"), ("intervals", "rhythm"), ("guide", "interval")],
)
def test_a_drill_that_does_not_fit_the_node_is_refused(auth_client, node_id, drill):
    assert start(auth_client, node_id, drill).status_code == 422


def test_starting_a_session_requires_authentication(client):
    assert start(client, "guide", "note").status_code in (401, 403)


# --- Completing a session ----------------------------------------------------

def test_a_perfect_session_earns_the_bonus(auth_client):
    results = [{"item": "treble:60", "hit": True} for _ in range(SESSION_LENGTH)]
    body = complete(auth_client, "guide", "note", results).json()
    assert body["xpGained"] == 10 * SESSION_LENGTH + 5
    assert body["xp"] == body["xpGained"]
    assert body["streakDays"] == 1


def test_an_imperfect_session_earns_no_bonus(auth_client):
    results = [{"item": "treble:60", "hit": True}, {"item": "treble:67", "hit": False}]
    assert complete(auth_client, "guide", "note", results).json()["xpGained"] == 10


def test_xp_accumulates_across_sessions(auth_client):
    complete(auth_client, "guide", "note", [{"item": "treble:60", "hit": True}])
    body = complete(auth_client, "guide", "note", [{"item": "treble:67", "hit": True}]).json()
    assert body["xp"] == 30  # two perfect one-answer sessions: (10 + 5) x 2


def test_completing_records_srs_state_and_an_attempt_log(auth_client, db):
    complete(
        auth_client, "guide", "note",
        [{"item": "treble:60", "hit": True}, {"item": "treble:67", "hit": False, "played": 65}],
    )
    rows = {r.item_key: r for r in db.scalars(select(ItemSRS))}
    assert rows["treble:60"].correct == 1 and rows["treble:60"].reps == 1
    assert rows["treble:67"].lapses == 1 and rows["treble:67"].reps == 0

    attempts = db.scalars(select(Attempt)).all()
    assert len(attempts) == 2
    assert {(a.item_key, a.hit, a.played) for a in attempts} == {
        ("treble:60", True, None),
        ("treble:67", False, 65),
    }


def test_repeats_of_one_item_are_a_single_review(auth_client, db):
    """A note seen three times in a session moves its schedule once."""
    results = [{"item": "treble:60", "hit": True} for _ in range(3)]
    complete(auth_client, "guide", "note", results)
    row = db.scalar(select(ItemSRS).where(ItemSRS.item_key == "treble:60"))
    assert row.reps == 1
    assert row.seen == 3


def test_completing_with_an_item_from_another_node_is_refused(auth_client):
    assert complete(auth_client, "guide", "note", [{"item": "bass:53", "hit": True}]).status_code == 422


def test_completing_with_no_results_is_refused(auth_client):
    assert complete(auth_client, "guide", "note", []).status_code == 422


def test_completing_with_too_many_results_is_refused(auth_client):
    results = [{"item": "treble:60", "hit": True} for _ in range(51)]
    assert complete(auth_client, "guide", "note", results).status_code == 422


def test_completing_an_unknown_node_is_a_404(auth_client):
    assert complete(auth_client, "nope", "note", [{"item": "treble:60", "hit": True}]).status_code == 404


@pytest.mark.parametrize("played", [-1, 128, 999])
def test_a_played_note_outside_the_midi_range_is_refused(auth_client, played):
    results = [{"item": "treble:60", "hit": False, "played": played}]
    assert complete(auth_client, "guide", "note", results).status_code == 422


def test_an_overlong_item_key_is_refused(auth_client):
    results = [{"item": "x" * 33, "hit": True}]
    assert complete(auth_client, "guide", "note", results).status_code == 422


# --- Day streaks -------------------------------------------------------------

def seed_sessions(db, user_id, days_ago):
    for day in days_ago:
        db.add(
            SessionRecord(
                user_id=user_id, node_id="guide", drill="note", ok=1, total=1, xp=10,
                finished_at=utcnow() - timedelta(days=day),
            )
        )
    db.commit()


def test_consecutive_days_build_a_streak(auth_client, db, user_id):
    seed_sessions(db, user_id, [0, 1, 2])
    assert auth_client.get("/api/me").json()["streakDays"] == 3


def test_a_gap_breaks_the_streak(auth_client, db, user_id):
    seed_sessions(db, user_id, [0, 1, 5, 6])
    assert auth_client.get("/api/me").json()["streakDays"] == 2


def test_a_streak_survives_one_missed_today(auth_client, db, user_id):
    """Practised yesterday but not yet today: the streak is still alive."""
    seed_sessions(db, user_id, [1, 2])
    assert auth_client.get("/api/me").json()["streakDays"] == 2


def test_an_old_streak_is_over(auth_client, db, user_id):
    seed_sessions(db, user_id, [4, 5, 6])
    assert auth_client.get("/api/me").json()["streakDays"] == 0


def test_two_sessions_in_one_day_count_once(auth_client, db, user_id):
    seed_sessions(db, user_id, [0, 0, 1])
    assert auth_client.get("/api/me").json()["streakDays"] == 2


# --- /stats ------------------------------------------------------------------

def test_stats_start_empty(auth_client):
    body = auth_client.get("/api/stats").json()
    assert body == {"items": [], "confusions": [], "sessionCount": 0, "xp": 0, "streakDays": 0}


def test_stats_report_per_item_accuracy(auth_client):
    complete(
        auth_client, "guide", "note",
        [{"item": "treble:60", "hit": True}, {"item": "treble:60", "hit": False, "played": 62}],
    )
    body = auth_client.get("/api/stats").json()
    item = next(i for i in body["items"] if i["item"] == "treble:60")
    assert (item["seen"], item["correct"]) == (2, 1)
    assert body["sessionCount"] == 1


def test_stats_build_a_confusion_matrix(auth_client):
    complete(
        auth_client, "guide", "note",
        [{"item": "treble:60", "hit": False, "played": 62} for _ in range(3)],
    )
    confusions = auth_client.get("/api/stats").json()["confusions"]
    assert {"item": "treble:60", "played": 62, "count": 3} in confusions


def test_confusions_ignore_correct_answers(auth_client):
    complete(auth_client, "guide", "note", [{"item": "treble:60", "hit": True}])
    assert auth_client.get("/api/stats").json()["confusions"] == []


def test_stats_are_per_user(auth_client, client):
    complete(auth_client, "guide", "note", [{"item": "treble:60", "hit": True}])
    other = client.post(
        "/api/auth/register", json={"email": "other@example.com", "password": "another passphrase"}
    ).json()["token"]
    body = client.get("/api/stats", headers={"Authorization": f"Bearer {other}"}).json()
    assert body["items"] == [] and body["xp"] == 0


# --- The chord track, end to end ---------------------------------------------

def test_a_chord_session_runs_from_start_to_stats(auth_client):
    exercises = start(auth_client, "chords", "chord").json()["exercises"]
    assert len(exercises) == SESSION_LENGTH

    results = [{"item": ex["item"], "hit": i > 0, "played": None if i else 65}
               for i, ex in enumerate(exercises)]
    reward = complete(auth_client, "chords", "chord", results).json()
    assert reward["xpGained"] == 10 * (SESSION_LENGTH - 1)

    stats = auth_client.get("/api/stats").json()
    assert all(i["item"].startswith("chord:") for i in stats["items"])
    assert stats["confusions"][0]["played"] == 65


def test_a_chord_with_an_accidental_survives_the_round_trip(auth_client):
    """Two of the eight triads need a black key; the draw is weighted-random,
    so keep drawing until one turns up rather than skipping on an unlucky one."""
    for _ in range(20):
        exercises = start(auth_client, "chords", "chord").json()["exercises"]
        sharps = [n for ex in exercises for n in ex["notes"] if n["acc"]]
        if sharps:
            break
    else:
        pytest.fail("20 sessions without a single accidental — the pool is wrong")
    assert all(n["acc"] == "#" and n["key"].count("#") == 1 for n in sharps)


# --- The ear track -----------------------------------------------------------

EAR_PAIRS = [
    ("ear-pitch", "ear-pitch"),
    ("ear-intervals", "ear-interval"),
    ("ear-chords", "ear-chord"),
    ("ear-phrases", "ear-phrase"),
]


@pytest.mark.parametrize(("node_id", "drill"), EAR_PAIRS)
def test_every_ear_node_builds_a_session(auth_client, node_id, drill):
    r = start(auth_client, node_id, drill)
    assert r.status_code == 200
    exercises = r.json()["exercises"]
    assert exercises
    valid = set(items_of(node_id))
    for ex in exercises:
        assert ex["drill"] == drill
        if drill == "ear-phrase":
            assert all(n["item"] in valid for n in ex["notes"])
        else:
            assert ex["item"] in valid


@pytest.mark.parametrize(("node_id", "drill"), EAR_PAIRS)
def test_ear_exercises_survive_json(auth_client, node_id, drill):
    """The audio payload is the exercise; it has to reach the browser intact."""
    for ex in start(auth_client, node_id, drill).json()["exercises"]:
        midis = ex.get("midis") or [ex["midi"]]
        assert all(isinstance(m, int) for m in midis)


@pytest.mark.parametrize(
    ("node_id", "drill"),
    [("ear-pitch", "note"), ("octave", "ear-pitch"), ("ear-chords", "chord"),
     ("chords", "ear-chord"), ("ear-intervals", "interval")],
)
def test_ear_drills_and_nodes_do_not_cross_wires(auth_client, node_id, drill):
    assert start(auth_client, node_id, drill).status_code == 422


def test_an_ear_session_records_progress(auth_client):
    exercises = start(auth_client, "ear-pitch", "ear-pitch").json()["exercises"]
    results = [{"item": ex["item"], "hit": True} for ex in exercises]
    assert complete(auth_client, "ear-pitch", "ear-pitch", results).json()["xpGained"] > 0

    items = auth_client.get("/api/stats").json()["items"]
    assert items and all(i["item"].startswith("ear:") for i in items)


def test_ear_and_reading_progress_are_scheduled_separately(auth_client, db):
    complete(auth_client, "octave", "note", [{"item": "treble:60", "hit": True}])
    complete(auth_client, "ear-pitch", "ear-pitch", [{"item": "ear:60", "hit": False}])

    rows = {r.item_key: r for r in db.scalars(select(ItemSRS))}
    assert rows["treble:60"].correct == 1
    assert rows["ear:60"].correct == 0
    assert rows["treble:60"].due_at > rows["ear:60"].due_at


def test_practising_by_ear_counts_toward_the_phrase_drill_too(auth_client, db):
    """They share an item, so evidence from one informs the other."""
    complete(auth_client, "ear-pitch", "ear-pitch", [{"item": "ear:60", "hit": True}])
    complete(auth_client, "ear-phrases", "ear-phrase", [{"item": "ear:60", "hit": True}])
    row = db.scalar(select(ItemSRS).where(ItemSRS.item_key == "ear:60"))
    assert row.seen == 2


def test_the_tree_shows_the_ear_nodes(auth_client):
    nodes = {n["id"]: n for n in auth_client.get("/api/tree").json()["nodes"]}
    for node_id, _ in EAR_PAIRS:
        assert node_id in nodes
        assert nodes[node_id]["title"] and nodes[node_id]["blurb"]
