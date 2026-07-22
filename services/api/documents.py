"""Patient documents: extract text from uploaded PDF/DOCX/TXT (prescriptions,
lab reports, discharge summaries), keep a full history per patient, and feed the
combined text into Arya's context for grounded, multilingual answers."""
from __future__ import annotations

import io
import time

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
        return data.decode("utf-8", errors="ignore").strip()
    except Exception as exc:  # pragma: no cover
        return f"(could not read document: {exc})"


def _classify(filename: str, text: str) -> str:
    low = (filename + " " + text[:400]).lower()
    if any(w in low for w in ("prescription", "rx", "tablet", "capsule", "mg ")):
        return "prescription"
    if any(w in low for w in ("lab", "report", "hemoglobin", "hba1c", "cholesterol", "blood")):
        return "lab_report"
    return "document"


def save_document(patient_id: str, filename: str, text: str) -> dict:
    doc_id = f"doc-{int(time.time()*1000)}"
    record = {
        "id": doc_id, "patientId": patient_id, "filename": filename,
        "type": _classify(filename, text), "text": text[:12000],
        "chars": len(text), "uploadedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    db().collection("documents").document(doc_id).set(record)
    return record


def list_documents(patient_id: str) -> list[dict]:
    docs = [s.to_dict() for s in db().collection("documents").stream()
            if (s.to_dict() or {}).get("patientId") == patient_id]
    docs.sort(key=lambda d: d.get("uploadedAt", ""), reverse=True)
    # Strip full text from the listing (keep metadata).
    return [{k: v for k, v in d.items() if k != "text"} for d in docs]


def get_document_text(patient_id: str) -> str:
    """Combined text of a patient's uploaded documents (most recent first), for RAG."""
    docs = [s.to_dict() for s in db().collection("documents").stream()
            if (s.to_dict() or {}).get("patientId") == patient_id]
    docs.sort(key=lambda d: d.get("uploadedAt", ""), reverse=True)
    parts = []
    total = 0
    for d in docs:
        chunk = f"[{d.get('filename','document')}]\n{d.get('text','')}"
        if total + len(chunk) > 10000:
            break
        parts.append(chunk)
        total += len(chunk)
    return "\n\n".join(parts)
