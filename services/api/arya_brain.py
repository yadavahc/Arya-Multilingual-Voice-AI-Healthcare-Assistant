"""Arya's conversational brain — shared by the text chat endpoint (works today)
and the voice agent (same logic over audio once LiveKit is wired).

Given a patient's full context (history, medications, care plan, appointments)
it holds a natural, low-latency conversation and can take real actions —
answering medication/diet/rest/follow-up questions and scheduling, rescheduling
or negotiating appointments — via function calling, with no human in the loop
for routine interactions.
"""
from __future__ import annotations

import json
import time
from typing import Any, Optional

from config import get_settings
from firestore_client import audit, db

# ── Context assembly ────────────────────────────────────────────────────
def build_patient_context(patient_id: str) -> dict[str, Any]:
    database = db()
    psnap = database.collection("patients").document(patient_id).get()
    patient = (psnap.to_dict() or {}) if psnap.exists else {}

    prescriptions = [
        s.to_dict() for s in database.collection("prescriptions").stream()
        if (s.to_dict() or {}).get("patientId") == patient_id
    ]
    encounters = sorted(
        [s.to_dict() or {} for s in database.collection("encounters").stream()
         if (s.to_dict() or {}).get("patientId") == patient_id],
        key=lambda e: e.get("startedAt", ""), reverse=True,
    )
    appointments = [
        s.to_dict() for s in database.collection("appointments").stream()
        if (s.to_dict() or {}).get("patientId") == patient_id
        and (s.to_dict() or {}).get("status") == "booked"
    ]
    care = next(
        (s.to_dict() for s in database.collection("careplans").stream()
         if (s.to_dict() or {}).get("patientId") == patient_id),
        None,
    )
    from documents import get_document_text

    return {
        "patient": patient,
        "prescriptions": prescriptions,
        "encounters": encounters[:3],
        "appointments": appointments,
        "carePlan": care,
        "document": get_document_text(patient_id),
    }


def context_summary(ctx: dict[str, Any]) -> str:
    """Compact, prompt-ready summary. Kept short to protect the latency budget."""
    p = ctx.get("patient", {})
    lines = [
        f"Patient: {p.get('name','')} ({p.get('sex','')}, DOB {p.get('dob','')}).",
        f"Conditions: {', '.join(p.get('conditions', [])) or 'none recorded'}.",
        f"Allergies: {', '.join(p.get('allergies', [])) or 'none'}.",
        f"Preferred language: {p.get('preferredLanguage','en')}.",
    ]
    for rx in ctx.get("prescriptions", []):
        for d in rx.get("drugs", []):
            lines.append(f"Medication: {d.get('name')} {d.get('dose')} — {d.get('frequency')}. {d.get('instructions','')}")
        missed = [a for a in rx.get("adherenceLog", []) if a.get("status") == "missed"]
        if missed:
            lines.append(f"Note: {len(missed)} recently missed dose(s).")
    care = ctx.get("carePlan")
    if care:
        lines.append(f"Diet advice: {care.get('diet','')}")
        lines.append(f"Rest advice: {care.get('rest','')}")
        lines.append(f"Follow-up: {care.get('followUp','')}")
    for enc in ctx.get("encounters", []):
        if enc.get("summary"):
            lines.append(f"Past visit ({enc.get('startedAt','')[:10]}): {enc.get('summary')}")
    for appt in ctx.get("appointments", []):
        lines.append(f"Upcoming appointment: {appt.get('scheduledAt')} — {appt.get('reason','')}")
    return "\n".join(lines)


_LANG_NAMES = {
    "en": "English", "hi": "Hindi", "kn": "Kannada", "ta": "Tamil",
    "te": "Telugu", "ml": "Malayalam", "mr": "Marathi", "bn": "Bengali",
    "gu": "Gujarati", "pa": "Punjabi", "or": "Odia",
}

# Unicode script blocks → language. Devanagari defaults to Hindi.
_SCRIPT_BLOCKS = [
    ("bn", 0x0980, 0x09FF), ("pa", 0x0A00, 0x0A7F), ("gu", 0x0A80, 0x0AFF),
    ("or", 0x0B00, 0x0B7F), ("ta", 0x0B80, 0x0BFF), ("te", 0x0C00, 0x0C7F),
    ("kn", 0x0C80, 0x0CFF), ("ml", 0x0D00, 0x0D7F), ("hi", 0x0900, 0x097F),
]


def detect_message_language(text: str) -> str:
    """Detect language from script so we can force the reply language."""
    for ch in text:
        cp = ord(ch)
        for lang, lo, hi in _SCRIPT_BLOCKS:
            if lo <= cp <= hi:
                return lang
    # Latin text: English, or romanized Hindi if markers appear.
    low = text.lower()
    if any(w in low for w in (" hai", " kya", " dawai", " kab", " nahi", "mujhe", "aap")):
        return "hi"
    return "en"


