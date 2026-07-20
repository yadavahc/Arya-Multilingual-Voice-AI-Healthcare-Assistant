"""Seed demo data so the app is populated on first run (dashboards, notes, and
enough patient history for Arya to hold a real, context-aware conversation)."""
from __future__ import annotations

import time

from firestore_client import db

DEMO_ORG = "demo-org"

# Phone → identity is how login maps a Firebase user to a role. Keep these in
# E.164 so they match Firebase phone-auth uids downstream.
DOCTOR_PHONE = "+919481479268"


def _now_iso(offset_min: int = 0) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + offset_min * 60))


def _date(offset_days: int = 0) -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + offset_days * 86400))


def seed() -> dict:
    database = db()

    database.collection("organizations").document(DEMO_ORG).set(
        {"id": DEMO_ORG, "name": "Arya Demo Clinic", "plan": "clinic", "region": "asia-south1", "createdAt": _now_iso(-1000)}
    )

    # ── Doctor user (doctor login portal) ───────────────────────────────
    database.collection("users").document("doc-1").set(
        {"uid": "doc-1", "role": "doctor", "orgId": DEMO_ORG, "displayName": "Dr. Meera Nair",
         "phone": DOCTOR_PHONE, "preferredLanguage": "en", "specialty": "Cardiology", "createdAt": _now_iso(-1000)}
    )

    # ── Patients (also usable as patient-login identities via phone) ─────
    patients = [
        {"id": "pat-1", "name": "Ramesh Kumar", "phone": "+918904030441", "preferredLanguage": "hi",
         "sex": "male", "dob": "1958-04-12", "allergies": ["penicillin"], "meds": ["Amlodipine 5mg", "Atorvastatin 10mg"],
         "conditions": ["Hypertension", "Hyperlipidemia"]},
        {"id": "pat-2", "name": "Lakshmi Iyer", "phone": "+919000000011", "preferredLanguage": "ta",
         "sex": "female", "dob": "1971-09-30", "allergies": [], "meds": ["Levothyroxine 50mcg"],
         "conditions": ["Hypothyroidism"]},
        {"id": "pat-3", "name": "Anjali Das", "phone": "+919000000012", "preferredLanguage": "bn",
         "sex": "female", "dob": "1965-01-22", "allergies": ["sulfa"], "meds": ["Metformin 500mg"],
         "conditions": ["Type 2 Diabetes"]},
    ]
    for p in patients:
        database.collection("patients").document(p["id"]).set({**p, "orgId": DEMO_ORG, "createdAt": _now_iso(-5000)})
        # Mirror a patient user record so auth/resolve finds them by phone.
        database.collection("users").document(f"user-{p['id']}").set(
            {"uid": f"user-{p['id']}", "role": "patient", "orgId": DEMO_ORG, "patientId": p["id"],
             "displayName": p["name"], "phone": p["phone"], "preferredLanguage": p["preferredLanguage"],
             "createdAt": _now_iso(-5000)}
        )

    # ── Prescriptions with dose schedules (drives adherence + Arya answers) ─
    database.collection("prescriptions").document("rx-1").set(
        {"id": "rx-1", "encounterId": "enc-1", "patientId": "pat-1", "orgId": DEMO_ORG,
         "drugs": [
             {"name": "Amlodipine", "dose": "5mg", "frequency": "once daily", "durationDays": 30, "instructions": "Take in the morning for blood pressure."},
             {"name": "Atorvastatin", "dose": "10mg", "frequency": "once at night", "durationDays": 30, "instructions": "Take at night for cholesterol."},
         ],
         "schedule": [
             {"timeOfDay": "morning", "hhmm": "08:00", "withFood": True, "drug": "Amlodipine 5mg"},
             {"timeOfDay": "night", "hhmm": "21:00", "withFood": False, "drug": "Atorvastatin 10mg"},
         ],
         "adherenceLog": [
             {"slotHHMM": "08:00", "scheduledAt": _now_iso(-1440), "status": "taken", "confirmedVia": "voice"},
             {"slotHHMM": "21:00", "scheduledAt": _now_iso(-720), "status": "missed"},
         ],
         "createdAt": _now_iso(-1440)}
    )

    # ── Care plan (rest / diet / follow-up guidance Arya can quote) ──────
    database.collection("careplans").document("care-pat-1").set(
        {"id": "care-pat-1", "patientId": "pat-1", "orgId": DEMO_ORG,
         "diet": "Low-salt DASH diet. Avoid pickles, papad, and fried food. Prefer fruits, vegetables, and whole grains.",
         "rest": "Sleep 7-8 hours. Light walking 30 minutes daily; avoid heavy exertion until BP is controlled.",
         "followUp": "Blood pressure re-check in 2 weeks. Lipid profile in 6 weeks.",
         "redFlags": "Chest pain, breathlessness, or severe headache — go to emergency immediately.",
         "updatedAt": _now_iso(-1440)}
    )

    # ── Previous consultations (history Arya reasons over) ──────────────
    database.collection("encounters").document("enc-1").set(
        {"id": "enc-1", "orgId": DEMO_ORG, "doctorId": "doc-1", "patientId": "pat-1",
         "startedAt": _now_iso(-1440), "endedAt": _now_iso(-1425), "status": "completed",
         "encounterType": "chest_pain", "detectedLanguages": ["hi", "hi-en", "en"],
         "summary": "Reviewed hypertension. BP 150/95. Started Amlodipine. Reported mild chest tightness on exertion.",
         "transcript": [
             {"role": "patient", "text": "Doctor sahab, seene mein dard ho raha hai", "language": "hi", "at": int(time.time() * 1000)},
             {"role": "doctor", "text": "Kab se ho raha hai? Does it radiate to your arm?", "language": "hi-en", "at": int(time.time() * 1000)},
             {"role": "patient", "text": "Since morning. Yes, it goes to my left arm", "language": "en", "at": int(time.time() * 1000)},
         ]}
    )
    database.collection("encounters").document("enc-0").set(
        {"id": "enc-0", "orgId": DEMO_ORG, "doctorId": "doc-1", "patientId": "pat-1",
         "startedAt": _now_iso(-43200), "endedAt": _now_iso(-43185), "status": "completed",
         "encounterType": "general", "detectedLanguages": ["hi"],
         "summary": "Routine check. Diagnosed hypertension. Advised low-salt diet and lifestyle changes.",
         "transcript": []}
    )

    # ── Appointments (Arya can schedule / reschedule against these) ─────
    database.collection("appointments").document("appt-1").set(
        {"id": "appt-1", "orgId": DEMO_ORG, "patientId": "pat-1", "doctorId": "doc-1",
         "scheduledAt": f"{_date(14)} 10:30", "status": "booked", "reason": "BP re-check", "createdAt": _now_iso(-1440)}
    )

    # ── Glossary — locked medical-term translations ─────────────────────
    glossary = {
        "hypertension": {"hi": "उच्च रक्तचाप", "ta": "உயர் இரத்த அழுத்தம்", "bn": "উচ্চ রক্তচাপ"},
        "diabetes": {"hi": "मधुमेह", "ta": "நீரிழிவு", "bn": "ডায়াবেটিস"},
        "chest pain": {"hi": "सीने में दर्द", "ta": "மார்பு வலி", "bn": "বুকে ব্যথা"},
        "fever": {"hi": "बुखार", "ta": "காய்ச்சல்", "bn": "জ্বর"},
        "blood pressure": {"hi": "रक्तचाप", "ta": "இரத்த அழுத்தம்", "bn": "রক্তচাপ"},
    }
    for term, translations in glossary.items():
        database.collection("glossary").document(term).set({"term": term, "translations": translations})

    # ── Calls + alerts for console/analytics ────────────────────────────
    calls = [
        {"id": "call-1", "direction": "inbound", "fromNumber": "+919000000010", "toNumber": "+911140000000", "triageLevel": "emergency", "patientId": "pat-1", "latencyMetrics": {"p50": 640, "p95": 910, "samples": 12}},
        {"id": "call-2", "direction": "inbound", "fromNumber": "+919000000011", "toNumber": "+911140000000", "triageLevel": "routine", "patientId": "pat-2", "latencyMetrics": {"p50": 580, "p95": 820, "samples": 9}},
        {"id": "call-3", "direction": "outbound", "fromNumber": "+911140000000", "toNumber": "+919000000012", "triageLevel": "routine", "patientId": "pat-3", "latencyMetrics": {"p50": 610, "p95": 870, "samples": 7}},
    ]
    for call in calls:
        database.collection("calls").document(call["id"]).set({**call, "orgId": DEMO_ORG, "startedAt": _now_iso(-30)})

    database.collection("alerts").document("alert-1").set(
        {"id": "alert-1", "orgId": DEMO_ORG, "severity": "critical", "kind": "red_flag", "title": "Cardiac red flag",
         "body": "Patient Ramesh Kumar reported chest pain radiating to left arm.", "encounterRef": "enc-1", "callRef": "call-1", "createdAt": _now_iso(-30)}
    )

    return {"seeded": True, "org": DEMO_ORG, "patients": len(patients), "calls": len(calls)}
