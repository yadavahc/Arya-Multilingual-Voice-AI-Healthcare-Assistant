"""Arya voice agent — LiveKit Agents entrypoint.

Latency-critical path. Uses OpenAI's Realtime API (native speech-to-speech, no
STT→LLM→TTS chaining) over LiveKit's WebRTC/SIP transport. Handles browser voice
AND inbound telephony (Twilio/Exotel SIP → LiveKit bridge) with the same worker.

Run locally:      python agent.py dev
Run a worker:     python agent.py start
Connect a room:   python agent.py connect --room <name>
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    WorkerOptions,
    cli,
    metrics,
)
from livekit.plugins import openai, silero

# turn-detector is optional; degrade to VAD-only turn detection if missing.
try:
    from livekit.plugins.turn_detector.multilingual import MultilingualModel
    _HAS_TURN_DETECTOR = True
except Exception:  # pragma: no cover
    _HAS_TURN_DETECTOR = False

from language import Glossary, detect_language_from_text
from prompts import build_instructions
from session_state import LatencySample, SessionState, SessionStore
from tools import build_tools
from triage import classify, escalate, RedFlag

load_dotenv()
logger = logging.getLogger("arya.agent")
logging.basicConfig(level=logging.INFO)

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8080")
REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime")


SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")

# Sarvam language codes + full names for the supported languages.
_SARVAM_LANG = {
    "en": "en-IN", "hi": "hi-IN", "kn": "kn-IN", "ta": "ta-IN", "te": "te-IN",
    "ml": "ml-IN", "mr": "mr-IN", "bn": "bn-IN", "gu": "gu-IN", "pa": "pa-IN", "or": "od-IN",
}
_LANG_FULL = {
    "en": "English", "hi": "Hindi", "kn": "Kannada", "ta": "Tamil", "te": "Telugu",
    "ml": "Malayalam", "mr": "Marathi", "bn": "Bengali", "gu": "Gujarati", "pa": "Punjabi", "or": "Odia",
}


def prewarm(proc: JobProcess) -> None:
    """Load heavy models once per worker process so call pickup has no cold start."""
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("prewarm complete: Silero VAD loaded")


def _build_session(ctx: JobContext, detected_language: str) -> AgentSession:
    """Build the voice session. Sarvam pipeline for Indian languages if keyed,
    else OpenAI Realtime speech-to-speech."""
    vad = ctx.proc.userdata.get("vad")

    if SARVAM_API_KEY:
        try:
            from livekit.plugins import sarvam

            sarvam_lang = _SARVAM_LANG.get(detected_language, "en-IN")
            # STT locked to the chosen language — faster + more accurate than
            # auto-detect, which removes noticeable lag while Arya listens.
            stt = sarvam.STT(language=sarvam_lang, model="saarika:v2.5")
            # Bulbul TTS in the same language for a clear, natural voice.
            # anushka requires bulbul:v2 (v3 uses a different speaker set).
            tts = sarvam.TTS(
                target_language_code=sarvam_lang,
                speaker="anushka",
                model="bulbul:v2",
            )
            llm = openai.LLM(model=os.getenv("OPENAI_NOTES_MODEL", "gpt-4.1-mini"))
            kwargs: dict = {"stt": stt, "llm": llm, "tts": tts, "vad": vad}
            if _HAS_TURN_DETECTOR:
                kwargs["turn_detection"] = MultilingualModel()
            logger.info("voice pipeline: Sarvam STT+TTS (Indian languages)")
            return AgentSession(**kwargs)
        except Exception as exc:  # pragma: no cover
            logger.warning("Sarvam pipeline unavailable (%s); using OpenAI Realtime", exc)

    realtime = openai.realtime.RealtimeModel(model=REALTIME_MODEL, voice="marin")
    kwargs = {"llm": realtime, "vad": vad}
    if _HAS_TURN_DETECTOR:
        kwargs["turn_detection"] = MultilingualModel()
    logger.info("voice pipeline: OpenAI Realtime (speech-to-speech)")
    return AgentSession(**kwargs)


def _parse_metadata(ctx: JobContext) -> tuple[str, Optional[str], str]:
    """Return (role, patient_id, language) from job metadata.

    Metadata may be JSON ({"role","patientId","language"}) from the token/
    dispatch, or a bare keyword string. Defaults to the companion persona and
    English. A fixed language keeps the voice clear and low-latency (no
    per-turn re-detection).
    """
    import json

    raw = ctx.job.metadata or ""
    try:
        data = json.loads(raw)
        return (
            (data.get("role") or "companion").lower(),
            data.get("patientId"),
            (data.get("language") or "en").lower(),
        )
    except Exception:
        pass
    meta = raw.lower()
    for r in ("scribe", "adherence", "triage", "companion"):
        if r in meta:
            return r, None, "en"
    return "companion", None, "en"


async def _prefetch_patient_context(
    store: SessionStore, session_id: str, role: str
) -> tuple[SessionState, str]:
    """Load patient context into Redis BEFORE the agent greets (caller-ID lookup).

    Returns (state, summary_text). Summary is a short cached block injected into
    the system prompt — keeps the live prompt < 1500 tokens.
    """
    import httpx

    state = store.load(session_id) or SessionState(session_id=session_id, role=role)
    summary = ""
    if state.patient_id:
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                # Full context (history, meds, care plan, appointments) so Arya can
                # hold a genuinely informed conversation from the first word.
                resp = await client.get(
                    f"{API_BASE_URL.rstrip('/')}/patients/{state.patient_id}/context"
                )
                if resp.status_code == 200:
                    summary = resp.json().get("summary", "")
        except Exception:
            pass
    store.save(state)
    return state, summary


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    role, meta_patient_id, fixed_language = _parse_metadata(ctx)

    # For browser (and SIP) calls, the caller's access token carries
    # {role, patientId, language} as participant metadata. Read it so Arya loads
    # the right patient's context and locks the voice language before greeting.
    try:
        import json as _json

        participant = await ctx.wait_for_participant()
        pmeta = _json.loads(participant.metadata or "{}")
        if pmeta.get("patientId"):
            meta_patient_id = pmeta["patientId"]
        if pmeta.get("role"):
            role = str(pmeta["role"]).lower()
        if pmeta.get("language"):
            fixed_language = str(pmeta["language"]).lower()
    except Exception:
        pass

    session_id = ctx.room.name
    store = SessionStore()
    logger.info("session %s starting (role=%s, store=%s)", session_id, role, store.mode)

    # Seed the session's patient id from metadata (caller-ID lookup on telephony,
    # or the logged-in patient on a browser call) before prefetching context.
    if meta_patient_id:
        seed_state = store.load(session_id) or SessionState(session_id=session_id, role=role)
        seed_state.patient_id = meta_patient_id
        seed_state.role = role
        store.save(seed_state)

    state, patient_summary = await _prefetch_patient_context(store, session_id, role)
    # Lock the conversation to the language the user chose on the website.
    state.detected_language = fixed_language
    store.save(state)

    # Glossary injection at prompt time (locked medical-term translations).
    glossary = Glossary(API_BASE_URL)
    await glossary.load()
    glossary_block = glossary.as_prompt_block(fixed_language)

    lang_name = _LANG_FULL.get(fixed_language, "English")
    instructions = build_instructions(role=role, patient_summary=patient_summary)
    instructions = (
        f"IMPORTANT: Speak ONLY in {lang_name}. Every reply must be in "
        f"{lang_name}, regardless of the language the patient uses.\n\n" + instructions
    )
    if glossary_block:
        instructions = f"{instructions}\n\n{glossary_block}"

    # Sarvam (STT→LLM→TTS) locked to the chosen language for clear, natural, low-
    # latency voice. Falls back to OpenAI Realtime if no Sarvam key.
    session = _build_session(ctx, fixed_language)

    tools = build_tools(
        org_id=state.org_id or "demo-org",
        patient_id=state.patient_id,
        call_id=session_id,
    )
    agent = Agent(instructions=instructions, tools=tools)

    # ── Per-turn latency instrumentation + transcript capture ───────────
    turn_start_speech_end: dict[str, float] = {}
    call_turns: list[dict] = []  # full transcript for the doctor's review

    @session.on("conversation_item_added")
    def _on_item(ev) -> None:
        # Capture Arya's (assistant) spoken turns for the transcript.
        try:
            item = ev.item
            role = getattr(item, "role", "")
            text = getattr(item, "text_content", None) or getattr(item, "text", "")
            if role == "assistant" and text:
                call_turns.append({"role": "arya", "text": text, "at": int(time.time() * 1000)})
        except Exception:
            pass

    async def _finalize_call() -> None:
        # On hang-up: persist the transcript, then generate summary/insights and
        # notify the assigned doctor (Call Reviews dashboard).
        if not call_turns:
            return
        try:
            import httpx

            async with httpx.AsyncClient(timeout=8.0) as client:
                await client.post(
                    f"{API_BASE_URL.rstrip('/')}/conversations",
                    json={"id": session_id, "patientId": state.patient_id or "pat-1",
                          "channel": "voice", "language": state.detected_language,
                          "turns": call_turns},
                )
                # Reuse the same session id so summary attaches to this call.
                await client.post(f"{API_BASE_URL.rstrip('/')}/conversations/{session_id}/finalize")
        except Exception:
            pass

    ctx.add_shutdown_callback(_finalize_call)

    @session.on("user_input_transcribed")
    def _on_user_transcript(ev) -> None:
        # Runs on final transcript deltas. Cheap language tag + red-flag scan.
        text = getattr(ev, "transcript", "") or ""
        if not text.strip():
            return
        turn_start_speech_end["t"] = time.monotonic()
        call_turns.append({"role": "patient", "text": text, "at": int(time.time() * 1000)})

        lang = detect_language_from_text(text)
        if lang != state.detected_language:
            state.detected_language = lang
            store.update_language(session_id, lang)
            logger.info("session %s detected_language -> %s", session_id, lang)

        # Parallel safety classifier — high recall, must never miss.
        result = classify(text)
        if result.is_red_flag and result.flag:
            logger.warning("RED FLAG (%s) in session %s", result.flag.value, session_id)
            # Break script immediately: instruct the model to deliver emergency
            # guidance now, in the patient's language.
            session.interrupt()
            session.generate_reply(
                instructions=(
                    "EMERGENCY: the patient may be describing "
                    f"{result.flag.value.replace('_', ' ')}. Immediately and calmly "
                    "give clear emergency first-aid / call-for-help instructions in "
                    "the patient's language, and reassure them help is being alerted."
                )
            )
            ctx.add_shutdown_callback(
                lambda: escalate(
                    API_BASE_URL,
                    org_id=state.org_id or "demo-org",
                    call_id=session_id,
                    patient_id=state.patient_id,
                    flag=result.flag,  # type: ignore[arg-type]
                    transcript_excerpt=text,
                )
            )
            # Fire escalation immediately too (don't wait for shutdown).
            import asyncio

            asyncio.create_task(
                escalate(
                    API_BASE_URL,
                    org_id=state.org_id or "demo-org",
                    call_id=session_id,
                    patient_id=state.patient_id,
                    flag=result.flag,
                    transcript_excerpt=text,
                )
            )

    @session.on("metrics_collected")
    def _on_metrics(ev) -> None:
        m = ev.metrics
        # Realtime model exposes TTFB-style metrics; record end-of-speech→response.
        ttfb = getattr(m, "ttfb", None)
        if ttfb is not None:
            eos = turn_start_speech_end.get("t")
            sample = LatencySample(
                time_to_first_audio_byte=float(ttfb) * 1000.0,
                end_of_speech_to_response_start=(
                    (time.monotonic() - eos) * 1000.0 if eos else None
                ),
            )
            store.record_latency(session_id, sample)
            logger.info(
                "session %s ttfab=%.0fms eos->resp=%s",
                session_id,
                sample.time_to_first_audio_byte,
                f"{sample.end_of_speech_to_response_start:.0f}ms"
                if sample.end_of_speech_to_response_start
                else "n/a",
            )
        metrics.log_metrics(m)

    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(),
    )

    # Pre-fetch done during "ringing"; greet immediately with warm audio.
    if role != "scribe":
        await session.generate_reply(
            instructions=(
                f"Greet the caller warmly in {lang_name}, say you're Arya, and ask "
                "how you can help — one short sentence, in that language only."
            )
        )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            # Deploy workers in the user's region (asia-south1 for India).
        )
    )
