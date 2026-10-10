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
from typing import Callable

import groq
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
# Connection-error diagnostics (no secrets exposed)
# -----------------------------------------------------------------------------
def _classify_connection_error(exc: Exception) -> tuple[str, str]:
    """Return (category, cause_type) for a connection error without exposing secrets."""
    cause = getattr(exc, "__cause__", None)
    cause_type = type(cause).__name__ if cause else "unknown"
    cause_str = str(cause).lower() if cause else ""
    if not cause:
        cause_str = str(exc).lower()
        cause_type = type(exc).__name__
    if any(k in cause_str for k in ("getaddrinfo", "name", "dns", "resolution", "nxdomain")):
        return "dns", cause_type
    if any(k in cause_str for k in ("ssl", "tls", "certificate", "cert", "verify")):
        return "tls", cause_type
    if "refused" in cause_str:
        return "connection_refused", cause_type
    if any(k in cause_str for k in ("timeout", "timed out")):
        return "timeout", cause_type
    if any(k in cause_str for k in ("network", "unreachable", "noroute")):
        return "network_unreachable", cause_type
    return "unknown", cause_type


def _proxy_env_present() -> list[str]:
    return [k for k in os.environ if "proxy" in k.lower()]


# -----------------------------------------------------------------------------
# Low-level Groq client wrapper
# -----------------------------------------------------------------------------
def call_groq(
    prompt_text: str,
    max_retries: int = 2,
    max_completion_tokens: int = 512,
    timing_out: dict | None = None,
    response_format: dict | None = None,
    state_callback: Callable[[str, float | None], None] | None = None,
    reasoning_effort: str | None = None,
    time_budget: float = 60.0,
) -> str:
    """
    Send a prompt to the Groq API with a finite timeout and bounded retries.

    Uses a single bounded retry strategy:
      - SDK auto-retries are disabled (max_retries=0 on the client).
      - Authentication and configuration errors are NOT retried.
      - Only transient failures (timeouts, connection errors, 5xx) are retried.

    Never exposes the raw API key or provider exceptions to callers.
    """
    start = time.monotonic()
    retry_count = 0

    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        if timing_out is not None:
            timing_out["duration_ms"] = round((time.monotonic() - start) * 1000)
            timing_out["retries"] = 0
        return "[ERROR] GROQ_API_KEY is not configured."

    model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")
    # Only override base_url when explicitly configured; otherwise let the SDK
    # use its own default to avoid double-path bugs like /openai/v1/openai/v1/...
    client_kwargs: dict = {"api_key": api_key, "max_retries": 0}
    env_base_url = os.environ.get("GROQ_BASE_URL")
    if env_base_url:
        client_kwargs["base_url"] = env_base_url
    client = Groq(**client_kwargs)

    proxy_vars = _proxy_env_present()
    if proxy_vars:
        import sys
        print(f"[DIAGNOSTICS] Proxy environment variables detected: {proxy_vars}", file=sys.stderr)

    last_error = ""
    total_wait_time = 0.0

    for attempt in range(max_retries + 1):
        elapsed = time.monotonic() - start
        remaining = time_budget - elapsed
        if remaining <= 0:
            last_error = f"TimeoutError (stopped: budget {time_budget:.1f}s exhausted before request)"
            break
            
        try:
            kwargs = {
                "messages": [{"role": "user", "content": prompt_text}],
                "model": model,
                "max_completion_tokens": max_completion_tokens,
                "timeout": min(30.0, remaining),
            }
            if response_format is not None:
                kwargs["response_format"] = response_format
            if reasoning_effort is not None:
                kwargs["reasoning_effort"] = reasoning_effort

            chat_completion = client.chat.completions.create(**kwargs)
            choice = chat_completion.choices[0]
            finish_reason = choice.finish_reason
            result = choice.message.content

            if timing_out is not None:
                timing_out["duration_ms"] = round((time.monotonic() - start) * 1000)
                timing_out["retries"] = retry_count
                timing_out["wait_time_ms"] = round(total_wait_time * 1000)
                timing_out["finish_reason"] = finish_reason
                timing_out["effective_model"] = model
                timing_out["effective_max_completion_tokens"] = max_completion_tokens
                timing_out["effective_reasoning_effort"] = reasoning_effort
                
                if hasattr(chat_completion, "usage") and chat_completion.usage:
                    usage = chat_completion.usage
                    if hasattr(usage, "prompt_tokens"):
                        timing_out["prompt_tokens"] = usage.prompt_tokens
                    if hasattr(usage, "completion_tokens"):
                        timing_out["completion_tokens"] = usage.completion_tokens
                    if hasattr(usage, "total_tokens"):
                        timing_out["total_tokens"] = usage.total_tokens
                    if hasattr(usage, "completion_tokens_details") and usage.completion_tokens_details:
                        details = usage.completion_tokens_details
                        if hasattr(details, "reasoning_tokens"):
                            timing_out["reasoning_tokens"] = details.reasoning_tokens

            if finish_reason == "length":
                return "[ERROR] Response truncated due to token limit (finish_reason='length')."

            if not result:
                return "[ERROR] Received empty response from provider."

            return result
        except groq.RateLimitError as exc:
            retry_after = 5.0
            quota_type = "unknown"
            sanitized_body = "unknown"
            req_id = "unknown"
            rl_headers = {}

            if hasattr(exc, "response") and exc.response is not None:
                headers = exc.response.headers
                req_id = headers.get("x-request-id", "unknown")
                rl_headers = {k: v for k, v in headers.items() if k.lower().startswith("x-ratelimit-")}

                if "retry-after" in headers:
                    try:
                        retry_after = float(headers["retry-after"])
                    except (ValueError, TypeError):
                        pass
                elif "x-ratelimit-reset" in headers:
                    val = str(headers["x-ratelimit-reset"]).replace("s", "")
                    try:
                        retry_after = float(val)
                    except (ValueError, TypeError):
                        pass
                
                try:
                    err_json = exc.response.json()
                    err_msg = err_json.get("error", {}).get("message", "")
                    if err_msg:
                        sanitized_body = err_msg.replace("\n", " ").strip()
                    
                    err_lower = err_msg.lower()
                    if "tokens per minute" in err_lower:
                        quota_type = "TPM"
                    elif "tokens per day" in err_lower:
                        quota_type = "TPD"
                    elif "requests per minute" in err_lower:
                        quota_type = "RPM"
                    elif "requests per day" in err_lower:
                        quota_type = "RPD"
                except Exception:
                    pass
                
                if quota_type == "unknown":
                    rem_tokens = headers.get("x-ratelimit-remaining-tokens")
                    rem_reqs = headers.get("x-ratelimit-remaining-requests")
                    if rem_tokens is not None and str(rem_tokens).strip() == "0":
                        quota_type = "Tokens"
                    elif rem_reqs is not None and str(rem_reqs).strip() == "0":
                        quota_type = "Requests"

            delay = max(retry_after, 1.0)
            
            import sys
            print(f"[DIAGNOSTICS] RateLimitError 429. req_id: {req_id}, quota: {quota_type}, delay: {delay:.1f}s. Headers: {rl_headers}. Body: {sanitized_body}", file=sys.stderr)

            last_error = f"RateLimitError (status 429, req_id: {req_id}, quota: {quota_type}, requested_delay: {delay:.1f}s)"

            elapsed = time.monotonic() - start
            remaining = time_budget - elapsed
            
            if attempt < max_retries and delay <= remaining:
                retry_count += 1
                total_wait_time += delay
                if state_callback:
                    state_callback(state="waiting_retry", retry_deadline=time.time() + delay)
                time.sleep(delay)
                if state_callback:
                    state_callback(state="processing", retry_deadline=None)
                continue
            else:
                if delay > remaining:
                    last_error += f" (stopped: requested retry delay exceeds remaining budget of {max(0.0, remaining):.1f}s)"
                else:
                    last_error += f" (stopped: max retries {max_retries} exhausted)"
                break
        except groq.AuthenticationError as exc:
            last_error = "AuthenticationError (status 401)"
            break
        except (groq.APITimeoutError, groq.APIConnectionError) as exc:
            category, cause_type = _classify_connection_error(exc)
            last_error = f"{type(exc).__name__} (category: {category}, cause: {cause_type})"

            import sys
            print(f"[DIAGNOSTICS] {last_error}", file=sys.stderr)

            delay = 1.0 * (attempt + 1)
            elapsed = time.monotonic() - start
            remaining = time_budget - elapsed
            if attempt < max_retries and delay <= remaining:
                retry_count += 1
                total_wait_time += delay
                if state_callback:
                    state_callback(state="waiting_retry", retry_deadline=time.time() + delay)
                time.sleep(delay)
                if state_callback:
                    state_callback(state="processing", retry_deadline=None)
                continue
            else:
                if delay > remaining:
                    last_error += f" (stopped: remaining budget {max(0.0, remaining):.1f}s exhausted)"
                else:
                    last_error += f" (stopped: max retries {max_retries} exhausted)"
                break
        except groq.APIStatusError as exc:
            last_error = f"APIStatusError (status {exc.status_code})"
            if exc.status_code < 500:
                if exc.status_code == 400 and exc.response is not None:
                    try:
                        err_body = exc.response.json().get("error", {})
                        if err_body.get("code") == "json_validate_failed":
                            fg = err_body.get("failed_generation", "")
                            return f"[ERROR] json_validate_failed: Model failed to conform to the strict schema.\nFailed generation:\n{fg}"
                    except Exception:
                        pass
                return f"[ERROR] Provider configuration error: {exc.message}"
            delay = 1.0 * (attempt + 1)
            elapsed = time.monotonic() - start
            remaining = time_budget - elapsed
            if attempt < max_retries and delay <= remaining:
                retry_count += 1
                total_wait_time += delay
                if state_callback:
                    state_callback(state="waiting_retry", retry_deadline=time.time() + delay)
                time.sleep(delay)
                if state_callback:
                    state_callback(state="processing", retry_deadline=None)
                continue
            else:
                if delay > remaining:
                    last_error += f" (stopped: remaining budget {max(0.0, remaining):.1f}s exhausted)"
                else:
                    last_error += f" (stopped: max retries {max_retries} exhausted)"
                break
        except Exception as exc:
            last_error = f"Unexpected Error: {type(exc).__name__}"
            break

    if timing_out is not None:
        timing_out["duration_ms"] = round((time.monotonic() - start) * 1000)
        timing_out["retries"] = retry_count
        timing_out["wait_time_ms"] = round(total_wait_time * 1000)

    import sys
    print(f"call_groq failed. Last error: {last_error}", file=sys.stderr)
    return f"[ERROR] Groq API call failed after {retry_count + 1} attempt(s). Reason: {last_error}"


