# Arya Voice Agent

LiveKit Agents worker running OpenAI's Realtime API (native speech-to-speech).
This is the latency-critical path — sub-second voice round-trip.

## Setup

```bash
cd apps/agent
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt

# download turn-detector + VAD model weights (one-time)
python agent.py download-files
```

Populate the repo-root `.env` (the agent reads it via python-dotenv):
`OPENAI_API_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
`API_BASE_URL`, and optionally `UPSTASH_REDIS_REST_URL/TOKEN`.

## Run

```bash
python agent.py dev          # dev mode, hot-reload, connects to LiveKit Cloud
python agent.py start        # production worker
```

Then join from the web app (Doctor Live Consult / Call Console) or dial the
Twilio number wired to the LiveKit SIP bridge.

## Files

| File               | Responsibility                                             |
|--------------------|------------------------------------------------------------|
| `agent.py`         | Entrypoint, Realtime session, prewarm, latency metrics     |
| `prompts.py`       | System prompts (< 1500 tokens) per role                    |
| `language.py`      | Rolling language tag + locked medical glossary injection   |
| `triage.py`        | Sub-ms red-flag classifier + same-turn escalation          |
| `session_state.py` | Redis/Upstash session state + latency samples              |
| `tools/`           | Function-calling tools (booking, payment link, lookup)     |

## Latency notes

- Prewarm loads Silero VAD once per worker (no cold start on pickup).
- Patient context is prefetched into Redis during the ringing state.
- Language is **never** detected on the critical path — the Realtime model
  mirrors the caller's language from audio directly.
- Deploy workers in `asia-south1` for Indian users; keep a warm pool.
