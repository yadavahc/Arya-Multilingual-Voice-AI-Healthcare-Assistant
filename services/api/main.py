"""Arya FastAPI service — clinical intelligence + integrations backend.

Owns Firestore writes (with audit logging), the LangGraph note/gap pipelines,
LiveKit token minting, payments, telephony messaging, and the analytics the
dashboard reads. Runs fully offline (in-memory store + heuristic LLM stubs) so
the whole product is demoable without cloud keys, and becomes real when keys
are supplied.
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from arya_brain import build_patient_context, chat as arya_chat, context_summary
from config import get_settings
from firestore_client import audit, db, mode
from graphs.gap_graph import detect_gaps
from graphs.soap_graph import run_soap_pipeline
from integrations import create_payment_link, send_push, send_sms
from livekit_tokens import create_token
from pdf_gen import claim_bundle_pdf, medication_pictogram_pdf
from seed import seed as seed_demo

app = FastAPI(title="Arya API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@app.on_event("startup")
def _startup() -> None:
    # Seed demo data if the org doesn't exist yet. Never crash startup if the
    # datastore isn't reachable yet (e.g. Firestore API not enabled) — the app
    # still serves, and endpoints surface the error per-request.
    try:
        snap = db().collection("organizations").document("demo-org").get()
        if not snap.exists:
            seed_demo()
    except Exception as exc:  # pragma: no cover
        import logging

        logging.getLogger("arya.api").warning(
            "startup seed skipped (datastore not ready): %s", str(exc)[:200]
        )


# ── Health / meta ───────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict:
    return {"ok": True, "store": mode(), "llm": bool(get_settings().openai_api_key)}


@app.post("/seed")
def seed_endpoint() -> dict:
    return seed_demo()


# ── LiveKit token (web joins agent rooms) ───────────────────────────────
class TokenReq(BaseModel):
    room: str
    identity: str
    name: str = ""
    role: str = "companion"  # companion | triage | scribe | adherence
    patientId: Optional[str] = None


@app.post("/token")
def token(req: TokenReq) -> dict:
    # Encode role + patient id in metadata so the agent picks the right persona
    # and prefetches the caller's context during the ringing state.
    import json as _json

    meta = _json.dumps({"role": req.role, "patientId": req.patientId})
    jwt = create_token(req.room, req.identity, req.name, metadata=meta)
    return {"token": jwt, "url": get_settings().livekit_url, "room": req.room}


# ── Auth: resolve a phone number to a role/identity (login portals) ─────
class ResolveReq(BaseModel):
    phone: str
    portal: str  # "doctor" | "patient"


def _e164(phone: str) -> str:
    """Normalize an Indian number to +91XXXXXXXXXX so lookups are format-agnostic."""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    return phone.strip() if phone.strip().startswith("+") else f"+{digits}"


@app.post("/auth/resolve")
def auth_resolve(req: ResolveReq) -> dict:
    phone = _e164(req.phone)
    # Find a user record by phone (comparing normalized forms).
    match = next(
        (s.to_dict() for s in db().collection("users").stream()
         if _e164((s.to_dict() or {}).get("phone", "")) == phone),
        None,
    )
    if match:
        role = match.get("role")
        # Enforce portal separation: doctors can't enter via the patient portal
        # and vice-versa.
        if req.portal == "doctor" and role not in ("doctor", "admin", "frontdesk"):
            raise HTTPException(403, "This number is not registered as clinical staff.")
        if req.portal == "patient" and role != "patient":
            raise HTTPException(403, "This number is registered as staff; use the staff portal.")
        return {
            "uid": match.get("uid"), "role": role, "orgId": match.get("orgId"),
            "displayName": match.get("displayName"), "patientId": match.get("patientId"),
            "preferredLanguage": match.get("preferredLanguage", "en"),
        }

    # Unknown number. Doctors must be pre-registered; patients self-provision.
    if req.portal == "doctor":
        raise HTTPException(403, "No clinician found for this number. Contact your admin.")
    pat_id = f"pat-{int(time.time()*1000)}"
    db().collection("patients").document(pat_id).set(
        {"id": pat_id, "orgId": "demo-org", "name": "New Patient", "phone": phone,
         "preferredLanguage": "en", "allergies": [], "meds": [], "conditions": [],
         "createdAt": _now_iso()}
    )
    uid = f"user-{pat_id}"
    db().collection("users").document(uid).set(
        {"uid": uid, "role": "patient", "orgId": "demo-org", "patientId": pat_id,
         "displayName": "New Patient", "phone": phone, "preferredLanguage": "en", "createdAt": _now_iso()}
    )
    audit("system", "provision_patient", f"patients/{pat_id}")
    return {"uid": uid, "role": "patient", "orgId": "demo-org", "displayName": "New Patient",
            "patientId": pat_id, "preferredLanguage": "en", "isNew": True}


# ── Patient context (Arya's knowledge for a call) ───────────────────────
@app.get("/patients/{patient_id}/context")
def patient_context(patient_id: str) -> dict:
    ctx = build_patient_context(patient_id)
    return {"context": ctx, "summary": context_summary(ctx)}


# ── Arya conversational brain (text now; same logic powers voice) ───────
class ChatReq(BaseModel):
    patientId: str
    messages: list[dict]  # [{role: "user"|"assistant", content: str}]


@app.post("/arya/chat")
def arya_chat_endpoint(req: ChatReq) -> dict:
    result = arya_chat(req.patientId, req.messages)
    return result


# ── Appointment reschedule (voice + chat) ───────────────────────────────
class RescheduleReq(BaseModel):
    orgId: str = "demo-org"
    patientId: str
    newDay: str
    newTime: str


@app.post("/appointments/reschedule")
def appointments_reschedule(req: RescheduleReq) -> dict:
    appt = next(
        (s for s in db().collection("appointments").stream()
         if (s.to_dict() or {}).get("patientId") == req.patientId
         and (s.to_dict() or {}).get("status") == "booked"),
        None,
    )
    new_when = f"{req.newDay} {req.newTime}"
    if appt is None:
        raise HTTPException(404, "No booked appointment to reschedule.")
    db().collection("appointments").document(appt.id).update({"scheduledAt": new_when})
    audit("system", "reschedule_appointment", f"appointments/{appt.id}")
    return {"rescheduled": True, "scheduledAt": new_when, "spoken": f"Done, I've moved your appointment to {new_when}."}


# ── Glossary ────────────────────────────────────────────────────────────
@app.get("/glossary")
def glossary(terms: Optional[str] = None) -> dict:
    wanted = set(t.strip() for t in terms.split(",")) if terms else None
    out: dict[str, dict] = {}
    for snap in db().collection("glossary").stream():
        data = snap.to_dict() or {}
        if wanted and snap.id not in wanted:
            continue
        out[snap.id] = data.get("translations", {})
    return {"terms": out}


# ── Patient summary (prefetched by agent during ringing) ────────────────
@app.get("/patients/{patient_id}/summary")
def patient_summary(patient_id: str) -> dict:
    snap = db().collection("patients").document(patient_id).get()
    if not snap.exists:
        return {"summary": ""}
    p = snap.to_dict() or {}
    summary = (
        f"{p.get('name','')}, preferred language {p.get('preferredLanguage','en')}. "
        f"Allergies: {', '.join(p.get('allergies', [])) or 'none'}. "
        f"Current meds: {', '.join(p.get('meds', [])) or 'none'}."
    )
    return {"summary": summary}


# ── Notes pipeline ──────────────────────────────────────────────────────
class NoteReq(BaseModel):
    encounterType: str = "general"
    patientLanguage: str = "en"


@app.post("/encounters/{encounter_id}/note")
async def generate_note(encounter_id: str, req: NoteReq) -> dict:
    snap = db().collection("encounters").document(encounter_id).get()
    if not snap.exists:
        raise HTTPException(404, "encounter not found")
    enc = snap.to_dict() or {}
    transcript = "\n".join(
        f"{t.get('role','?')}: {t.get('text','')}" for t in enc.get("transcript", [])
    )
    result = await run_soap_pipeline(
        transcript, req.encounterType or enc.get("encounterType", "general"), req.patientLanguage
    )
    note = {
        "id": f"note-{encounter_id}",
        "encounterId": encounter_id,
        "soap": result.get("soap", {}),
        "icd10": result.get("icd10", []),
        "cpt": result.get("cpt", []),
        "differentials": result.get("differentials", []),
        "patientSummaryTranslated": result.get("patient_summary", ""),
        "patientSummaryLanguage": req.patientLanguage,
        "createdAt": _now_iso(),
    }
    db().collection("notes").document(note["id"]).set(note)
    audit("system", "generate_note", f"encounters/{encounter_id}")
    return note


@app.post("/encounters/{encounter_id}/gaps")
async def encounter_gaps(encounter_id: str, progress: float = 1.0) -> dict:
    snap = db().collection("encounters").document(encounter_id).get()
    if not snap.exists:
        raise HTTPException(404, "encounter not found")
    enc = snap.to_dict() or {}
    transcript = "\n".join(
        f"{t.get('role','?')}: {t.get('text','')}" for t in enc.get("transcript", [])
    )
    gaps = await detect_gaps(transcript, enc.get("encounterType", "general"), progress)
    # Only surface at ~80% through the visit.
    surface = gaps if progress >= 0.8 else []
    return {"gaps": gaps, "surface": surface}


# ── Triage escalation ───────────────────────────────────────────────────
class EscalateReq(BaseModel):
    orgId: str
    callId: str
    patientId: Optional[str] = None
    flag: str
    excerpt: str


@app.post("/escalate")
def escalate(req: EscalateReq) -> dict:
    alert_id = f"alert-{int(time.time()*1000)}"
    db().collection("alerts").document(alert_id).set(
        {
            "id": alert_id, "orgId": req.orgId, "severity": "critical", "kind": "red_flag",
            "title": f"Red flag: {req.flag.replace('_',' ')}", "body": req.excerpt,
            "callRef": req.callId, "createdAt": _now_iso(),
        }
    )
    # SMS + push to on-call doctor with transcript link + one-tap dial-back.
    link = f"/call-console?call={req.callId}"
    send_sms("+919000000001", f"ARYA ALERT ({req.flag}): open {link}")
    send_push(None, "Arya red-flag alert", req.flag.replace("_", " "), {"callId": req.callId})
    audit("system", "escalate", f"calls/{req.callId}")
    return {"alertId": alert_id, "dispatched": True}


# ── Appointments (voice tool) ───────────────────────────────────────────
class ApptReq(BaseModel):
    orgId: str
    patientId: Optional[str] = None
    preferredDay: str
    preferredTime: str
    reason: str


@app.post("/appointments")
def appointments(req: ApptReq) -> dict:
    appt_id = f"appt-{int(time.time()*1000)}"
    scheduled = f"{req.preferredDay} {req.preferredTime}"
    db().collection("appointments").document(appt_id).set(
        {"id": appt_id, "orgId": req.orgId, "patientId": req.patientId, "scheduledAt": scheduled, "reason": req.reason, "createdAt": _now_iso()}
    )
    return {"id": appt_id, "scheduledAt": scheduled, "spoken": f"Done, I've booked you for {scheduled}."}


# ── Payments (voice tool + webhook) ─────────────────────────────────────
class PayLinkReq(BaseModel):
    orgId: str
    patientId: Optional[str] = None
    amount: int  # paise
    currency: str = "INR"
    note: str = "Consultation fee"


@app.post("/payments/link")
def payment_link(req: PayLinkReq) -> dict:
    phone = "+910000000000"
    if req.patientId:
        snap = db().collection("patients").document(req.patientId).get()
        if snap.exists:
            phone = (snap.to_dict() or {}).get("phone", phone)
    link = create_payment_link(req.amount, req.currency, req.note, phone)
    pay_id = f"pay-{int(time.time()*1000)}"
    db().collection("payments").document(pay_id).set(
        {
            "id": pay_id, "orgId": req.orgId, "patientId": req.patientId, "provider": "razorpay",
            "amount": req.amount, "currency": req.currency, "status": "created",
            "invoiceUrl": link.get("short_url"), "createdAt": _now_iso(),
        }
    )
    rupees = req.amount / 100
    send_sms(phone, f"Arya: {req.note} — pay ₹{rupees:.0f}: {link.get('short_url')}")
    return {"id": pay_id, "link": link.get("short_url"), "spoken": f"Your fee is {rupees:.0f} rupees. I've sent the payment link by SMS."}


@app.post("/payments/webhook")
async def payments_webhook(request: Request) -> dict:
    # In production: verify X-Razorpay-Signature with RAZORPAY_WEBHOOK_SECRET.
    payload = await request.json()
    entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = entity.get("order_id")
    audit("razorpay", "payment_webhook", f"payments/{order_id}")
    return {"received": True}


# ── Availability (front-desk voice tool) ────────────────────────────────
@app.get("/availability")
def availability(orgId: str, resource: str) -> dict:
    stub = {"opd": "4 OPD slots open this afternoon", "bed": "2 general beds available"}
    msg = stub.get(resource.lower(), f"Let me check {resource} for you.")
    return {"resource": resource, "spoken": msg}


# ── Adherence ───────────────────────────────────────────────────────────
class AdherenceReq(BaseModel):
    patientId: Optional[str] = None
    callId: str
    taken: bool


@app.post("/adherence/log")
def adherence_log(req: AdherenceReq) -> dict:
    entry = {"slotHHMM": time.strftime("%H:%M"), "scheduledAt": _now_iso(), "status": "taken" if req.taken else "missed", "confirmedVia": "voice"}
    db().collection("adherence").document(f"adh-{int(time.time()*1000)}").set({"patientId": req.patientId, "callId": req.callId, **entry})
    spoken = "Shabaash! Well done for taking your medicine." if req.taken else "Okay, please take it as soon as you can."
    return {"logged": True, "spoken": spoken}


# ── Prescription pictogram PDF ──────────────────────────────────────────
class PictogramReq(BaseModel):
    patientName: str
    drugs: list[dict]
    schedule: list[dict]


@app.post("/prescriptions/pictogram")
def pictogram(req: PictogramReq):
    from fastapi.responses import Response

    pdf = medication_pictogram_pdf(req.patientName, req.drugs, req.schedule)
    return Response(content=pdf, media_type="application/pdf")


# ── Analytics / list endpoints (dashboard + console) ────────────────────
@app.get("/calls")
def list_calls(orgId: str = "demo-org") -> dict:
    calls = [s.to_dict() for s in db().collection("calls").stream() if (s.to_dict() or {}).get("orgId") == orgId]
    return {"calls": calls}


@app.get("/alerts")
def list_alerts(orgId: str = "demo-org") -> dict:
    alerts = [s.to_dict() for s in db().collection("alerts").stream() if (s.to_dict() or {}).get("orgId") == orgId]
    return {"alerts": alerts}


@app.get("/encounters")
def list_encounters(orgId: str = "demo-org") -> dict:
    encs = [s.to_dict() for s in db().collection("encounters").stream() if (s.to_dict() or {}).get("orgId") == orgId]
    return {"encounters": encs}


@app.get("/analytics")
def analytics(orgId: str = "demo-org") -> dict:
    calls = [s.to_dict() or {} for s in db().collection("calls").stream() if (s.to_dict() or {}).get("orgId") == orgId]
    alerts = [s.to_dict() or {} for s in db().collection("alerts").stream() if (s.to_dict() or {}).get("orgId") == orgId]
    encs = [s.to_dict() or {} for s in db().collection("encounters").stream() if (s.to_dict() or {}).get("orgId") == orgId]

    lang_dist: dict[str, int] = {}
    for e in encs:
        for lang in e.get("detectedLanguages", []):
            lang_dist[lang] = lang_dist.get(lang, 0) + 1

    p50s = [c.get("latencyMetrics", {}).get("p50") for c in calls if c.get("latencyMetrics", {}).get("p50")]
    return {
        "docTimeSavedMinutes": len(encs) * 7,  # ~7 min saved per documented encounter
        "languageDistribution": lang_dist,
        "redFlagCatches": sum(1 for a in alerts if a.get("kind") == "red_flag"),
        "avgLatencyP50": round(sum(p50s) / len(p50s)) if p50s else None,
        "totalCalls": len(calls),
        "emergencyCalls": sum(1 for c in calls if c.get("triageLevel") == "emergency"),
    }