# -----------------------------------------------------------------------------
# Agent: Rider Advocate
# -----------------------------------------------------------------------------
def rider_advocate(dispute_data: dict, timing_out: dict | None = None, state_callback: Callable[[str, float | None], None] | None = None, time_budget: float = 60.0) -> str:
    evidence_json = json.dumps(dispute_data["evidence"], indent=2)

    prompt = f"""You are an advocate representing the rider in a ride-hailing dispute.

Your job is to build the strongest fair case for the rider using ONLY the evidence provided below.

RULES — you MUST follow all of these:
1. Distinguish recorded facts, the rider's allegations, supplied policy text, and unresolved questions. Label each category explicitly when you rely on it.
2. When supporting an important claim, cite the exact evidence field path (e.g., evidence["trip_data"]["actual_duration_minutes"]).
3. NEVER invent policy that is not in the evidence. If no policy covers a point, say so.
4. If the evidence contains only a textual photo description, you may NOT claim to have inspected the photograph itself.
5. Ratings, trip counts, and prior dispute history are background data only. You MUST NOT use them to argue credibility, trustworthiness, or likelihood of fault.
6. Do NOT invent facts, assume details not in the data, or hallucinate information.
7. Write in clear paragraph form only, similar to a professional case summary.
8. Do NOT use markdown tables, HTML tables, or table-like formatting.
9. Keep the tone professional and factual.
10. Do not mention that you are an AI.
11. Target length: 120–180 words. Be concise.

--- RIDER COMPLAINT ---
{dispute_data['rider_complaint']}

--- EVIDENCE ---
{evidence_json}

--- RIDER PROFILE (background only, do NOT use for credibility arguments) ---
Prior disputes: {dispute_data['rider_profile']['prior_disputes']}
"""

    return call_groq(
        prompt,
        max_completion_tokens=int(os.environ.get("GROQ_ADVOCATE_TOKENS", 4096)),
        timing_out=timing_out,
        state_callback=state_callback,
        reasoning_effort=os.environ.get("GROQ_REASONING_EFFORT"),
        time_budget=time_budget,
    )


