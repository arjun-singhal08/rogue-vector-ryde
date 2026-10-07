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

# Allow the Vite dev server and any production origin the React app is served from.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# In-memory job store (thread-safe)
# -----------------------------------------------------------------------------
_MAX_CONCURRENT = 2

_jobs_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}
_active_case_reviews: dict[int, str] = {}  # case_id -> review_id


def _strip_internal_fields(case: dict) -> dict:
    """Remove evaluation-only fields before sending to the browser."""
    return {k: v for k, v in case.items() if k != "expected_ruling"}


def _find_case(case_id: int) -> dict | None:
    for c in DISPUTES:
        if c["id"] == case_id:
            return c
    return None


def _update_job(review_id: str, **kwargs: Any) -> None:
    with _jobs_lock:
        if review_id in _jobs:
            _jobs[review_id].update(kwargs)


def _release_case(case_id: int, review_id: str) -> None:
    with _jobs_lock:
        if _active_case_reviews.get(case_id) == review_id:
            del _active_case_reviews[case_id]


# -----------------------------------------------------------------------------
# Background worker
# -----------------------------------------------------------------------------
def _run_review(review_id: str, case: dict) -> None:
    """Run Rider Advocate → Driver Advocate → Judge in a background thread."""
    case_id = case["id"]
    try:
        _update_job(review_id, stage="rider")
        rider_case = rider_advocate(case)
        if rider_case.startswith("[ERROR]"):
            _update_job(review_id, status="failed", error=rider_case, stage=None)
            _release_case(case_id, review_id)
            return

        _update_job(review_id, rider_case=rider_case, stage="driver")
        driver_case = driver_advocate(case)
        if driver_case.startswith("[ERROR]"):
            _update_job(review_id, status="failed", error=driver_case, stage=None)
            _release_case(case_id, review_id)
            return

        _update_job(review_id, driver_case=driver_case, stage="judge")
        ruling = judge_ruling(rider_case, driver_case, case)

        if ruling.get("decision") == "[ERROR]":
            _update_job(
                review_id,
                status="failed",
                error=ruling.get("explanation", "Judge validation failed."),
                stage=None,
            )
            _release_case(case_id, review_id)
            return

        _update_job(review_id, ruling=ruling, status="complete", stage=None)
        _release_case(case_id, review_id)
    except Exception as exc:
        _update_job(
            review_id,
            status="failed",
            error="An internal error occurred while processing the review.",
            stage=None,
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


@app.post("/api/cases/{case_id}/reviews")
def start_review(case_id: int) -> dict:
    case = _find_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    with _jobs_lock:
        # Prevent duplicate active reviews of the same case.
        active_id = _active_case_reviews.get(case_id)
        if active_id:
            active_job = _jobs.get(active_id)
            if active_job and active_job["status"] in ("running",):
                raise HTTPException(
                    status_code=409,
                    detail=f"Active review already exists for this case: {active_id}",
                )

        # Bound concurrent work.
        running_count = sum(1 for j in _jobs.values() if j["status"] == "running")
        if running_count >= _MAX_CONCURRENT:
            raise HTTPException(
                status_code=503,
                detail="Server is at capacity. Please try again later.",
            )

        review_id = str(uuid.uuid4())
        job = {
            "review_id": review_id,
            "case_id": case_id,
            "status": "running",
            "stage": None,
            "rider_case": None,
            "driver_case": None,
            "ruling": None,
            "error": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
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

    return {
        "review_id": job["review_id"],
        "case_id": job["case_id"],
        "status": job["status"],
        "stage": job["stage"],
        "rider_case": job["rider_case"],
        "driver_case": job["driver_case"],
        "ruling": job["ruling"],
        "error": job["error"],
    }
