"""Firebase Admin initialization with a graceful in-memory fallback.

If FIREBASE_SERVICE_ACCOUNT_JSON is unset (local dev / hackathon), we fall back
to an in-memory document store so every endpoint still works end-to-end without
cloud credentials. All PHI writes flow through here so audit logging is central.
"""
from __future__ import annotations

import base64
import json
import logging
import time
from typing import Any

from config import get_settings

logger = logging.getLogger("arya.firestore")

_db: Any = None
_mode = "memory"


def _init() -> None:
    global _db, _mode
    if _db is not None:
        return
    settings = get_settings()
    raw = settings.firebase_service_account_json
    if raw:
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore

            decoded = base64.b64decode(raw).decode("utf-8")
            cred = credentials.Certificate(json.loads(decoded))
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            _db = firestore.client()
            _mode = "firestore"
            logger.info("Firestore initialized")
            return
        except Exception as exc:  # pragma: no cover
            logger.warning("Firestore init failed, using memory store: %s", exc)
    _db = _MemoryDB()
    _mode = "memory"


class _MemoryCollection:
    def __init__(self, store: dict) -> None:
        self._store = store

    def document(self, doc_id: str | None = None):
        doc_id = doc_id or f"auto-{int(time.time()*1000)}-{len(self._store)}"
        return _MemoryDoc(self._store, doc_id)

    def stream(self):
        for k, v in self._store.items():
            yield _MemorySnap(k, v)


class _MemoryDoc:
    def __init__(self, store: dict, doc_id: str) -> None:
        self._store = store
        self.id = doc_id

    def set(self, data: dict, merge: bool = False) -> None:
        if merge and self.id in self._store:
            self._store[self.id].update(data)
        else:
            self._store[self.id] = dict(data)

    def update(self, data: dict) -> None:
        self._store.setdefault(self.id, {}).update(data)

    def get(self):
        return _MemorySnap(self.id, self._store.get(self.id))


class _MemorySnap:
    def __init__(self, doc_id: str, data: dict | None) -> None:
        self.id = doc_id
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict | None:
        return self._data


class _MemoryDB:
    def __init__(self) -> None:
        self._collections: dict[str, dict] = {}

    def collection(self, name: str) -> _MemoryCollection:
        return _MemoryCollection(self._collections.setdefault(name, {}))


def db() -> Any:
    _init()
    return _db


def mode() -> str:
    _init()
    return _mode


def audit(actor: str, action: str, resource: str, ip: str | None = None) -> None:
    """Central audit log for every PHI-touching operation."""
    entry = {
        "actor": actor,
        "action": action,
        "resource": resource,
        "ip": ip,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    db().collection("audit").document().set(entry)
