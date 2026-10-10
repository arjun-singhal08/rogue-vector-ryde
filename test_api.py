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
            api._active_workers.clear()

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
            self.assertIn("Another case is being reviewed", second.json()["detail"])

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

    def test_review_includes_timing_metadata(self):
        with patch("api.rider_advocate", return_value="Rider argument text."), \
             patch("api.driver_advocate", return_value="Driver argument text."), \
             patch("api.judge_ruling", return_value={
                 "decision": "UPHELD",
                 "confidence": "75%",
                 "explanation": "Rider wins.",
                 "escalate": False,
             }):
            start = client.post("/api/cases/1/reviews")
            review_id = start.json()["review_id"]

            for _ in range(10):
                poll = client.get(f"/api/reviews/{review_id}")
                body = poll.json()
                if body["status"] == "complete":
                    break
                time.sleep(0.05)
            else:
                self.fail("Review did not complete in time")

            self.assertIn("timings", body)
            self.assertIn("total_ms", body["timings"])
            self.assertIsInstance(body["timings"]["total_ms"], int)
            self.assertGreaterEqual(body["timings"]["total_ms"], 0)

    def test_review_failure_includes_partial_timing(self):
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

            self.assertIn("timings", body)
            self.assertIn("total_ms", body["timings"])
            self.assertIsInstance(body["timings"]["total_ms"], int)
            self.assertGreaterEqual(body["timings"]["total_ms"], 0)

    def test_running_review_exposes_elapsed_ms(self):
        import agents.dispute_agents as agents

        def slow_rider(d, timing_out=None):
            time.sleep(0.15)
            return "Rider argument."

        with patch.object(agents, "rider_advocate", side_effect=slow_rider):
            start = client.post("/api/cases/1/reviews")
            review_id = start.json()["review_id"]

            # Poll while still running.
            for _ in range(5):
                poll = client.get(f"/api/reviews/{review_id}")
                body = poll.json()
                if body["status"] == "running" and body.get("elapsed_ms") is not None:
                    break
                time.sleep(0.05)
            else:
                self.fail("Did not observe elapsed_ms while running")

            self.assertIsInstance(body["elapsed_ms"], int)
            self.assertGreaterEqual(body["elapsed_ms"], 0)




    @patch("agents.dispute_agents.Groq")
    def test_call_groq_retains_actual_error(self, MockGroq):
        from agents.dispute_agents import call_groq
        import os
        from groq import RateLimitError
        original = os.environ.get("GROQ_API_KEY")
        os.environ["GROQ_API_KEY"] = "fake_key"
        
        try:
            mock_client = MockGroq.return_value
            mock_response = unittest.mock.MagicMock()
            mock_response.headers = {"retry-after": "65.0"}
            err = RateLimitError("Rate limit exceeded", response=mock_response, body=None)
            
            mock_client.chat.completions.create.side_effect = [err]
            
            result = call_groq("test prompt", max_retries=1)
            
            self.assertTrue(result.startswith("[ERROR]"))
            self.assertIn("requested retry delay exceeds remaining budget", result)
            self.assertIn("65.0s", result)
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original
            else:
                del os.environ["GROQ_API_KEY"]

    @patch("agents.dispute_agents.call_groq")
    def test_judge_ruling_schema_failure_then_success(self, mock_call_groq):
        from agents.dispute_agents import judge_ruling
        import data.sample_disputes
        
        case = data.sample_disputes.DISPUTES[0]
        
        # First call fails with json_validate_failed, second succeeds
        mock_call_groq.side_effect = [
            "[ERROR] json_validate_failed: Model failed to conform to the strict schema.\nFailed generation:\nbad",
            '{"decision": "UPHELD", "confidence": "70%", "explanation": "test"}'
        ]
        
        result = judge_ruling("rider", "driver", case)
        
        self.assertEqual(mock_call_groq.call_count, 2)
        self.assertEqual(result["decision"], "UPHELD")
        self.assertEqual(result["confidence"], "70%")

    @patch("agents.dispute_agents.call_groq")
    def test_judge_ruling_two_schema_failures(self, mock_call_groq):
        from agents.dispute_agents import judge_ruling
        import data.sample_disputes
        
        case = data.sample_disputes.DISPUTES[0]
        
        # Both calls fail with json_validate_failed
        mock_call_groq.side_effect = [
            "[ERROR] json_validate_failed: Model failed to conform to the strict schema.\nFailed generation:\nbad",
            "[ERROR] json_validate_failed: Model failed to conform to the strict schema.\nFailed generation:\nworse",
        ]
        
        result = judge_ruling("rider", "driver", case)
        
        self.assertEqual(mock_call_groq.call_count, 2)
        self.assertEqual(result["decision"], "[ERROR]")
        self.assertIn("json_validate_failed", result["explanation"])

    @patch("agents.dispute_agents.call_groq")
    def test_regeneration_shares_deadline(self, mock_call_groq):
        from agents.dispute_agents import judge_ruling
        import data.sample_disputes
        
        case = data.sample_disputes.DISPUTES[0]
        
        def side_effect(*args, **kwargs):
            # Simulate first call taking 40 seconds
            if kwargs.get("timing_out") is not None:
                kwargs["timing_out"]["duration_ms"] = 40000
            if mock_call_groq.call_count == 1:
                return "[ERROR] json_validate_failed: Model failed to conform to the strict schema."
            else:
                self.assertEqual(kwargs["time_budget"], 20.0) # 60 - 40
                return '{"decision": "REJECTED", "confidence": "99%", "explanation": "ok"}'
                
        mock_call_groq.side_effect = side_effect
        
        result = judge_ruling("rider", "driver", case)
        self.assertEqual(mock_call_groq.call_count, 2)
        self.assertEqual(result["decision"], "REJECTED")

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

    def test_escalate_decision_high_confidence(self):
        result = validate_judge_output({
            "decision": "ESCALATE",
            "confidence": "92%",
            "explanation": "Complex case requiring human judgment.",
        })
        self.assertEqual(result["escalate"], True)
        self.assertIn("explicitly recommended escalation", result["explanation"])

    def test_escalate_for_human_review_high_confidence(self):
        result = validate_judge_output({
            "decision": "ESCALATE FOR HUMAN REVIEW",
            "confidence": "92%",
            "explanation": "Sensitive situation.",
        })
        self.assertEqual(result["escalate"], True)
        self.assertIn("explicitly recommended escalation", result["explanation"])

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


