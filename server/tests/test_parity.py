"""content.py and web/src/lib/notes.js must stay in step.

Guest mode builds sessions from the JS copy, logged-in mode from the Python
one. Both files say "mirrored in ..." in a comment; nothing enforced it until
this test. A drift here means a guest and an account holder practise different
curricula from the same-looking screen.
"""
import json
import os
import pathlib
import shutil
import subprocess

import pytest

from app.content import (
    NODE_BY_ID,
    NOTES,
    RHYTHM_PATTERNS,
    SKILL_NODES,
    TECHNIQUE_PATTERNS,
    chord_key,
    chord_spec,
    node_items,
    note_spec,
)
from app.grades import GRADES
from app.keys import KEYS
from app.pieces import PIECES, TEMPO_STEPS

WEB = pathlib.Path(__file__).resolve().parents[2] / "web"
NOTES_JS = WEB / "src" / "lib" / "notes.js"
I18N_JS = WEB / "src" / "lib" / "i18n.js"

# Enough MIDI numbers to cover naturals, sharps, and octave boundaries.
SPELLING_PROBES = [21, 48, 59, 60, 61, 62, 66, 67, 68, 71, 72, 76, 84, 108]

DUMP_JS = f"""
Promise.all([
  import(({json.dumps(str(NOTES_JS))})),
  import(({json.dumps(str(I18N_JS))})),
]).then(([m, i18n]) => {{
  const nodes = m.SKILL_NODES.map(n => ({{
    id: n.id, kind: n.kind ?? "notes", title: n.title, blurb: n.blurb,
    clef: n.clef ?? null, midis: n.midis ?? null, patterns: n.patterns ?? null,
    sizes: n.sizes ?? null, triads: n.triads ?? null, piece: n.piece ?? null,
    track: n.track ?? null,
    itemKeys: m.nodeItemKeys(n),
  }}));
  const probes = {json.dumps(SPELLING_PROBES)};
  console.log(JSON.stringify({{
    nodes,
    notes: m.NOTES,
    rhythms: m.RHYTHM_PATTERNS,
    spellings: Object.fromEntries(probes.map(x => [x, m.noteSpec(x)])),
    pieces: m.PIECES,
    keys: m.KEYS,
    gradeEs: i18n.GRADE_ES,
    requirementEs: i18n.REQUIREMENT_ES,
    technique: m.TECHNIQUE_PATTERNS,
    tempoSteps: m.TEMPO_STEPS,
    chords: Object.fromEntries(
      (m.SKILL_NODES.find(n => n.id === "chords")?.triads ?? []).map(
        ([root, q]) => [m.chordKey(root, q), m.chordSpec(root, q)]
      )
    ),
  }}));
}});
"""


def find_node() -> str | None:
    """Locate a node binary.

    `node` is often an nvm shell function rather than something on PATH, so
    which() alone finds nothing in a plain subprocess environment. Fall back to
    the nvm install tree, preferring the major version .nvmrc pins.
    """
    on_path = shutil.which("node")
    if on_path:
        return on_path

    nvm = pathlib.Path(os.environ.get("NVM_DIR") or (pathlib.Path.home() / ".nvm"))
    versions = sorted(
        (p for p in (nvm / "versions" / "node").glob("v*/bin/node") if os.access(p, os.X_OK)),
        key=lambda p: [int(x) for x in p.parents[1].name.lstrip("v").split(".")],
        reverse=True,
    )
    if not versions:
        return None

    nvmrc = (WEB.parent / ".nvmrc").read_text().strip() if (WEB.parent / ".nvmrc").exists() else ""
    if nvmrc:
        pinned = [p for p in versions if p.parents[1].name.lstrip("v").split(".")[0] == nvmrc]
        if pinned:
            return str(pinned[0])
    return str(versions[0])


