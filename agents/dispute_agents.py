# =============================================================================
# Dispute Agents — LLM-backed reasoning
# =============================================================================
# This module calls the Groq API to generate advocate arguments and judge
# rulings.  All agent outputs are validated before they reach the UI.
# =============================================================================

import json
import math
import os
import time

from groq import Groq


# -----------------------------------------------------------------------------
# Allowed judge decisions (documented contract)
# -----------------------------------------------------------------------------
ALLOWED_DECISIONS = {
    "UPHELD",
    "REJECTED",
    "PARTIAL",
    "PARTIAL REFUND",
    "ESCALATE FOR HUMAN REVIEW",
    "ESCALATE",
}

CONFIDENCE_THRESHOLD = 60.0


# -----------------------------------------------------------------------------
# Low-level Groq client wrapper
# -----------------------------------------------------------------------------
def call_groq(prompt_text: str, max_retries: int = 2) -> str:
    """
    Send a prompt to the Groq API with a finite timeout and bounded retries.

    Never exposes the raw API key or provider exceptions to callers.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return "[ERROR] GROQ_API_KEY is not configured."

    model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")
    client = Groq(api_key=api_key)

    for attempt in range(max_retries + 1):
        try:
            chat_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt_text}],
                model=model,
                timeout=30.0,
            )
            return chat_completion.choices[0].message.content
        except Exception as exc:
            if attempt == max_retries:
                # Return a safe, non-leaky error string.
                return f"[ERROR] Groq API call failed after {max_retries + 1} attempts."
            time.sleep(1.0 * (attempt + 1))

    return "[ERROR] Groq API call failed unexpectedly."


# -----------------------------------------------------------------------------
# Agent: Rider Advocate
# -----------------------------------------------------------------------------
def rider_advocate(dispute_data: dict) -> str:
    evidence_json = json.dumps(dispute_data["evidence"], indent=2)

    prompt = f"""You are an advocate representing the rider in a ride-hailing dispute.

Your job is to build the strongest fair case for the rider using ONLY the evidence provided below. Do NOT invent facts, assume details not in the data, or hallucinate information.

--- RIDER COMPLAINT ---
{dispute_data['rider_complaint']}

--- EVIDENCE ---
{evidence_json}

--- RIDER HISTORY ---
Prior disputes: {dispute_data['rider_profile']['prior_disputes']}

Instructions:
1. State the rider's core grievance clearly.
2. Highlight specific evidence that supports the rider's position.
3. Write in clear paragraph form only, similar to a professional case summary.
4. Do NOT use markdown tables, HTML tables, or table-like formatting.
5. Keep the tone professional and factual.
6. Do not mention that you are an AI.
"""

    return call_groq(prompt)


# -----------------------------------------------------------------------------
# Agent: Driver Advocate
# -----------------------------------------------------------------------------
def driver_advocate(dispute_data: dict) -> str:
    evidence_json = json.dumps(dispute_data["evidence"], indent=2)

    prompt = f"""You are an advocate representing the driver in a ride-hailing dispute.

Your job is to build the strongest fair case for the driver using ONLY the evidence provided below. Do NOT invent facts, assume details not in the data, or hallucinate information.

--- RIDER COMPLAINT (for context) ---
{dispute_data['rider_complaint']}

--- EVIDENCE ---
{evidence_json}

--- DRIVER PROFILE ---
{json.dumps(dispute_data['driver_profile'], indent=2)}

