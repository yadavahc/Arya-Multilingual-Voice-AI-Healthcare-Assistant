"""Test fixtures. Forces the API into offline mode (in-memory store, heuristic
LLM fallbacks) so tests are hermetic — they never touch Firestore, OpenAI, or
any external service, and run identically in CI with no secrets."""
import os
import sys

# Force offline mode BEFORE the app is imported (env vars beat .env values).
os.environ["OPENAI_API_KEY"] = ""
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = ""
os.environ["LIVEKIT_API_KEY"] = ""
os.environ["LIVEKIT_API_SECRET"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ["SMTP_HOST"] = ""
os.environ["TWILIO_ACCOUNT_SID"] = ""
os.environ["TWILIO_AUTH_TOKEN"] = ""

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    from main import app

    with TestClient(app) as c:
        # Startup seeds the in-memory store with demo data.
        yield c
