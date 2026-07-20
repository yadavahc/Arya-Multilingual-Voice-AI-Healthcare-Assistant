# Telephony wiring (Twilio / Exotel → LiveKit SIP → agent)

Patients dial a PSTN number; the call is bridged into a LiveKit room that a
warm Python agent worker is already listening on (<2 rings, no cold start).

## Twilio (international / primary)

1. Buy a number in the Twilio console (Voice-capable).
2. Create a LiveKit SIP inbound trunk:
   ```bash
   lk sip inbound create \
     --name arya-inbound \
     --numbers "+91XXXXXXXXXX" \
     --krisp-enabled
   ```
3. Create a dispatch rule that routes calls to the agent and names the room:
   ```bash
   lk sip dispatch create \
     --rule '{"dispatchRuleIndividual":{"roomPrefix":"call-"}}' \
     --agent-name arya-agent \
     --metadata '{"role":"triage"}'
   ```
4. Point the Twilio number's SIP/Origination URI at the LiveKit SIP host
   (`sip:<project>.sip.livekit.cloud`).

## Exotel (India-optimized alternative)

- Better rural PSTN coverage + cheaper. Configure an ExoPhone with a
  "Voicebot Applet" pointing at the SIP bridge, or use Exotel's WebSocket
  Voice Streaming into a small adapter that publishes into LiveKit.
- Use Exotel for the **missed-call-to-callback** flow: a missed call triggers a
  webhook → the API places a free outbound call back to the patient.

## Fallback: DTMF IVR + SMS (feature phones / no data)

If WebRTC negotiation fails or the caller is on a feature phone, the same number
answers with a Twilio/Exotel `<Gather>` DTMF IVR and sends SMS in the local
script. See `services/api` `/availability` and messaging helpers; extend with a
TwiML/Exotel IVR handler that mirrors the triage tree.

## Outbound (adherence + follow-up)

The API places outbound calls at dose times (see `/adherence/log`); wire a
scheduler (Cloud Scheduler → API endpoint) to originate calls into agent rooms
with `metadata.role = "adherence"`.
