<div align="center">

# 🩺 Arya — Multilingual Voice AI Clinical Companion

### Patients call. Arya answers — in their language, with their history, in under a second.

*An end‑to‑end healthcare voice‑AI platform: patients talk to an AI that knows their prescriptions and medical history, books their appointments by voice, and answers questions about their uploaded reports — in English, Hindi, Kannada, Tamil, Telugu and more. Doctors get every conversation transcribed, summarised, and reviewable.*

**Built for the OneInbox Hackathon.**

`OpenAI` · `Sarvam AI` · `LiveKit` · `Twilio` · `Firebase` · `Next.js 15` · `FastAPI` · `LangGraph`

</div>

---

## 🎯 The problem

Healthcare in India is bottlenecked by **language, literacy, and doctor time**:

- A patient who speaks only **Kannada or Tamil** can't easily get their questions answered.
- Elderly and low‑literacy patients **forget medication timings** and can't read prescriptions.
- Front desks are overwhelmed with *"when's my appointment?"* and *"which tablet do I take?"* calls.
- Doctors spend hours on **documentation** instead of care, and have **no record** of what patients were told between visits.

**Arya fixes all of this with one thing patients already know how to use — a phone call.**

---

## 💡 What Arya does

Arya is a voice‑first clinical companion with **two connected experiences** under one hospital:

### 👤 For patients
- **Call Arya** (voice) or **chat** — in your own language. Arya already knows you.
- Ask *"When do I take my BP tablet?"*, *"What should I eat?"*, *"When is my next appointment?"* — accurate answers from **your real prescription and care plan**.
- **Upload a prescription / lab report (PDF/DOC)** and ask questions about it — no need to re‑explain your history.
- **Book an appointment entirely by voice** — *"Book me for Monday morning"* → Arya offers open slots, confirms, and requests it. No forms.
- See your **medicines, appointments, documents, and full chat history** — any time.

### 🩺 For doctors
- A dashboard of **your patients** (same hospital), each with prescription, vitals, history, and care plan.
- **Every Arya conversation** — voice and chat — is **transcribed, summarised, and given AI insights** (topics, actions taken, follow‑up needed, red flags, *and where Arya may have answered wrong*).
- **Approve or decline** appointment requests — the patient is instantly notified and **emailed a confirmation**.
- **Rate Arya's answers** (👍/👎 + notes) to track and improve AI performance over time.

---

## ✨ Standout features (all functional)

| Feature | What it does |
|---|---|
| 🌐 **True multilingual voice** | Auto‑natural speech in **English, Hindi, Kannada, Tamil, Telugu** (+ 6 more for chat) via **Sarvam AI** — purpose‑built for Indian languages. Pick a language once; the *entire app + Arya* switch to it. |
| 🧠 **Context‑aware agent** | On every call, Arya loads the patient's **medications, care plan, vitals, past visits, and uploaded documents** *before greeting* — so patients never re‑explain themselves. |
| 📄 **Document Q&A (RAG)** | Upload a prescription or lab report; ask about it in any language. Arya reads it, treats it as the current source of truth, and **extracts meds/conditions into the patient's history** automatically. |
| 📅 **Voice appointment booking** | Book / reschedule entirely by speaking. Doctors define **3 slots/day**; bookings are **Pending → Doctor‑approved → Confirmed**, with a **confirmation email** (date, slot, doctor, hospital). |
| 📞 **Real phone line** | Patients dial a hospital number → Twilio → LiveKit SIP → Arya answers, identifying the caller by **caller‑ID** and loading their history. |
| 👩‍⚕️ **Doctor call‑review + feedback** | SOAP‑style summary, transcript, duration, AI insights, and a feedback loop to correct/improve Arya. |
| 🚨 **Red‑flag triage** | A sub‑millisecond safety classifier on every turn escalates emergencies (chest pain, stroke signs, self‑harm) to the on‑call doctor mid‑conversation. |
| 🔐 **Google sign‑in + hospital model** | Separate patient/doctor portals; same‑hospital patients and doctors are auto‑connected. |
| 🎨 **Premium UI** | A **Three.js** animated hero, framer‑motion micro‑interactions, a polished teal medical‑infrastructure theme, and a beautiful full‑screen **voice‑call surface**. |

---

## 🏗️ Architecture

```
                    ┌──────────────────────────────────────────────┐
   📞 PSTN call ───▶│ Twilio number → Vercel TwiML → LiveKit SIP    │
   🎙️ Browser mic ─▶│ LiveKit WebRTC                                │
                    └───────────────┬──────────────────────────────┘
                                    ▼
                 apps/agent  ·  Python · LiveKit Agents (India South)
                 ┌────────────────────────────────────────────────┐
                 │ Sarvam STT  →  GPT‑4.1  →  Sarvam TTS (Bulbul)  │
                 │ · language locked per call (clear, low‑latency) │
                 │ · caller‑ID → patient · prefetch full context   │
                 │ · care + scheduling tools · red‑flag triage     │
                 │ · warm process pool (instant pickup)            │
                 └───────────────────────┬────────────────────────┘
                                         │  one shared brain (HTTP)
                                         ▼
                 services/api  ·  FastAPI + LangGraph
                 /arya/chat · /auth · SOAP notes · calendar ·
                 appointments · documents(RAG) · call insights ·
                 payments · email · telephony
                                         │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
        Firestore + Auth            Sarvam / OpenAI              Twilio + Resend
        (PHI, audit log)            (voice + LLM)                (calls + email)
                                         │
                                         ▼
                 apps/web  ·  Next.js 15  ·  Vercel
                 Landing (3D) · Patient app · Doctor dashboard ·
                 Call reviews · Language selector · Onboarding
```

