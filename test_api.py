# =============================================================================
# API verification tests (mocked agents — no live Groq calls)
# =============================================================================
# Run with:
#     python test_api.py
#
# These tests exercise the FastAPI endpoints and judge validation using
# monkey-patched agent functions so no real LLM requests are made.
# =============================================================================

import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import api
from agents.dispute_agents import validate_judge_output

client = TestClient(api.app)


class TestHealthAndCases(unittest.TestCase):
    def test_health(self):
        response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("groq_configured", data)
        # The key itself must never appear in the response.
        self.assertNotIn("GROQ_API_KEY", str(data))

    def test_cases(self):
        response = client.get("/api/cases")
        self.assertEqual(response.status_code, 200)
        cases = response.json()
        self.assertEqual(len(cases), 4)
        for c in cases:
            self.assertNotIn("expected_ruling", c)
            self.assertIn("id", c)
            self.assertIn("title", c)
            self.assertIn("rider_complaint", c)
            self.assertIn("evidence", c)

    def test_case_not_found(self):
        response = client.post("/api/cases/99/reviews")
        self.assertEqual(response.status_code, 404)


class TestReviewLifecycle(unittest.TestCase):
    def setUp(self):
        # Reset in-memory job store between tests to avoid case-ID collisions.
        with api._jobs_lock:
            api._jobs.clear()
            api._active_case_reviews.clear()

    def test_start_and_poll_review(self):
        with patch("api.rider_advocate", return_value="Rider argument text."), \
             patch("api.driver_advocate", return_value="Driver argument text."), \
             patch("api.judge_ruling", return_value={
                 "decision": "UPHELD",
                 "confidence": "75%",
                 "explanation": "Rider wins.",
                 "escalate": False,
             }):
            start = client.post("/api/cases/3/reviews")
            self.assertEqual(start.status_code, 200)
            review_id = start.json()["review_id"]

            # Poll until complete (mocked agents are instant).
            for _ in range(10):
                poll = client.get(f"/api/reviews/{review_id}")
                self.assertEqual(poll.status_code, 200)
                body = poll.json()
                if body["status"] == "complete":
                    break
                time.sleep(0.05)
            else:
                self.fail("Review did not complete in time")

            self.assertEqual(body["case_id"], 3)
            self.assertEqual(body["status"], "complete")
            self.assertEqual(body["stage"], None)
            self.assertEqual(body["rider_case"], "Rider argument text.")
            self.assertEqual(body["driver_case"], "Driver argument text.")
            self.assertEqual(body["ruling"]["decision"], "UPHELD")
            self.assertEqual(body["error"], None)

    def test_duplicate_active_review_blocked(self):
        with patch("api.rider_advocate", return_value="Rider argument text."):
            first = client.post("/api/cases/1/reviews")
            self.assertEqual(first.status_code, 200)

            second = client.post("/api/cases/1/reviews")
            self.assertEqual(second.status_code, 409)
            self.assertIn("Active review already exists", second.json()["detail"])

    def test_review_failure_retains_partial_output(self):
        with patch("api.rider_advocate", return_value="Rider argument text."), \
             patch("api.driver_advocate", return_value="[ERROR] Driver failed."):
            start = client.post("/api/cases/2/reviews")
            review_id = start.json()["review_id"]

            for _ in range(10):
                poll = client.get(f"/api/reviews/{review_id}")
                body = poll.json()
                if body["status"] == "failed":
                    break
                time.sleep(0.05)
            else:
                self.fail("Review did not fail in time")

            self.assertEqual(body["status"], "failed")
            self.assertEqual(body["rider_case"], "Rider argument text.")
            self.assertIsNone(body["driver_case"])
            self.assertIn("Driver failed", body["error"])

    def test_review_not_found(self):
        response = client.get("/api/reviews/nonexistent-id")
        self.assertEqual(response.status_code, 404)


class TestJudgeValidation(unittest.TestCase):
    def test_valid_upheld(self):
        result = validate_judge_output({
            "decision": "UPHELD",
            "confidence": "75%",
            "explanation": "Rider wins.",
        })
        self.assertEqual(result["decision"], "UPHELD")
        self.assertEqual(result["escalate"], False)
        self.assertEqual(result["confidence"], "75%")

    def test_valid_rejected(self):
        result = validate_judge_output({
            "decision": "REJECTED",
            "confidence": "80",
            "explanation": "Driver wins.",
        })
        self.assertEqual(result["decision"], "REJECTED")
        self.assertEqual(result["escalate"], False)

    def test_escalation_below_threshold(self):
        result = validate_judge_output({
            "decision": "PARTIAL",
            "confidence": "55%",
            "explanation": "Uncertain.",
        })
        self.assertEqual(result["escalate"], True)
        self.assertIn("ESCALATION NOTICE", result["explanation"])

    def test_invalid_decision(self):
        result = validate_judge_output({
            "decision": "INVALID",
            "confidence": "75%",
            "explanation": "Bad.",
        })
        self.assertEqual(result["decision"], "[ERROR]")
        self.assertIn("Invalid decision", result["explanation"])

    def test_missing_explanation(self):
        result = validate_judge_output({
            "decision": "UPHELD",
            "confidence": "75%",
        })
        self.assertEqual(result["decision"], "[ERROR]")
        self.assertIn("explanation", result["explanation"].lower())

    def test_nan_confidence(self):
        result = validate_judge_output({
            "decision": "UPHELD",
            "confidence": "NaN%",
            "explanation": "Bad.",
        })
        self.assertEqual(result["decision"], "[ERROR]")

    def test_infinite_confidence(self):
        result = validate_judge_output({
            "decision": "UPHELD",
            "confidence": "inf",
            "explanation": "Bad.",
        })
        self.assertEqual(result["decision"], "[ERROR]")

    def test_out_of_range_confidence(self):
        result = validate_judge_output({
            "decision": "UPHELD",
            "confidence": "150%",
            "explanation": "Bad.",
        })
        self.assertEqual(result["decision"], "[ERROR]")

    def test_not_a_dict(self):
        result = validate_judge_output("not a dict")
        self.assertEqual(result["decision"], "[ERROR]")

    def test_null_fields(self):
        result = validate_judge_output({
            "decision": None,
            "confidence": "75%",
            "explanation": "Bad.",
        })
        self.assertEqual(result["decision"], "[ERROR]")


class TestNoShowDataConsistency(unittest.TestCase):
    def test_fee_is_five_dollars_everywhere(self):
        from data.sample_disputes import DISPUTES
        case = next(c for c in DISPUTES if c["id"] == 2)
        ev = case["evidence"]

        self.assertIn("$5.00", case["rider_complaint"])
        self.assertEqual(ev["trip_data"]["cancellation_fee"], 5.00)
        self.assertIn("$5.00", ev["chat_logs"][-1]["content"])
        self.assertIn("$5.00", ev["app_events"][-2]["details"])
        self.assertEqual(ev["cancellation_policy"]["cancellation_fee_after_wait"], 5.00)

    def test_free_wait_is_five_minutes(self):
        from data.sample_disputes import DISPUTES
        case = next(c for c in DISPUTES if c["id"] == 2)
        ev = case["evidence"]

        self.assertEqual(ev["cancellation_policy"]["free_wait_time_min"], 5)
        self.assertIn("5 min", ev["app_events"][5]["details"])
        self.assertIn("5-min", ev["app_events"][7]["details"])

    def test_expected_ruling_is_rejected(self):
        from data.sample_disputes import DISPUTES
        case = next(c for c in DISPUTES if c["id"] == 2)
        self.assertEqual(case["expected_ruling"], "REJECTED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
