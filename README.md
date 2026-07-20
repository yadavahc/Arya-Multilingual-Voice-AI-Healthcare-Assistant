# Arya — Multilingual Voice AI Clinical Companion

Arya is a healthcare voice-AI platform. Patients call in and **Arya answers first**
— an AI companion that knows their history, medications, and care plan, and holds a
natural, low-latency conversation in their own language. She answers questions about
medicines, diet, rest and follow-up care, and can **book, reschedule or negotiate
appointments on her own** — no human needed for routine calls. For clinicians, Arya
ambiently scribes consultations into SOAP notes, flags red-flag emergencies, and
surfaces missing questions during the visit.

Separate sign-in portals keep the two worlds apart: **patients** talk to Arya;
**clinicians** get the live consult, call console and analytics.

---

## Table of contents

- [What's working](#whats-working)
- [Architecture](#architecture)
- [Repo layout](#repo-layout)
- [Quick start](#quick-start)
- [Signing in (demo)](#signing-in-demo)
- [Enabling live voice](#enabling-live-voice)
- [Configuration & keys](#configuration--keys)
- [Data model](#data-model)
- [How Arya works](#how-arya-works)
- [Latency engineering](#latency-engineering)
- [Security notes](#security-notes)

---

## What's working

| Capability | Status | Notes |
|---|---|---|
| Doctor / patient login portals | ✅ | Phone-based, role-separated, role-guarded routes |
| Arya conversational brain (chat) | ✅ | Answers meds/diet/rest/follow-up; books & reschedules |
| Arya voice (browser + telephony) | ✅ | OpenAI Realtime over LiveKit; needs LiveKit keys |
| Patient context (history, meds, care plan) | ✅ | Loaded before Arya greets |
| SOAP note + ICD-10 + differentials | ✅ | LangGraph pipeline, offline-safe fallback |
| Ambient gap-detection ("Arya Nudge") | ✅ | Silent checklist cards for the doctor |
| Red-flag triage + escalation | ✅ | Sub-ms classifier, SMS + push |
| Admin analytics dashboard | ✅ | Language mix, red-flag catches, latency |
| Firestore persistence + audit log | ✅ | Falls back to in-memory without keys |
| Payments (Razorpay link) | ⚙️ | Voice/chat tool + webhook; real keys optional |
| Telephony SIP bridge | ⚙️ | Documented in `infra/telephony.md` |
| SMS/IVR rural fallback | ⚙️ | Messaging helpers + docs; TwiML handler is a stub |

Legend: ✅ functional · ⚙️ partial/documented.

Everything runs **offline** (in-memory store + heuristic fallbacks) so you can demo
without any keys, and becomes fully real as you add them.

---

## Architecture

```
                    ┌──────────────────────────────────────────────┐
   PSTN call ──────▶│ Twilio / Exotel → LiveKit SIP bridge          │
   Browser mic ────▶│ LiveKit WebRTC                                │
                    └───────────────┬──────────────────────────────┘
                                    ▼
                    apps/agent  (Python · LiveKit Agents)
                    OpenAI Realtime API — native speech-to-speech
                    · companion persona (answers as the doctor)
                    · language mirroring (no detection pass)
                    · full patient-context prefetch on ring
                    · care + scheduling tools · red-flag triage
                                    │  HTTP (same brain as chat)
                                    ▼
                    services/api  (FastAPI + LangGraph)
                    · /arya/chat  — context-aware conversation + tools
                    · /auth/resolve — phone → role/patient (portals)
                    · SOAP notes · gap detection · escalation
                    · appointments · payments · analytics
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                      ▼
       Firestore + Auth      Upstash Redis          functions/ (triggers
       (PHI, audited)        (session/context)       + webhooks + FCM)
                                    │
                                    ▼
                    apps/web  (Next.js 15)
                    · /login  — doctor & patient portals
                    · /patient — call Arya + live chat + care
                    · /consult · /console · /admin (clinician)
```

The key idea: **`/arya/chat` and the voice agent share one brain.** The chat path
works today (text, OpenAI), and the voice agent runs the same context + tools over
audio the moment LiveKit keys are present.

---

## Repo layout

| Path | What |
|---|---|
| `apps/web` | Next.js 15 frontend — portals, patient app, clinician screens |
| `apps/agent` | Python LiveKit + OpenAI Realtime voice agent |
| `services/api` | FastAPI + LangGraph — Arya brain, notes, auth, integrations |
| `functions` | Firebase Cloud Functions — webhooks, Firestore triggers |
| `packages/shared` | Shared TypeScript types (the data model) |
| `infra` | Firestore rules/indexes, Dockerfiles, telephony + deploy docs |

Key backend files:

- `services/api/arya_brain.py` — patient-context builder, tool schema, chat loop
- `services/api/main.py` — all HTTP endpoints
- `services/api/graphs/` — LangGraph SOAP + gap-detection pipelines
- `apps/agent/agent.py` — LiveKit entrypoint, Realtime session, latency metrics
- `apps/agent/prompts.py` — role prompts (companion / triage / scribe)

---

## Quick start

Three terminals. Python 3.11–3.12 recommended for the agent (audio deps).

### 1) API — clinical brain + integrations

```bash
cd services/api
python -m venv .venv
# Windows:  .venv\Scripts\activate    |  macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
# → http://localhost:8080/health
```

Add keys in `services/api/.env` (see [Configuration](#configuration--keys)). With no
keys, `/health` reports `{"store":"memory","llm":false}` and everything still runs on
fallbacks. With an OpenAI key + Firebase service account it becomes
`{"store":"firestore","llm":true}`.

### 2) Web — the app

```bash
npm install                              # from the repo root (workspaces)
cp apps/web/.env.local.example apps/web/.env.local   # then fill in values
npm run dev                              # → http://localhost:3000
```

### 3) Agent — the voice brain (optional; needs LiveKit + OpenAI keys)

```bash
cd apps/agent
python -m venv .venv && . .venv/Scripts/activate     # or source .venv/bin/activate
pip install -r requirements.txt
python agent.py download-files           # one-time model weights
python agent.py dev                      # registers a worker with LiveKit Cloud
```

---

## Signing in (demo)

The demo uses a simplified login: enter a phone number, then the code **`123456`**.
The number determines the role (this is the real logic; the OTP is stubbed for
convenience). Seeded accounts:

| Portal | Number | Signs in as |
|---|---|---|
| Patient | `8904030441` | **Ramesh Kumar** — hypertension, BP meds, care plan, appointment |
| Clinician | `9481479268` | **Dr. Meera Nair** — Cardiology |

Any other number on the patient portal self-provisions a new patient. Doctor numbers
are rejected on the patient portal and vice-versa.

> **Production:** the real Firebase phone-OTP flow (reCAPTCHA + SMS) still exists in
> git history and Firebase is already configured — swap the `DEMO_OTP` path in
> `apps/web/src/components/PhoneLogin.tsx` back to it when you need real auth.

---

## Enabling live voice

1. Create a free project at **[cloud.livekit.io](https://cloud.livekit.io)**.
2. Put the three values in `services/api/.env` **and** `apps/agent/.env`:
   `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
3. Put `NEXT_PUBLIC_LIVEKIT_URL` (same wss URL) in `apps/web/.env.local`.
4. Start the agent: `python agent.py dev` (deploys a worker; pick a region near your
   users — LiveKit Cloud auto-selects, e.g. India South).
5. Sign in as the patient → **Call your doctor** → allow the mic → Arya greets you
   and answers with full context, speech-to-speech.

For real phone calls (PSTN), wire Twilio/Exotel → LiveKit SIP per `infra/telephony.md`.

---

## Configuration & keys

Copy `.env.example` → `services/api/.env` (backend) and fill what you need. The web app
reads `apps/web/.env.local`; the agent reads `apps/agent/.env`.

| Key | Used by | Enables |
|---|---|---|
| `OPENAI_API_KEY` | api, agent | Real LLM notes + Realtime voice (needs Realtime access) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | api | Firestore persistence + audit (base64 of the SA JSON) |
| `NEXT_PUBLIC_FIREBASE_*` | web | Client Firebase (auth, storage) |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | api, agent | Voice transport + token minting |
| `NEXT_PUBLIC_LIVEKIT_URL` | web | Browser joins voice rooms |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | api, agent | Session state + <100ms context cache |
| `RAZORPAY_KEY_ID` / `_SECRET` / `_WEBHOOK_SECRET` | api, functions | Payment links + webhook |
| `TWILIO_*` / `EXOTEL_*` | api | SMS + inbound/outbound telephony |

All `.env*` files are git-ignored. **Never commit secrets** — the service-account JSON
grants full admin access to your Firebase project.

---

## Data model

Firestore collections (typed in `packages/shared/src/models.ts`):

```
organizations/{orgId}
users/{uid}                 role: doctor|patient|admin|frontdesk, phone, orgId
patients/{patientId}        demographics, conditions, allergies, meds
encounters/{encounterId}    transcript[], detectedLanguages[], summary
  notes/{noteId}            soap{}, icd10[], cpt[], patientSummaryTranslated
  gaps/{gapId}              field, status, resolvedVia
prescriptions/{rxId}        drugs[], schedule[], adherenceLog[]
careplans/{id}              diet, rest, followUp, redFlags
appointments/{apptId}       scheduledAt, status, reason
calls/{callId}              direction, triageLevel, latencyMetrics{}
payments/{paymentId}        provider, amount, status, invoiceUrl
alerts/{alertId}            severity, kind, encounterRef
glossary/{term}             translations{lang: string}
audit/{logId}               actor, action, resource, timestamp
```

Auth maps a phone number → a `users` record (role + `patientId`). PHI writes go
through the API/Cloud Functions with central audit logging.

---

## How Arya works

**Zero-latency language handling.** Arya never runs a separate language-detection pass
(that adds 200–400ms). The Realtime session is instructed to mirror the caller's
language from the audio itself, including mid-sentence code-switching (Hinglish /
Tanglish). A cheap rolling language tag (`apps/agent/language.py`) is kept only for
downstream artifacts (notes, SMS), never to gate the voice reply.

**One brain, two surfaces.** `services/api/arya_brain.py` builds the patient's context
(history, meds, adherence, care plan, appointments) and exposes function-calling tools:
`get_medication_schedule`, `get_care_instructions`, `get_next_appointment`,
`get_available_slots`, `book_appointment`, `reschedule_appointment`,
`log_medication_taken`. The `/arya/chat` endpoint runs this over text today; the voice
agent runs the same tools over audio.

**Red-flag safety.** Every turn is scanned by a sub-millisecond multilingual classifier
(`apps/agent/triage.py`). On a red flag (cardiac, stroke, obstetric bleed, self-harm,
respiratory distress) Arya breaks script, delivers emergency guidance in the patient's
language, and fires an SMS + push escalation in the same turn.

**Ambient scribing.** During a consult, a LangGraph pipeline turns the transcript into
a SOAP note with ICD-10/CPT codes and cited differentials, plus a translated patient
summary. A gap-detection agent surfaces silent "not yet asked" cards to the doctor.

---

## Latency engineering

- Native **speech-to-speech** (OpenAI Realtime) — no STT→LLM→TTS chaining.
- Agent workers deploy near users (LiveKit Cloud picks the region, e.g. India South).
- Silero VAD is **pre-warmed** per worker; patient context is **prefetched on ring**.
- System prompt kept < 1500 tokens; long context summarized into a cached block.
- Per-turn `time_to_first_audio_byte` and `end_of_speech_to_response_start` are
  instrumented in `apps/agent/agent.py`.

---

## Security notes

- Firestore rules (`infra/firestore.rules`) scope patients to their own docs and staff
  to their org; client PHI writes are denied (writes flow through the Admin SDK).
- Central audit log for every PHI-touching operation
  (`services/api/firestore_client.py::audit`).
- The demo login is **not** production auth — see the note in
  [Signing in](#signing-in-demo).
- Field-level encryption via Google Cloud KMS is a documented integration point.

---

## Deploy

See `infra/cloudrun.md` (Cloud Run, in-region) and
`firebase deploy --only functions,firestore:rules`. Dockerfiles for the API and agent
live in `infra/`.