# -----------------------------------------------------------------------------
# Agent: Driver Advocate
# -----------------------------------------------------------------------------
def driver_advocate(dispute_data: dict, timing_out: dict | None = None, state_callback: Callable[[str, float | None], None] | None = None, time_budget: float = 60.0) -> str:
    evidence_json = json.dumps(dispute_data["evidence"], indent=2)

    prompt = f"""You are an advocate representing the driver in a ride-hailing dispute.

Your job is to build the strongest fair case for the driver using ONLY the evidence provided below.

RULES — you MUST follow all of these:
1. Distinguish recorded facts, the rider's allegations, supplied policy text, and unresolved questions. Label each category explicitly when you rely on it.
2. When supporting an important claim, cite the exact evidence field path (e.g., evidence["trip_data"]["driver_arrival_time"]).
3. NEVER invent policy that is not in the evidence. If no policy covers a point, say so.
4. If the evidence contains only a textual photo description, you may NOT claim to have inspected the photograph itself.
5. Ratings, trip counts, and prior dispute history are background data only. You MUST NOT use them to argue credibility, trustworthiness, or likelihood of fault.
6. You MUST acknowledge contrary evidence rather than simply assuming the driver acted appropriately. Address the rider's strongest points directly.
7. Do NOT invent facts, assume details not in the data, or hallucinate information.
8. Write in clear paragraph form only, similar to a professional case summary.
9. Do NOT use markdown tables, HTML tables, or table-like formatting.
10. Keep the tone professional and factual.
11. Do not mention that you are an AI.
12. Target length: 120–180 words. Be concise.

--- RIDER COMPLAINT (for context) ---
{dispute_data['rider_complaint']}

--- EVIDENCE ---
{evidence_json}

--- DRIVER PROFILE (background only, do NOT use for credibility arguments) ---
{json.dumps(dispute_data['driver_profile'], indent=2)}
"""

    return call_groq(
        prompt,
        max_completion_tokens=int(os.environ.get("GROQ_ADVOCATE_TOKENS", 4096)),
        timing_out=timing_out,
        state_callback=state_callback,
        reasoning_effort=os.environ.get("GROQ_REASONING_EFFORT"),
        time_budget=time_budget,
    )


