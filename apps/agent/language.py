"""Code-switch handling + medical glossary injection.

The voice response is NEVER gated on language detection (that would add
200-400ms). Instead:

  * The Realtime session is instructed to mirror the user's language from audio.
  * We keep a *rolling* `detected_language` derived cheaply from transcript
    deltas, used only for downstream artifacts (notes, prescriptions, SMS).
  * A locked medical glossary is injected at prompt time so clinical terms have
    correct, non-colloquial translations.
"""
from __future__ import annotations

import re
from typing import Optional

import httpx

# Script (Unicode block) → language heuristic. Cheap, synchronous, no model call.
# Used ONLY to tag artifacts, never to gate the spoken reply.
_SCRIPT_RANGES: list[tuple[str, range]] = [
    ("hi", range(0x0900, 0x0980)),  # Devanagari (Hindi/Marathi — refine downstream)
    ("bn", range(0x0980, 0x0A00)),  # Bengali
    ("pa", range(0x0A00, 0x0A80)),  # Gurmukhi (Punjabi)
    ("gu", range(0x0A80, 0x0B00)),  # Gujarati
    ("or", range(0x0B00, 0x0B80)),  # Odia
    ("ta", range(0x0B80, 0x0C00)),  # Tamil
    ("te", range(0x0C00, 0x0C80)),  # Telugu
    ("kn", range(0x0C80, 0x0D00)),  # Kannada
    ("ml", range(0x0D00, 0x0D80)),  # Malayalam
    ("ur", range(0x0600, 0x0700)),  # Arabic block (Urdu)
]


def detect_language_from_text(text: str) -> str:
    """Best-effort language tag from a transcript delta. Latin => en (or mixed)."""
    if not text.strip():
        return "en"
    counts: dict[str, int] = {}
    latin = 0
    for ch in text:
        cp = ord(ch)
        if 0x0041 <= cp <= 0x007A:
            latin += 1
            continue
        for lang, rng in _SCRIPT_RANGES:
            if cp in rng:
                counts[lang] = counts.get(lang, 0) + 1
                break
    if not counts:
        return "en"
    dominant = max(counts, key=counts.get)
    # Meaningful Latin alongside an Indic script => code-switch (e.g. Hinglish).
    if latin > 0 and counts[dominant] > 0 and latin >= counts[dominant] * 0.5:
        if dominant == "hi":
            return "hi-en"
        if dominant == "ta":
            return "ta-en"
    return dominant


class Glossary:
    """Locked medical-term translations, fetched from the API (Firestore-backed)
    and injected into the system prompt at session start.
    """

    def __init__(self, api_base_url: str) -> None:
        self._api = api_base_url.rstrip("/")
        self._cache: dict[str, dict[str, str]] = {}

    async def load(self, terms: Optional[list[str]] = None) -> dict[str, dict[str, str]]:
        params = {"terms": ",".join(terms)} if terms else {}
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self._api}/glossary", params=params)
                resp.raise_for_status()
                self._cache = resp.json().get("terms", {})
        except Exception:
            # Non-fatal: agent still speaks; artifacts just won't have locked terms.
            self._cache = self._cache or {}
        return self._cache

    def as_prompt_block(self, lang: str) -> str:
        """Render locked translations for the target language as a prompt snippet."""
        lines = []
        for term, translations in self._cache.items():
            t = translations.get(lang)
            if t:
                lines.append(f'- "{term}" → "{t}"')
        if not lines:
            return ""
        return (
            "Locked medical glossary — always use these exact translations for "
            f"clinical terms in the patient's language:\n" + "\n".join(lines)
        )
