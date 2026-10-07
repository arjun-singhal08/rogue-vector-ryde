# ROGUE VECTOR — RydeResolve

RydeResolve is a prototype dispute-resolution dashboard for ride-hailing platforms. It loads synthetic dispute evidence, runs Rider Advocate, Driver Advocate, and Judge agents backed by the Groq API, and presents a structured recommendation with human-review escalation for low-confidence outcomes.

The React frontend connects to a FastAPI backend that orchestrates the agents in background threads. A Streamlit backup remains available for standalone demos.

---

## Architecture

```
┌─────────────────┐     GET /api/cases      ┌─────────────────┐
│                 │ ◄────────────────────── │                 │
│   React + Vite  │     POST /api/cases/... │   FastAPI       │
│   (Dashboard)   │ ──────────────────────► │   (api.py)      │
│                 │  Poll GET /api/reviews/ │                 │
│                 │ ◄────────────────────── │                 │
└─────────────────┘                         └────────┬────────┘
                                                      │
                              ┌───────────────────────┼───────────────────────┐
                              │                       │                       │
                              ▼                       ▼                       ▼
                        ┌─────────┐            ┌─────────┐            ┌─────────┐
                        │  Rider  │            │ Driver  │            │  Judge  │
                        │Advocate │            │Advocate │            │ Ruling  │
                        └────┬────┘            └────┬────┘            └────┬────┘
                             │                      │                      │
                             └──────────────────────┼──────────────────────┘
                                                    │
                                                    ▼
                                              ┌─────────┐
                                              │  Groq   │
                                              │   API   │
                                              └─────────┘
```

- **React frontend** — loads cases, starts reviews, polls progress, renders evidence tabs, advocate cards, and judge recommendations.
- **FastAPI backend** — serves cases, runs agent reviews in daemon threads, enforces duplicate-prevention and concurrency limits, validates judge output.
- **Three agents** — `rider_advocate`, `driver_advocate`, and `judge_ruling` in `agents/dispute_agents.py`.
- **Groq API** — external LLM provider; timeout and bounded retries are configured in `call_groq`. The API key never leaves the server.

---

## Supported dispute categories

1. **Route deviation** — rider claims the driver took a longer route, inflating fare and duration.
2. **No-show cancellation fee** — rider disputes a cancellation fee charged after the driver waited.
3. **Cleaning fee dispute** — rider contests a post-trip cleaning fee; driver submitted a photo.
4. **Lost item** — rider reports a lost phone; GPS data shows the driver visited an unscheduled location after drop-off.

All evidence, profiles, timestamps, and policy values are synthetic and for demonstration only.

---

## Setup

1. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Install frontend dependencies:

   ```bash
   cd frontend
   npm install
   ```

3. Create a `.env` file in the project root from the example:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and replace the placeholder with your key:

   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```

   The example file contains placeholders only. Never commit a file with a real key.

---

## Start the application (two terminals)

**Terminal 1 — Backend**

```bash
uvicorn api:app --reload --port 8000
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:8000`. Open the URL shown by Vite (typically `http://localhost:5173`).

---

## Streamlit backup

To run the original Streamlit app independently:

```bash
streamlit run app.py
```

---

## Judge output validation

The backend validates every judge response before it reaches the UI:

- Must be a JSON object.
- `decision` must be one of: `UPHELD`, `REJECTED`, `PARTIAL`, `PARTIAL REFUND`, `ESCALATE`, `ESCALATE FOR HUMAN REVIEW`.
- `explanation` must be a non-empty string.
- `confidence` must parse to a finite number between 0 and 100.
- NaN, infinity, null fields, and unknown decisions are rejected safely.
- Confidence below 60 % triggers escalation and appends a human-review notice.
- Invalid output never becomes a successful recommendation.

---

## Limitations

- **Synthetic data** — All cases, profiles, routes, and policy values are fabricated for demonstration. Thresholds such as the 60 % confidence limit are synthetic assumptions, not official platform policy.
- **Model-reported confidence** — The confidence score is self-reported by the LLM and is not verified ground-truth accuracy.
- **In-memory jobs** — Reviews are stored in a thread-safe in-memory dictionary. All jobs disappear on server restart. This prototype uses a single backend worker thread.
- **Concurrency bound** — Maximum of 2 concurrent reviews. Additional requests receive HTTP 503.
- **No sidebar collapse on narrow viewports** — The fixed 240 px sidebar can crowd the main content on very small screens; horizontal scroll is enabled below the `md` breakpoint as a safeguard.
- **No persistent audit log** — Reviews are not written to disk or a database.

---

## Security notes

- `GROQ_API_KEY` is loaded only on the server from the environment.
- The key is never included in API responses, frontend code, the built JS bundle, browser storage, or URL parameters.
- Raw provider exceptions are caught and replaced with safe, generic error messages before reaching the client.
- If you find a secret committed to any tracked file, report the file path immediately and rotate the key.

---

## Running tests (mocked — no live Groq calls)

```bash
python test_api.py
```

This exercises the FastAPI endpoints and judge validation using monkey-patched agent functions.

```bash
cd frontend
npm run build
npm run lint
```
