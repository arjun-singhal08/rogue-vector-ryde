# =============================================================================
# Dispute Agents — Placeholder Logic
# =============================================================================
# This module contains the "brains" that will eventually call a real LLM
# (Large Language Model) API to generate arguments and rulings.
# For now every function returns hard-coded placeholder text so the UI can be
# built and tested without needing an API key or internet connection.
# =============================================================================

import json
import os

from groq import Groq


def call_groq(prompt_text: str) -> str:
    """
    Send a prompt to the Groq API and return the generated text.

    Parameters
    ----------
    prompt_text : str
        The full prompt to send to the model.

    Returns
    -------
    str
        The model's response text, or an "[ERROR]" string if the call fails.
    """
    try:
        # Read the API key from the environment variable loaded by dotenv in app.py.
        api_key = os.environ["GROQ_API_KEY"]

        # Create a Groq client instance.
        client = Groq(api_key=api_key)

        # Send the prompt to the Groq-hosted model and get the response.
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt_text}],
            model="openai/gpt-oss-20b",
        )

        # Return the text content of the first choice.
        return chat_completion.choices[0].message.content
    except Exception as exc:
        # If anything goes wrong (network issue, bad key, etc.) return a safe
        # error string instead of crashing the whole Streamlit app.
        return f"[ERROR] Groq API call failed: {exc}"


def rider_advocate(dispute_data: dict) -> str:
    """
    Build the rider's side of the case using a real LLM call.

    This function:
      1. Formats all available evidence into a clear, structured prompt.
      2. Asks the model to act as the rider's advocate.
      3. Calls call_groq() and returns the generated argument.

    Parameters
    ----------
    dispute_data : dict
        The full dispute dictionary from sample_disputes.py.

    Returns
    -------
    str
        The AI-generated argument for the rider, or an error message.
    """
    # -------------------------------------------------------------------------
    # Build the evidence block dynamically.
    # We convert the evidence dict to a pretty-printed JSON string so the
    # model can read every field regardless of dispute type (Route Deviation,
    # No-Show Charge, etc.).
    # -------------------------------------------------------------------------
    evidence_json = json.dumps(dispute_data["evidence"], indent=2)

    # -------------------------------------------------------------------------
    # Compose the full prompt.
    # We explicitly tell the model:
    #   - Its role (advocate for the rider).
    #   - What data it has access to.
    #   - The constraint: use ONLY the evidence provided; do not invent facts.
    # This keeps the output grounded in the sample data.
    # -------------------------------------------------------------------------
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
3. Keep the tone professional and factual.
4. Do not mention that you are an AI.
"""

    return call_groq(prompt)


def driver_advocate(dispute_data: dict) -> str:
    """
    Build the driver's side of the case using a real LLM call.

    This function:
      1. Formats all available evidence into a clear, structured prompt.
      2. Asks the model to act as the driver's advocate.
      3. Calls call_groq() and returns the generated argument.

    Parameters
    ----------
    dispute_data : dict
        The full dispute dictionary from sample_disputes.py.

    Returns
    -------
    str
        The AI-generated argument for the driver, or an error message.
    """
    # -------------------------------------------------------------------------
    # Build the evidence block dynamically.
    # We convert the evidence dict to a pretty-printed JSON string so the
    # model can read every field regardless of dispute type.
    # -------------------------------------------------------------------------
    evidence_json = json.dumps(dispute_data["evidence"], indent=2)

    # -------------------------------------------------------------------------
    # Compose the full prompt.
    # We explicitly tell the model:
    #   - Its role (advocate for the driver).
    #   - What data it has access to.
    #   - The constraint: use ONLY the evidence provided; do not invent facts.
    # This keeps the output grounded in the sample data.
    # -------------------------------------------------------------------------
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
3. Keep the tone professional and factual.
4. Do not mention that you are an AI.
"""

    return call_groq(prompt)


def judge_ruling(rider_case: str, driver_case: str, dispute_data: dict) -> dict:
    """
    Produce a final ruling after hearing both sides.

    This function:
      1. Builds a judge prompt with both arguments and the raw evidence.
      2. Asks the model to act as an impartial judge.
      3. Calls call_groq() and expects a strict JSON response.
      4. Parses the JSON into a Python dict with keys:
         "decision", "confidence", "explanation".
      5. Returns a safe error dict if the API call or JSON parsing fails.

    Parameters
    ----------
    rider_case : str
        The argument generated by rider_advocate().
    driver_case : str
        The argument generated by driver_advocate().
    dispute_data : dict
        The full dispute dictionary (gives the judge access to raw evidence).

    Returns
    -------
    dict
        Ruling dict with keys:
        - "decision"     : str  (e.g. "UPHELD", "REJECTED", "PARTIAL")
        - "confidence"   : str  (percentage, e.g. "85%")
        - "explanation"  : str  (plain-English reasoning)
    """
    # -------------------------------------------------------------------------
    # Build the evidence block so the judge can verify claims against raw data.
    # -------------------------------------------------------------------------
    evidence_json = json.dumps(dispute_data["evidence"], indent=2)

    # -------------------------------------------------------------------------
    # Compose the full prompt.
    # We explicitly instruct the model to:
    #   - Act as an impartial judge.
    #   - Weigh arguments against the actual evidence, not rhetoric.
    #   - Respond in strict JSON so we can parse it reliably in code.
    # -------------------------------------------------------------------------
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

    # Call the LLM.  If the API fails, call_groq returns a string starting with
    # "[ERROR]" and we convert it into the error dict our app expects.
    response_text = call_groq(prompt)
    if response_text.startswith("[ERROR]"):
        return {
            "decision": "[ERROR]",
            "confidence": "N/A",
            "explanation": response_text,
        }

    # -------------------------------------------------------------------------
    # Parse the JSON response.
    # LLMs sometimes wrap JSON in markdown code fences (```json ... ```).
    # We strip those fences before parsing so json.loads doesn't choke.
    # -------------------------------------------------------------------------
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        # Remove the opening ```json or ``` line.
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
    if cleaned.endswith("```"):
        # Remove the closing ``` line.
        cleaned = cleaned.rsplit("\n", 1)[0] if "\n" in cleaned else cleaned
    cleaned = cleaned.strip()

    try:
        ruling = json.loads(cleaned)
    except Exception as exc:
        # If the model didn't return valid JSON, return a safe error dict.
        return {
            "decision": "[ERROR]",
            "confidence": "N/A",
            "explanation": f"[ERROR] Could not parse judge response as JSON: {exc}\n\nRaw response:\n{response_text}",
        }

    # Ensure the required keys exist.  If the model omitted one, fall back.
    required_keys = {"decision", "confidence", "explanation"}
    missing = required_keys - set(ruling.keys())
    if missing:
        return {
            "decision": "[ERROR]",
            "confidence": "N/A",
            "explanation": (
                f"[ERROR] Judge response missing required keys: {missing}.\n\n"
                f"Parsed JSON:\n{json.dumps(ruling, indent=2)}"
            ),
        }

    return ruling
