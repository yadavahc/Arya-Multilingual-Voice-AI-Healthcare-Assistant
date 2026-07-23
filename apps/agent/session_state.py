"""Redis-backed session state for sub-100ms context caching.

Holds the rolling `detected_language`, patient context, and per-turn latency
samples. Uses Upstash REST (works from any region, no TCP) with a graceful
in-memory fallback so the agent still runs locally without Redis configured.
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass, field
from typing import Any

try:  # Upstash REST client — serverless-friendly
    from upstash_redis import Redis as UpstashRedis
except Exception:  # pragma: no cover
    UpstashRedis = None  # type: ignore


@dataclass
class LatencySample:
    time_to_first_audio_byte: float | None = None
    end_of_speech_to_response_start: float | None = None
    at: float = field(default_factory=time.time)


@dataclass
class SessionState:
    session_id: str
    role: str = "triage"
    detected_language: str = "en"
    patient_id: str | None = None
    org_id: str | None = None
    latency: list[LatencySample] = field(default_factory=list)

    def to_json(self) -> str:
        d = asdict(self)
        return json.dumps(d)

    @classmethod
    def from_json(cls, raw: str) -> SessionState:
        d = json.loads(raw)
        samples = [LatencySample(**s) for s in d.pop("latency", [])]
        return cls(latency=samples, **d)


class _MemoryStore:
    """Fallback store when Upstash is not configured (local dev)."""

    def __init__(self) -> None:
        self._d: dict[str, str] = {}

    def get(self, key: str) -> str | None:
        return self._d.get(key)

    def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._d[key] = value


class SessionStore:
    def __init__(self) -> None:
        url = os.getenv("UPSTASH_REDIS_REST_URL")
        token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
        if url and token and UpstashRedis is not None:
            self._r: Any = UpstashRedis(url=url, token=token)
            self._mode = "upstash"
        else:
            self._r = _MemoryStore()
            self._mode = "memory"

    @property
    def mode(self) -> str:
        return self._mode

    def _key(self, session_id: str) -> str:
        return f"arya:session:{session_id}"

    def load(self, session_id: str) -> SessionState | None:
        raw = self._r.get(self._key(session_id))
        return SessionState.from_json(raw) if raw else None

    def save(self, state: SessionState, ttl_seconds: int = 3600) -> None:
        self._r.set(self._key(state.session_id), state.to_json(), ex=ttl_seconds)

    def update_language(self, session_id: str, lang: str) -> None:
        """Update the rolling detected_language used only for downstream artifacts."""
        state = self.load(session_id)
        if state is None:
            state = SessionState(session_id=session_id)
        if lang and lang != state.detected_language:
            state.detected_language = lang
        self.save(state)

    def record_latency(self, session_id: str, sample: LatencySample) -> None:
        state = self.load(session_id) or SessionState(session_id=session_id)
        state.latency.append(sample)
        # keep last 50 samples
        state.latency = state.latency[-50:]
        self.save(state)
