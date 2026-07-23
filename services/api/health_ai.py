"""AI health features: medicine verification & condition detection from images
(OpenAI vision), a personalized diet generator, and wearable abnormal‑reading
detection. All degrade gracefully to safe stubs without an OpenAI key."""
from __future__ import annotations

import base64
import json
from typing import Any

from config import get_settings


# gpt-4.1-mini is multimodal (supports images). Override via OPENAI_VISION_MODEL.
def _vision_model() -> str:
    import os
    return os.getenv("OPENAI_VISION_MODEL", get_settings().openai_notes_model)


def _client():
    from openai import OpenAI
    return OpenAI(api_key=get_settings().openai_api_key)


def _vision_json(prompt: str, image_bytes: bytes, mime: str = "image/jpeg") -> dict[str, Any]:
    if not get_settings().openai_api_key:
        return {}
    b64 = base64.b64encode(image_bytes).decode()
    resp = _client().chat.completions.create(
        model=_vision_model(),
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ]}],
    )
    try:
        return json.loads(resp.choices[0].message.content or "{}")
    except Exception:
        return {}


# ── 1. Smart medicine verification ──────────────────────────────────────
def verify_medicine(image_bytes: bytes, mime: str, prescribed: list[dict],
                    current_meds: list[str]) -> dict[str, Any]:
    """Identify a medicine strip and cross‑check it against the prescription."""
    out = _vision_json(
        "You are a pharmacist assistant. From this photo of a medicine strip/pack, "
        "identify it. Return JSON: {name, salt (active ingredient), strength, form, "
        "manufacturer, expiryText (as printed), purpose (what it treats in one line), "
        "howToTake (typical instruction), confidence (0-1)}. If unreadable, set name to null.",
        image_bytes, mime,
    )
    name = (out.get("name") or "").lower()
    salt = (out.get("salt") or "").lower()

    # Cross-check against the prescription.
    rx_names = [f"{d.get('name','')} {d.get('salt','')}".lower() for d in prescribed]
    matches_rx = any(name and (name in rx or (salt and salt in rx)) for rx in rx_names) if name else False

    # Duplicate detection against current meds.
    dup = [m for m in current_meds if name and name.split()[0] in m.lower()]

    # Expiry check.
    expired = _is_expired(out.get("expiryText", ""))

    warnings = []
    if not matches_rx and name:
        warnings.append("This medicine is not on your current prescription — check with your doctor before taking it.")
    if len(dup) > 1 or (dup and salt and any(salt in m.lower() for m in current_meds)):
        warnings.append("You may already be taking this or a similar medicine — possible duplicate.")
    if expired is True:
        warnings.append("⚠️ This medicine appears to be EXPIRED. Do not take it.")

    return {
        "identified": bool(name),
        "medicine": out,
        "matchesPrescription": matches_rx,
        "possibleDuplicate": bool(dup),
        "expired": expired,
        "warnings": warnings,
    }


def _is_expired(expiry_text: str) -> Any:
    import re
    from datetime import datetime
    if not expiry_text:
        return None
    m = re.search(r"(0?[1-9]|1[0-2])[/\-\s]?(\d{2,4})", expiry_text)
    if not m:
        return None
    month = int(m.group(1))
    year = int(m.group(2))
    year += 2000 if year < 100 else 0
    try:
        return datetime(year, month, 1) < datetime.now().replace(day=1)
    except Exception:
        return None


# ── 2. Disease / condition detection from images ────────────────────────
def detect_condition(image_bytes: bytes, mime: str, note: str = "") -> dict[str, Any]:
    out = _vision_json(
        "You are a careful clinical triage assistant looking at a photo of a visible "
        "condition (skin rash, eye, burn, swelling, wound, etc.). Give a PRELIMINARY, "
        "non-diagnostic assessment. Return JSON: {observation (what you see), "
        "possibleConditions (list, most likely first), urgency ('routine'|'see_doctor_soon'|'urgent'), "
        "advice (short self-care or next step), seekCareIf (warning signs), "
        f"disclaimer}}. Patient note: '{note}'.",
        image_bytes, mime,
    )
    if not out:
        out = {"observation": "Unable to analyze the image automatically.",
               "possibleConditions": [], "urgency": "see_doctor_soon",
               "advice": "Please consult a doctor.", "seekCareIf": "Symptoms worsen.",
               "disclaimer": ""}
    out["disclaimer"] = ("This is an AI preliminary assessment, NOT a medical diagnosis. "
                         "Always consult a qualified doctor for an accurate diagnosis and treatment.")
    return out