# -----------------------------------------------------------------------------
# Judge output validation
# -----------------------------------------------------------------------------
def _error_ruling(msg: str) -> dict:
    clean_msg = msg
    while clean_msg.startswith("[ERROR]"):
        clean_msg = clean_msg[7:].strip()
    return {
        "decision": "[ERROR]",
        "confidence": "N/A",
        "explanation": f"[ERROR] {clean_msg}",
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
    if decision in ("ESCALATE", "ESCALATE FOR HUMAN REVIEW"):
        escalate = True
        explanation += (
            "\n\n[ESCALATION NOTICE] The judge has explicitly recommended escalation "
            "for human review rather than finalizing automatically."
        )
    elif escalate:
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
def judge_ruling(
    rider_case: str, driver_case: str, dispute_data: dict, timing_out: dict | None = None, state_callback: Callable[[str, float | None], None] | None = None, time_budget: float = 60.0
) -> dict:
    evidence_json = json.dumps(dispute_data["evidence"], indent=2)

    prompt = f"""You are an impartial judge resolving a ride-hailing dispute.

Your job is to weigh BOTH arguments against the RAW EVIDENCE below — not against which side sounds more convincing. Use ONLY the evidence provided; do NOT invent facts.

RULES — you MUST follow all of these:
1. Distinguish recorded facts, party allegations, supplied policy text, and unresolved questions. Label each category explicitly.
2. When supporting an important claim, cite the exact evidence field path.
3. NEVER invent policy that is not in the evidence. If no policy covers a point, say so. Missing policy text means the applicable rule is unknown, not nonexistent. Do NOT treat missing policy as evidence that a fee or route deviation is permitted. Escalate when that missing rule is material to resolution.
4. If the evidence contains only a textual photo description, you may NOT claim to have inspected the photograph itself.
5. Ratings, trip counts, and prior dispute history are background data only. You MUST NOT use them to establish credibility, trustworthiness, or likelihood of fault.
6. Consider the ORIGINAL RIDER COMPLAINT explicitly. Distinguish its separate issues and evaluate each one independently.
7. The Driver Advocate may have acknowledged contrary evidence — weigh that fairly.
8. If MISSING EVIDENCE prevents a defensible resolution, recommend human review (decision: "ESCALATE FOR HUMAN REVIEW") and identify exactly what evidence is missing. Do NOT force a ruling toward either party.
9. Reporting or charging events (e.g., "cleaning fee applied") show that a charge happened, NOT that it was justified.
10. Street counts or route summaries do NOT independently prove total route distance.
11. Decision definitions MUST be used exactly as follows:
    - UPHELD = rider complaint accepted (e.g., rider receives a refund).
    - REJECTED = rider complaint denied / disputed fee stands.
    - PARTIAL = only part of the rider complaint accepted.
    - ESCALATE (or ESCALATE FOR HUMAN REVIEW) = unresolved and requires human review.
12. Provide a confidence score as a percentage (0-100%). The confidence should be LOWER when evidence is ambiguous, contradictory, or incomplete.
13. Target explanation length: 100–150 words. Be concise.
14. Provide a clear, plain-English explanation of your reasoning. A non-technical rider or driver should be able to read it and understand why you decided this way.

IMPORTANT — Respond in strict JSON format with exactly these keys and no extra text:
{{
  "decision": "<your ruling>",
  "confidence": "<percentage, e.g. 85%>",
  "explanation": "<your reasoning>"
}}

--- ORIGINAL RIDER COMPLAINT ---
{dispute_data['rider_complaint']}

--- RIDER'S ARGUMENT ---
{rider_case}

--- DRIVER'S ARGUMENT ---
{driver_case}

--- RAW EVIDENCE ---
{evidence_json}

--- RIDER PROFILE (background only, do NOT use for credibility arguments) ---
{json.dumps(dispute_data['rider_profile'], indent=2)}

--- DRIVER PROFILE (background only, do NOT use for credibility arguments) ---
{json.dumps(dispute_data['driver_profile'], indent=2)}
"""

    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "dispute_ruling",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "decision": {
                        "type": "string",
                        "enum": sorted(list(ALLOWED_DECISIONS))
                    },
                    "confidence": {"type": "string"},
                    "explanation": {"type": "string"}
                },
                "required": ["decision", "confidence", "explanation"],
                "additionalProperties": False
            }
        }
    }

    total_duration_ms = 0
    total_retries = 0
    total_wait_time_ms = 0
    regeneration_count = 0
    prompt_to_use = prompt

    for attempt in range(2):
        if attempt > 0:
            regeneration_count += 1
            
        attempt_timing = {}
        response_text = call_groq(
            prompt_to_use, 
            max_completion_tokens=int(os.environ.get("GROQ_JUDGE_TOKENS", 6144)), 
            timing_out=attempt_timing,
            response_format=response_format,
            state_callback=state_callback,
            reasoning_effort=os.environ.get("GROQ_REASONING_EFFORT"),
            time_budget=time_budget
        )

        elapsed_ms = attempt_timing.get("duration_ms", 0)
        total_duration_ms += elapsed_ms
        total_retries += attempt_timing.get("retries", 0)
        total_wait_time_ms += attempt_timing.get("wait_time_ms", 0)
        time_budget = max(0.0, time_budget - (elapsed_ms / 1000.0))

        if timing_out is not None:
            timing_out.update(attempt_timing)
            timing_out["duration_ms"] = total_duration_ms
            timing_out["retries"] = total_retries
            timing_out["wait_time_ms"] = total_wait_time_ms
            timing_out["regeneration_count"] = regeneration_count

        if response_text.startswith("[ERROR] json_validate_failed"):
            if attempt == 0:
                prompt_to_use = prompt + "\n\nREMINDER: You previously failed to output valid JSON. You MUST output strictly valid JSON matching the schema, with no trailing characters or markdown."
                continue
            else:
                return _error_ruling(response_text)
        elif response_text.startswith("[ERROR]"):
            return _error_ruling(response_text)

        break

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
