# Cloud Run / deploy notes

Deploy the latency-critical pieces in **asia-south1** (Mumbai) for Indian users.

## API (FastAPI)

```bash
gcloud run deploy arya-api \
  --source . \
  --region asia-south1 \
  --dockerfile infra/Dockerfile.api \
  --set-env-vars "OPENAI_API_KEY=...,FIREBASE_SERVICE_ACCOUNT_JSON=..." \
  --allow-unauthenticated
```

## Agent worker

The agent is a long-lived worker (not request/response), so run it on Cloud Run
with `--no-cpu-throttling` and min instances ≥ 1 for a warm pool, or on GKE /
a VM:

```bash
gcloud run deploy arya-agent \
  --source . \
  --region asia-south1 \
  --dockerfile infra/Dockerfile.agent \
  --no-cpu-throttling \
  --min-instances 1 \
  --set-env-vars "OPENAI_API_KEY=...,LIVEKIT_URL=...,LIVEKIT_API_KEY=...,LIVEKIT_API_SECRET=...,API_BASE_URL=https://arya-api-..."
```

## Web (Next.js)

Deploy to Vercel or Cloud Run. Set `NEXT_PUBLIC_*` at build time.

## Latency checklist

- [ ] Workers in the same region as callers (asia-south1).
- [ ] `--min-instances 1` (warm pool, no cold start on pickup).
- [ ] Redis (Upstash) in-region for sub-100ms context caching.
- [ ] System prompt < 1500 tokens; long context summarized + cached.
- [ ] 20ms Opus frames; server-side VAD with `interrupt_response: true`.
