# Phone-call support — patients call a hospital number, Arya answers

## ✅ Already configured for this project
- **Number:** `+19207686876` (Twilio, active)
- **LiveKit SIP inbound trunk:** `ST_iakWkBZWg7tm` (accepts that number)
- **Dispatch rule:** `SDR_LCe5AZj4Yxbj` → rooms `call-*`, Arya (companion role)
- **TwiML bridge endpoint:** `GET/POST /twilio/voice` (returns
  `<Dial><Sip>sip:+19207686876@arya-62mcncn2.sip.livekit.cloud</Sip></Dial>`)

## The one remaining step: make the API public, then point Twilio at it
Twilio must reach `/twilio/voice`, so the API needs a public URL:
```bash
# Option A — quick test tunnel
ngrok http 8080
# Option B — deploy the API (infra/Dockerfile.api → Cloud Run)

# Then wire the number to it (reads creds from services/api/.env):
PUBLIC_API_URL=https://<your-public-api> python infra/configure_twilio.py
```
After that, dial `+19207686876` and Arya answers in the selected language,
records + transcribes the call, and posts it to the doctor's Call Reviews.

---


Patients dial a real PSTN number; the call bridges into a LiveKit room that a
warm Arya agent worker is already on. Arya answers (not a human), handles the
whole conversation in the patient's language, and the call is recorded,
transcribed, summarized, and surfaced on the doctor's **Call Reviews** dashboard.

## What you need to provide
1. A **phone number** — Twilio (global) or **Exotel** (India, cheaper PSTN).
2. Its credentials in `.env` (`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
   `TWILIO_PHONE_NUMBER`, or `EXOTEL_SID` / `EXOTEL_TOKEN`).

Everything else (the agent, Sarvam voice, transcript → summary → doctor review)
is already built.

## Twilio → LiveKit SIP (one-time)
```bash
# 1) LiveKit inbound SIP trunk for your number
lk sip inbound create \
  --name arya-hospital \
  --numbers "+91XXXXXXXXXX" \
  --krisp-enabled

# 2) Dispatch inbound calls to the Arya agent, naming the room "call-*"
lk sip dispatch create \
  --rule '{"dispatchRuleIndividual":{"roomPrefix":"call-"}}' \
  --metadata '{"role":"companion"}'
```
Then point the Twilio number's **Voice → SIP/Origination URI** at your LiveKit
SIP host (`sip:<project>.sip.livekit.cloud`). Inbound calls now reach the agent.

## Caller-ID → patient context
The agent looks up the caller's number against `patients.phone`, loads that
patient's full context before greeting, and answers in their preferred language.
(See `apps/agent/agent.py` — participant metadata / caller-ID lookup.)

## Recording, transcript & doctor review (already wired)
- The agent saves every turn to a `conversations` doc (`channel: "voice"`).
- On hang-up it calls `POST /conversations/{id}/finalize` → duration + AI
  summary + insights, and alerts the assigned doctor (`kind: "call_completed"`).
- The doctor reviews it at **/doctor/calls**: summary, transcript, duration,
  patient, AI insights, and gives feedback (correct / needs-fixing + notes) that
  is stored for tracking Arya's performance over time.
- **Audio recording**: enable LiveKit **Egress** (room composite / track) to
  store the call audio in Cloud Storage; attach the URL to the conversation doc.

## Exotel (India alternative)
Use an ExoPhone with a Voicebot applet pointing at the SIP bridge, or Exotel's
WebSocket Voice Streaming into a small adapter that publishes into LiveKit.
Exotel is also the cheapest path for the **missed-call → free callback** flow.