def companion_system_prompt(ctx: dict[str, Any]) -> str:
    lang = ctx.get("patient", {}).get("preferredLanguage", "en")
    return (
        "You are Arya, a warm, careful multilingual healthcare voice companion "
        "answering on behalf of the patient's doctor. The patient has called the "
        "clinic; you handle the call directly, escalating to the human doctor for "
        "anything clinically serious or outside routine care.\n\n"
        "LANGUAGES: You fluently speak English, Hindi, Kannada, Tamil, Telugu, "
        "Malayalam, Marathi, Bengali, Gujarati, Punjabi and Odia. ALWAYS "
        "reply in the SAME language the patient used in their latest message — if "
        "they write in English, reply in English; in Hindi, reply in Hindi; and so "
        "on. Mirror code-switching (Hinglish/Tanglish/Kanglish) too. Only if it's "
        f"ambiguous, default to their preferred language ('{lang}'). Keep replies "
        "short and natural — one or two sentences, as if on a phone call.\n\n"
        "MEDICAL ACCURACY (critical — this is health advice):\n"
        "- Only state medication names, doses, timings, diet, and appointment "
        "details that come from the patient's actual records via your tools. NEVER "
        "invent or guess a drug, dose, frequency, or date. If a detail isn't in the "
        "records, say you'll have the doctor confirm it.\n"
        "- Do not diagnose new conditions, change prescribed doses, or recommend new "
        "medicines. You reinforce the doctor's existing plan; you do not create one.\n"
        "- For anything beyond the recorded plan, or if the patient sounds unwell, "
        "advise them to consult the doctor and offer to book an appointment.\n\n"
        "YOU CAN help with: medication instructions and timing, whether doses were "
        "taken, rest, diet, follow-up care, and appointments. You can check the "
        "doctor's live calendar and book, reschedule, or negotiate a real slot "
        "yourself with your tools — offer concrete available times, confirm before "
        "booking, and never promise a slot you haven't verified is free.\n\n"
        "EMERGENCY: If the patient describes crushing/radiating chest pain, stroke "
        "signs (face droop, arm weakness, slurred speech), severe breathlessness, "
        "heavy bleeding, or self-harm — stop, calmly tell them to seek emergency "
        "care immediately, and say the doctor is being alerted.\n\n"
        "Known patient context (do not read aloud; use to personalize):\n"
        + context_summary(ctx)
        + (
            "\n\nUploaded patient document (answer questions grounded in this; if "
            "the answer isn't here, say so):\n" + ctx["document"][:8000]
            if ctx.get("document")
            else ""
        )
    )


# ── Tools (OpenAI function-calling schema) ──────────────────────────────
TOOLS = [
    {"type": "function", "function": {
        "name": "get_medication_schedule",
        "description": "Get the patient's current medications, dose times, and adherence.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "log_medication_taken",
        "description": "Record whether the patient took a dose.",
        "parameters": {"type": "object", "properties": {
            "drug": {"type": "string", "description": "Medication name, or 'latest' if unspecified."},
            "taken": {"type": "boolean"},
        }, "required": ["taken"]},
    }},
    {"type": "function", "function": {
        "name": "get_care_instructions",
        "description": "Get diet, rest, follow-up, or red-flag guidance from the care plan.",
        "parameters": {"type": "object", "properties": {
            "topic": {"type": "string", "enum": ["diet", "rest", "followUp", "redFlags", "all"]},
        }, "required": ["topic"]},
    }},
    {"type": "function", "function": {
        "name": "get_next_appointment",
        "description": "Get the patient's next booked appointment.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_available_slots",
        "description": "Propose available appointment slots near a preferred day.",
        "parameters": {"type": "object", "properties": {
            "preferred_day": {"type": "string", "description": "e.g. 'tomorrow', 'Monday', '2026-07-25'."},
        }},
    }},
    {"type": "function", "function": {
        "name": "book_appointment",
        "description": "Book a new appointment.",
        "parameters": {"type": "object", "properties": {
            "day": {"type": "string"}, "time": {"type": "string"}, "reason": {"type": "string"},
        }, "required": ["day", "time"]},
    }},
    {"type": "function", "function": {
        "name": "reschedule_appointment",
        "description": "Reschedule the patient's existing appointment to a new day/time.",
        "parameters": {"type": "object", "properties": {
            "new_day": {"type": "string"}, "new_time": {"type": "string"},
        }, "required": ["new_day", "new_time"]},
    }},
]


def _iso(offset_min: int = 0) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + offset_min * 60))


