"""The curriculum-as-data layer: note spelling, chords, and skill-tree integrity."""
import pytest

from app.content import (
    EAR_MIDIS,
    NODE_BY_ID,
    NOTES,
    RHYTHM_PATTERNS,
    SKILL_NODES,
    TECHNIQUE_PATTERNS,
    chord_key,
    chord_spec,
    ear_key,
    item_key,
    node_items,
    note_spec,
)
from app.pieces import HANDS, PIECES, bar_beats, bar_key, bar_tempo, piece_items
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
            elif kind == "piece":
                assert meta["bar"] >= 1 and meta["title"]
                assert meta["rh"] or meta["lh"]
            elif kind == "technique":
                assert len(meta["midis"]) == len(meta["fingers"])
                assert meta["name"] and meta["hand"] in ("rh", "lh")
            elif kind in ("ear-pitch", "ear-phrases"):
                assert meta["midi"] and meta["letter"]
            elif kind == "ear-intervals":
                assert meta["size"] >= 2 and meta["name"]
            elif kind == "ear-chords":
                assert meta["quality"] in ("maj", "min") and meta["name"]
            else:
                assert meta["key"] and meta["letter"] and meta["clef"]
                assert meta["pos"] in ("line", "space")


# --- The ear track -----------------------------------------------------------

EAR_NODES = ["ear-pitch", "ear-intervals", "ear-chords", "ear-phrases"]


def test_ear_items_are_namespaced_and_fit_the_schema():
    for node_id in EAR_NODES:
        for key, _ in node_items(NODE_BY_ID[node_id]):
            assert key.startswith("ear:"), key
            assert len(key) <= MAX_ITEM_KEY


def test_hearing_a_note_is_a_different_item_from_seeing_it():
    """Same pitch, different skill — so a separate schedule."""
    ear = {k for k, _ in node_items(NODE_BY_ID["ear-pitch"])}
    read = {k for k, _ in node_items(NODE_BY_ID["octave"])}
    assert ear.isdisjoint(read)
    assert ear_key(60) == "ear:60"


def test_the_pitch_and_phrase_drills_share_one_schedule_per_note():
    """Both train "which note is that?", so they must not split the evidence."""
    pitch = [k for k, _ in node_items(NODE_BY_ID["ear-pitch"])]
    phrase = [k for k, _ in node_items(NODE_BY_ID["ear-phrases"])]
    assert pitch == phrase


def test_the_ear_range_matches_the_reading_curriculum():
    assert sorted(NOTES["treble"]) == EAR_MIDIS


def test_ear_chord_items_are_qualities_not_specific_chords():
    """The drill asks major-or-minor, so C major and F major are one item."""
    keys = [k for k, _ in node_items(NODE_BY_ID["ear-chords"])]
    assert keys == ["ear:qual:maj", "ear:qual:min"]


def test_every_ear_chord_root_can_be_built_in_both_qualities():
    for root in NODE_BY_ID["ear-chords"]["roots"]:
        for quality in ("maj", "min"):
            spec = chord_spec(root, quality)
            assert len(spec["midis"]) == 3
            assert spec["midis"][0] == root


def test_ear_nodes_carry_no_notation_requirement():
    """Nothing in an ear item should imply a staff — these drills draw none."""
    for node_id in ("ear-intervals", "ear-chords"):
        for _key, meta in node_items(NODE_BY_ID[node_id]):
            assert "pos" not in meta


# --- The technique track -----------------------------------------------------

TECHNIQUE_NODES = ["technique-5finger", "technique-scales", "technique-arpeggios"]


def test_technique_items_are_namespaced_and_fit_the_schema():
    for node_id in TECHNIQUE_NODES:
        for key, _ in node_items(NODE_BY_ID[node_id]):
            assert key.startswith("tech:"), key
            assert len(key) <= MAX_ITEM_KEY


def test_every_pattern_has_one_finger_per_note():
    for pid, pattern in TECHNIQUE_PATTERNS.items():
        assert len(pattern["fingers"]) == len(pattern["midis"]), pid


