"""Ambient gap-detection ("Arya Nudge").

Maintains a required-field checklist per encounter type and, given the running
transcript, returns which required fields have NOT yet been covered. Surfaced as
silent, non-interrupting cards on the doctor's screen.
"""
from __future__ import annotations

from typing import Any

from .llm import json_call

# Per-encounter-type required checklist. Extend freely; this is the clinical spine.
CHECKLISTS: dict[str, list[dict[str, str]]] = {
    "chest_pain": [
        {"field": "onset", "label": "Onset / timing of pain"},
        {"field": "radiation", "label": "Radiation (e.g. to left arm/jaw)"},
        {"field": "exertional", "label": "Relation to exertion"},
        {"field": "cardiac_risk", "label": "Cardiac risk factors"},
        {"field": "family_history_cad", "label": "Family history of CAD"},
        {"field": "medication_list", "label": "Current medications"},
    ],
    "general": [
        {"field": "chief_complaint", "label": "Chief complaint"},
        {"field": "duration", "label": "Duration of symptoms"},
        {"field": "allergies", "label": "Known allergies"},
        {"field": "medication_list", "label": "Current medications"},
    ],
}

# Cheap keyword heuristics used when no LLM key is present.
_HEURISTIC_HINTS: dict[str, list[str]] = {
    "onset": ["started", "began", "since", "onset", "ago"],
    "radiation": ["radiat", "left arm", "jaw", "spread", "shoulder"],
    "exertional": ["walking", "exert", "climb", "stairs", "rest", "activity"],
    "cardiac_risk": ["smoke", "diabetes", "cholesterol", "bp", "blood pressure", "hypertension"],
    "family_history_cad": ["family", "father", "mother", "heart attack", "cad"],
    "medication_list": ["taking", "medicine", "medication", "tablet", "pills", "dose"],
    "chief_complaint": ["problem", "complaint", "feeling", "pain", "symptom"],
    "duration": ["days", "weeks", "months", "since", "hours"],
    "allergies": ["allergic", "allergy", "reaction"],
}


async def detect_gaps(
    transcript: str, encounter_type: str, progress: float = 1.0
) -> list[dict[str, Any]]:
    """Return open required fields. `progress` 0..1 is how far through the visit
    we are; cards should only surface at ~0.8 (caller enforces)."""
    checklist = CHECKLISTS.get(encounter_type, CHECKLISTS["general"])

    covered = await _covered_fields_llm(transcript, checklist)
    if covered is None:
        covered = _covered_fields_heuristic(transcript, checklist)

    return [
        {"field": item["field"], "label": item["label"]}
        for item in checklist
        if item["field"] not in covered
    ]


async def _covered_fields_llm(transcript: str, checklist) -> list[str] | None:
    fields = ", ".join(i["field"] for i in checklist)
    out = await json_call(
        "You audit a live consult transcript against a required-question "
        "checklist. Return which checklist fields have been ADEQUATELY covered.",
        f"Checklist fields: {fields}\n\nTranscript:\n{transcript}",
        schema_hint='{"covered":[field_name, ...]}',
    )
    if not out:
        return None
    return out.get("covered", [])


def _covered_fields_heuristic(transcript: str, checklist) -> list[str]:
    text = transcript.lower()
    covered = []
    for item in checklist:
        hints = _HEURISTIC_HINTS.get(item["field"], [])
        if any(h in text for h in hints):
            covered.append(item["field"])
    return covered
