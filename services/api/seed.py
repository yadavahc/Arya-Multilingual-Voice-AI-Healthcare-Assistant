"""Seed demo data: a hospital with a connected doctor + patient, a realistic
prescription, the doctor's calendar/availability, and conversation history — so
Arya has real context and the doctor can track what was discussed."""
from __future__ import annotations

import time

from firestore_client import db

DEMO_ORG = "demo-org"
HOSPITAL_ID = "hosp-oxford"

# Real accounts used for Google sign-in (mapped to roles + the same hospital).
PATIENT_EMAIL = "yadavahc333@gmail.com"
DOCTOR_EMAIL = "yadavaoxford@gmail.com"
PATIENT_PHONE = "+918904030441"
DOCTOR_PHONE = "+919481479268"


def _now_iso(offset_min: int = 0) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + offset_min * 60))


def _date(offset_days: int = 0) -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + offset_days * 86400))


def seed() -> dict:
    d = db()

    # ── Hospital / organization ─────────────────────────────────────────
    d.collection("organizations").document(DEMO_ORG).set(
        {"id": DEMO_ORG, "name": "Arya Health Network", "plan": "clinic", "region": "asia-south1", "createdAt": _now_iso(-9000)}
    )
    d.collection("hospitals").document(HOSPITAL_ID).set(
        {"id": HOSPITAL_ID, "orgId": DEMO_ORG, "name": "Oxford Health Multispeciality, Bengaluru",
         "city": "Bengaluru", "departments": ["Cardiology", "General Medicine", "Endocrinology"],
         "createdAt": _now_iso(-9000)}
    )
    d.collection("hospitals").document("hosp-city").set(
        {"id": "hosp-city", "orgId": DEMO_ORG, "name": "City Care Hospital, Mysuru",
         "city": "Mysuru", "departments": ["General Medicine", "Pediatrics"], "createdAt": _now_iso(-9000)}
    )

    # ── Doctor (Google account: yadavaoxford@gmail.com) ─────────────────
    d.collection("users").document("doc-1").set(
        {"uid": "doc-1", "role": "doctor", "orgId": DEMO_ORG, "hospitalId": HOSPITAL_ID,
         "displayName": "Dr. Aisha Rao", "email": DOCTOR_EMAIL, "phone": DOCTOR_PHONE,
         "specialty": "Cardiology", "preferredLanguage": "en",
         # Doctor defines exactly THREE bookable slots per working day.
         "availability": {"days": [0, 1, 2, 3, 4, 5], "slots": ["10:00", "12:30", "16:00"]},
         "createdAt": _now_iso(-9000)}
    )

    # ── Patient (Google account: yadavahc333@gmail.com) ─────────────────
    d.collection("patients").document("pat-1").set(
        {"id": "pat-1", "orgId": DEMO_ORG, "hospitalId": HOSPITAL_ID, "primaryDoctorId": "doc-1",
         "name": "Ramesh Kumar", "email": PATIENT_EMAIL, "phone": PATIENT_PHONE,
         "sex": "male", "dob": "1958-04-12", "bloodGroup": "B+",
         "conditions": ["Hypertension", "Hyperlipidemia", "Type 2 Diabetes"],
         "allergies": ["Penicillin"], "preferredLanguage": "hi",
         "vitals": {"bp": "150/95", "pulse": 82, "weightKg": 78, "heightCm": 168, "hba1c": 7.8},
         "createdAt": _now_iso(-9000)}
    )
    d.collection("users").document("user-pat-1").set(
        {"uid": "user-pat-1", "role": "patient", "orgId": DEMO_ORG, "hospitalId": HOSPITAL_ID,
         "patientId": "pat-1", "displayName": "Ramesh Kumar", "email": PATIENT_EMAIL,
         "phone": PATIENT_PHONE, "preferredLanguage": "hi", "createdAt": _now_iso(-9000)}
    )

    # ── Realistic prescription ──────────────────────────────────────────
    d.collection("prescriptions").document("rx-1").set(
        {"id": "rx-1", "orgId": DEMO_ORG, "hospitalId": HOSPITAL_ID, "patientId": "pat-1",
         "doctorId": "doc-1", "doctorName": "Dr. Aisha Rao", "encounterId": "enc-1",
         "diagnosis": "Essential hypertension with dyslipidemia; Type 2 diabetes mellitus.",
         "issuedAt": _date(-1),
         "drugs": [
             {"name": "Amlodipine", "strength": "5 mg", "form": "Tablet", "frequency": "Once daily",
              "timing": "Morning, after breakfast", "durationDays": 30, "instructions": "For blood pressure. Do not stop suddenly."},
             {"name": "Atorvastatin", "strength": "10 mg", "form": "Tablet", "frequency": "Once daily",
              "timing": "Night, after dinner", "durationDays": 30, "instructions": "For cholesterol."},
             {"name": "Metformin", "strength": "500 mg", "form": "Tablet", "frequency": "Twice daily",
              "timing": "After breakfast and after dinner", "durationDays": 30, "instructions": "For blood sugar. Take with food."},
         ],
         "advice": "Low-salt, low-sugar diet. 30 minutes walking daily. Home BP monitoring.",
         "followUp": _date(13),
         "schedule": [
             {"timeOfDay": "morning", "hhmm": "08:00", "withFood": True, "drug": "Amlodipine 5 mg"},
             {"timeOfDay": "morning", "hhmm": "08:00", "withFood": True, "drug": "Metformin 500 mg"},
             {"timeOfDay": "night", "hhmm": "21:00", "withFood": True, "drug": "Atorvastatin 10 mg"},
             {"timeOfDay": "night", "hhmm": "21:00", "withFood": True, "drug": "Metformin 500 mg"},
         ],
         "adherenceLog": [
             {"slotHHMM": "08:00", "scheduledAt": _now_iso(-1440), "status": "taken", "confirmedVia": "voice"},
             {"slotHHMM": "21:00", "scheduledAt": _now_iso(-720), "status": "missed"},
         ],
         "createdAt": _now_iso(-1440)}
    )

    # ── Care plan (diet/rest/follow-up/red-flags Arya can quote) ─────────
    d.collection("careplans").document("care-pat-1").set(
        {"id": "care-pat-1", "patientId": "pat-1", "orgId": DEMO_ORG,
         "diet": "Low-salt DASH diet. Avoid pickles, papad, fried and processed food. For diabetes, avoid sugar, sweets, and white rice in excess. Prefer millets, vegetables, dal, and fruit in moderation.",
         "rest": "Sleep 7-8 hours. Walk 30 minutes daily at an easy pace. Avoid heavy lifting and strenuous exertion until BP is controlled.",
         "followUp": f"Blood pressure and blood sugar re-check on {_date(13)}. Bring your home BP readings and this prescription.",
         "redFlags": "Chest pain, breathlessness, severe headache, sudden weakness or slurred speech, or fasting sugar above 300 — go to emergency or call immediately.",
         "updatedAt": _now_iso(-1440)}
    )

    # ── Past consultations (history + doctor-visible transcript) ────────
    d.collection("encounters").document("enc-1").set(
        {"id": "enc-1", "orgId": DEMO_ORG, "hospitalId": HOSPITAL_ID, "doctorId": "doc-1", "patientId": "pat-1",
         "startedAt": _now_iso(-1440), "endedAt": _now_iso(-1425), "status": "completed",
         "encounterType": "chest_pain", "detectedLanguages": ["hi", "hi-en", "en"],
         "summary": "Reviewed hypertension and diabetes. BP 150/95, HbA1c 7.8. Continued Amlodipine, added Metformin. Mild exertional chest tightness — advised monitoring and follow-up.",
         "transcript": [
             {"role": "patient", "text": "Doctor sahab, seene mein halka dard rehta hai", "language": "hi", "at": int(time.time() * 1000)},
             {"role": "doctor", "text": "Kab hota hai? On walking or at rest?", "language": "hi-en", "at": int(time.time() * 1000)},
             {"role": "patient", "text": "Walking ke time. Rest karne pe theek ho jata hai", "language": "hi", "at": int(time.time() * 1000)},
         ]}
    )

    # ── Doctor's calendar: one confirmed appointment (14 days out) ──────
    d.collection("appointments").document("appt-1").set(
        {"id": "appt-1", "orgId": DEMO_ORG, "hospitalId": HOSPITAL_ID, "patientId": "pat-1",
         "patientName": "Ramesh Kumar", "doctorId": "doc-1", "date": _date(13), "time": "10:00",
         "status": "confirmed", "reason": "BP & sugar re-check", "createdAt": _now_iso(-1440)}
    )

    # ── Conversations (chat/voice, saved for the doctor to review) ──────
    d.collection("conversations").document("conv-seed").set(
        {"id": "conv-seed", "orgId": DEMO_ORG, "patientId": "pat-1", "doctorId": "doc-1",
         "channel": "voice", "language": "hi", "startedAt": _now_iso(-600),
         "summary": "Patient asked about BP medicine timing and diet; Arya confirmed schedule and advised low-salt food.",
         "turns": [
             {"role": "patient", "text": "Meri BP ki dawai kab leni hai?", "at": int(time.time() * 1000) - 600000},
             {"role": "arya", "text": "Amlodipine subah 8 baje breakfast ke baad leni hai.", "at": int(time.time() * 1000) - 590000},
         ]}
    )

    # ── Glossary — locked medical terms in the 4 supported languages ────
    glossary = {
        "hypertension": {"hi": "उच्च रक्तचाप", "kn": "ಅಧಿಕ ರಕ್ತದೊತ್ತಡ", "ta": "உயர் இரத்த அழுத்தம்"},
        "diabetes": {"hi": "मधुमेह", "kn": "ಮಧುಮೇಹ", "ta": "நீரிழிவு"},
        "chest pain": {"hi": "सीने में दर्द", "kn": "ಎದೆ ನೋವು", "ta": "மார்பு வலி"},
        "blood pressure": {"hi": "रक्तचाप", "kn": "ರಕ್ತದೊತ್ತಡ", "ta": "இரத்த அழுத்தம்"},
        "blood sugar": {"hi": "रक्त शर्करा", "kn": "ರಕ್ತದ ಸಕ್ಕರೆ", "ta": "இரத்த சர்க்கரை"},
        "medicine": {"hi": "दवाई", "kn": "ಔಷಧಿ", "ta": "மருந்து"},
    }
    for term, tr in glossary.items():
        d.collection("glossary").document(term).set({"term": term, "translations": tr})

    # ── Calls + alerts for console/analytics ────────────────────────────
    for c in [
        {"id": "call-1", "direction": "inbound", "fromNumber": PATIENT_PHONE, "toNumber": "+918040000000", "triageLevel": "routine", "patientId": "pat-1", "latencyMetrics": {"p50": 620, "p95": 880, "samples": 10}},
    ]:
        d.collection("calls").document(c["id"]).set({**c, "orgId": DEMO_ORG, "startedAt": _now_iso(-30)})

    return {"seeded": True, "hospital": HOSPITAL_ID, "doctor": DOCTOR_EMAIL, "patient": PATIENT_EMAIL}