Instructions:
1. Acknowledge the rider's complaint but explain why the driver acted appropriately based on the evidence.
2. Highlight specific evidence (GPS data, app events, chat logs, policy rules) that supports the driver's position.
3. Write in clear paragraph form, similar to a professional case summary.
4. Do NOT use markdown tables, HTML tables, or table-like formatting.
5. Keep the tone professional and factual.
6. Do not mention that you are an AI.
"""

    return call_groq(prompt)


# -----------------------------------------------------------------------------
# Judge output validation
# -----------------------------------------------------------------------------
def _error_ruling(msg: str) -> dict:
    return {
        "decision": "[ERROR]",
        "confidence": "N/A",
        "explanation": f"[ERROR] {msg}",
        "escalate": True,
    }


def validate_judge_output(raw: object) -> dict:
    """
    Validate and sanitise a judge model's output.

    Rules:
      - Must be a JSON object (dict).
      - decision must be a non-empty string in ALLOWED_DECISIONS.
      - explanation must be a non-empty string.
      - confidence must parse to a finite float in [0, 100].
      - NaN, infinity, and unknown decisions are rejected.
      - confidence < CONFIDENCE_THRESHOLD triggers escalation.

    Returns a safe error dict on any validation failure.
    """
    if not isinstance(raw, dict):
        return _error_ruling(f"Judge output must be a JSON object, got {type(raw).__name__}.")

    decision = raw.get("decision")
    confidence = raw.get("confidence")
    explanation = raw.get("explanation")

    # --- decision ---
    if not isinstance(decision, str) or not decision.strip():
        return _error_ruling("Judge output missing or empty decision field.")
    if decision not in ALLOWED_DECISIONS:
        return _error_ruling(
            f"Invalid decision '{decision}'. Allowed: {', '.join(sorted(ALLOWED_DECISIONS))}"
        )

    # --- explanation ---
    if not isinstance(explanation, str) or not explanation.strip():
        return _error_ruling("Judge output missing or empty explanation field.")

    # --- confidence ---
    if confidence is None or (isinstance(confidence, str) and not confidence.strip()):
        return _error_ruling("Judge output missing or empty confidence field.")

    confidence_str = str(confidence).replace("%", "").strip()
    try:
        confidence_num = float(confidence_str)
    except ValueError:
        return _error_ruling(f"Confidence must be a numeric percentage, got: '{confidence}'")

    if not math.isfinite(confidence_num):
        return _error_ruling(f"Confidence must be a finite number, got: {confidence_num}")

    if confidence_num < 0 or confidence_num > 100:
        return _error_ruling(f"Confidence must be between 0 and 100, got: {confidence_num}")

    # --- escalation ---
    escalate = confidence_num < CONFIDENCE_THRESHOLD
    if escalate:
        explanation += (
            "\n\n[ESCALATION NOTICE] Confidence is below the platform's threshold "
            "for automated resolution. This case is being flagged for human review "
            "rather than finalized automatically."
        )

    return {
        "decision": decision,
        "confidence": f"{confidence_num:.0f}%",
        "explanation": explanation,
        "escalate": escalate,
    }


# -----------------------------------------------------------------------------
# Agent: Judge
# -----------------------------------------------------------------------------
def judge_ruling(rider_case: str, driver_case: str, dispute_data: dict) -> dict:
    evidence_json = json.dumps(dispute_data["evidence"], indent=2)

    prompt = f"""You are an impartial judge resolving a ride-hailing dispute.

Your job is to weigh BOTH arguments against the RAW EVIDENCE below — not against which side sounds more convincing. Use ONLY the evidence provided; do NOT invent facts.

--- RIDER'S ARGUMENT ---
{rider_case}

--- DRIVER'S ARGUMENT ---
{driver_case}

--- RAW EVIDENCE ---
{evidence_json}

--- RIDER PROFILE ---
{json.dumps(dispute_data['rider_profile'], indent=2)}

--- DRIVER PROFILE ---
{json.dumps(dispute_data['driver_profile'], indent=2)}

Instructions:
1. Evaluate the claims made by both sides against the raw evidence.
2. Decide a ruling (e.g., "UPHELD" for the rider, "REJECTED" for the rider, or a "PARTIAL" outcome such as a partial refund).
3. Provide a confidence score as a percentage (0-100%). The confidence should be LOWER when evidence is ambiguous, contradictory, or incomplete.
4. Provide a clear, plain-English explanation of your reasoning. A non-technical rider or driver should be able to read it and understand why you decided this way.

IMPORTANT — Respond in strict JSON format with exactly these keys and no extra text:
{{
  "decision": "<your ruling>",
  "confidence": "<percentage, e.g. 85%>",
  "explanation": "<your reasoning>"
}}
"""

    response_text = call_groq(prompt)
    if response_text.startswith("[ERROR]"):
        return _error_ruling(response_text)

    # Strip markdown fences if present.
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("\n", 1)[0] if "\n" in cleaned else cleaned
    cleaned = cleaned.strip()

    try:
        ruling = json.loads(cleaned)
    except Exception as exc:
        return _error_ruling(
            f"Could not parse judge response as JSON: {exc}\n\nRaw response:\n{response_text}"
        )

    return validate_judge_output(ruling)
