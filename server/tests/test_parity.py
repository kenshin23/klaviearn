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
    NOTES,
    RHYTHM_PATTERNS,
    SKILL_NODES,
    chord_key,
    chord_spec,
    node_items,
    note_spec,
)

WEB = pathlib.Path(__file__).resolve().parents[2] / "web"
NOTES_JS = WEB / "src" / "lib" / "notes.js"

# Enough MIDI numbers to cover naturals, sharps, and octave boundaries.
SPELLING_PROBES = [21, 48, 59, 60, 61, 62, 66, 67, 68, 71, 72, 76, 84, 108]

DUMP_JS = f"""
import(({json.dumps(str(NOTES_JS))})).then(m => {{
  const nodes = m.SKILL_NODES.map(n => ({{
    id: n.id, kind: n.kind ?? "notes", title: n.title, blurb: n.blurb,
    clef: n.clef ?? null, midis: n.midis ?? null, patterns: n.patterns ?? null,
    sizes: n.sizes ?? null, triads: n.triads ?? null,
    itemKeys: m.nodeItemKeys(n),
  }}));
  const probes = {json.dumps(SPELLING_PROBES)};
  console.log(JSON.stringify({{
    nodes,
    notes: m.NOTES,
    rhythms: m.RHYTHM_PATTERNS,
    spellings: Object.fromEntries(probes.map(x => [x, m.noteSpec(x)])),
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
        for field in ("clef", "midis", "patterns", "sizes"):
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
