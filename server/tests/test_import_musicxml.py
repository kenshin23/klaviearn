"""The MusicXML importer — the path repertoire arrives by.

A piece that imports *wrong* is worse than one that does not import, so most
of these check that the importer refuses what it cannot represent rather than
guessing.
"""
import pathlib

import pytest
from defusedxml.common import EntitiesForbidden

from app.pieces import PIECES, bar_beats
from tools.import_musicxml import Unsupported, check, main, parse

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "two-bars.musicxml"


@pytest.fixture(scope="module")
def imported():
    return parse(FIXTURE.read_text(encoding="utf-8"))


def wrap(measures: str, *, attributes: str = "") -> str:
    default = """
        <divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
    """
    return f"""<?xml version="1.0"?>
    <score-partwise version="4.0">
      <part id="P1"><measure number="1">
        <attributes>{attributes or default}</attributes>
        {measures}
      </measure></part>
    </score-partwise>"""


NOTE = ('<note><pitch><step>C</step><octave>4</octave></pitch>'
        '<duration>8</duration><type>whole</type><staff>1</staff></note>')


# --- What it reads -----------------------------------------------------------

def test_it_reads_the_title_and_composer(imported):
    assert imported["title"] == "Two Bar Study"
    assert imported["composer"] == "A. Nonymous"


def test_it_reads_the_time_signature(imported):
    assert imported["beatsPerBar"] == 4


def test_it_reads_every_measure(imported):
    assert len(imported["bars"]) == 2


def test_it_converts_divisions_into_beats(imported):
    """<divisions>2</divisions> means two ticks to a quarter note."""
    assert [n["beats"] for n in imported["bars"][0]["rh"]] == [1.0, 1.0, 2.0]
    assert imported["bars"][0]["lh"][0]["beats"] == 4.0


def test_it_reads_a_dotted_note(imported):
    assert imported["bars"][1]["rh"][0]["beats"] == 1.5


def test_it_reads_pitch_including_accidentals(imported):
    assert [n["midi"] for n in imported["bars"][0]["rh"]] == [60, 62, 64]
    assert imported["bars"][1]["rh"][0]["midi"] == 66, "F sharp via <alter>1</alter>"


def test_it_splits_the_staves_into_hands(imported):
    assert all(n["midi"] >= 60 for n in imported["bars"][0]["rh"])
    assert imported["bars"][0]["lh"][0]["midi"] == 48


def test_it_reads_fingering(imported):
    assert [n["finger"] for n in imported["bars"][0]["rh"]] == [1, 2, 3]
    assert imported["bars"][0]["lh"][0]["finger"] == 5


def test_it_keeps_rests_so_the_bar_still_adds_up(imported):
    rest = imported["bars"][1]["rh"][-1]
    assert rest == {"rest": True, "beats": 2.0}
    assert sum(n["beats"] for n in imported["bars"][1]["rh"]) == 4


def test_the_result_is_the_shape_pieces_py_holds(imported):
    authored = next(iter(PIECES.values()))
    assert set(imported) == set(authored)
    for bar in imported["bars"]:
        assert set(bar) == {"rh", "lh"}


def test_an_imported_piece_passes_the_same_bar_length_check(imported):
    for number, bar in enumerate(imported["bars"], 1):
        for hand in ("rh", "lh"):
            assert bar_beats(bar, hand) == imported["beatsPerBar"], f"bar {number} {hand}"


# --- What it refuses ---------------------------------------------------------

def test_it_refuses_a_timewise_score():
    with pytest.raises(Unsupported, match="score-partwise"):
        parse('<?xml version="1.0"?><score-timewise/>')


def test_it_refuses_a_score_with_no_part():
    with pytest.raises(Unsupported, match="no <part>"):
        parse('<?xml version="1.0"?><score-partwise><part-list/></score-partwise>')


def test_it_refuses_a_measure_that_never_declares_divisions():
    xml = ('<?xml version="1.0"?><score-partwise><part id="P1">'
           f'<measure number="1">{NOTE}</measure></part></score-partwise>')
    with pytest.raises(Unsupported, match="divisions"):
        parse(xml)


