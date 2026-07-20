"""Mint LiveKit access tokens so the web app (doctor console / patient voice)
can join the same rooms the Python agent serves.
"""
from __future__ import annotations

from config import get_settings


def create_token(room: str, identity: str, name: str = "", metadata: str = "") -> str:
    settings = get_settings()
    if not (settings.livekit_api_key and settings.livekit_api_secret):
        # Dev fallback: return a clearly-invalid placeholder so the UI still renders.
        return "DEV_TOKEN_missing_LIVEKIT_credentials"
    from livekit import api

    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(name or identity)
        .with_metadata(metadata)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room,
                can_publish=True,
                can_subscribe=True,
            )
        )
    )
    return token.to_jwt()
