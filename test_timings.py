import json
import os
import tempfile
import unittest
import uuid
from fastapi.testclient import TestClient

from api import app, _jobs, _active_case_reviews, _release_case

client = TestClient(app)

class TestTimingsCapture(unittest.TestCase):
    def test_timings_capture(self):
        with tempfile.TemporaryDirectory() as tmp_path:
            original_cwd = os.getcwd()
            os.chdir(tmp_path)
            
            try:
                # Mock case and job
                review_id = str(uuid.uuid4())
                case_id = 1
                _jobs[review_id] = {
                    "review_id": review_id,
                    "case_id": case_id,
                    "status": "running",
                    "timings": {
                        "rider_duration_ms": 100,
                        "judge_regeneration_count": 1
                    }
                }
                _active_case_reviews[case_id] = review_id
                
                # Trigger release_case via failed deadline or explicit call
                _jobs[review_id]["status"] = "failed"
                _release_case(case_id, review_id)
                
                # Verify the log file is created and contains correct data
                log_file = os.path.join(tmp_path, "review_logs.jsonl")
                self.assertTrue(os.path.exists(log_file))
                
                with open(log_file, "r") as f:
                    data = json.loads(f.read().strip())
                    
                self.assertEqual(data["review_id"], review_id)
                self.assertEqual(data["case_id"], case_id)
                self.assertEqual(data["status"], "failed")
                self.assertEqual(data["timings"]["rider_duration_ms"], 100)
                self.assertEqual(data["timings"]["judge_regeneration_count"], 1)
            finally:
                os.chdir(original_cwd)

if __name__ == "__main__":
    unittest.main(verbosity=2)
