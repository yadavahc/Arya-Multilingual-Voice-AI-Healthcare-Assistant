from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str = ""
    openai_notes_model: str = "gpt-4.1-mini"

    firebase_service_account_json: str = ""  # base64

    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    pinecone_api_key: str = ""
    sentry_dsn: str = ""

    agent_region: str = "asia-south1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