def execute_tool(name: str, args: dict, patient_id: str, ctx: dict) -> dict:
    """Run a tool against Firestore. Returns a JSON-serializable result the model
    reads back to compose its spoken reply."""
    database = db()

    if name == "get_medication_schedule":
        meds, schedule, missed = [], [], 0
        for rx in ctx.get("prescriptions", []):
            meds += [f"{d.get('name')} {d.get('dose')} — {d.get('frequency')} ({d.get('instructions','')})" for d in rx.get("drugs", [])]
            schedule += [f"{s.get('timeOfDay')} {s.get('hhmm')}: {s.get('drug')}" for s in rx.get("schedule", [])]
            missed += sum(1 for a in rx.get("adherenceLog", []) if a.get("status") == "missed")
        return {"medications": meds, "schedule": schedule, "missedDoses": missed}

    if name == "log_medication_taken":
        entry = {"patientId": patient_id, "drug": args.get("drug", "latest"),
                 "status": "taken" if args.get("taken") else "missed",
                 "scheduledAt": _iso(), "confirmedVia": "chat"}
        database.collection("adherence").document(f"adh-{int(time.time()*1000)}").set(entry)
        audit("patient", "log_medication", f"patients/{patient_id}")
        return {"logged": True, "status": entry["status"]}

    if name == "get_care_instructions":
        care = ctx.get("carePlan") or {}
        topic = args.get("topic", "all")
        if topic == "all":
            return {k: care.get(k, "") for k in ("diet", "rest", "followUp", "redFlags")}
        return {topic: care.get(topic, "No specific guidance recorded.")}

    if name == "get_next_appointment":
        appts = ctx.get("appointments", [])
        if not appts:
            return {"next": None}
        return {"next": appts[0].get("scheduledAt"), "reason": appts[0].get("reason", "")}

    doctor_id = ctx.get("patient", {}).get("primaryDoctorId") or "doc-1"

    if name == "get_available_slots":
        from calendar_slots import available_slots, next_available
        day = args.get("preferred_day", "")
        # Try to resolve a concrete date; otherwise return the next open day.
        date = _resolve_day(day)
        if date:
            slots = available_slots(doctor_id, date)
            if slots:
                return {"date": date, "slots": slots[:6]}
        nxt = next_available(doctor_id)
        return {"date": nxt["date"], "slots": nxt["slots"], "note": "nearest available"}

    if name == "book_appointment":
        from calendar_slots import available_slots
        date = _resolve_day(args.get("day", "")) or args.get("day")
        tm = args.get("time")
        if date and tm and tm not in available_slots(doctor_id, date):
            return {"booked": False, "reason": "slot_taken", "message": "That time is not free; please offer another."}
        appt_id = f"appt-{int(time.time()*1000)}"
        appt = {"id": appt_id, "orgId": ctx.get("patient", {}).get("orgId", "demo-org"),
                "hospitalId": ctx.get("patient", {}).get("hospitalId"),
                "patientId": patient_id, "patientName": ctx.get("patient", {}).get("name", "Patient"),
                "doctorId": doctor_id, "date": date, "time": tm, "status": "booked",
                "reason": args.get("reason", "Follow-up"), "createdAt": _iso()}
        database.collection("appointments").document(appt_id).set(appt)
        _notify_doctor_booking(appt, ctx)
        audit("patient", "book_appointment", f"appointments/{appt_id}")
        return {"booked": True, "date": date, "time": tm}

    if name == "reschedule_appointment":
        from calendar_slots import available_slots
        appts = ctx.get("appointments", [])
        date = _resolve_day(args.get("new_day", "")) or args.get("new_day")
        tm = args.get("new_time")
        if not appts:
            return {"rescheduled": False, "reason": "no existing appointment"}
        if date and tm and tm not in available_slots(doctor_id, date):
            return {"rescheduled": False, "reason": "slot_taken", "message": "That time is not free; offer another."}
        appt_id = appts[0].get("id")
        database.collection("appointments").document(appt_id).update({"date": date, "time": tm, "status": "booked"})
        audit("patient", "reschedule_appointment", f"appointments/{appt_id}")
        return {"rescheduled": True, "date": date, "time": tm}

    return {"error": f"unknown tool {name}"}