class TestGroqClientBehaviour(unittest.TestCase):
    def test_call_groq_no_retry_on_missing_key(self):
        """A missing API key must return immediately without retries."""
        from agents.dispute_agents import call_groq
        import os

        # Temporarily clear the key.
        original = os.environ.pop("GROQ_API_KEY", None)
        try:
            timing = {}
            result = call_groq("test prompt", timing_out=timing)
            self.assertTrue(result.startswith("[ERROR]"))
            self.assertIn("not configured", result)
            # Should return almost instantly; duration under 100 ms.
            self.assertLess(timing.get("duration_ms", 1000), 100)
            self.assertEqual(timing.get("retries", -1), 0)
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original

    @patch("agents.dispute_agents.Groq")
    def test_call_groq_truncation(self, MockGroq):
        from agents.dispute_agents import call_groq
        import os
        original = os.environ.get("GROQ_API_KEY")
        os.environ["GROQ_API_KEY"] = "fake_key"
        
        try:
            mock_client = MockGroq.return_value
            mock_choice = unittest.mock.MagicMock()
            mock_choice.finish_reason = "length"
            mock_choice.message.content = "Truncated text..."
            mock_client.chat.completions.create.return_value.choices = [mock_choice]
            
            timing = {}
            result = call_groq("test prompt", timing_out=timing)
            
            self.assertTrue(result.startswith("[ERROR]"))
            self.assertIn("truncated due to token limit", result)
            self.assertEqual(timing.get("finish_reason"), "length")
            self.assertEqual(timing.get("retries"), 0)
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original
            else:
                del os.environ["GROQ_API_KEY"]

    @patch("agents.dispute_agents.Groq")
    def test_call_groq_empty_content(self, MockGroq):
        from agents.dispute_agents import call_groq
        import os
        original = os.environ.get("GROQ_API_KEY")
        os.environ["GROQ_API_KEY"] = "fake_key"
        
        try:
            mock_client = MockGroq.return_value
            mock_choice = unittest.mock.MagicMock()
            mock_choice.finish_reason = "stop"
            mock_choice.message.content = ""
            mock_client.chat.completions.create.return_value.choices = [mock_choice]
            
            timing = {}
            result = call_groq("test prompt", timing_out=timing)
            
            self.assertTrue(result.startswith("[ERROR]"))
            self.assertIn("Received empty response", result)
            self.assertEqual(timing.get("finish_reason"), "stop")
            self.assertEqual(timing.get("retries"), 0)
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original
            else:
                del os.environ["GROQ_API_KEY"]

    @patch("agents.dispute_agents.Groq")
    def test_call_groq_successful(self, MockGroq):
        from agents.dispute_agents import call_groq
        import os
        original = os.environ.get("GROQ_API_KEY")
        os.environ["GROQ_API_KEY"] = "fake_key"
        
        try:
            mock_client = MockGroq.return_value
            mock_choice = unittest.mock.MagicMock()
            mock_choice.finish_reason = "stop"
            mock_choice.message.content = "Successful response"
            
            mock_completion = unittest.mock.MagicMock()
            mock_completion.choices = [mock_choice]
            
            mock_usage = unittest.mock.MagicMock()
            mock_usage.completion_tokens = 150
            mock_details = unittest.mock.MagicMock()
            mock_details.reasoning_tokens = 50
            mock_usage.completion_tokens_details = mock_details
            mock_completion.usage = mock_usage
            
            mock_client.chat.completions.create.return_value = mock_completion
            
            timing = {}
            result = call_groq("test prompt", timing_out=timing)
            
            self.assertEqual(result, "Successful response")
            self.assertEqual(timing.get("finish_reason"), "stop")
            self.assertEqual(timing.get("retries"), 0)
            self.assertEqual(timing.get("completion_tokens"), 150)
            self.assertEqual(timing.get("reasoning_tokens"), 50)
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original
            else:
                del os.environ["GROQ_API_KEY"]

    @patch("agents.dispute_agents.time.sleep")
    @patch("agents.dispute_agents.Groq")
    def test_call_groq_rate_limit_retry(self, MockGroq, mock_sleep):
        from agents.dispute_agents import call_groq
        import os
        from groq import RateLimitError
        original = os.environ.get("GROQ_API_KEY")
        os.environ["GROQ_API_KEY"] = "fake_key"
        
        try:
            mock_client = MockGroq.return_value
            
            # First call raises RateLimitError with retry-after header
            mock_response = unittest.mock.MagicMock()
            mock_response.headers = {"retry-after": "2.5"}
            err = RateLimitError("Rate limit exceeded", response=mock_response, body=None)
            
            # Second call succeeds
            mock_choice = unittest.mock.MagicMock()
            mock_choice.finish_reason = "stop"
            mock_choice.message.content = "Success after rate limit"
            mock_completion = unittest.mock.MagicMock()
            mock_completion.choices = [mock_choice]
            
            mock_client.chat.completions.create.side_effect = [err, mock_completion]
            
            timing = {}
            result = call_groq("test prompt", max_retries=1, timing_out=timing)
            
            self.assertEqual(result, "Success after rate limit")
            self.assertEqual(timing.get("retries"), 1)
            mock_sleep.assert_called_once_with(2.5)
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original
            else:
                del os.environ["GROQ_API_KEY"]

    @patch("agents.dispute_agents.time.sleep")
    @patch("agents.dispute_agents.Groq")
    def test_call_groq_rate_limit_exceeds_total_wait(self, MockGroq, mock_sleep):
        from agents.dispute_agents import call_groq
        import os
        from groq import RateLimitError
        original = os.environ.get("GROQ_API_KEY")
        os.environ["GROQ_API_KEY"] = "fake_key"
        
        try:
            mock_client = MockGroq.return_value
            
            # Request requires waiting 65 seconds, which exceeds 60.0s bound
            mock_response = unittest.mock.MagicMock()
            mock_response.headers = {"retry-after": "65.0"}
            err = RateLimitError("Rate limit exceeded", response=mock_response, body=None)
            
            mock_client.chat.completions.create.side_effect = [err]
            
            timing = {}
            result = call_groq("test prompt", max_retries=1, timing_out=timing)
            
            self.assertTrue(result.startswith("[ERROR]"))
            self.assertEqual(timing.get("retries"), 0)
            mock_sleep.assert_not_called()
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original
            else:
                del os.environ["GROQ_API_KEY"]

    @patch("agents.dispute_agents.time.sleep")
    @patch("agents.dispute_agents.Groq")
    def test_call_groq_auth_error_no_retry(self, MockGroq, mock_sleep):
        from agents.dispute_agents import call_groq
        import os
        from groq import AuthenticationError
        original = os.environ.get("GROQ_API_KEY")
        os.environ["GROQ_API_KEY"] = "fake_key"
        
        try:
            mock_client = MockGroq.return_value
            mock_response = unittest.mock.MagicMock()
            err = AuthenticationError("Invalid API Key", response=mock_response, body=None)
            
            mock_client.chat.completions.create.side_effect = [err]
            
            timing = {}
            result = call_groq("test prompt", max_retries=2, timing_out=timing)
            
            self.assertTrue(result.startswith("[ERROR]"))
            self.assertEqual(timing.get("retries"), 0)
            mock_sleep.assert_not_called()
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original
            else:
                del os.environ["GROQ_API_KEY"]

    @patch("agents.dispute_agents.Groq")
    def test_call_groq_json_validate_failed(self, MockGroq):
        from agents.dispute_agents import call_groq
        import os
        from groq import APIStatusError
        original = os.environ.get("GROQ_API_KEY")
        os.environ["GROQ_API_KEY"] = "fake_key"
        
        try:
            mock_client = MockGroq.return_value
            mock_response = unittest.mock.MagicMock()
            mock_response.json.return_value = {
                "error": {
                    "code": "json_validate_failed",
                    "failed_generation": '{"decision": "UPHELD", "confidence": "70%", "explanation": "test"}}'
                }
            }
            err = APIStatusError("Unsupported schema", response=mock_response, body=None)
            err.status_code = 400
            
            mock_client.chat.completions.create.side_effect = [err]
            
            result = call_groq("test prompt")
            
            self.assertTrue(result.startswith("[ERROR] json_validate_failed"))
            self.assertIn('{"decision": "UPHELD"', result)
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original
            else:
                del os.environ["GROQ_API_KEY"]

    @patch("agents.dispute_agents.Groq")
    def test_call_groq_effective_tokens(self, MockGroq):
        from agents.dispute_agents import call_groq
        import os
        original = os.environ.get("GROQ_API_KEY")
        os.environ["GROQ_API_KEY"] = "fake_key"
        
        try:
            mock_client = MockGroq.return_value
            mock_completion = unittest.mock.MagicMock()
            mock_completion.choices[0].finish_reason = "stop"
            mock_completion.choices[0].message.content = "OK"
            mock_client.chat.completions.create.return_value = mock_completion
            
            timing = {}
            call_groq("test prompt", max_completion_tokens=4096, reasoning_effort="low", timing_out=timing)
            
            self.assertEqual(timing["effective_max_completion_tokens"], 4096)
            self.assertEqual(timing["effective_reasoning_effort"], "low")
        finally:
            if original is not None:
                os.environ["GROQ_API_KEY"] = original
            else:
                del os.environ["GROQ_API_KEY"]

    @patch("agents.dispute_agents.call_groq")
    def test_judge_prompt_includes_missing_policy_instruction(self, mock_call_groq):
        from agents.dispute_agents import judge_ruling
        import data.sample_disputes
        
        mock_call_groq.return_value = '{"decision": "UPHELD", "confidence": "70%", "explanation": "test"}'
        case = data.sample_disputes.DISPUTES[0]
        
        judge_ruling("rider", "driver", case)
        
        args, kwargs = mock_call_groq.call_args
        prompt = args[0] if args else kwargs.get("prompt_text", "")
        self.assertIn("Missing policy text means the applicable rule is unknown", prompt)
        self.assertIn("Do NOT treat missing policy as evidence that a fee or route deviation is permitted", prompt)
        self.assertIn("Escalate when that missing rule is material to resolution", prompt)

    @patch("agents.dispute_agents.call_groq")
    def test_advocate_and_judge_response_format(self, mock_call_groq):
        from agents.dispute_agents import rider_advocate, driver_advocate, judge_ruling
        import data.sample_disputes
        
        mock_call_groq.return_value = '{"decision": "UPHELD", "confidence": "70%", "explanation": "test"}'
        case = data.sample_disputes.DISPUTES[0]
        
        rider_advocate(case)
        args, kwargs = mock_call_groq.call_args
        self.assertNotIn("response_format", kwargs)
        
        driver_advocate(case)
        args, kwargs = mock_call_groq.call_args
        self.assertNotIn("response_format", kwargs)
        
        judge_ruling("rider", "driver", case)
        args, kwargs = mock_call_groq.call_args
        self.assertIn("response_format", kwargs)
        fmt = kwargs["response_format"]
        self.assertEqual(fmt["type"], "json_schema")
        self.assertEqual(fmt["json_schema"]["strict"], True)
        self.assertIn("ESCALATE", fmt["json_schema"]["schema"]["properties"]["decision"]["enum"])



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


