# =============================================================================
# RydeResolve — FastAPI backend
# =============================================================================
# Serves the React dashboard and runs Groq agent reviews in background threads.
# All jobs are stored in memory and disappear on server restart.
#
# Start:
#     uvicorn api:app --reload --port 8000
#
# The Streamlit app (app.py) remains a working backup.
# =============================================================================

import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agents.dispute_agents import driver_advocate, judge_ruling, rider_advocate
from data.sample_disputes import DISPUTES

load_dotenv()

app = FastAPI(title="RydeResolve API", version="0.1.0")

import os

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# Allow the Vite dev server and any production origin the React app is served from.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# In-memory job store (thread-safe)
# -----------------------------------------------------------------------------
_MAX_CONCURRENT = 1

_jobs_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}
_active_case_reviews: dict[int, str] = {}  # case_id -> review_id

# In-memory hourly review counter. This is a demo guard, not a durable
# spending guarantee: it resets to zero on every server restart.
_review_history: list[float] = []


def _strip_internal_fields(case: dict) -> dict:
    """Remove evaluation-only fields before sending to the browser."""
    return {k: v for k, v in case.items() if k != "expected_ruling"}


def _find_case(case_id: int) -> dict | None:
    for c in DISPUTES:
        if c["id"] == case_id:
            return c
    return None


def _update_job(review_id: str, force: bool = False, **kwargs: Any) -> None:
    with _jobs_lock:
        if review_id in _jobs:
            if _jobs[review_id]["status"] != "running" and not force:
                return
            _jobs[review_id].update(kwargs)

def _log_job_summary(job: dict) -> None:
    try:
        import json
        log_entry = {
            "review_id": job.get("review_id"),
            "case_id": job.get("case_id"),
            "status": job.get("status"),
            "timings": job.get("timings", {})
        }
        with open("review_logs.jsonl", "a") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception:
        pass


def _release_case(case_id: int, review_id: str) -> None:
    with _jobs_lock:
        if review_id in _jobs:
            _log_job_summary(_jobs[review_id])
        if _active_case_reviews.get(case_id) == review_id:
            del _active_case_reviews[case_id]


# -----------------------------------------------------------------------------
# Background worker
# -----------------------------------------------------------------------------
def _run_review(review_id: str, case: dict) -> None:
    """Run Rider Advocate → Driver Advocate → Judge in a background thread."""
    case_id = case["id"]
    review_start = time.monotonic()
    timings: dict[str, Any] = {}

    def state_callback(state: str, retry_deadline: float | None = None) -> None:
        # Do not force-update; if the deadline check has already marked the job
        # failed, leave it alone.
        _update_job(review_id, operational_state=state, retry_deadline=retry_deadline)

    try:
        _update_job(review_id, stage="rider", operational_state="processing")
        rider_timing: dict[str, Any] = {}
        rider_case = rider_advocate(case, timing_out=rider_timing, state_callback=state_callback)
        for k, v in rider_timing.items():
            key = "rider_ms" if k == "duration_ms" else f"rider_{k}"
            timings[key] = v
        
        if rider_case.startswith("[ERROR]"):
            timings["total_ms"] = round((time.monotonic() - review_start) * 1000)
            _update_job(
                review_id,
                status="failed",
                error=rider_case,
                stage=None,
                timings=timings,
            )
            _release_case(case_id, review_id)
            return

        _update_job(review_id, rider_case=rider_case, stage="driver", operational_state="processing")
        driver_timing: dict[str, Any] = {}
        driver_case = driver_advocate(case, timing_out=driver_timing, state_callback=state_callback)
        for k, v in driver_timing.items():
            key = "driver_ms" if k == "duration_ms" else f"driver_{k}"
            timings[key] = v
            
        if driver_case.startswith("[ERROR]"):
            timings["total_ms"] = round((time.monotonic() - review_start) * 1000)
            _update_job(
                review_id,
                status="failed",
                error=driver_case,
                stage=None,
                timings=timings,
            )
            _release_case(case_id, review_id)
            return

        _update_job(review_id, driver_case=driver_case, stage="judge", operational_state="processing")
        judge_timing: dict[str, Any] = {}
        ruling = judge_ruling(rider_case, driver_case, case, timing_out=judge_timing, state_callback=state_callback)
        for k, v in judge_timing.items():
            key = "judge_ms" if k == "duration_ms" else f"judge_{k}"
            timings[key] = v

        if ruling.get("decision") == "[ERROR]":
            timings["total_ms"] = round((time.monotonic() - review_start) * 1000)
            _update_job(
                review_id,
                status="failed",
                error=ruling.get("explanation", "Judge validation failed."),
                stage=None,
                timings=timings,
            )
            _release_case(case_id, review_id)
            return

        timings["total_ms"] = round((time.monotonic() - review_start) * 1000)
        _update_job(
            review_id,
            ruling=ruling,
            status="complete",
            stage=None,
            timings=timings,
        )
        _release_case(case_id, review_id)
    except Exception as exc:
        timings["total_ms"] = round((time.monotonic() - review_start) * 1000)
        _update_job(
            review_id,
            status="failed",
            error="An internal error occurred while processing the review.",
            stage=None,
            timings=timings,
        )
        _release_case(case_id, review_id)


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------
@app.get("/api/health")
def health() -> dict:
    import os

    return {
        "status": "ok",
        "groq_configured": bool(os.environ.get("GROQ_API_KEY")),
    }


