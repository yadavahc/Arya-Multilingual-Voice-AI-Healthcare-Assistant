// Twilio Voice webhook — bridges an inbound PSTN call into LiveKit SIP so the
// Arya agent answers. Point your Twilio number's "A call comes in" webhook at
// https://<your-vercel-app>/api/twilio/voice  (GET or POST).
//
// This is public (served by Vercel), so Twilio can reach it. The agent worker
// (running anywhere, connected to LiveKit Cloud) then picks up the call.

const SIP_HOST = process.env.LIVEKIT_SIP_HOST || 'arya-62mcncn2.sip.livekit.cloud';
const NUMBER = process.env.TWILIO_PHONE_NUMBER || '+19207686876';

function twiml(): Response {
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Response>' +
    `<Dial answerOnBridge="true"><Sip>sip:${NUMBER}@${SIP_HOST}</Sip></Dial>` +
    '</Response>';
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST() {
  return twiml();
}
export async function GET() {
  return twiml();
}