def test_fingers_are_fingers():
    for pid, pattern in TECHNIQUE_PATTERNS.items():
        assert all(1 <= f <= 5 for f in pattern["fingers"]), pid


def test_each_hand_reads_from_its_own_clef():
    for pid, pattern in TECHNIQUE_PATTERNS.items():
        assert pattern["clef"] == ("treble" if pattern["hand"] == "rh" else "bass"), pid


def test_left_hand_patterns_sit_below_the_right_hand_ones():
    rh = [p for p in TECHNIQUE_PATTERNS.values() if p["hand"] == "rh"]
    lh = [p for p in TECHNIQUE_PATTERNS.values() if p["hand"] == "lh"]
    assert max(max(p["midis"]) for p in lh) <= max(max(p["midis"]) for p in rh)
    assert min(min(p["midis"]) for p in lh) < min(min(p["midis"]) for p in rh)


def test_five_finger_positions_use_each_finger_once_per_direction():
    """Five notes under five fingers is the whole idea — no thumb-under here."""
    for pid in ("5finger:rh", "5finger:lh"):
        pattern = TECHNIQUE_PATTERNS[pid]
        assert sorted(set(pattern["fingers"])) == [1, 2, 3, 4, 5], pid
        assert len(set(pattern["midis"])) == 5, pid


def test_the_scales_actually_tuck_the_thumb_under():
    """A one-octave scale cannot be played without the thumb crossing, and a
    fingering that never returns to 1 mid-scale would be teaching it wrong."""
    for pid in ("scale:C:rh", "scale:C:lh"):
        fingers = TECHNIQUE_PATTERNS[pid]["fingers"]
        interior = fingers[1:-1]
        assert 1 in interior, f"{pid} never crosses the thumb"


def test_the_right_hand_scale_is_the_standard_fingering():
    pattern = TECHNIQUE_PATTERNS["scale:C:rh"]
    assert pattern["fingers"][:8] == [1, 2, 3, 1, 2, 3, 4, 5], "ascending"
    assert pattern["fingers"][7:] == [5, 4, 3, 2, 1, 3, 2, 1], "descending"


def test_the_left_hand_scale_is_the_standard_fingering():
    pattern = TECHNIQUE_PATTERNS["scale:C:lh"]
    assert pattern["fingers"][:8] == [5, 4, 3, 2, 1, 3, 2, 1], "ascending"
    assert pattern["fingers"][7:] == [1, 2, 3, 1, 2, 3, 4, 5], "descending"


