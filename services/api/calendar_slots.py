"""Doctor calendar: each doctor defines exactly THREE time slots per working
day. A patient booking takes one of those slots (any slot already held by a
pending or confirmed appointment is unavailable). Shared by the booking UI, the
doctor view, and Arya's voice/chat scheduling so everyone sees one calendar."""
from __future__ import annotations

import time
from datetime import datetime

from firestore_client import db

# Default three slots/day if a doctor hasn't customized them.
_DEFAULT_AVAIL = {"days": [0, 1, 2, 3, 4, 5], "slots": ["10:00", "12:30", "16:00"]}


def _doctor_availability(doctor_id: str) -> dict:
    snap = db().collection("users").document(doctor_id).get()
    if snap.exists:
        avail = (snap.to_dict() or {}).get("availability") or {}
        # Support both the new 3-slots model and any legacy start/end config.
        if avail.get("slots"):
            return {"days": avail.get("days", _DEFAULT_AVAIL["days"]), "slots": avail["slots"][:3]}
    return _DEFAULT_AVAIL


def _taken(doctor_id: str, date: str) -> set[str]:
    """Slots held by a pending OR confirmed appointment on that date."""
    return {
        (s.to_dict() or {}).get("time")
        for s in db().collection("appointments").stream()
        if (s.to_dict() or {}).get("doctorId") == doctor_id
        and (s.to_dict() or {}).get("date") == date
        and (s.to_dict() or {}).get("status") in ("pending", "confirmed", "booked")
    }


def available_slots(doctor_id: str, date: str) -> list[str]:
    """The doctor's open slots (HH:MM) on a given YYYY-MM-DD date."""
    avail = _doctor_availability(doctor_id)
    try:
        weekday = datetime.strptime(date, "%Y-%m-%d").weekday()  # Mon=0
    except ValueError:
        return []
    if weekday not in avail.get("days", _DEFAULT_AVAIL["days"]):
        return []
    taken = _taken(doctor_id, date)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    out = []
    for hhmm in avail["slots"]:
        if date == now[:10] and hhmm <= now[11:]:
            continue  # past slot today
        if hhmm in taken:
            continue
        out.append(hhmm)
    return out


def next_available(doctor_id: str, from_days: int = 0, search_days: int = 14):
    """Find the earliest date (within search_days) that has an open slot."""
    base = time.time()
    for i in range(from_days, from_days + search_days):
        date = time.strftime("%Y-%m-%d", time.localtime(base + i * 86400))
        slots = available_slots(doctor_id, date)
        if slots:
            return {"date": date, "slots": slots}
    return {"date": None, "slots": []}