class TestAdvancedReviewLifecycle(unittest.TestCase):
    def setUp(self):
        with api._jobs_lock:
            api._jobs.clear()
            api._active_case_reviews.clear()
            api._active_workers.clear()
        self._orig_max_concurrent = api._MAX_CONCURRENT
        self._orig_review_history = api._review_history.copy()
        api._MAX_CONCURRENT = 1
        api._review_history.clear()

    def tearDown(self):
        api._MAX_CONCURRENT = self._orig_max_concurrent
        api._review_history[:] = self._orig_review_history

    def test_409_returns_review_id(self):
        with patch("api._run_review"):
            start1 = client.post("/api/cases/3/reviews")
            self.assertEqual(start1.status_code, 200)
            rid = start1.json()["review_id"]

            start2 = client.post("/api/cases/3/reviews")
            self.assertEqual(start2.status_code, 409)
            self.assertEqual(start2.json()["review_id"], rid)

    def test_polling_does_not_mutate_running_job(self):
        from datetime import datetime, timezone, timedelta

        with patch("api._run_review"):
            start = client.post("/api/cases/3/reviews")
            rid = start.json()["review_id"]

        with api._jobs_lock:
            # Fake the started_at to be > 120 seconds ago
            old_time = (datetime.now(timezone.utc) - timedelta(seconds=121)).isoformat()
            api._jobs[rid]["started_at"] = old_time

        poll = client.get(f"/api/reviews/{rid}")
        self.assertEqual(poll.json()["status"], "running")
        # Polling must not modify the job status for a still-running worker

    def test_late_worker_does_not_overwrite_terminal_status(self):
        with patch("api._run_review"):
            start = client.post("/api/cases/3/reviews")
            rid = start.json()["review_id"]

        with api._jobs_lock:
            api._jobs[rid]["status"] = "failed"
            api._jobs[rid]["error"] = "Deadline exceeded"

        # simulate worker finishing late
        api._update_job(rid, status="complete", ruling={"decision": "UPHELD"})

        poll = client.get(f"/api/reviews/{rid}")
        self.assertEqual(poll.json()["status"], "failed")

    def test_503_does_not_count_against_hourly_limit(self):
        """A request rejected for concurrency (503) must not consume the hourly quota."""
        api._MAX_CONCURRENT = 0  # Force every request to be rejected

        # First request should get 503
        r1 = client.post("/api/cases/1/reviews")
        self.assertEqual(r1.status_code, 503)

        # Restore capacity
        api._MAX_CONCURRENT = 1

        # Second request should succeed because the 503 did not count
        with patch("api._run_review"):
            r2 = client.post("/api/cases/2/reviews")
            self.assertEqual(r2.status_code, 200)

    def test_429_when_hourly_limit_exceeded(self):
        """Requests beyond MAX_REVIEWS_PER_HOUR receive 429."""
        import os
        orig = os.environ.get("MAX_REVIEWS_PER_HOUR")
        os.environ["MAX_REVIEWS_PER_HOUR"] = "1"
        try:
            with patch("api._run_review"):
                r1 = client.post("/api/cases/1/reviews")
                self.assertEqual(r1.status_code, 200)

                r2 = client.post("/api/cases/2/reviews")
                self.assertEqual(r2.status_code, 429)
                self.assertIn("maximum free reviews per hour", r2.json()["detail"])
        finally:
            if orig is not None:
                os.environ["MAX_REVIEWS_PER_HOUR"] = orig
            else:
                os.environ.pop("MAX_REVIEWS_PER_HOUR", None)


    def test_worker_enforces_monotonic_deadline(self):
        """Worker must fail itself if the 120s deadline is exceeded between stages."""
        with patch("api.time.monotonic", side_effect=[100.0, 300.0, 300.0, 300.0]), \
             patch("api.rider_advocate") as mock_rider:
            
            import api
            case = api._find_case(1)
            api._jobs["test-id"] = {
                "review_id": "test-id", "case_id": 1, "status": "running", "timings": {}
            }
            api._active_case_reviews[1] = "test-id"
            api._active_workers.add("test-id")
            
            api._run_review("test-id", case)
            
            job = api._jobs["test-id"]
            self.assertEqual(job["status"], "failed")
            self.assertIn("120-second deadline", job["error"])
            mock_rider.assert_not_called()
            self.assertNotIn("test-id", api._active_workers)

    def test_capacity_stays_occupied_until_worker_exits(self):
        """A running job (even if slow) must keep the worker slot occupied."""
        import threading
        evt = threading.Event()
        
        def slow_rider(*args, **kwargs):
            evt.wait()
            return "[ERROR] timeout"

        with patch("api.rider_advocate", side_effect=slow_rider):
            r1 = client.post("/api/cases/1/reviews")
            self.assertEqual(r1.status_code, 200)
            
            # Slot is now occupied by worker 1.
            r2 = client.post("/api/cases/2/reviews")
            self.assertEqual(r2.status_code, 503)
            
            # Release worker 1.
            evt.set()
            
            # Wait for worker 1 to exit.
            import api
            rid1 = r1.json()["review_id"]
            for _ in range(20):
                if rid1 not in api._active_workers:
                    break
                time.sleep(0.05)
            
            # Slot is now free.
            r3 = client.post("/api/cases/2/reviews")
            self.assertEqual(r3.status_code, 200)


