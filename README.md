# Arya — Multilingual Voice AI Clinical Companion

Arya listens to doctor–patient consultations, auto-generates clinical notes,
translates explanations into the patient's language, nudges doctors about
missing questions, and lets patients **phone in** to a voice AI agent with
**sub-second response latency** — degrading gracefully to SMS/IVR for rural
feature-phone users.

> **Status:** functional foundation. Every service runs end-to-end *offline*
> (in-memory store + heuristic LLM stubs) so you can demo immediately, and
> becomes fully real the moment you supply keys in `.env`. See
> [Build order](#build-order--whats-done) for what is wired vs. roadmap.

---

## Architecture

```
                    ┌────────────────────────────────────────────┐
   PSTN call ──────▶│ Twilio / Exotel → LiveKit SIP bridge        │
   Browser mic ────▶│ LiveKit WebRTC                              │
                    └───────────────┬────────────────────────────┘
                                    ▼
                   apps/agent  (Python, LiveKit Agents)
                   OpenAI Realtime API — native speech-to-speech
                   · language mirroring (no detection pass)
                   · sub-ms red-flag classifier + escalation
                   · function tools (booking, payment, lookup)
                                    │  HTTP
                                    ▼
                   services/api  (FastAPI + LangGraph)
                   · SOAP note / ICD-10 / differentials / translation
                   · gap detection · payments · messaging · analytics
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                      ▼
       Firestore + Auth      Upstash Redis          functions/ (triggers
       (functions/ owns      (session state,        + razorpay webhook +
        PHI writes)          <100ms context)         FCM push)
                                    │
                                    ▼
                    apps/web  (Next.js 15 · doctor consult,
                    call console, admin analytics, patient app)
```

## Repo layout

| Path              | What                                                          |
|-------------------|--------------------------------------------------------------|
| `apps/web`        | Next.js 15 frontend (landing, consult, console, admin, patient) |
| `apps/agent`      | Python LiveKit + OpenAI Realtime voice agent                 |
| `services/api`    | FastAPI + LangGraph clinical intelligence + integrations     |
| `functions`       | Firebase Cloud Functions (webhooks, Firestore triggers)      |
| `packages/shared` | Shared TypeScript types for the data model                   |
| `infra`           | Firestore rules/indexes, Dockerfiles, telephony + deploy docs |

---

## Quick start (offline demo — no keys needed)

Three terminals.

**1. API** (Python 3.11+)
```bash
cd services/api
python -m venv .venv && . .venv/Scripts/activate   # (bash: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
# → http://localhost:8080/health  → {"ok":true,"store":"memory","llm":false}
```

**2. Web**
```bash
npm install                       # root, installs workspaces
cp apps/web/.env.local.example apps/web/.env.local
npm run dev                       # → http://localhost:3000
```

**3. Voice agent** (needs OpenAI + LiveKit keys to actually talk — optional for UI demo)
```bash
cd apps/agent
python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt
python agent.py download-files
python agent.py dev
```

Open **http://localhost:3000**, click **Live Consult** — the demo transcript
streams, gap cards surface, the red-flag banner fires, and **Generate Note**
calls the real LangGraph pipeline. **Analytics** and **Call Console** read seeded
data from the API.

## Going live (supply keys)

Copy `.env.example` → `.env` (root, read by agent + api) and fill in:

- **OpenAI** (`OPENAI_API_KEY`) → real Realtime voice + LLM notes.
- **LiveKit** (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) → browser
  voice + telephony rooms. Also set `NEXT_PUBLIC_LIVEKIT_URL` in web env.
- **Firebase** (`FIREBASE_SERVICE_ACCOUNT_JSON` base64 + `NEXT_PUBLIC_FIREBASE_*`)
  → persistent Firestore, Auth (phone OTP), Storage, FCM.
- **Upstash Redis** → real session state + sub-100ms context caching.
- **Twilio/Exotel** → inbound triage line + outbound adherence calls
  (see `infra/telephony.md`).
- **Razorpay** → voice-initiated payment links + webhook.

Deploy: `infra/cloudrun.md` (Cloud Run, asia-south1) and
`firebase deploy --only functions,firestore:rules`.

---

## Latency engineering

- Native **speech-to-speech** (OpenAI Realtime) — no STT→LLM→TTS chaining.
- Language is **never** detected on the critical path; the model mirrors the
  caller's language from audio (see `apps/agent/language.py` for the rolling tag
  used only for downstream artifacts).
- Silero VAD pre-warmed per worker; patient context prefetched during ringing.
- Per-turn `time_to_first_audio_byte` + `end_of_speech_to_response_start`
  instrumented in `apps/agent/agent.py` and shown live in the UI.
- Deploy workers in-region with `--min-instances 1` (warm pool).

## Build order — what's done

1. ✅ Monorepo scaffold, data model, `.env.example`, seed data.
2. ✅ LiveKit + OpenAI Realtime agent (browser + SIP), latency instrumentation.
3. ✅ Zero-latency language mirroring + locked medical glossary injection.
4. ⚙️ Twilio SIP → LiveKit bridge — config documented (`infra/telephony.md`).
5. ✅ Transcript → SOAP note pipeline (FastAPI + LangGraph), ICD-10 extraction.
6. ✅ Gap-detection agent + doctor live-consult UI.
7. ✅ Triage red-flag classifier + escalation (SMS + push).
8. ✅ Razorpay payment link + voice tool + webhook (functions).
9. ⚙️ Adherence loop: logging + pictogram PDF done; outbound scheduler is a stub.
10. ⚙️ IVR/SMS fallback: documented + messaging helpers; TwiML handler is a stub.
11. ✅ Admin analytics dashboard.
12. ⏳ Demo polish.

Legend: ✅ functional · ⚙️ partial/documented · ⏳ todo.

## Security & compliance notes

- All PHI writes flow through Cloud Functions / the API with central audit
  logging (`services/api/firestore_client.py::audit`).
- Firestore rules (`infra/firestore.rules`) scope patients to their own docs and
  staff to their org; client PHI writes are denied.
- Field-level encryption for identifiers via Google Cloud KMS is a documented
  integration point (not yet wired).
