"""End-to-end API tests (offline mode: in-memory store + heuristic fallbacks)."""
import time


def _future_workday(days_ahead: int = 3) -> str:
    """A date `days_ahead`+ days out that falls on the doctor's working days (Mon-Sat)."""
    t = time.time() + days_ahead * 86400
    while time.strftime("%a", time.localtime(t)) == "Sun":
        t += 86400
    return time.strftime("%Y-%m-%d", time.localtime(t))


# ── Health & seed ───────────────────────────────────────────────────────
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["store"] == "memory"  # offline mode in tests
    assert body["llm"] is False


def test_seed_idempotent(client):
    r = client.post("/seed")
    assert r.status_code == 200
    assert r.json()["seeded"] is True


# ── Auth: phone portals + Google resolve ────────────────────────────────
def test_resolve_patient_by_phone(client):
    r = client.post("/auth/resolve", json={"phone": "8904030441", "portal": "patient"})
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "patient"
    assert body["patientId"] == "pat-1"


def test_resolve_doctor_rejected_on_patient_portal(client):
    r = client.post("/auth/resolve", json={"phone": "9481479268", "portal": "patient"})
    assert r.status_code == 403


def test_resolve_doctor_by_phone(client):
    r = client.post("/auth/resolve", json={"phone": "+91 94814 79268", "portal": "doctor"})
    assert r.status_code == 200
    assert r.json()["role"] == "doctor"


def test_google_auth_known_and_unknown(client):
    known = client.post("/auth/google", json={"email": "yadavaoxford@gmail.com"}).json()
    assert known["needsOnboarding"] is False
    assert known["profile"]["role"] == "doctor"
    new = client.post("/auth/google", json={"email": "someone.new@example.com"}).json()
    assert new["needsOnboarding"] is True


def test_caller_id_lookup(client):
    r = client.get("/patients/by-phone", params={"phone": "+918904030441"})
    assert r.status_code == 200
    assert r.json()["found"] is True
    assert r.json()["patientId"] == "pat-1"


# ── Calendar: 3 slots/day + booking flow ────────────────────────────────
def test_three_slots_per_day(client):
    date = _future_workday(5)
    r = client.get("/calendar/slots", params={"doctorId": "doc-1", "date": date})
    assert r.status_code == 200
    slots = r.json()["slots"]
    assert len(slots) <= 3
    assert set(slots).issubset({"10:00", "12:30", "16:00"})


def test_booking_is_pending_then_confirmed(client):
    date = _future_workday(6)
    slots = client.get("/calendar/slots", params={"doctorId": "doc-1", "date": date}).json()["slots"]
    assert slots, "expected an open slot"
    slot = slots[0]

    r = client.post("/appointments/book", json={
        "patientId": "pat-1", "doctorId": "doc-1", "date": date, "time": slot, "reason": "Test"})
    assert r.status_code == 200
    assert r.json()["status"] == "pending"
    appt_id = r.json()["appointment"]["id"]

    # Slot is now taken.
    remaining = client.get("/calendar/slots", params={"doctorId": "doc-1", "date": date}).json()["slots"]
    assert slot not in remaining

    # Double-booking the same slot is rejected.
    dup = client.post("/appointments/book", json={
        "patientId": "pat-1", "doctorId": "doc-1", "date": date, "time": slot, "reason": "Dup"})
    assert dup.status_code == 409

    # Doctor confirms → status flips.
    conf = client.post(f"/appointments/{appt_id}/confirm")
    assert conf.status_code == 200
    assert conf.json()["confirmed"] is True
    appts = client.get("/appointments", params={"patientId": "pat-1"}).json()["appointments"]
    assert any(a["id"] == appt_id and a["status"] == "confirmed" for a in appts)


# ── Conversations: transcript dedup + feedback ──────────────────────────
def test_conversation_dedup_of_interim_transcripts(client):
    turns = [
        {"role": "patient", "text": "I want to"},
        {"role": "patient", "text": "I want to check my health"},
        {"role": "arya", "text": "Sure."},
        {"role": "patient", "text": "Thanks"},
    ]
    r = client.post("/conversations", json={"id": "conv-test-dedup", "patientId": "pat-1",
                                            "channel": "voice", "turns": turns})
    assert r.status_code == 200
    conv = client.get("/conversations/conv-test-dedup").json()
    texts = [t["text"] for t in conv["turns"]]
    assert texts == ["I want to check my health", "Sure.", "Thanks"]


def test_conversation_finalize_and_feedback(client):
    r = client.post("/conversations/conv-test-dedup/finalize")
    assert r.status_code == 200
    assert "summary" in r.json()
    fb = client.post("/conversations/conv-test-dedup/feedback",
                     json={"handledCorrectly": True, "rating": 5, "notes": "ok"})
    assert fb.status_code == 200 and fb.json()["saved"] is True


# ── Documents: upload + history + context grounding ─────────────────────
def test_document_upload_and_history(client):
    content = b"Prescription: Tab. Aspirin 75 mg once daily after lunch. HbA1c 7.8%."
    r = client.post("/patients/pat-1/document",
                    files={"file": ("rx.txt", content, "text/plain")})
    assert r.status_code == 200
    assert r.json()["uploaded"] is True
    assert r.json()["type"] == "prescription"  # classified

    docs = client.get("/patients/pat-1/documents").json()["documents"]
    assert any(d["filename"] == "rx.txt" for d in docs)

    # The document text is part of the patient context used by the brain.
    ctx = client.get("/patients/pat-1/context").json()
    assert "Aspirin" in ctx["context"]["document"]


# ── Chat brain (offline heuristic) ──────────────────────────────────────
def test_chat_replies_offline(client):
    r = client.post("/arya/chat", json={"patientId": "pat-1",
                                        "messages": [{"role": "user", "content": "What should I eat?"}]})
    assert r.status_code == 200
    assert isinstance(r.json()["reply"], str) and r.json()["reply"]


# ── AI health: diet + wearables ─────────────────────────────────────────
def test_diet_plan_structure(client):
    r = client.post("/patients/pat-1/diet-plan")
    assert r.status_code == 200
    plan = r.json()["plan"]
    for key in ("breakfast", "lunch", "dinner", "calorieTarget", "proteinTarget", "waterLitres"):
        assert key in plan


def test_wearable_sync_flags_low_spo2(client):
    r = client.post("/wearables/pat-1/sync",
                    json={"steps": 9000, "restingHeartRate": 72, "spo2": 90, "sleepHours": 7.5})
    assert r.status_code == 200
    analysis = r.json()["analysis"]
    assert analysis["status"] == "attention"
    assert any(a["metric"] == "SpO₂" for a in analysis["alerts"])


# ── Twilio TwiML bridge ─────────────────────────────────────────────────
def test_twilio_voice_returns_twiml(client):
    r = client.post("/twilio/voice")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/xml")
    assert "<Dial" in r.text and "sip:" in r.text
