"""Generate medication pictogram cards (for non-readers) and pre-filled
insurance claim bundles as PDFs. Uses reportlab; returns raw bytes the caller
uploads to Cloud Storage.
"""
from __future__ import annotations

import io
from typing import Any


def _pictogram_for_slot(slot: str) -> str:
    return {
        "morning": "☀️  Morning",
        "afternoon": "🍽️  Afternoon (with food)",
        "evening": "🌆  Evening",
        "night": "🌙  Night",
    }.get(slot, slot)


def medication_pictogram_pdf(patient_name: str, drugs: list[dict], schedule: list[dict]) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 3 * cm

    c.setFont("Helvetica-Bold", 20)
    c.drawString(2 * cm, y, f"Medication Schedule — {patient_name}")
    y -= 1.2 * cm
    c.setFont("Helvetica", 12)
    c.drawString(2 * cm, y, "Follow the sun / moon / plate icons for each dose.")
    y -= 1.5 * cm

    for drug in drugs:
        c.setFont("Helvetica-Bold", 15)
        c.drawString(2 * cm, y, f"{drug.get('name','')} — {drug.get('dose','')}")
        y -= 0.8 * cm
        c.setFont("Helvetica", 13)
        c.drawString(2.5 * cm, y, f"{drug.get('frequency','')} for {drug.get('durationDays','')} days")
        y -= 1.2 * cm

    y -= 0.5 * cm
    c.setFont("Helvetica-Bold", 15)
    c.drawString(2 * cm, y, "Dose times:")
    y -= 1 * cm
    c.setFont("Helvetica", 16)
    for slot in schedule:
        label = _pictogram_for_slot(slot.get("timeOfDay", ""))
        c.drawString(2.5 * cm, y, f"{label}   {slot.get('hhmm','')}")
        y -= 1 * cm

    c.showPage()
    c.save()
    return buf.getvalue()


def claim_bundle_pdf(encounter: dict, note: dict, payment: dict | None) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 2.5 * cm

    def line(text: str, size: int = 11, bold: bool = False, indent: float = 2) -> None:
        nonlocal y
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(indent * cm, y, text[:110])
        y -= 0.7 * cm

    line("Insurance Claim Bundle — Arya", 18, bold=True)
    line(f"Encounter: {encounter.get('id','')}", 11)
    line(f"Date: {encounter.get('startedAt','')}", 11)
    y -= 0.3 * cm
    line("Diagnosis codes (ICD-10):", 13, bold=True)
    for code in note.get("icd10", []):
        line(f"  {code.get('code','')} — {code.get('description','')} (conf {code.get('confidence','')})")
    y -= 0.2 * cm
    line("Procedure codes (CPT):", 13, bold=True)
    for code in note.get("cpt", []):
        line(f"  {code.get('code','')} — {code.get('description','')}")
    y -= 0.2 * cm
    line("Assessment:", 13, bold=True)
    line(f"  {note.get('soap',{}).get('assessment','')}")
    if payment:
        y -= 0.2 * cm
        line("Payment:", 13, bold=True)
        line(f"  {payment.get('amount',0)/100:.2f} {payment.get('currency','INR')} — {payment.get('status','')}")

    c.showPage()
    c.save()
    return buf.getvalue()