def _notify_doctor_booking(appt: dict, ctx: dict) -> None:
    """Alert the assigned doctor + email the patient when Arya books by voice/chat."""
    database = db()
    alert_id = f"alert-{int(time.time()*1000)}"
    database.collection("alerts").document(alert_id).set(
        {"id": alert_id, "orgId": appt.get("orgId", "demo-org"), "severity": "info",
         "kind": "appointment", "title": "New appointment booked (via Arya)",
         "body": f"{appt.get('patientName','A patient')} booked {appt.get('date')} at {appt.get('time')}.",
         "doctorId": appt.get("doctorId"), "patientRef": appt.get("patientId"), "createdAt": _iso()}
    )
    patient = ctx.get("patient", {})
    if patient.get("email"):
        try:
            from integrations import send_email

            send_email(
                patient["email"],
                f"Appointment confirmed — {appt.get('date')} at {appt.get('time')}",
                f"<p>Namaste {patient.get('name','')},</p><p>Arya has booked your appointment for "
                f"<b>{appt.get('date')} at {appt.get('time')}</b>.</p>",
            )
        except Exception:
            pass


def _resolve_day(text: str) -> str | None:
    """Resolve a natural day reference to YYYY-MM-DD (best-effort)."""
    import re
    from datetime import datetime, timedelta

    t = (text or "").strip().lower()
    if re.match(r"^\d{4}-\d{2}-\d{2}", t):
        return t[:10]
    today = datetime.now()
    if "today" in t:
        return today.strftime("%Y-%m-%d")
    if "tomorrow" in t:
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")
    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for i, wd in enumerate(weekdays):
        if wd in t:
            delta = (i - today.weekday()) % 7
            delta = delta or 7  # next occurrence
            return (today + timedelta(days=delta)).strftime("%Y-%m-%d")
    return None


# ── Chat loop ───────────────────────────────────────────────────────────
def chat(patient_id: str, messages: list[dict], max_tool_rounds: int = 4,
         forced_language: str | None = None) -> dict:
    """Run one assistant turn: may call tools, then returns Arya's reply.

    messages: prior [{role, content}] turns from the patient/assistant.
    forced_language: if set (from the website language selector), Arya replies
    ONLY in this language regardless of the input language.
    Returns {reply, actions:[...], context_used: bool}.
    """
    settings = get_settings()
    ctx = build_patient_context(patient_id)

    if not settings.openai_api_key:
        # Offline fallback: still answer basic intents deterministically.
        return {"reply": _offline_reply(messages, ctx), "actions": [], "context_used": bool(ctx.get("patient"))}

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    # Reply language: the user's chosen website language wins; else detect it.
    last_user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
    reply_lang = forced_language if forced_language in _LANG_NAMES else detect_message_language(last_user)
    lang_directive = {
        "role": "system",
        "content": f"The patient's latest message is in {_LANG_NAMES[reply_lang]}. "
        f"You MUST write your entire reply in {_LANG_NAMES[reply_lang]} only.",
    }
    convo = [{"role": "system", "content": companion_system_prompt(ctx)}, lang_directive] + messages
    actions: list[dict] = []

    for _ in range(max_tool_rounds):
        resp = client.chat.completions.create(
            model=settings.openai_notes_model, temperature=0.3,
            messages=convo, tools=TOOLS, tool_choice="auto",
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            return {"reply": msg.content or "", "actions": actions, "context_used": True}

        convo.append({"role": "assistant", "content": msg.content or "", "tool_calls": [
            {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
            for tc in msg.tool_calls
        ]})
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except Exception:
                args = {}
            result = execute_tool(tc.function.name, args, patient_id, ctx)
            actions.append({"tool": tc.function.name, "args": args, "result": result})
            # Refresh context if an action changed state.
            if tc.function.name in ("book_appointment", "reschedule_appointment", "log_medication_taken"):
                ctx = build_patient_context(patient_id)
            convo.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})

    # Final synthesis after tool rounds.
    resp = client.chat.completions.create(model=settings.openai_notes_model, temperature=0.3, messages=convo)
    return {"reply": resp.choices[0].message.content or "", "actions": actions, "context_used": True}


def _offline_reply(messages: list[dict], ctx: dict) -> str:
    last = (messages[-1].get("content", "") if messages else "").lower()
    care = ctx.get("carePlan") or {}
    if any(w in last for w in ("diet", "eat", "food", "khana")):
        return care.get("diet", "Please follow a balanced, low-salt diet.")
    if any(w in last for w in ("rest", "sleep", "walk")):
        return care.get("rest", "Get adequate rest and light activity.")
    if any(w in last for w in ("appointment", "book", "schedule", "next visit")):
        appts = ctx.get("appointments", [])
        return f"Your next appointment is on {appts[0].get('scheduledAt')}." if appts else "You have no upcoming appointment; I can book one."
    if any(w in last for w in ("medicine", "tablet", "dose", "goli", "medication")):
        rx = ctx.get("prescriptions", [])
        if rx and rx[0].get("drugs"):
            d = rx[0]["drugs"][0]
            return f"Take {d.get('name')} {d.get('dose')} {d.get('frequency')}."
    return "I'm here to help with your medicines, diet, rest, and appointments. What would you like to know?"