# ── 3. Personalized diet generator ──────────────────────────────────────
def generate_diet(patient: dict, care_plan: dict | None, document_text: str = "") -> dict[str, Any]:
    conditions = ", ".join(patient.get("conditions", [])) or "general wellness"
    settings = get_settings()
    if not settings.openai_api_key:
        return _diet_stub(conditions)
    try:
        resp = _client().chat.completions.create(
            model=settings.openai_notes_model, temperature=0.4,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a clinical dietitian for Indian patients. "
                 "Create a safe, culturally appropriate ONE-DAY diet plan. Return JSON: "
                 "{breakfast, midMorning, lunch, evening, dinner, calorieTarget (kcal number), "
                 "proteinTarget (grams number), waterLitres (number), avoid (list), notes}. "
                 "Tailor to the conditions (e.g. low-salt for hypertension, low-glycemic for "
                 "diabetes, low-potassium for kidney disease, extra iron/protein for pregnancy)."},
                {"role": "user", "content": f"Conditions: {conditions}. "
                 f"Age/sex: {patient.get('dob','')}/{patient.get('sex','')}. "
                 f"Care plan diet note: {(care_plan or {}).get('diet','')}. "
                 f"Reports: {document_text[:1500]}"},
            ],
        )
        return json.loads(resp.choices[0].message.content or "{}") or _diet_stub(conditions)
    except Exception:
        return _diet_stub(conditions)


def _diet_stub(conditions: str) -> dict:
    return {
        "breakfast": "Vegetable oats with a boiled egg and a small fruit.",
        "midMorning": "A handful of nuts / buttermilk.",
        "lunch": "2 rotis, dal, seasonal vegetable, salad, curd.",
        "evening": "Roasted chana with green tea.",
        "dinner": "Millet khichdi with vegetables and a bowl of salad.",
        "calorieTarget": 1800, "proteinTarget": 60, "waterLitres": 2.5,
        "avoid": ["Excess salt", "Sugar and sweets", "Fried/processed food"],
        "notes": f"General plan for: {conditions}. Consult your doctor before major changes.",
    }


# ── 4. Wearable abnormal‑reading detection ──────────────────────────────
def analyze_wearables(metrics: dict) -> dict[str, Any]:
    """Flag abnormal readings from synced wearable data (Google Fit / Health Connect)."""
    alerts = []
    hr = metrics.get("restingHeartRate")
    spo2 = metrics.get("spo2")
    sleep = metrics.get("sleepHours")
    steps = metrics.get("steps")

    if isinstance(spo2, (int, float)) and spo2 < 94:
        alerts.append({"metric": "SpO₂", "value": f"{spo2}%", "level": "high",
                       "message": f"Low blood oxygen ({spo2}%). If you feel breathless, seek care."})
    if isinstance(hr, (int, float)) and (hr > 100 or hr < 45):
        alerts.append({"metric": "Resting HR", "value": f"{hr} bpm", "level": "medium",
                       "message": f"Resting heart rate {hr} bpm is outside the normal range (60–100)."})
    if isinstance(sleep, (int, float)) and sleep < 5:
        alerts.append({"metric": "Sleep", "value": f"{sleep} h", "level": "low",
                       "message": f"Only {sleep} h of sleep — aim for 7–8 hours."})
    if isinstance(steps, (int, float)) and steps < 2000:
        alerts.append({"metric": "Activity", "value": f"{steps} steps", "level": "low",
                       "message": "Low activity today — a short walk would help your BP and sugar."})

    status = "attention" if any(a["level"] == "high" for a in alerts) else (
        "review" if alerts else "good")
    return {"alerts": alerts, "status": status}