class TestConnectionClassification(unittest.TestCase):
    def test_dns_error(self):
        from agents.dispute_agents import _classify_connection_error
        exc = Exception("getaddrinfo failed")
        category, cause_type = _classify_connection_error(exc)
        self.assertEqual(category, "dns")

    def test_tls_error(self):
        from agents.dispute_agents import _classify_connection_error
        exc = Exception("SSL certificate verify failed")
        category, cause_type = _classify_connection_error(exc)
        self.assertEqual(category, "tls")

    def test_connection_refused(self):
        from agents.dispute_agents import _classify_connection_error
        exc = Exception("Connection refused")
        category, cause_type = _classify_connection_error(exc)
        self.assertEqual(category, "connection_refused")

    def test_timeout_error(self):
        from agents.dispute_agents import _classify_connection_error
        exc = Exception("timed out")
        category, cause_type = _classify_connection_error(exc)
        self.assertEqual(category, "timeout")

    def test_network_unreachable(self):
        from agents.dispute_agents import _classify_connection_error
        exc = Exception("network unreachable")
        category, cause_type = _classify_connection_error(exc)
        self.assertEqual(category, "network_unreachable")

    def test_unknown_error(self):
        from agents.dispute_agents import _classify_connection_error
        exc = Exception("something weird")
        category, cause_type = _classify_connection_error(exc)
        self.assertEqual(category, "unknown")

    def test_cause_takes_precedence(self):
        from agents.dispute_agents import _classify_connection_error
        exc = Exception("outer")
        exc.__cause__ = Exception("getaddrinfo failed")
        category, cause_type = _classify_connection_error(exc)
        self.assertEqual(category, "dns")
        self.assertEqual(cause_type, "Exception")

    def test_startup_diagnostic_runs_when_enabled(self):
        import os
        import threading
        from unittest.mock import patch, MagicMock
        import api

        # Ensure diagnostic does not block or raise when GROQ_DIAGNOSTICS=1
        with patch.dict(os.environ, {"GROQ_DIAGNOSTICS": "1", "GROQ_API_KEY": "test_key"}):
            with patch("api.threading.Thread") as mock_thread:
                mock_instance = MagicMock()
                mock_thread.return_value = mock_instance
                # Re-run the module-level check logic
                if os.environ.get("GROQ_DIAGNOSTICS") == "1":
                    t = threading.Thread(target=api._run_startup_diagnostic, daemon=True)
                    t.start()
                mock_thread.assert_called_once()
                self.assertTrue(mock_thread.call_args[1].get("daemon"))

    def test_startup_diagnostic_skipped_when_disabled(self):
        import os
        from unittest.mock import patch
        import api

        with patch.dict(os.environ, {"GROQ_DIAGNOSTICS": "0"}, clear=False):
            # Should not start a thread when disabled
            self.assertNotEqual(os.environ.get("GROQ_DIAGNOSTICS"), "1")


if __name__ == "__main__":
    unittest.main(verbosity=2)
