"""Thin LLM helper: JSON-mode calls with a deterministic offline fallback so the
graphs run end-to-end without an OpenAI key (returns clearly-marked stubs).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from config import get_settings

logger = logging.getLogger("arya.llm")


def have_llm() -> bool:
    return bool(get_settings().openai_api_key)


async def json_call(
    system: str, user: str, *, schema_hint: str = "", temperature: float = 0.2
) -> dict[str, Any]:
    """Call the notes model in JSON mode. Returns {} on failure."""
    settings = get_settings()
    if not settings.openai_api_key:
        return {}
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        prompt = user if not schema_hint else f"{user}\n\nReturn JSON: {schema_hint}"
        resp = await client.chat.completions.create(
            model=settings.openai_notes_model,
            temperature=temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )
        content = resp.choices[0].message.content or "{}"
        return json.loads(content)
    except Exception as exc:  # pragma: no cover
        logger.warning("LLM call failed: %s", exc)
        return {}