**Key idea — one brain, three surfaces.** The same context‑aware reasoning powers **voice calls, phone calls, and text chat**. Add a Sarvam key and it speaks; add a Twilio number and it answers the phone.

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| **Voice** | **Sarvam AI** (Saarika STT + Bulbul TTS, Indian languages) · **OpenAI Realtime** (fallback) |
| **Orchestration** | **LiveKit Agents** (Python) · Silero VAD · warm process pool |
| **Telephony** | **Twilio** Programmable Voice → LiveKit **SIP** |
| **AI / reasoning** | **OpenAI GPT‑4.1** · **LangGraph** (SOAP notes, gap detection) · function‑calling tools |
| **Frontend** | **Next.js 15** (App Router, TS) · Tailwind · **Framer Motion** · **Three.js** · TanStack Query · Zustand |
| **Backend** | **FastAPI** · Firebase Admin |
| **Data / auth** | **Firebase** Firestore + Google/Phone Auth · field‑level audit logging |
| **Email** | **Resend** (appointment confirmations) |
| **Deploy** | **Vercel** (web) · Cloud Run / Docker (api + agent) |

---

## 🌍 How the language magic works

1. The user picks a language once (top‑of‑site selector, default English).
2. That choice **locks the whole experience** — UI strings, chatbot, and the **voice agent's STT + TTS** — to that language.
3. **Sarvam** handles Indian‑language speech natively (Saarika transcribes, Bulbul speaks) — far more natural for Kannada/Tamil than generic TTS.
4. A locked medical glossary keeps clinical terms accurate across languages.

*Result: a Kannada‑speaking grandmother has the same fluent, natural conversation an English speaker does.*

---

## 🎬 The demo journey

**Patient (Ramesh Kumar — hypertension + diabetes):**
1. Signs in → picks **ಕನ್ನಡ / हिन्दी** → the whole app switches language.
2. Uploads `samples/prescription-ramesh-kumar.pdf` in chat.
3. Taps **Call Arya**, asks *"ನನ್ನ ಮಾತ್ರೆ ಯಾವಾಗ ತೆಗೆದುಕೊಳ್ಳಬೇಕು?"* → Arya answers from his real schedule, in Kannada.
4. Says *"Book an appointment for Monday"* → Arya offers 3 slots → books it → *"pending doctor confirmation."*

**Doctor (Dr. Aisha Rao — Cardiology):**
5. Sees the **pending request** → clicks **Confirm** → Ramesh gets an **email + notification**.
6. Opens **Call Reviews** → reads the AI summary, transcript, and insights of Ramesh's conversation → rates Arya 👍.

> 🔑 **Demo logins** — Patient `8904030441` · Doctor `9481479268` · code `123456` (or Google sign‑in).
> Both belong to **Oxford Health Multispeciality, Bengaluru**, so they're auto‑connected.

---

## 🚀 Run it locally

Three terminals. (Python 3.11–3.12 recommended for the agent.)

```bash
# 1) API — the brain
cd services/api && python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080          # → http://localhost:8080/health

# 2) Web — the app
npm install
npm run dev                                     # → http://localhost:3000

# 3) Voice agent (needs OpenAI + LiveKit + Sarvam keys)
cd apps/agent && python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt
python agent.py download-files
python agent.py dev                             # registers a worker with LiveKit
```

Keys live in `services/api/.env`, `apps/agent/.env`, `apps/web/.env.local` (all git‑ignored; templates in `.env.example`). With no keys the app still runs offline on an in‑memory store + heuristic fallbacks.

### Enabling the phone line
Twilio number → Vercel TwiML (`/api/twilio/voice`) → LiveKit SIP → agent. The SIP trunk + dispatch rule are created; point the number at the webhook with `infra/configure_twilio.py`. Details in `infra/phone-setup.md`.

---

## 📦 Repo layout

```
arya/
├── apps/web/          Next.js 15 — landing (3D), patient app, doctor dashboard, call reviews
├── apps/agent/        Python LiveKit + Sarvam/OpenAI voice agent (the "brain" over audio)
├── services/api/      FastAPI + LangGraph — chat brain, calendar, documents, notes, email, telephony
├── functions/         Firebase Cloud Functions (webhooks, triggers)
├── packages/shared/   Shared TypeScript types
├── samples/           Dummy prescription + patient PDFs for testing document Q&A
└── infra/             Firestore rules, Dockerfiles, phone-setup + deploy guides
```

---

## ✅ What's real vs. roadmap

**Fully functional & demoable today:** multilingual chat + voice, document upload & RAG, voice/UI appointment booking with doctor approval + real confirmation emails, doctor call‑review + feedback, red‑flag triage, Google/phone auth, hospital connection, 3D landing, full‑site i18n, SOAP‑note pipeline.

**Wired, needs an upgrade to go fully live:** inbound PSTN calling works end‑to‑end to the agent; the Twilio→LiveKit SIP bridge needs a **paid Twilio account** (trial blocks external SIP). Email sends to any address once a domain is verified in Resend.

---

## 🔐 Security & compliance

- PHI writes flow through the API/Cloud Functions with **central audit logging**.
- Firestore security rules scope patients to their own data and staff to their org.
- All secrets are git‑ignored; nothing sensitive is committed.

---

<div align="center">

### Arya — because everyone deserves a doctor who speaks their language.

*Made with ❤️ for the OneInbox Hackathon.*

</div>
