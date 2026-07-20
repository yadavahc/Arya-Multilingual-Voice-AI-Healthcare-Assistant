"""Red-flag safety classifier + escalation.

Runs in PARALLEL to the voice turn on every transcript delta. When it fires, the
agent immediately breaks script (handled in agent.py) AND an escalation is
dispatched via the API (SMS + push to on-call doctor) within the same turn.

The classifier is intentionally lightweight and multilingual-aware: it matches
against romanized + native-script red-flag lexemes so it works even before a
transcript is translated. A model-based confirm pass runs server-side, but this
gate must be fast and must never miss (favor recall over precision).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

import httpx


class RedFlag(str, Enum):
    STROKE = "stroke"
    CARDIAC = "cardiac_chest_pain"
    SUICIDAL = "suicidal_ideation"
    OBSTETRIC_BLEED = "obstetric_bleeding"
    RESP_DISTRESS = "respiratory_distress"


@dataclass
class TriageResult:
    is_red_flag: bool
    flag: Optional[RedFlag] = None
    matched: Optional[str] = None
    emergency_instruction_key: Optional[str] = None


# High-recall multilingual lexicon. Keys are lowercased substrings we scan for.
# Includes English, common Hindi/romanized, and a few native-script forms.
_LEXICON: dict[RedFlag, list[str]] = {
    RedFlag.CARDIAC: [
        "chest pain", "crushing", "left arm", "radiating", "seene me dard",
        "seene mein dard", "chhati", "छाती में दर्द", "सीने में दर्द",
        "pressure on chest", "tightness in chest",
    ],
    RedFlag.STROKE: [
        "face droop", "slurred speech", "arm weakness", "one side", "can't move",
        "numbness", "sudden weakness", "bol nahi", "chehra teda", "लकवा", "फालिज",
    ],
    RedFlag.SUICIDAL: [
        "kill myself", "end my life", "suicide", "self harm", "don't want to live",
        "jeena nahi", "marna chahta", "आत्महत्या", "मरना चाहता",
    ],
    RedFlag.OBSTETRIC_BLEED: [
        "bleeding pregnant", "pregnancy bleeding", "heavy bleeding", "blood while pregnant",
        "garbh", "pregnant", "khoon aa raha", "गर्भ", "खून बह रहा",
    ],
    RedFlag.RESP_DISTRESS: [
        "can't breathe", "cannot breathe", "gasping", "blue lips", "choking",
        "saans nahi", "dam ghut", "सांस नहीं", "दम घुट",
    ],
}

_INSTRUCTION_KEYS: dict[RedFlag, str] = {
    RedFlag.CARDIAC: "emergency.cardiac",
    RedFlag.STROKE: "emergency.stroke",
    RedFlag.SUICIDAL: "emergency.suicidal",
    RedFlag.OBSTETRIC_BLEED: "emergency.obstetric",
    RedFlag.RESP_DISTRESS: "emergency.respiratory",
}


def classify(text: str) -> TriageResult:
    """Synchronous, sub-millisecond red-flag scan over a transcript delta."""
    haystack = text.lower()
    for flag, needles in _LEXICON.items():
        for n in needles:
            if n in haystack:
                return TriageResult(
                    is_red_flag=True,
                    flag=flag,
                    matched=n,
                    emergency_instruction_key=_INSTRUCTION_KEYS[flag],
                )
    return TriageResult(is_red_flag=False)


async def escalate(
    api_base_url: str,
    *,
    org_id: str,
    call_id: str,
    patient_id: Optional[str],
    flag: RedFlag,
    transcript_excerpt: str,
) -> None:
    """Fire SMS + push to on-call doctor via the API. Same-turn, non-blocking."""
    payload = {
        "orgId": org_id,
        "callId": call_id,
        "patientId": patient_id,
        "flag": flag.value,
        "excerpt": transcript_excerpt[-500:],
    }
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            await client.post(f"{api_base_url.rstrip('/')}/escalate", json=payload)
    except Exception:
        # Escalation must not crash the call; API also has a retry queue.
        pass
