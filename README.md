# RydeResolve

**A prototype dispute-resolution dashboard for ride-hailing platforms.**

RydeResolve loads synthetic dispute evidence, runs two advocate agents and a judge agent backed by the Groq API, and presents a structured recommendation with automatic human-review escalation when confidence is low.

**[Try the live demo &rarr;](https://ryderesolve-ui.onrender.com)**

> The demo is hosted on Render Free. If the backend has been idle, the first request may take 30–60 seconds while the container wakes up.

---

## What the prototype does

- **Loads four synthetic dispute cases** with trip data, chat logs, GPS telemetry, and profile information.
- **Runs three LLM agents sequentially** in the background: Rider Advocate, Driver Advocate, and Judge.
- **Presents a recommendation** with decision, confidence, explanation, and escalation flag.
- **Shows per-agent timing metadata** so you can see where review time is spent.
- **Prevents duplicate reviews** of the same case and limits concurrency to one active review.

The app **recommends** outcomes; it does **not** issue real refunds or bind a live platform.

---

## Agent workflow

1. **Rider Advocate** — builds the strongest fair case for the rider using only the provided evidence.
2. **Driver Advocate** — builds the strongest fair case for the driver, acknowledging contrary evidence.
3. **Judge** — weighs both arguments against the raw evidence and produces a decision, confidence score, and explanation.

All agents are constrained to cite exact evidence field paths, never invent policy, and never use ratings or dispute history as credibility evidence. The judge validates its output against a strict JSON schema before returning.

---

## Supported dispute categories

1. **Route deviation** — rider claims the driver took a longer route, inflating fare and duration.
2. **No-show cancellation fee** — rider disputes a cancellation fee charged after the driver waited.
3. **Cleaning fee dispute** — rider contests a post-trip cleaning fee; driver submitted a photo description.
4. **Lost item** — rider reports a lost phone; GPS data shows the driver visited an unscheduled location after drop-off.

All evidence, profiles, timestamps, and policy values are **synthetic** and for demonstration only.

---

## Architecture

```mermaid
graph LR
    A[React Dashboard] -->|GET /api/cases| B[FastAPI Backend]
    A -->|POST /reviews| B
    A -->|Poll /reviews/{id}| B
    B -->|1. rider_advocate| C[Groq API]
    B -->|2. driver_advocate| C
    B -->|3. judge_ruling| C
    B -->|Result + timing| A
```

- **React + Vite + Tailwind** — loads cases, starts reviews, polls progress, renders evidence, advocate cards, and judge recommendations.
- **FastAPI backend** — serves cases, runs agent reviews in daemon threads, enforces duplicate-prevention and concurrency limits, validates judge output.
- **Three agents** — `rider_advocate`, `driver_advocate`, and `judge_ruling` in `agents/dispute_agents.py`.
- **Groq API** — external LLM provider; timeout and bounded retries are configured in `call_groq`. The API key never leaves the server.

---

## Local setup

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

   The example file contains placeholders only. **Never commit a file with a real key.**

4. Start the application (two terminals):

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

## Running tests

Backend tests use mocked agents — no live Groq calls are made:

```bash
python test_api.py
```

Frontend build and lint:

```bash
cd frontend
npm run build
npm run lint
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

- **Synthetic data** — All cases, profiles, routes, and policy values are fabricated for demonstration. Thresholds such as the 60 % confidence limit are synthetic assumptions, not official Ryde policy.
- **Model-reported confidence** — The confidence score is self-reported by the LLM and is not verified ground-truth accuracy.
- **Recommendations only** — The app produces advisory outcomes. It does not process real payments or issue actual refunds.
- **Render Free hosting** — The backend spins down after 15 minutes of inactivity. The first request may take 30–60 seconds to wake the container.
- **Groq API limits** — Rate limits, token quotas, or transient provider errors can delay or fail a review. The UI shows retry status and elapsed time honestly.
- **In-memory jobs** — Reviews are stored in a thread-safe in-memory dictionary. All jobs disappear on server restart. This prototype uses a single backend worker thread.
- **Concurrency bound** — Maximum of 1 concurrent review. Additional requests receive HTTP 503.
- **No persistent audit log** — Reviews are not written to disk or a database.
- **Mobile drawer navigation** — A sheet-based drawer replaces the sidebar on narrow viewports. Desktop keeps the fixed sidebar.

---

## Security notes

- `GROQ_API_KEY` is loaded only on the server from the environment.
- The key is never included in API responses, frontend code, the built JS bundle, browser storage, or URL parameters.
- Raw provider exceptions are caught and replaced with safe, generic error messages before reaching the client.
- If you find a secret committed to any tracked file, report the file path immediately and rotate the key.