def test_it_refuses_chords_rather_than_flattening_them():
    chord = NOTE.replace("<pitch>", "<chord/><pitch>")
    with pytest.raises(Unsupported, match="chords"):
        parse(wrap(NOTE + chord))


def test_it_refuses_ties_and_tuplets():
    with pytest.raises(Unsupported, match="ties and tuplets"):
        parse(wrap(NOTE.replace("</note>", "<tie type='start'/></note>")))


def test_it_refuses_a_third_staff():
    with pytest.raises(Unsupported, match="staff 3"):
        parse(wrap(NOTE.replace("<staff>1</staff>", "<staff>3</staff>")))


def test_it_refuses_a_time_signature_it_cannot_count():
    attributes = "<divisions>2</divisions><time><beats>6</beats><beat-type>8</beat-type></time>"
    with pytest.raises(Unsupported, match="x/4"):
        parse(wrap(NOTE, attributes=attributes))


def test_it_refuses_a_score_with_no_time_signature():
    xml = ('<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">'
           f'<attributes><divisions>2</divisions></attributes>{NOTE}'
           "</measure></part></score-partwise>")
    with pytest.raises(Unsupported, match="time signature"):
        parse(xml)


def test_it_refuses_an_unknown_pitch_step():
    with pytest.raises(Unsupported, match="pitch step"):
        parse(wrap(NOTE.replace("<step>C</step>", "<step>H</step>")))


def test_it_refuses_a_pitchless_note_that_is_not_a_rest():
    pitchless = "<note><duration>8</duration><staff>1</staff></note>"
    with pytest.raises(Unsupported, match="no pitch"):
        parse(wrap(pitchless))


# --- Untrusted input ---------------------------------------------------------

def test_it_refuses_an_entity_bomb():
    """Scores come from IMSLP and MuseScore, so the input is untrusted. The
    stdlib parser expands internal entities; defusedxml is why this raises."""
    bomb = """<?xml version="1.0"?>
    <!DOCTYPE lolz [
      <!ENTITY lol "lol">
      <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
      <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
    ]>
    <score-partwise><part id="P1"><measure>&lol3;</measure></part></score-partwise>"""
    with pytest.raises(EntitiesForbidden):
        parse(bomb)


# --- The pre-flight check ----------------------------------------------------

def test_check_passes_a_clean_import(imported):
    problems = check(imported)
    assert problems == [], problems


def test_check_reports_a_bar_that_does_not_add_up():
    piece = {"beatsPerBar": 4, "bars": [{"rh": [{"midi": 60, "beats": 3, "finger": 1}], "lh": []}]}
    assert any("3 beats, expected 4" in p for p in check(piece))


def test_check_reports_a_note_off_the_keyboard():
    piece = {"beatsPerBar": 4, "bars": [{"rh": [{"midi": 200, "beats": 4, "finger": 1}], "lh": []}]}
    assert any("off the keyboard" in p for p in check(piece))


def test_check_reports_missing_fingering():
    piece = {"beatsPerBar": 4, "bars": [{"rh": [{"midi": 60, "beats": 4}], "lh": []}]}
    assert any("no fingering" in p for p in check(piece))


def test_check_reports_everything_at_once_rather_than_the_first_problem():
    piece = {"beatsPerBar": 4, "bars": [
        {"rh": [{"midi": 60, "beats": 3}], "lh": []},
        {"rh": [{"midi": 200, "beats": 4, "finger": 1}], "lh": []},
    ]}
    assert len(check(piece)) >= 3


# --- The CLI -----------------------------------------------------------------

def test_the_cli_prints_a_piece_under_the_id_it_was_given(capsys):
    assert main([str(FIXTURE), "--id", "two-bars", "--tempo", "90"]) == 0
    out = capsys.readouterr().out
    assert '"two-bars"' in out
    assert '"tempo": 90' in out


def test_the_cli_falls_back_to_a_slug_of_the_title(capsys):
    main([str(FIXTURE)])
    assert '"two-bar-study"' in capsys.readouterr().out


def test_the_cli_reports_a_file_it_cannot_read(tmp_path, capsys):
    bad = tmp_path / "bad.musicxml"
    bad.write_text("<score-timewise/>")
    assert main([str(bad)]) == 1
    assert "cannot import" in capsys.readouterr().err
