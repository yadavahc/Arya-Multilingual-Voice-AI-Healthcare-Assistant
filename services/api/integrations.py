"""External provider integrations: Razorpay (payment links), Twilio (SMS),
FCM (push). All degrade gracefully to logged no-ops when keys are absent, so
the demo flow runs offline while remaining real when configured.
"""
from __future__ import annotations

import logging
from typing import Optional

from config import get_settings

logger = logging.getLogger("arya.integrations")


def create_payment_link(amount_paise: int, currency: str, note: str, phone: str) -> dict:
    settings = get_settings()
    if not (settings.razorpay_key_id and settings.razorpay_key_secret):
        logger.info("[dev] payment link amount=%s note=%s", amount_paise, note)
        return {
            "id": "plink_dev_stub",
            "short_url": "https://rzp.io/i/DEV_STUB_LINK",
            "status": "created",
        }
    import razorpay

    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    link = client.payment_link.create(
        {
            "amount": amount_paise,
            "currency": currency,
            "description": note,
            "customer": {"contact": phone},
            "notify": {"sms": True},
            "reminder_enable": True,
        }
    )
    return link


def send_sms(to: str, body: str) -> bool:
    settings = get_settings()
    if not (settings.twilio_account_sid and settings.twilio_auth_token):
        logger.info("[dev] SMS to %s: %s", to, body)
        return True
    from twilio.rest import Client

    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    client.messages.create(to=to, from_=settings.twilio_phone_number, body=body)
    return True


def send_push(token: Optional[str], title: str, body: str, data: Optional[dict] = None) -> bool:
    if not token:
        logger.info("[dev] push (no token): %s — %s", title, body)
        return True
    try:
        from firebase_admin import messaging

        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
        )
        messaging.send(msg)
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning("push failed: %s", exc)
        return False
