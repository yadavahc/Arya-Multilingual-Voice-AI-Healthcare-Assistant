"""Function-calling tools the voice agent can invoke mid-conversation.

Each tool calls the FastAPI service, which owns Firestore writes + audit logging.
Tools are defined with LiveKit Agents' @function_tool decorator so the Realtime
model can call them natively during a turn.
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from livekit.agents import function_tool, RunContext

API = os.getenv("API_BASE_URL", "http://localhost:8080").rstrip("/")


async def _post(path: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=6.0) as client:
        resp = await client.post(f"{API}{path}", json=payload)
        resp.raise_for_status()
        return resp.json()


async def _get(path: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=6.0) as client:
        resp = await client.get(f"{API}{path}", params=params)
        resp.raise_for_status()
        return resp.json()


def build_tools(*, org_id: str, patient_id: Optional[str], call_id: str) -> list:
    """Return the tool list, closed over the current session's identifiers."""

    @function_tool
    async def book_appointment(
        ctx: RunContext,
        preferred_day: str,
        preferred_time: str,
        reason: str,
    ) -> str:
        """Book or reschedule an appointment for the patient.

        Args:
            preferred_day: e.g. "tomorrow", "2026-07-22", "Monday".
            preferred_time: e.g. "morning", "15:30".
            reason: short reason for the visit.
        """
        data = await _post(
            "/appointments",
            {
                "orgId": org_id,
                "patientId": patient_id,
                "preferredDay": preferred_day,
                "preferredTime": preferred_time,
                "reason": reason,
            },
        )
        return data.get(
            "spoken",
            f"Booked for {data.get('scheduledAt', preferred_day)}.",
        )

    @function_tool
    async def send_payment_link(ctx: RunContext, amount_rupees: float, note: str) -> str:
        """Create a Razorpay payment link and send it to the patient by SMS/WhatsApp.

        Args:
            amount_rupees: consultation/other fee in INR.
            note: what the payment is for.
        """
        data = await _post(
            "/payments/link",
            {
                "orgId": org_id,
                "patientId": patient_id,
                "amount": int(amount_rupees * 100),
                "currency": "INR",
                "note": note,
            },
        )
        return data.get("spoken", "I've sent you the payment link by SMS.")

    @function_tool
    async def lookup_slot_availability(ctx: RunContext, resource: str) -> str:
        """Look up OPD/bed slot availability (for front-desk voice queries).

        Args:
            resource: "opd", "bed", or a department name.
        """
        data = await _get(
            "/availability", {"orgId": org_id, "resource": resource}
        )
        return data.get("spoken", "Let me check the availability for you.")

    @function_tool
    async def log_medication_taken(ctx: RunContext, taken: bool) -> str:
        """Log whether the patient took their scheduled dose (adherence loop).

        Args:
            taken: True if the patient confirms they took the medication.
        """
        data = await _post(
            "/adherence/log",
            {"patientId": patient_id, "callId": call_id, "taken": taken},
        )
        return data.get("spoken", "Thank you, I've noted that down.")

    return [
        book_appointment,
        send_payment_link,
        lookup_slot_availability,
        log_medication_taken,
    ]
