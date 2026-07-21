"""Patient document handling: extract text from an uploaded PDF/DOCX/TXT so Arya
can answer questions grounded in it, in any language. Text is stored per patient
and injected into the conversation context (lightweight RAG)."""
from __future__ import annotations

import io

from firestore_client import db


def extract_text(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    try:
        if name.endswith(".pdf"):
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            return "\n".join((page.extract_text() or "") for page in reader.pages).strip()
        if name.endswith(".docx"):
            import docx

            doc = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs).strip()
        # txt / fallback
        return data.decode("utf-8", errors="ignore").strip()
    except Exception as exc:  # pragma: no cover
        return f"(could not read document: {exc})"


def save_document(patient_id: str, filename: str, text: str) -> str:
    doc_id = f"doc-{patient_id}"
    # Cap stored text so the prompt stays within budget.
    db().collection("documents").document(doc_id).set(
        {"id": doc_id, "patientId": patient_id, "filename": filename, "text": text[:12000]}
    )
    return doc_id


def get_document_text(patient_id: str) -> str:
    snap = db().collection("documents").document(f"doc-{patient_id}").get()
    if snap.exists:
        return (snap.to_dict() or {}).get("text", "")
    return ""
