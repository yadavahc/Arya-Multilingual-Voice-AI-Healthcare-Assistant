"""Seed demo data so the app is populated on first run (dashboards, calls, notes)."""
from __future__ import annotations

import time

from firestore_client import db

DEMO_ORG = "demo-org"


def _now_iso(offset_min: int = 0) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + offset_min * 60))


def seed() -> dict:
    database = db()

    database.collection("organizations").document(DEMO_ORG).set(
        {"id": DEMO_ORG, "name": "Arya Demo Clinic", "plan": "clinic", "region": "asia-south1", "createdAt": _now_iso(-1000)}
    )

    database.collection("users").document("doc-1").set(
        {"uid": "doc-1", "role": "doctor", "orgId": DEMO_ORG, "displayName": "Dr. Meera Nair", "phone": "+919000000001", "preferredLanguage": "en", "createdAt": _now_iso(-1000)}
    )

    patients = [
        {"id": "pat-1", "name": "Ramesh Kumar", "phone": "+919000000010", "preferredLanguage": "hi", "allergies": ["penicillin"], "meds": ["amlodipine 5mg"]},
        {"id": "pat-2", "name": "Lakshmi Iyer", "phone": "+919000000011", "preferredLanguage": "ta", "allergies": [], "meds": []},
        {"id": "pat-3", "name": "Anjali Das", "phone": "+919000000012", "preferredLanguage": "bn", "allergies": ["sulfa"], "meds": ["metformin 500mg"]},
    ]
    for p in patients:
        database.collection("patients").document(p["id"]).set({**p, "orgId": DEMO_ORG, "createdAt": _now_iso(-500)})

    # Glossary — locked medical-term translations.
    glossary = {
        "hypertension": {"hi": "उच्च रक्तचाप", "ta": "உயர் இரத்த அழுத்தம்", "bn": "উচ্চ রক্তচাপ"},
        "diabetes": {"hi": "मधुमेह", "ta": "நீரிழிவு", "bn": "ডায়াবেটিস"},
        "chest pain": {"hi": "सीने में दर्द", "ta": "மார்பு வலி", "bn": "বুকে ব্যথা"},
        "fever": {"hi": "बुखार", "ta": "காய்ச்சல்", "bn": "জ্বর"},
    }
    for term, translations in glossary.items():
        database.collection("glossary").document(term).set({"term": term, "translations": translations})

    # A completed encounter with a note.
    database.collection("encounters").document("enc-1").set(
        {
            "id": "enc-1", "orgId": DEMO_ORG, "doctorId": "doc-1", "patientId": "pat-1",
            "startedAt": _now_iso(-60), "endedAt": _now_iso(-45), "status": "completed",
            "encounterType": "chest_pain", "detectedLanguages": ["hi", "hi-en", "en"],
            "transcript": [
                {"role": "patient", "text": "Doctor sahab, seene mein dard ho raha hai", "language": "hi", "at": int(time.time() * 1000)},
                {"role": "doctor", "text": "Kab se ho raha hai? Does it radiate to your arm?", "language": "hi-en", "at": int(time.time() * 1000)},
                {"role": "patient", "text": "Since morning. Yes, it goes to my left arm", "language": "en", "at": int(time.time() * 1000)},
            ],
        }
    )

    # Some calls for the console + analytics.
    calls = [
        {"id": "call-1", "direction": "inbound", "fromNumber": "+919000000010", "toNumber": "+911140000000", "triageLevel": "emergency", "patientId": "pat-1", "latencyMetrics": {"p50": 640, "p95": 910, "samples": 12}},
        {"id": "call-2", "direction": "inbound", "fromNumber": "+919000000011", "toNumber": "+911140000000", "triageLevel": "routine", "patientId": "pat-2", "latencyMetrics": {"p50": 580, "p95": 820, "samples": 9}},
        {"id": "call-3", "direction": "outbound", "fromNumber": "+911140000000", "toNumber": "+919000000012", "triageLevel": "routine", "patientId": "pat-3", "latencyMetrics": {"p50": 610, "p95": 870, "samples": 7}},
    ]
    for call in calls:
        database.collection("calls").document(call["id"]).set({**call, "orgId": DEMO_ORG, "startedAt": _now_iso(-30)})

    database.collection("alerts").document("alert-1").set(
        {"id": "alert-1", "orgId": DEMO_ORG, "severity": "critical", "kind": "red_flag", "title": "Cardiac red flag", "body": "Patient Ramesh Kumar reported chest pain radiating to left arm.", "encounterRef": "enc-1", "callRef": "call-1", "createdAt": _now_iso(-30)}
    )

    return {"seeded": True, "org": DEMO_ORG, "patients": len(patients), "calls": len(calls)}