@pytest.fixture(scope="module")
def js():
    node = find_node()
    if node is None:
        pytest.skip("no node binary found — cannot read the JS mirror")
    result = subprocess.run(
        [node, "--input-type=module", "-e", DUMP_JS],
        capture_output=True, text=True, cwd=WEB, timeout=60, check=False,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def py_nodes():
    return {n["id"]: n for n in SKILL_NODES}


# --- The skill tree ----------------------------------------------------------

def test_the_same_nodes_in_the_same_order(js):
    assert [n["id"] for n in js["nodes"]] == [n["id"] for n in SKILL_NODES]


def test_node_kinds_match(js):
    for node in js["nodes"]:
        assert node["kind"] == py_nodes()[node["id"]].get("kind", "notes")


def test_node_titles_and_blurbs_match(js):
    """These are the canonical English strings the i18n layer translates from."""
    for node in js["nodes"]:
        py = py_nodes()[node["id"]]
        assert node["title"] == py["title"], node["id"]
        assert node["blurb"] == py["blurb"], node["id"]


def test_node_contents_match(js):
    for node in js["nodes"]:
        py = py_nodes()[node["id"]]
        for field in ("clef", "midis", "patterns", "sizes", "piece"):
            if node[field] is not None or field in py:
                assert node[field] == py.get(field), f"{node['id']}.{field}"
        if node["triads"] is not None:
            assert [list(t) for t in py["triads"]] == [list(t) for t in node["triads"]]


def test_both_sides_generate_the_same_item_keys(js):
    """The SRS key is the join between guest progress and server progress."""
    for node in js["nodes"]:
        py_keys = [k for k, _ in node_items(py_nodes()[node["id"]])]
        assert node["itemKeys"] == py_keys, node["id"]


# --- Note and rhythm tables --------------------------------------------------

def test_the_note_tables_match(js):
    for clef, table in NOTES.items():
        js_table = js["notes"][clef]
        assert {int(k) for k in js_table} == set(table)
        for midi, meta in table.items():
            assert js_table[str(midi)] == meta, f"{clef}:{midi}"


def test_the_rhythm_patterns_match(js):
    assert set(js["rhythms"]) == set(RHYTHM_PATTERNS)
    for pid, pattern in RHYTHM_PATTERNS.items():
        assert js["rhythms"][pid]["name"] == pattern["name"]
        assert js["rhythms"][pid]["durations"] == pattern["durations"]


# --- Accidentals and chords --------------------------------------------------

@pytest.mark.parametrize("midi", SPELLING_PROBES)
def test_note_spelling_matches(js, midi):
    assert js["spellings"][str(midi)] == note_spec(midi)


def test_chord_specs_match(js):
    triads = py_nodes()["chords"]["triads"]
    assert set(js["chords"]) == {chord_key(root, q) for root, q in triads}
    for root, quality in triads:
        assert js["chords"][chord_key(root, quality)] == chord_spec(root, quality)


# --- Repertoire --------------------------------------------------------------
# Every note of every piece is transcribed by hand on both sides. This is the
# most drift-prone data in the app, and a divergence means a guest and an
# account holder practise different music under the same title.

def test_the_same_pieces(js):
    assert set(js["pieces"]) == set(PIECES)


def test_piece_headers_match(js):
    for piece_id, piece in PIECES.items():
        for field in ("title", "composer", "key", "beatsPerBar", "tempo"):
            assert js["pieces"][piece_id][field] == piece[field], f"{piece_id}.{field}"


def test_every_bar_of_every_piece_matches(js):
    for piece_id, piece in PIECES.items():
        js_bars = js["pieces"][piece_id]["bars"]
        assert len(js_bars) == len(piece["bars"]), piece_id
        for number, (js_bar, py_bar) in enumerate(zip(js_bars, piece["bars"], strict=True), 1):
            for hand in ("rh", "lh"):
                assert js_bar[hand] == py_bar[hand], f"{piece_id} bar {number} {hand}"


def test_the_tempo_ladder_matches(js):
    """Both sides decide how fast a bar is asked for; a drift would mean the
    same bar comes at two different tempos depending on whether you signed in."""
    assert js["tempoSteps"] == list(TEMPO_STEPS)


# --- Keys and technique ------------------------------------------------------
# Both are generated on both sides now rather than transcribed, which removes
# one kind of drift and introduces another: two generators that must agree.

def test_the_same_keys(js):
    assert set(js["keys"]) == set(KEYS)


def test_every_key_signature_matches(js):
    for key_id, key in KEYS.items():
        for field in ("name", "vex", "tonic", "mode", "sharps", "flats", "prefers"):
            assert js["keys"][key_id][field] == key[field], f"{key_id}.{field}"
        assert js["keys"][key_id]["signature"] == key["signature"], key_id


def test_the_same_technique_patterns(js):
    assert set(js["technique"]) == set(TECHNIQUE_PATTERNS)


def test_every_pattern_has_the_same_notes_and_fingering(js):
    """A fingering that differs by hand or by language is a fingering that
    teaches two different things."""
    for pid, pattern in TECHNIQUE_PATTERNS.items():
        for field in ("name", "hand", "clef", "key", "midis", "fingers"):
            assert js["technique"][pid][field] == pattern[field], f"{pid}.{field}"


def test_every_node_sits_on_the_same_track(js):
    for node in js["nodes"]:
        assert node["track"] == NODE_BY_ID[node["id"]]["track"], node["id"]


# --- Grades -------------------------------------------------------------------

def test_every_grade_is_translated(js):
    for grade in GRADES:
        assert grade["id"] in js["gradeEs"], grade["id"]
        assert js["gradeEs"][grade["id"]]["title"]
        assert js["gradeEs"][grade["id"]]["blurb"]


def test_every_requirement_label_is_translated(js):
    """A screen in two languages at once is worse than one in neither."""
    labels = {
        requirement["label"]
        for grade in GRADES
        for section in grade["sections"]
        for requirement in section["requirements"]
    }
    missing = labels - set(js["requirementEs"])
    assert missing == set(), f"requirements with no Spanish: {sorted(missing)}"


def test_no_stale_translations_left_behind(js):
    labels = {
        requirement["label"]
        for grade in GRADES
        for section in grade["sections"]
        for requirement in section["requirements"]
    }
    assert set(js["requirementEs"]) - labels == set()
