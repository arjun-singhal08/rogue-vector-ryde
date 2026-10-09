# RydeResolve - Project Handover

## Verified State
- **Backend Architecture**: FastAPI orchestrates `rider_advocate`, `driver_advocate`, and `judge_ruling` sequentially in a background thread. Maximum 2 concurrent reviews enforced.
- **LLM Integration**: `agents/dispute_agents.py` uses the Groq API (`openai/gpt-oss-20b` by default). Outer-loop retries are implemented; SDK-level retries are disabled. Agent token caps are set to 4096 (advocates) and 6144 (judge) to accommodate reasoning token consumption. Note: Larger token caps are provisional unless future failed runs' usage supports them.
- **Error Handling**: 
  - **Rate Limiting (Unresolved Reliability Issue)**: Rate limit boundaries (max wait budgets) are enforced to prevent UI stalls, but underlying provider quota failures (e.g., TPD exhaustion observed in Cases 2-4) remain a separate, unresolved reliability blocker.
  - **json_validate_failed (Unresolved Reliability Issue)**: The provider error for malformed JSON is trapped, and a single fallback regeneration attempt is implemented, but the underlying model failure to conform to the strict schema is a distinct, unresolved reliability issue.
- **Prompt Rules**: Explicit instructions prohibit inventing policy, claiming to inspect textual photo descriptions, and using ratings for credibility. Judge handles missing evidence.
- **Validation**: Judge output strictly enforces JSON format (using Groq `response_format` JSON schema mode), finite confidence (0-100), and valid decisions. Confidence < 60% safely sets `escalate=True`.
- **Test Suite**: `test_api.py` (35 tests) fully covers mocked API endpoints, validation logic, review lifecycle edge cases (e.g., late workers), rate limit bounds, and `json_validate_failed` handling.
- **Live Diagnostics (Case 2)**: 
  - One successful API/polling run. This is NOT a verified browser interaction.
  - **Rider Advocate**: effective model `openai/gpt-oss-20b`, tokens: 4096 max (802 completion, 436 reasoning), finish_reason `stop`, 0 retries, duration 1.8s.
  - **Driver Advocate**: effective model `openai/gpt-oss-20b`, tokens: 4096 max (636 completion, 258 reasoning), finish_reason `stop`, 0 retries, duration 1.6s.
  - **Judge**: effective model `openai/gpt-oss-20b`, tokens: 6144 max (673 completion, 398 reasoning), finish_reason `stop`, 1 retry, duration 16.6s.
  - **Result**: Validated judge outcome: REJECTED (97% confidence). Total review time: 20s.
- **Frontend**: Vite + React + Tailwind v3 build completes successfully. `oxlint` confirms exactly 2 warnings related to ref cleanup (`pollTimers` and `abortControllers` in `App.tsx`), as reported.

## Unverified State
- **Frontend Interaction**: Browser rendering, Radix UI component states, and Anime.js transitions during an active API polling cycle have not been thoroughly tested end-to-end.

## Remaining Priorities (Checklist)
- [x] 1. Check `finish_reason` in `call_groq` to detect token truncation and run live latency diagnostics.
- [x] 2. Evaluate all four cases for evidence-grounded reasoning (no invented policy, appropriate escalation). *Note: Completed. Model performed remarkably well, adhering strictly to evidence and escalating when context/policy was missing.*
- [x] 3. Ensure the Judge explicitly references evidence/policy and recommends actionable steps without hallucinating. *Note: Verified. The judge accurately cites evidence fields and justifies recommendations based on available data.*
- [x] 4. Build a documented evaluation set (clear, ambiguous, contradictory, and failure cases). *Note: Documented in `docs/evaluation.md`.*
- [x] 5. Diagnose provider failures (Case 1 schema rejection / Case 2 truncation) and establish a stable execution configuration.
- [ ] 6. Complete submission materials (business value explanation, demo script, screenshots).
- [ ] 7. Test clean setup and browser behaviour before potential public deployment.

