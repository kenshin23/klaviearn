"""Key signatures, and the distinction they create between what a note IS and
what gets drawn for it."""
import pytest

from app.keys import DEFAULT_KEY, FLAT_ORDER, KEYS, SHARP_ORDER, note_in_key, spell

# --- The signatures themselves -----------------------------------------------

@pytest.mark.parametrize(
    ("key_id", "sharps", "flats"),
    [("C", 0, 0), ("G", 1, 0), ("D", 2, 0), ("A", 3, 0), ("E", 4, 0),
     ("F", 0, 1), ("Bb", 0, 2), ("Eb", 0, 3),
     ("Am", 0, 0), ("Em", 1, 0), ("Dm", 0, 1)],
)
def test_each_key_has_the_signature_it_should(key_id, sharps, flats):
    key = KEYS[key_id]
    assert key["sharps"] == sharps
    assert key["flats"] == flats
    assert len(key["signature"]) == sharps + flats


def test_sharps_arrive_in_the_order_every_printed_score_uses():
    assert list(KEYS["E"]["signature"]) == SHARP_ORDER[:4]
    assert KEYS["E"]["signature"] == {"F": "#", "C": "#", "G": "#", "D": "#"}


def test_flats_arrive_in_their_own_order():
    assert list(KEYS["Eb"]["signature"]) == FLAT_ORDER[:3]
    assert KEYS["Eb"]["signature"] == {"B": "b", "E": "b", "A": "b"}


def test_a_key_never_mixes_sharps_and_flats():
    for key_id, key in KEYS.items():
        accidentals = set(key["signature"].values())
        assert len(accidentals) <= 1, f"{key_id} mixes {accidentals}"


def test_relative_keys_share_a_signature():
    assert KEYS["C"]["signature"] == KEYS["Am"]["signature"]
    assert KEYS["G"]["signature"] == KEYS["Em"]["signature"]
    assert KEYS["F"]["signature"] == KEYS["Dm"]["signature"]


def test_c_major_is_the_default_and_has_nothing_to_say():
    assert DEFAULT_KEY == "C"
    assert KEYS["C"]["signature"] == {}


# --- Spelling: what the note is ----------------------------------------------

def test_sharp_keys_spell_with_sharps():
    assert note_in_key(66, "G")["letter"] == "F"
    assert note_in_key(66, "G")["acc"] == "#"


def test_flat_keys_spell_with_flats():
    """Pitch class 10 is B flat in F major, not A sharp."""
    assert note_in_key(70, "F")["letter"] == "B"
    assert note_in_key(70, "F")["acc"] == "b"
    assert note_in_key(70, "F")["key"] == "bb/4"


def test_the_same_pitch_is_spelled_differently_in_different_keys():
    assert note_in_key(70, "D")["key"] == "a#/4"
    assert note_in_key(70, "F")["key"] == "bb/4"


def test_naturals_are_spelled_the_same_everywhere():
    for key_id in KEYS:
        assert note_in_key(60, key_id)["letter"] == "C"
        assert note_in_key(60, key_id)["acc"] == ""


# --- What gets drawn ---------------------------------------------------------

def test_the_signature_speaks_once_so_the_notes_do_not():
    """Every F in a G major scale is sharp; none of them draws a sharp."""
    assert note_in_key(66, "G")["written"] == ""
    assert note_in_key(78, "G")["written"] == ""


def test_a_flat_already_in_the_signature_is_not_drawn_either():
    assert note_in_key(70, "F")["written"] == ""


def test_an_accidental_the_signature_never_covered_is_drawn():
    """A harmonic minor's G sharp: A minor's signature says nothing about G."""
    assert note_in_key(68, "Am")["acc"] == "#"
    assert note_in_key(68, "Am")["written"] == "#"


def test_contradicting_the_signature_needs_a_natural():
    """An F natural in G major has to cancel the signature's sharp."""
    assert note_in_key(65, "G")["acc"] == ""
    assert note_in_key(65, "G")["written"] == "n"


def test_a_natural_the_signature_says_nothing_about_draws_nothing():
    assert note_in_key(60, "G")["written"] == ""
    assert note_in_key(62, "G")["written"] == ""


def test_what_a_note_is_and_what_is_drawn_are_not_the_same_question():
    sharp_in_signature = note_in_key(66, "G")
    sharp_outside_it = note_in_key(68, "Am")
    assert sharp_in_signature["acc"] == sharp_outside_it["acc"] == "#"
    assert sharp_in_signature["written"] != sharp_outside_it["written"]


def test_c_major_draws_every_accidental_it_meets():
    """With no signature there is nothing to lean on."""
    assert note_in_key(66, "C")["written"] == "#"
    assert note_in_key(61, "C")["written"] == "#"


# --- Octaves and clefs -------------------------------------------------------

def test_the_octave_boundary_is_at_c_in_every_key():
    for key_id in ("C", "G", "F"):
        assert note_in_key(59, key_id)["key"].endswith("/3")
        assert note_in_key(60, key_id)["key"].endswith("/4")


def test_spell_attaches_the_clef_and_keeps_the_order():
    notes = spell([60, 62, 64], "C", "bass")
    assert [n["midi"] for n in notes] == [60, 62, 64]
    assert all(n["clef"] == "bass" for n in notes)


def test_spelling_a_whole_scale_in_g_draws_exactly_one_accidental():
    g_major = [67, 69, 71, 72, 74, 76, 78, 79]
    written = [n["written"] for n in spell(g_major, "G")]
    assert written == [""] * 8, "the signature carries the F sharp"


def test_spelling_a_harmonic_minor_draws_exactly_one():
    a_harmonic = [69, 71, 72, 74, 76, 77, 80, 81]
    written = [n["written"] for n in spell(a_harmonic, "Am")]
    assert written.count("#") == 1
    assert [n["midi"] for n in spell(a_harmonic, "Am") if n["written"]] == [80]