def test_patterns_go_up_and_come_back_to_where_they_started():
    for pid, pattern in TECHNIQUE_PATTERNS.items():
        midis = pattern["midis"]
        assert midis[0] == midis[-1], f"{pid} does not return home"
        assert midis[len(midis) // 2] == max(midis), f"{pid} does not turn at the top"


def test_arpeggios_are_built_from_a_triad():
    for pid in ("arp:C:rh", "arp:C:lh"):
        pitch_classes = {m % 12 for m in TECHNIQUE_PATTERNS[pid]["midis"]}
        assert pitch_classes == {0, 4, 7}, f"{pid} is not a C major triad"


def test_scales_are_stepwise_and_arpeggios_are_not():
    def steps(midis):
        return [abs(b - a) for a, b in zip(midis, midis[1:], strict=False)]

    assert all(s <= 2 for s in steps(TECHNIQUE_PATTERNS["scale:C:rh"]["midis"]))
    assert max(steps(TECHNIQUE_PATTERNS["arp:C:rh"]["midis"])) > 2


def test_technique_specs_carry_what_the_staff_draws():
    for node_id in TECHNIQUE_NODES:
        for _key, meta in node_items(NODE_BY_ID[node_id]):
            assert len(meta["notes"]) == len(meta["midis"])
            assert all(n["clef"] == meta["clef"] for n in meta["notes"])
            assert [n["midi"] for n in meta["notes"]] == meta["midis"]


# --- Repertoire --------------------------------------------------------------

PIECE_NODES = [f"piece-{pid}" for pid in PIECES]


def test_every_bar_is_its_own_srs_item():
    """"Which bar do I keep fumbling" needs the bar to be the unit."""
    for piece_id, piece in PIECES.items():
        keys = [k for k, _ in piece_items(piece_id)]
        assert keys == [bar_key(piece_id, n) for n in range(1, len(piece["bars"]) + 1)]
        assert len(set(keys)) == len(keys)


def test_piece_item_keys_fit_the_schema():
    """The id is part of the key, so a long title cannot blow the 32-char cap."""
    for piece_id, piece in PIECES.items():
        longest = bar_key(piece_id, len(piece["bars"]))
        assert len(longest) <= MAX_ITEM_KEY, longest


def test_every_bar_holds_exactly_its_time_signature():
    for piece_id, piece in PIECES.items():
        for number, bar in enumerate(piece["bars"], 1):
            for hand in ("rh", "lh"):
                if not bar[hand]:
                    continue
                assert bar_beats(bar, hand) == piece["beatsPerBar"], \
                    f"{piece_id} bar {number} {hand} is {bar_beats(bar, hand)} beats"


def test_both_hands_of_a_bar_last_the_same_time():
    for piece_id, piece in PIECES.items():
        for number, bar in enumerate(piece["bars"], 1):
            assert bar_beats(bar, "rh") == bar_beats(bar, "lh"), f"{piece_id} bar {number}"


def test_every_note_is_playable_and_fingered():
    for piece_id, piece in PIECES.items():
        for number, bar in enumerate(piece["bars"], 1):
            for hand in ("rh", "lh"):
                for note in bar[hand]:
                    if note.get("rest"):
                        continue
                    assert 21 <= note["midi"] <= 108, f"{piece_id} bar {number}"
                    assert 1 <= note["finger"] <= 5, f"{piece_id} bar {number}"
                    assert note["beats"] > 0


def test_each_hand_stays_inside_one_five_finger_position():
    """The fingering is only honest if the hand never has to move."""
    for piece_id, piece in PIECES.items():
        for hand in ("rh", "lh"):
            midis = [n["midi"] for bar in piece["bars"] for n in bar[hand] if not n.get("rest")]
            assert max(midis) - min(midis) <= 7, f"{piece_id} {hand} spans more than a fifth"


def test_the_hands_do_not_overlap():
    for piece_id, piece in PIECES.items():
        rh = [n["midi"] for bar in piece["bars"] for n in bar["rh"]]
        lh = [n["midi"] for bar in piece["bars"] for n in bar["lh"]]
        assert min(rh) > max(lh), f"{piece_id} hands cross"


def test_fingering_is_consistent_for_a_given_note():
    """A five-finger position means one note is always the same finger."""
    for piece_id, piece in PIECES.items():
        for hand in ("rh", "lh"):
            fingers = {}
            for bar in piece["bars"]:
                for note in bar[hand]:
                    fingers.setdefault(note["midi"], set()).add(note["finger"])
            for midi, used in fingers.items():
                assert len(used) == 1, f"{piece_id} {hand} {midi} uses {used}"


def test_tempo_rises_with_the_bar_you_know():
    for piece in PIECES.values():
        slow, middling, full = (bar_tempo(piece, lvl) for lvl in (0, 1, 2))
        assert slow < middling < full
        assert full == piece["tempo"], "a mastered bar comes at the piece's tempo"
        assert slow >= 50, "never so slow the pulse disappears"


def test_tempo_clamps_outside_the_ladder():
    piece = next(iter(PIECES.values()))
    assert bar_tempo(piece, 9) == bar_tempo(piece, 2)
    assert bar_tempo(piece, -1) == bar_tempo(piece, 0)


def test_every_piece_has_a_node_offering_all_three_hand_drills():
    for node_id in PIECE_NODES:
        node = NODE_BY_ID[node_id]
        assert node["kind"] == "piece"
        assert DRILLS_BY_KIND["piece"] == {"piece-rh", "piece-lh", "piece-both"}
        assert node["title"] and node["blurb"]


def test_hands_map_covers_every_piece_drill():
    assert set(HANDS) == DRILLS_BY_KIND["piece"]
    assert HANDS["piece-both"] == ("rh", "lh")
