"""Call/conversation intelligence for the doctor's review dashboard: an AI
summary, structured insights, and a quality read on how Arya handled the call.
Falls back to a heuristic when no LLM key is present."""
from __future__ import annotations

import json
from typing import Any

from config import get_settings


def _transcript_text(turns: list[dict]) -> str:
    return "\n".join(f"{t.get('role','?')}: {t.get('text','')}" for t in turns)


def summarize_call(turns: list[dict], language: str = "en") -> dict[str, Any]:
    settings = get_settings()
    transcript = _transcript_text(turns)
    if not settings.openai_api_key or not transcript.strip():
        return _heuristic(turns)
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model=settings.openai_notes_model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": (
                    "You review an AI health-assistant (Arya) call transcript for a "
                    "doctor. Return JSON with: summary (2-3 sentences, English), "
                    "topics (list of short tags), patientConcerns (list), "
                    "actionsTaken (list, e.g. booked appointment), followUpNeeded "
                    "(bool), redFlag (bool), handledWell (bool), and "
                    "possibleIssues (list of any incorrect/missed/uncertain "
                    "responses by Arya the doctor should check)."
                )},
                {"role": "user", "content": f"Transcript:\n{transcript}"},
            ],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        return {
            "summary": data.get("summary", ""),
            "insights": {
                "topics": data.get("topics", []),
                "patientConcerns": data.get("patientConcerns", []),
                "actionsTaken": data.get("actionsTaken", []),
                "followUpNeeded": bool(data.get("followUpNeeded", False)),
                "redFlag": bool(data.get("redFlag", False)),
                "handledWell": bool(data.get("handledWell", True)),
                "possibleIssues": data.get("possibleIssues", []),
            },
        }
    except Exception:
        return _heuristic(turns)


def _heuristic(turns: list[dict]) -> dict[str, Any]:
    text = _transcript_text(turns).lower()
    topics = [t for t in ["medication", "diet", "appointment", "chest", "sugar", "blood pressure"] if t in text]
    return {
        "summary": "Patient spoke with Arya about " + (", ".join(topics) or "general care") + ".",
        "insights": {
            "topics": topics,
            "patientConcerns": [],
            "actionsTaken": ["booked appointment"] if "appointment" in text else [],
            "followUpNeeded": "appointment" in text,
            "redFlag": any(w in text for w in ["chest pain", "breathless", "bleeding"]),
            "handledWell": True,
            "possibleIssues": [],
        },
    }


def duration_seconds(turns: list[dict]) -> int:
    ats = [t.get("at") for t in turns if isinstance(t.get("at"), (int, float))]
    if len(ats) >= 2:
        return max(0, int((max(ats) - min(ats)) / 1000))
    return 0
