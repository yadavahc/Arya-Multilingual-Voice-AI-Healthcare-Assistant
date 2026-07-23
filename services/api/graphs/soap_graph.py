"""LangGraph pipeline: transcript → SOAP note + ICD-10/CPT + differentials +
translated patient summary.

Nodes run partly in parallel (coding + differentials both depend only on the
SOAP draft). Each node degrades gracefully to a heuristic stub when no LLM key
is present, so the whole graph produces a valid Note offline.
"""
from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from .llm import json_call


class SoapState(TypedDict, total=False):
    transcript: str  # flattened "role: text" lines
    encounter_type: str
    patient_language: str
    soap: dict
    icd10: list[dict]
    cpt: list[dict]
    differentials: list[dict]
    patient_summary: str


# ── Nodes ───────────────────────────────────────────────────────────────
async def draft_soap(state: SoapState) -> SoapState:
    system = (
        "You are a clinical scribe. Convert a doctor-patient consult transcript "
        "into a precise SOAP note in ENGLISH. Be faithful; do not invent findings."
    )
    out = await json_call(
        system,
        f"Transcript:\n{state.get('transcript','')}",
        schema_hint='{"subjective":str,"objective":str,"assessment":str,"plan":str}',
    )
    if not out:
        out = _stub_soap(state.get("transcript", ""))
    return {"soap": out}


async def extract_codes(state: SoapState) -> SoapState:
    soap = state.get("soap", {})
    system = (
        "You are a medical coder. From this SOAP note, extract the most likely "
        "ICD-10 diagnosis codes and CPT procedure codes with a 0-1 confidence. "
        "Only include codes clearly supported by the note."
    )
    out = await json_call(
        system,
        f"SOAP note:\n{soap}",
        schema_hint=(
            '{"icd10":[{"code":str,"description":str,"confidence":number}],'
            '"cpt":[{"code":str,"description":str,"confidence":number}]}'
        ),
    )
    icd10 = out.get("icd10") or _stub_icd10(soap)
    cpt = out.get("cpt") or [{"code": "99213", "description": "Office/outpatient visit, established patient", "confidence": 0.55}]
    return {"icd10": icd10, "cpt": cpt}


async def suggest_differentials(state: SoapState) -> SoapState:
    soap = state.get("soap", {})
    system = (
        "You are a diagnostic assistant. Suggest up to 3 differential diagnoses "
        "with a one-line rationale each. Cite a guideline body (WHO/ICMR/NICE) "
        "when relevant. Never present as definitive."
    )
    out = await json_call(
        system,
        f"Assessment: {soap.get('assessment','')}\nPlan: {soap.get('plan','')}",
        schema_hint='{"differentials":[{"diagnosis":str,"rationale":str,"source":str}]}',
    )
    diffs = out.get("differentials") or []
    return {"differentials": diffs}


async def translate_summary(state: SoapState) -> SoapState:
    lang = state.get("patient_language", "en")
    soap = state.get("soap", {})
    if lang == "en":
        return {"patient_summary": _plain_summary(soap)}
    system = (
        "Write a short, warm, plain-language visit summary the patient can "
        f"understand, in the language with code '{lang}'. 3-4 sentences. Use the "
        "locked medical glossary terms if provided. No medical jargon."
    )
    out = await json_call(
        system,
        f"SOAP note:\n{soap}",
        schema_hint='{"summary":str}',
    )
    return {"patient_summary": out.get("summary") or _plain_summary(soap)}


# ── Heuristic stubs (offline mode) ──────────────────────────────────────
def _stub_soap(transcript: str) -> dict:
    lines = [line for line in transcript.splitlines() if line.strip()]
    patient_lines = " ".join(line.split(":", 1)[-1].strip() for line in lines if line.lower().startswith("patient"))
    return {
        "subjective": patient_lines[:600] or "Patient-reported symptoms (see transcript).",
        "objective": "Vitals and exam findings to be completed by clinician.",
        "assessment": "Working assessment pending clinician review.",
        "plan": "Plan pending clinician confirmation.",
    }


def _stub_icd10(soap: dict) -> list[dict]:
    text = (soap.get("subjective", "") + " " + soap.get("assessment", "")).lower()
    codes = []
    if any(k in text for k in ("chest", "seene", "seene mein", "left arm", "छाती", "सीने")):
        codes.append({"code": "R07.9", "description": "Chest pain, unspecified", "confidence": 0.6})
    if "cough" in text or "fever" in text:
        codes.append({"code": "R05", "description": "Cough", "confidence": 0.5})
    if not codes:
        codes.append({"code": "Z00.00", "description": "General adult medical exam", "confidence": 0.4})
    return codes


def _plain_summary(soap: dict) -> str:
    return (
        "Here's a summary of your visit. "
        + soap.get("assessment", "") + " "
        + soap.get("plan", "")
    ).strip()


# ── Graph assembly ──────────────────────────────────────────────────────
def build_soap_graph():
    g = StateGraph(SoapState)
    g.add_node("draft_soap", draft_soap)
    g.add_node("extract_codes", extract_codes)
    g.add_node("suggest_differentials", suggest_differentials)
    g.add_node("translate_summary", translate_summary)

    g.add_edge(START, "draft_soap")
    # Fan out from the SOAP draft.
    g.add_edge("draft_soap", "extract_codes")
    g.add_edge("draft_soap", "suggest_differentials")
    g.add_edge("draft_soap", "translate_summary")
    g.add_edge("extract_codes", END)
    g.add_edge("suggest_differentials", END)
    g.add_edge("translate_summary", END)
    return g.compile()


_GRAPH = None


async def run_soap_pipeline(
    transcript: str, encounter_type: str, patient_language: str
) -> dict[str, Any]:
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_soap_graph()
    result = await _GRAPH.ainvoke(
        {
            "transcript": transcript,
            "encounter_type": encounter_type,
            "patient_language": patient_language,
        }
    )
    return result
