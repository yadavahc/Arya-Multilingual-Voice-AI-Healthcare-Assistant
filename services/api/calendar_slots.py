"""Doctor calendar: generate available appointment slots from a doctor's
availability (working days/hours, slot length, lunch) minus already-booked
appointments. Shared by the patient booking UI, the doctor view, and Arya's
voice/chat scheduling tools so everyone sees one calendar."""
from __future__ import annotations

import time
from datetime import datetime, timedelta

from firestore_client import db

_DEFAULT_AVAIL = {"days": [0, 1, 2, 3, 4, 5], "start": "09:00", "end": "17:00",
                  "slotMinutes": 30, "lunch": {"start": "13:00", "end": "14:00"}}


def _doctor_availability(doctor_id: str) -> dict:
    snap = db().collection("users").document(doctor_id).get()
    if snap.exists:
        return (snap.to_dict() or {}).get("availability") or _DEFAULT_AVAIL
    return _DEFAULT_AVAIL


def _booked(doctor_id: str, date: str) -> set[str]:
    return {
        (s.to_dict() or {}).get("time")
        for s in db().collection("appointments").stream()
        if (s.to_dict() or {}).get("doctorId") == doctor_id
        and (s.to_dict() or {}).get("date") == date
        and (s.to_dict() or {}).get("status") == "booked"
    }


def _hhmm_range(start: str, end: str, step_min: int):
    t = datetime.strptime(start, "%H:%M")
    endt = datetime.strptime(end, "%H:%M")
    while t < endt:
        yield t.strftime("%H:%M")
        t += timedelta(minutes=step_min)


def available_slots(doctor_id: str, date: str) -> list[str]:
    """Open slots (HH:MM) for a doctor on a given YYYY-MM-DD date."""
    avail = _doctor_availability(doctor_id)
    try:
        weekday = datetime.strptime(date, "%Y-%m-%d").weekday()  # Mon=0
    except ValueError:
        return []
    if weekday not in avail.get("days", _DEFAULT_AVAIL["days"]):
        return []

    booked = _booked(doctor_id, date)
    lunch = avail.get("lunch") or {}
    slots = []
    now = datetime.now()
    for hhmm in _hhmm_range(avail["start"], avail["end"], avail.get("slotMinutes", 30)):
        # Skip lunch window.
        if lunch and lunch.get("start", "") <= hhmm < lunch.get("end", ""):
            continue
        # Skip past times if the date is today.
        if date == now.strftime("%Y-%m-%d") and hhmm <= now.strftime("%H:%M"):
            continue
        if hhmm in booked:
            continue
        slots.append(hhmm)
    return slots


def next_available(doctor_id: str, from_days: int = 1, search_days: int = 14):
    """Find the earliest open (date, time) within the next `search_days`."""
    base = time.time()
    for i in range(from_days, from_days + search_days):
        date = time.strftime("%Y-%m-%d", time.gmtime(base + i * 86400))
        slots = available_slots(doctor_id, date)
        if slots:
            return {"date": date, "slots": slots[:6]}
    return {"date": None, "slots": []}
