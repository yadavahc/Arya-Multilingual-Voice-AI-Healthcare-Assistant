"""Unit tests for pure logic: language detection, phone normalization, expiry
parsing, wearable thresholds, transcript utilities, document handling."""
from arya_brain import _resolve_day, detect_message_language
from call_records import duration_seconds, summarize_call
from documents import _classify, extract_text
from health_ai import _is_expired, analyze_wearables
from main import _dedup_turns, _e164


# ── Language detection by script ────────────────────────────────────────
def test_detect_language_scripts():
    assert detect_message_language("When is my appointment?") == "en"
    assert detect_message_language("मेरी दवाई कब लेनी है?") == "hi"
    assert detect_message_language("ನನ್ನ ಮಾತ್ರೆ ಯಾವಾಗ?") == "kn"
    assert detect_message_language("என் மருந்து எப்போது?") == "ta"
    assert detect_message_language("నా మందు ఎప్పుడు?") == "te"
    assert detect_message_language("meri dawai kab leni hai") == "hi"  # romanized


# ── Phone normalization ─────────────────────────────────────────────────
def test_e164_normalization():
    assert _e164("8904030441") == "+918904030441"
    assert _e164("+91 89040 30441") == "+918904030441"
    assert _e164("918904030441") == "+918904030441"


# ── Medicine expiry parsing ─────────────────────────────────────────────
def test_expiry_parsing():
    assert _is_expired("EXP 01/2020") is True
    assert _is_expired("EXP 12/2099") is False
    assert _is_expired("") is None
    assert _is_expired("no date here") is None


# ── Wearable thresholds ─────────────────────────────────────────────────
def test_wearables_normal_is_good():
    out = analyze_wearables({"steps": 8000, "restingHeartRate": 70, "spo2": 98, "sleepHours": 7.5})
    assert out["status"] == "good" and out["alerts"] == []


def test_wearables_low_spo2_is_attention():
    out = analyze_wearables({"spo2": 90})
    assert out["status"] == "attention"


def test_wearables_high_hr_is_review():
    out = analyze_wearables({"restingHeartRate": 120})
    assert out["status"] == "review"


# ── Transcript utilities ────────────────────────────────────────────────
def test_dedup_collapses_growing_prefixes():
    turns = [
        {"role": "patient", "text": "hello I"},
        {"role": "patient", "text": "hello I need help"},
        {"role": "arya", "text": "Yes?"},
    ]
    out = _dedup_turns(turns)
    assert [t["text"] for t in out] == ["hello I need help", "Yes?"]


def test_dedup_keeps_distinct_turns():
    turns = [
        {"role": "patient", "text": "first question"},
        {"role": "patient", "text": "second question"},
    ]
    assert len(_dedup_turns(turns)) == 2


def test_duration_from_turn_timestamps():
    turns = [{"role": "patient", "text": "a", "at": 1_000_000},
             {"role": "arya", "text": "b", "at": 1_061_000}]
    assert duration_seconds(turns) == 61


def test_call_summary_heuristic():
    out = summarize_call([{"role": "patient", "text": "I want an appointment for my blood pressure"}])
    assert "appointment" in out["summary"] or out["insights"]["topics"]
    assert out["insights"]["followUpNeeded"] is True


# ── Documents ───────────────────────────────────────────────────────────
def test_extract_text_txt():
    assert extract_text("note.txt", b"hello world") == "hello world"


def test_document_classification():
    assert _classify("rx.pdf", "Tab. Amlodipine 5 mg once daily") == "prescription"
    assert _classify("labs.pdf", "Hemoglobin 13.5, HbA1c 7.8") == "lab_report"
    assert _classify("letter.pdf", "Dear patient, welcome") == "document"


# ── Natural-language day resolution ─────────────────────────────────────
def test_resolve_day_formats():
    assert _resolve_day("2026-08-01") == "2026-08-01"
    assert _resolve_day("today") is not None
    assert _resolve_day("tomorrow") is not None
    assert _resolve_day("next monday") is not None
    assert _resolve_day("someday maybe") is None
