import importlib.util
import json
import pathlib
import tempfile
import threading
import urllib.parse
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[3]
MODULE = ROOT / "tools" / "evaluate_research_nli.py"
spec = importlib.util.spec_from_file_location("kurisu_nli_eval_test", MODULE)
evaluator = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(evaluator)


class EvalHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def do_POST(self):
        if self.path != "/v1/nli/batch":
            self.send_error(404)
            return
        payload = json.loads(self.rfile.read(int(self.headers.get("content-length", "0"))))
        outcomes = [
            {"entailment": 0.94, "contradiction": 0.02, "neutral": 0.04},
            {"entailment": 0.03, "contradiction": 0.93, "neutral": 0.04},
            {"entailment": 0.08, "contradiction": 0.08, "neutral": 0.84},
        ]
        response = {"modelId": "test-evaluator-model", "modelRevision": "test-revision", "results": [
            {"modelId": "test-evaluator-model", "scores": outcomes[index % len(outcomes)], "calibrated": False}
            for index, _pair in enumerate(payload["pairs"])
        ]}
        raw = json.dumps(response).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


class NliEvaluatorTests(unittest.TestCase):
    def test_endpoint_requires_explicit_privacy_consent_for_remote(self):
        self.assertEqual(evaluator.batch_endpoint("http://127.0.0.1:8798/v1/nli"), "http://127.0.0.1:8798/v1/nli/batch")
        self.assertEqual(evaluator.batch_endpoint("https://nli.example/v1/nli", allow_remote=True), "https://nli.example/v1/nli/batch")
        with self.assertRaisesRegex(ValueError, "allow-remote"):
            evaluator.batch_endpoint("https://nli.example/v1/nli")
        with self.assertRaisesRegex(ValueError, "loopback"):
            evaluator.batch_endpoint("http://nli.example/v1/nli", allow_remote=True)

    def test_metrics_report_confusion_f1_and_calibration_without_claiming_truth(self):
        rows = [{"label": label} for label in evaluator.LABELS]
        predictions = [
            {"entailment": .94, "contradiction": .02, "neutral": .04},
            {"entailment": .03, "contradiction": .93, "neutral": .04},
            {"entailment": .08, "contradiction": .08, "neutral": .84},
        ]
        report = evaluator.evaluate_metrics(rows, predictions, bins=10)
        self.assertEqual(report["accuracy"], 1.0)
        self.assertEqual(report["macroF1"], 1.0)
        self.assertEqual(report["classBalance"]["minimumClassSupport"], 1)
        self.assertEqual(report["confusionMatrix"]["neutral"]["neutral"], 1)
        self.assertGreaterEqual(report["topLabelExpectedCalibrationError"], 0)
        self.assertLessEqual(report["topLabelExpectedCalibrationError"], 1)

    def test_jsonl_loader_rejects_missing_classes_and_duplicate_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            data = pathlib.Path(directory) / "one.jsonl"
            data.write_text(json.dumps({"id": "a", "premise": "A premise long enough.", "hypothesis": "A hypothesis long enough.", "label": "neutral"}) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "missing"):
                evaluator.load_dataset(data)
            rows = [
                {"id": "same", "premise": "The cat is an animal.", "hypothesis": "The cat is an animal.", "label": "entailment"},
                {"id": "same", "premise": "The cat is not an animal.", "hypothesis": "The cat is an animal.", "label": "contradiction"},
                {"id": "other", "premise": "There is a cat in the garden.", "hypothesis": "The cat is brown.", "label": "neutral"},
            ]
            data.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "duplicate id"):
                evaluator.load_dataset(data)

    def test_cli_runs_against_loopback_batch_service_and_excludes_text_from_report(self):
        from subprocess import run
        import sys

        server = ThreadingHTTPServer(("127.0.0.1", 0), EvalHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                root = pathlib.Path(directory)
                data = root / "holdout.jsonl"
                rows = [
                    {"id": "e1", "premise": "The cat is an animal.", "hypothesis": "The cat is an animal.", "label": "entailment"},
                    {"id": "c1", "premise": "The cat is not an animal.", "hypothesis": "The cat is an animal.", "label": "contradiction"},
                    {"id": "n1", "premise": "There is a cat in the garden.", "hypothesis": "The cat is brown.", "label": "neutral"},
                ]
                data.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
                output = root / "result.json"
                endpoint = f"http://127.0.0.1:{server.server_address[1]}/v1/nli"
                completed = run([sys.executable, str(MODULE), str(data), "--endpoint", endpoint, "--output", str(output)], capture_output=True, text=True, timeout=10)
                self.assertEqual(completed.returncode, 0, completed.stderr)
                report = json.loads(output.read_text(encoding="utf-8"))
                self.assertEqual(report["service"]["modelId"], "test-evaluator-model")
                self.assertEqual(report["metrics"]["accuracy"], 1.0)
                self.assertFalse(report["dataset"]["textIncludedInReport"])
                self.assertNotIn("The cat is an animal.", output.read_text(encoding="utf-8"))
                self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
