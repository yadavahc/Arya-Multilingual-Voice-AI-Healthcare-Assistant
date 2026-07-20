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
    return {
        "patient": patient,
        "prescriptions": prescriptions,
        "encounters": encounters[:3],
        "appointments": appointments,
        "carePlan": care,
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


def companion_system_prompt(ctx: dict[str, Any]) -> str:
    lang = ctx.get("patient", {}).get("preferredLanguage", "en")
    return (
        "You are Arya, a warm, careful multilingual healthcare voice companion "
        "answering on behalf of the patient's doctor. The patient has called the "
        "clinic; you handle the call directly, only escalating to the human doctor "
        "for anything clinically serious or outside routine care.\n\n"
        f"Reply in the patient's language (preferred: '{lang}'), mirroring how they "
        "speak (including Hinglish/Tanglish code-switching). Keep replies short and "
        "natural, one or two sentences, as if speaking on a phone call.\n\n"
        "You can and should help with: medication instructions and timing, whether "
        "doses were taken, rest, diet, follow-up care, and next appointments. You "
        "can schedule, reschedule, or negotiate appointment times yourself using "
        "your tools — do not tell the patient to call back or wait for a human for "
        "routine requests. Use the tools to fetch real data and take real actions; "
        "never invent medication names, doses, or appointment times.\n\n"
        "If the patient describes an emergency (crushing/radiating chest pain, "
        "stroke signs, severe breathlessness, heavy bleeding, or self-harm), stop "
        "and calmly tell them to seek emergency care immediately and that the "
        "doctor is being alerted.\n\n"
        "Known patient context (do not read aloud; use to personalize):\n"
        + context_summary(ctx)
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

    if name == "get_available_slots":
        # Propose three plausible slots (a real impl checks the doctor's calendar).
        base = time.time() + 2 * 86400
        slots = [time.strftime("%Y-%m-%d", time.gmtime(base + i * 86400)) + t
                 for i, t in enumerate([" 10:00", " 15:30", " 11:15"])]
        return {"slots": slots}

    if name == "book_appointment":
        appt_id = f"appt-{int(time.time()*1000)}"
        scheduled = f"{args.get('day')} {args.get('time')}"
        database.collection("appointments").document(appt_id).set(
            {"id": appt_id, "orgId": ctx.get("patient", {}).get("orgId", "demo-org"),
             "patientId": patient_id, "doctorId": "doc-1", "scheduledAt": scheduled,
             "status": "booked", "reason": args.get("reason", "Follow-up"), "createdAt": _iso()}
        )
        audit("patient", "book_appointment", f"appointments/{appt_id}")
        return {"booked": True, "scheduledAt": scheduled}

    if name == "reschedule_appointment":
        appts = ctx.get("appointments", [])
        new_when = f"{args.get('new_day')} {args.get('new_time')}"
        if appts:
            appt_id = appts[0].get("id")
            database.collection("appointments").document(appt_id).update({"scheduledAt": new_when, "status": "booked"})
            audit("patient", "reschedule_appointment", f"appointments/{appt_id}")
            return {"rescheduled": True, "scheduledAt": new_when}
        return {"rescheduled": False, "reason": "no existing appointment"}

    return {"error": f"unknown tool {name}"}


# ── Chat loop ───────────────────────────────────────────────────────────
def chat(patient_id: str, messages: list[dict], max_tool_rounds: int = 4) -> dict:
    """Run one assistant turn: may call tools, then returns Arya's reply.

    messages: prior [{role, content}] turns from the patient/assistant.
    Returns {reply, actions:[...], context_used: bool}.
    """
    settings = get_settings()
    ctx = build_patient_context(patient_id)

    if not settings.openai_api_key:
        # Offline fallback: still answer basic intents deterministically.
        return {"reply": _offline_reply(messages, ctx), "actions": [], "context_used": bool(ctx.get("patient"))}

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    convo = [{"role": "system", "content": companion_system_prompt(ctx)}] + messages
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
