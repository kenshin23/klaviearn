"""Graded practice: a goal laid over the curriculum, adding no new state."""
import pytest

from app.content import SKILL_NODES, node_items
from app.grades import GRADE_BY_ID, GRADES, readiness, requirement_items
from app.models import ItemSRS, utcnow


def every_item_the_app_has():
    return {key for node in SKILL_NODES for key, _ in node_items(node)}


# --- The thing most likely to rot --------------------------------------------

def test_every_requirement_names_items_that_actually_exist():
    """A requirement pointing at a key nothing produces would read "not
    started" forever and nobody would ever find out."""
    known = every_item_the_app_has()
    missing = {
        item
        for grade in GRADES
        for item in requirement_items(grade)
        if item not in known
    }
    assert missing == set(), f"grades reference items the app never makes: {sorted(missing)}"


def test_no_requirement_is_empty():
    for grade in GRADES:
        for section in grade["sections"]:
            for requirement in section["requirements"]:
                assert requirement["items"], f"{grade['id']}: {requirement['label']}"
                assert requirement["label"]


def test_grade_ids_and_titles_are_unique():
    assert len({g["id"] for g in GRADES}) == len(GRADES)
    assert len({g["title"] for g in GRADES}) == len(GRADES)


def test_every_grade_has_sections_with_names():
    for grade in GRADES:
        assert grade["sections"], grade["id"]
        for section in grade["sections"]:
            assert section["name"] and section["requirements"]


def test_a_requirement_does_not_list_the_same_item_twice():
    for grade in GRADES:
        for section in grade["sections"]:
            for requirement in section["requirements"]:
                items = requirement["items"]
                assert len(set(items)) == len(items), requirement["label"]


def test_the_later_grade_asks_for_more():
    foundation = set(requirement_items(GRADE_BY_ID["foundation"]))
    grade_one = set(requirement_items(GRADE_BY_ID["grade-1"]))
    assert len(grade_one) > len(foundation)


def test_grade_one_reaches_every_track():
    """An exam tests reading, technique, ear and repertoire; so should this."""
    prefixes = {item.split(":")[0] for item in requirement_items(GRADE_BY_ID["grade-1"])}
    assert {"tech", "piece", "treble", "bass", "ear", "key", "int"} <= prefixes


# --- Readiness ---------------------------------------------------------------

def state(item, seen=0, correct=0, level=0):
    return ItemSRS(
        user_id=1, item_key=item, ease=2.5, interval_days=0.0, due_at=utcnow(),
        reps=0, lapses=0, streak=0, level=level, seen=seen, correct=correct,
    )


def test_an_untouched_requirement_has_not_started():
    assert readiness(["a", "b"], {}) == {
        "status": "not started", "practised": 0, "of": 2, "accuracy": None,
    }


def test_a_partly_practised_requirement_is_working():
    states = {"a": state("a", seen=10, correct=10, level=2)}
    result = readiness(["a", "b"], states)
    assert result["status"] == "working"
    assert result["practised"] == 1 and result["of"] == 2


def test_everything_practised_and_solid_is_secure():
    states = {k: state(k, seen=10, correct=10, level=2) for k in ("a", "b")}
    assert readiness(["a", "b"], states)["status"] == "secure"


def test_practised_but_inaccurate_is_still_working():
    states = {k: state(k, seen=10, correct=4, level=2) for k in ("a", "b")}
    assert readiness(["a", "b"], states)["status"] == "working"


def test_accurate_but_still_on_full_scaffolds_is_working():
    """Right every time with every training wheel on is not the same as
    knowing it."""
    states = {k: state(k, seen=10, correct=10, level=0) for k in ("a", "b")}
    assert readiness(["a", "b"], states)["status"] == "working"


def test_readiness_reports_accuracy_across_the_whole_requirement():
    states = {
        "a": state("a", seen=10, correct=10, level=2),
        "b": state("b", seen=10, correct=0, level=2),
    }
    assert readiness(["a", "b"], states)["accuracy"] == pytest.approx(0.5)


def test_a_row_that_exists_but_was_never_seen_does_not_count_as_practised():
    assert readiness(["a"], {"a": state("a")})["status"] == "not started"


# --- Through the API ---------------------------------------------------------

def test_the_endpoint_lists_every_grade(auth_client):
    body = auth_client.get("/api/grades").json()
    assert [g["id"] for g in body["grades"]] == [g["id"] for g in GRADES]


def test_everything_starts_not_started(auth_client):
    for grade in auth_client.get("/api/grades").json()["grades"]:
        for section in grade["sections"]:
            for requirement in section["requirements"]:
                assert requirement["status"] == "not started"
                assert requirement["of"] > 0


def test_practising_moves_a_requirement(auth_client):
    auth_client.post("/api/sessions/complete", json={
        "node_id": "guide", "drill": "note",
        "results": [{"item": "treble:60", "hit": True}],
    })
    grades = {g["id"]: g for g in auth_client.get("/api/grades").json()["grades"]}
    reading = next(s for s in grades["foundation"]["sections"] if s["name"] == "Reading")
    guide = next(r for r in reading["requirements"] if r["label"] == "Treble guide notes")
    assert guide["status"] == "working"
    assert guide["practised"] == 1 and guide["of"] == 2


def test_a_requirement_goes_secure_once_its_items_are(auth_client, db):
    from app import srs

    for item in ("tech:5finger:rh", "tech:5finger:lh"):
        row = srs.get_or_create(db, 1, item)
        for _ in range(srs.HITS_PER_LEVEL):
            srs.record_review(row, [True])
    db.commit()

    grades = {g["id"]: g for g in auth_client.get("/api/grades").json()["grades"]}
    technique = next(s for s in grades["foundation"]["sections"] if s["name"] == "Technique")
    position = next(r for r in technique["requirements"] if "C position" in r["label"])
    assert position["status"] == "secure"


def test_grades_are_per_user(auth_client, client):
    auth_client.post("/api/sessions/complete", json={
        "node_id": "guide", "drill": "note",
        "results": [{"item": "treble:60", "hit": True}],
    })
    other = client.post("/api/auth/register", json={
        "email": "other@example.com", "password": "another passphrase",
    }).json()["token"]
    body = client.get("/api/grades", headers={"Authorization": f"Bearer {other}"}).json()
    for grade in body["grades"]:
        for section in grade["sections"]:
            for requirement in section["requirements"]:
                assert requirement["status"] == "not started"


def test_grades_need_authentication(client):
    assert client.get("/api/grades").status_code in (401, 403)
