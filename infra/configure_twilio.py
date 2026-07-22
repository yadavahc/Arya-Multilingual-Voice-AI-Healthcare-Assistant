"""One-shot: point the Twilio number's Voice webhook at Arya's TwiML bridge.

The API must be reachable from the internet first (deploy it, or `ngrok http
8080`). Then run:

    PUBLIC_API_URL=https://your-api.example.com python infra/configure_twilio.py

This sets +19207686876 to POST /twilio/voice, which bridges callers to Arya on
LiveKit SIP. Credentials are read from services/api/.env.
"""
import os
import sys

from dotenv import load_dotenv

load_dotenv("services/api/.env")

public = os.getenv("PUBLIC_API_URL")
if not public:
    sys.exit("Set PUBLIC_API_URL to your internet-reachable API base URL first.")

from twilio.rest import Client

client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
number = os.environ["TWILIO_PHONE_NUMBER"]

sid = next(n.sid for n in client.incoming_phone_numbers.list() if n.phone_number == number)
client.incoming_phone_numbers(sid).update(
    voice_url=f"{public.rstrip('/')}/twilio/voice", voice_method="POST"
)
print(f"✓ {number} will now ring Arya via {public}/twilio/voice")