@app.get("/api/cases")
def get_cases() -> list[dict]:
    return [_strip_internal_fields(c) for c in DISPUTES]


from fastapi.responses import JSONResponse

@app.post("/api/cases/{case_id}/reviews")
def start_review(case_id: int) -> Any:
    case = _find_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    with _jobs_lock:
        # Prevent duplicate active reviews of the same case.
        active_id = _active_case_reviews.get(case_id)
        if active_id:
            active_job = _jobs.get(active_id)
            if active_job and active_job["status"] in ("running",):
                return JSONResponse(
                    status_code=409,
                    content={"detail": "Another case is being reviewed", "review_id": active_id}
                )

        # Hourly rate limiting — demo guard, resets on server restart.
        try:
            max_reviews_per_hour = int(os.environ.get("MAX_REVIEWS_PER_HOUR", 20))
        except ValueError:
            max_reviews_per_hour = 20

        now = time.monotonic()
        _review_history[:] = [t for t in _review_history if now - t < 3600]

        if len(_review_history) >= max_reviews_per_hour:
            raise HTTPException(
                status_code=429,
                detail=f"Server reached maximum free reviews per hour ({max_reviews_per_hour}). Please try again later."
            )

        # Bound concurrent work.
        running_count = sum(1 for j in _jobs.values() if j["status"] == "running")
        if running_count >= _MAX_CONCURRENT:
            raise HTTPException(
                status_code=503,
                detail="Server is at capacity. Please try again later.",
            )

        review_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        job = {
            "review_id": review_id,
            "case_id": case_id,
            "status": "running",
            "stage": None,
            "rider_case": None,
            "driver_case": None,
            "ruling": None,
            "error": None,
            "created_at": now,
            "started_at": now,
            "timings": {},
        }
        _review_history.append(time.monotonic())
        _jobs[review_id] = job
        _active_case_reviews[case_id] = review_id

    thread = threading.Thread(target=_run_review, args=(review_id, case), daemon=True)
    thread.start()

    return {"review_id": review_id}


@app.get("/api/reviews/{review_id}")
def get_review(review_id: str) -> dict:
    with _jobs_lock:
        job = _jobs.get(review_id)
        if not job:
            raise HTTPException(status_code=404, detail="Review not found")

        # Compute elapsed time for running reviews.
        elapsed_ms = None
        if job["status"] == "running" and job.get("started_at"):
            try:
                started = datetime.fromisoformat(job["started_at"])
                elapsed_ms = round((datetime.now(timezone.utc) - started).total_seconds() * 1000)
                
                # Check for 2-minute deadline (120,000 ms)
                if elapsed_ms > 120000:
                    job["status"] = "failed"
                    job["error"] = "[ERROR] Overall review deadline exceeded."
                    job["stage"] = None
                    if job["case_id"] in _active_case_reviews and _active_case_reviews[job["case_id"]] == review_id:
                        del _active_case_reviews[job["case_id"]]
                    _log_job_summary(job)
            except (ValueError, TypeError):
                pass

        return {
            "review_id": job["review_id"],
            "case_id": job["case_id"],
            "status": job["status"],
            "stage": job["stage"],
            "operational_state": job.get("operational_state", "processing"),
            "retry_deadline": job.get("retry_deadline"),
            "rider_case": job["rider_case"],
            "driver_case": job["driver_case"],
            "ruling": job["ruling"],
            "error": job["error"],
            "elapsed_ms": elapsed_ms,
            "timings": job.get("timings", {}),
        }
