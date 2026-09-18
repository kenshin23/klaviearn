"""The curriculum-as-data layer: note spelling, chords, and skill-tree integrity."""
import pytest

from app.content import (
    NODE_BY_ID,
    NOTES,
    RHYTHM_PATTERNS,
    SKILL_NODES,
    chord_key,
    chord_spec,
    item_key,
    node_items,
    note_spec,
)
from app.routes import DRILLS_BY_KIND

# The Attempt/ResultIn schema caps an item key at 32 characters.
MAX_ITEM_KEY = 32


# --- note_spec: spelling any MIDI number ------------------------------------

@pytest.mark.parametrize(
    ("midi", "key", "letter", "acc"),
    [
        (60, "c/4", "C", ""),
        (61, "c#/4", "C", "#"),
        (62, "d/4", "D", ""),
        (66, "f#/4", "F", "#"),
        (71, "b/4", "B", ""),
        (72, "c/5", "C", ""),
        (21, "a/0", "A", ""),   # lowest key on an 88-key piano
        (108, "c/8", "C", ""),  # highest
    ],
)
def test_note_spec_spells_naturals_and_sharps(midi, key, letter, acc):
    spec = note_spec(midi)
    assert spec["key"] == key
    assert spec["letter"] == letter
    assert spec["acc"] == acc
    assert spec["midi"] == midi


def test_note_spec_keeps_the_base_letter_for_sharps():
    """F# reports letter "F" so it inherits F's colour in the scaffold palette."""
    assert note_spec(66)["letter"] == "F"
    assert note_spec(68)["letter"] == "G"


def test_note_spec_octave_boundary_is_at_c():
    assert note_spec(59)["key"] == "b/3"
    assert note_spec(60)["key"] == "c/4"


def test_note_spec_agrees_with_the_hand_written_notes_table():
    """The two spellings must not drift: NOTES is authored, note_spec derived."""
    for clef, table in NOTES.items():
        for midi, meta in table.items():
            assert note_spec(midi, clef)["key"] == meta["key"]
            assert note_spec(midi, clef)["letter"] == meta["letter"]


# --- The diatonic invariant --------------------------------------------------

def test_notes_table_stays_diatonic():
    """The interval drill derives its scale from NOTES by index.

    A chromatic entry here would silently redefine what a "3rd" is, which is
    why accidentals live in note_spec() instead. This test is the guard.
    """
    for clef, table in NOTES.items():
        for midi, meta in table.items():
            assert "#" not in meta["key"], f"{clef}:{midi} is not diatonic"
            assert "b/" not in meta["key"].replace(meta["letter"].lower() + "/", "")


def test_treble_scale_is_the_eight_notes_the_interval_drill_expects():
    assert sorted(NOTES["treble"]) == [60, 62, 64, 65, 67, 69, 71, 72]


# --- Chords ------------------------------------------------------------------

def test_chord_qualities_are_the_right_intervals():
    assert [n["midi"] - 60 for n in chord_spec(60, "maj")["notes"]] == [0, 4, 7]
    assert [n["midi"] - 60 for n in chord_spec(60, "min")["notes"]] == [0, 3, 7]


@pytest.mark.parametrize(
    ("root", "quality", "key", "name"),
    [
        (60, "maj", "chord:C:maj", "C major"),
        (62, "min", "chord:D:min", "D minor"),
        (62, "maj", "chord:D:maj", "D major"),
        (66, "maj", "chord:F#:maj", "F# major"),
    ],
)
def test_chord_key_and_name(root, quality, key, name):
    assert chord_key(root, quality) == key
    assert chord_spec(root, quality)["name"] == name


def test_chord_key_is_octave_independent():
    """Root position C major is the same SRS item wherever it is voiced."""
    assert chord_key(60, "maj") == chord_key(72, "maj")


def test_quality_distinguishes_chords_on_the_same_root():
    assert chord_key(62, "maj") != chord_key(62, "min")


def test_the_two_sharp_triads_carry_their_accidental():
    assert [n["key"] for n in chord_spec(62, "maj")["notes"]] == ["d/4", "f#/4", "a/4"]
    assert [n["key"] for n in chord_spec(64, "maj")["notes"]] == ["e/4", "g#/4", "b/4"]


def test_every_shipped_triad_spells_with_sharps_only():
    """v1 has no flat spelling; a triad needing one would render wrong."""
    for root, quality in NODE_BY_ID["chords"]["triads"]:
        for note in chord_spec(root, quality)["notes"]:
            assert "b" not in note["acc"], f"{chord_key(root, quality)} needs a flat"


def test_shipped_triads_stay_in_a_readable_treble_range():
    for root, quality in NODE_BY_ID["chords"]["triads"]:
        midis = chord_spec(root, quality)["midis"]
        assert min(midis) >= 60 and max(midis) <= 79, f"{chord_key(root, quality)} off the staff"


# --- Skill tree integrity ----------------------------------------------------

def test_node_ids_are_unique():
    ids = [n["id"] for n in SKILL_NODES]
    assert len(ids) == len(set(ids))


def test_every_node_kind_has_at_least_one_drill():
    for node in SKILL_NODES:
        kind = node.get("kind", "notes")
        assert kind in DRILLS_BY_KIND, f"{node['id']}: kind {kind!r} has no drill"
        assert DRILLS_BY_KIND[kind]


def test_every_node_produces_items():
    for node in SKILL_NODES:
        items = node_items(node)
        assert items, f"{node['id']} produced no items"
        keys = [k for k, _ in items]
        assert len(keys) == len(set(keys)), f"{node['id']} has duplicate item keys"


def test_item_keys_fit_the_schema_limit():
    for node in SKILL_NODES:
        for key, _ in node_items(node):
            assert len(key) <= MAX_ITEM_KEY, f"{key} is {len(key)} chars"


def test_note_nodes_reference_notes_that_exist():
    for node in SKILL_NODES:
        if node.get("kind", "notes") != "notes":
            continue
        for midi in node["midis"]:
            assert midi in NOTES[node["clef"]], f"{node['id']}: no {node['clef']}:{midi}"
            assert item_key(node["clef"], midi) == f"{node['clef']}:{midi}"


def test_rhythm_nodes_reference_patterns_that_exist():
    for node in SKILL_NODES:
        if node.get("kind") == "rhythm":
            for pattern in node["patterns"]:
                assert pattern in RHYTHM_PATTERNS


def test_every_rhythm_pattern_fills_exactly_one_bar_of_four_four():
    beats = {"q": 1, "h": 2, "w": 4, "8": 0.5}
    for pid, pattern in RHYTHM_PATTERNS.items():
        total = sum(beats[d.rstrip("r")] for d in pattern["durations"])
        assert total == 4, f"{pid} is {total} beats, not 4"


def test_item_metadata_carries_what_each_drill_renders():
    for node in SKILL_NODES:
        kind = node.get("kind", "notes")
        for _key, meta in node_items(node):
            if kind == "rhythm":
                assert meta["durations"] and meta["name"]
            elif kind == "intervals":
                assert meta["size"] >= 2 and meta["name"]
            elif kind == "chords":
                assert len(meta["midis"]) == 3
                assert len(meta["notes"]) == 3
                assert meta["clef"] == "treble"
            else:
                assert meta["key"] and meta["letter"] and meta["clef"]
                assert meta["pos"] in ("line", "space")
