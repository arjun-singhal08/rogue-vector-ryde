# Public Deployment Guide

This guide explains how to deploy the RydeResolve dashboard to **Render**.

## Chosen Infrastructure: Render

Render offers a **Free Web Service** (for the FastAPI backend) and another Web Service with a **static runtime** (for the Vite + React frontend).

### Limitations of the Free Tier

- **Sleeping Services**: The FastAPI backend spins down after 15 minutes of inactivity. The first request after inactivity may take 30–60 seconds while the container wakes up.
- **Request Duration**: Render imposes a 100-second maximum HTTP request timeout. This is safe for RydeResolve because the backend uses a polling architecture (`POST /reviews` starts a background thread and returns immediately; `GET /reviews/{id}` polls the status instantly).
- **Persistent Storage**: Free web services lack persistent disk storage. Any in-memory jobs and logs are lost when the service restarts or goes to sleep.
- **Usage Limits**: Render provides 750 free instance hours per month. Static site bandwidth is capped at 100 GB/month.

### Security & Abuse Prevention

- **Concurrent Limits**: `_MAX_CONCURRENT = 1` ensures only one review actively communicates with the Groq API at a time.
- **Hourly Quota**: A server-side in-memory counter (`MAX_REVIEWS_PER_HOUR=20`) rejects excessive requests with HTTP 429. This is a **demo guard**, not a durable spending guarantee: it resets to zero on every server restart.
- **Hidden Credentials**: The `GROQ_API_KEY` is injected only into the FastAPI backend. The React frontend never exposes it.

---

## Deployment Steps

The repository includes a `render.yaml` Blueprint to automate deployment.

1. Create a free account at [Render](https://render.com/).
2. Connect your GitHub/GitLab repository.
3. In the Render Dashboard, click **New** -> **Blueprint**.
4. Select the `rogue-vector-ryde` repository.
5. Render will detect the `render.yaml` file and propose creating two services:
   - `ryderesolve-api` (Web Service)
   - `ryderesolve-ui` (Web Service with static runtime)
6. Click **Apply**.
7. **Important**: Go to the settings for the `ryderesolve-api` Web Service, navigate to the **Environment** tab, and add your `GROQ_API_KEY` securely. (It is marked as `sync: false` in the blueprint so it is not exposed in code.)
8. Ensure the backend's `FRONTEND_URL` and the frontend's `VITE_API_URL` environment variables match your actual `.onrender.com` subdomains.
9. **Critical**: After setting `VITE_API_URL`, you must manually trigger a new build of the `ryderesolve-ui` service (e.g. "Manual Deploy" -> "Clear build cache & deploy") so Vite can inline the correct URL.
10. Once both services deploy successfully, visit `https://ryderesolve-ui.onrender.com`.

---

## Build-Time Configuration

`VITE_API_URL` is a **build-time** environment variable. Vite inlines it into the static bundle during `npm run build`. Changing it after the static site has built has no effect; you must trigger a new build (e.g., by pushing a commit or clicking "Manual Deploy" in the Render dashboard).

Set `VITE_API_URL` to the backend origin **without** a trailing slash and **without** `/api`:
- Correct: `https://ryderesolve-api.onrender.com`
- Incorrect: `https://ryderesolve-api.onrender.com/` (trailing slash)
- Incorrect: `https://ryderesolve-api.onrender.com/api` (includes path)

When `VITE_API_URL` is unset, the frontend uses relative `/api/...` URLs, which work with the Vite dev-server proxy during local development.

---

## Local Development

For local development, run both services separately:

```bash
# Terminal 1 — Backend
uvicorn api:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:8000`. No `VITE_API_URL` is needed.
