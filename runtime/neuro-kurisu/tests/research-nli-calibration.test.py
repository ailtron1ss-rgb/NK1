import importlib.util
import json
import pathlib
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[3]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))
FIT_SCRIPT = TOOLS / "fit_research_nli_calibration.py"
spec = importlib.util.spec_from_file_location("kurisu_nli_calibration", FIT_SCRIPT)
fit = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(fit)

MODEL_ID = "test-calibrated-model"
MODEL_REVISION = "a" * 40


class CalibrationServiceHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def do_POST(self):
        if self.path != "/v1/nli/batch":
            self.send_error(404)
            return
        request = json.loads(self.rfile.read(int(self.headers.get("content-length", "0"))))
        results = []
        for pair in request["pairs"]:
            label = pair["hypothesis"].split("actual:", 1)[1].strip()
            scores = {"entailment": .11, "contradiction": .11, "neutral": .11}
            scores[label] = .78
            results.append({"modelId": MODEL_ID, "modelRevision": MODEL_REVISION, "scores": scores, "calibrated": False, "calibration": None})
        body = json.dumps({"modelId": MODEL_ID, "modelRevision": MODEL_REVISION, "results": results, "calibrated": False, "calibration": None}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class NliCalibrationTests(unittest.TestCase):
    def test_temperature_fit_reduces_nll_on_overconfident_fixture(self):
        rows = []
        predictions = []
        for index in range(90):
            label = fit.LABELS[index % 3]
            rows.append({"label": label})
            predictions.append({label: .78, **{other: .11 for other in fit.LABELS if other != label}})
        temperature = fit.fit_temperature(rows, predictions)
        before = fit.mean_nll(rows, predictions, 1.0)
        after = fit.mean_nll(rows, predictions, temperature)
        self.assertLess(temperature, 1.0)
        self.assertLess(after, before)

    def test_temperature_bounds_and_input_validation(self):
        with self.assertRaisesRegex(ValueError, "permitted range"):
            fit.softmax_temperature({label: 1 / 3 for label in fit.LABELS}, 100)
        with self.assertRaisesRegex(ValueError, "equal non-zero length"):
            fit.mean_nll([], [], 1)

    def test_group_split_never_crosses_related_examples_and_is_stratified(self):
        rows = []
        predictions = []
        for label in fit.LABELS:
            for group_index in range(25):
                for variant in range(2):
                    rows.append({"id": f"{label}-{group_index}-{variant}", "groupId": f"publisher-group-{group_index}", "label": label})
                    predictions.append({label: .78, **{other: .11 for other in fit.LABELS if other != label}})
        train_rows, _, validation_rows, _, train_counts, validation_counts, group_count = fit.split_calibration_rows(rows, predictions)
        train_groups = {row["groupId"] for row in train_rows}
        validation_groups = {row["groupId"] for row in validation_rows}
        self.assertFalse(train_groups & validation_groups)
        self.assertGreaterEqual(group_count, 1)
        self.assertTrue(all(train_counts[label] >= 20 and validation_counts[label] >= 10 for label in fit.LABELS))

    def test_calibration_cli_writes_private_model_bound_artifact_without_text(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), CalibrationServiceHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                root = pathlib.Path(temp_dir)
                dataset = root / "calibration.jsonl"
                rows = []
                for label in fit.LABELS:
                    for index in range(50):
                        rows.append({"id": f"{label}-{index}", "groupId": f"{label}-source-{index // 2}", "premise": f"A labelled premise example number {index} with sufficient detail.", "hypothesis": f"A labelled hypothesis actual: {label}", "label": label})
                dataset.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
                output = root / "calibration.json"
                endpoint = f"http://127.0.0.1:{server.server_address[1]}/v1/nli"
                completed = subprocess.run([sys.executable, str(FIT_SCRIPT), str(dataset), "--endpoint", endpoint, "--dataset-source", "internal calibration fixture v1", "--labeling-protocol", "controlled fixture labels", "--output", str(output)], capture_output=True, text=True, timeout=20)
                self.assertEqual(completed.returncode, 0, completed.stderr)
                artifact = json.loads(output.read_text(encoding="utf-8"))
                self.assertEqual(artifact["modelId"], MODEL_ID)
                self.assertEqual(artifact["modelRevision"], MODEL_REVISION)
                self.assertEqual(artifact["dataset"]["count"], 150)
                self.assertEqual(artifact["dataset"]["classCounts"], {"entailment": 50, "contradiction": 50, "neutral": 50})
                self.assertEqual(artifact["fit"]["validationSplitMethod"], "deterministic-greedy-stratified-group-20pct-v1")
                self.assertEqual(artifact["fit"]["validationClassCounts"], {"entailment": 10, "contradiction": 10, "neutral": 10})
                self.assertEqual(artifact["fit"]["validationGroupCount"], 15)
                self.assertEqual(artifact["fit"]["trainingClassCounts"], {"entailment": 40, "contradiction": 40, "neutral": 40})
                self.assertTrue(artifact["fit"]["eligibleForReview"])
                self.assertFalse(artifact["dataset"]["textIncludedInArtifact"])
                self.assertFalse(artifact["fit"]["promoted"])
                self.assertNotIn("labelled premise example", output.read_text(encoding="utf-8"))
                self.assertEqual(output.stat().st_mode & 0o777, 0o600)
                second = subprocess.run([sys.executable, str(FIT_SCRIPT), str(dataset), "--endpoint", endpoint, "--dataset-source", "internal calibration fixture v1", "--labeling-protocol", "controlled fixture labels", "--output", str(output)], capture_output=True, text=True, timeout=20)
                self.assertNotEqual(second.returncode, 0, "existing artifacts must not be silently overwritten")
                self.assertIn("output already exists", second.stderr)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_calibration_rejects_model_revision_mismatch(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = pathlib.Path(temp_dir) / "calibration.json"
            artifact = {
                "schemaVersion": 1,
                "kind": "local-nli-temperature-calibration",
                "method": "temperature-scaling-from-softmax-v1",
                "modelId": MODEL_ID,
                "modelRevision": MODEL_REVISION,
                "labels": ["entailment", "contradiction", "neutral"],
                "temperature": 1.8,
                "dataset": {"sha256": "b" * 64, "sourceReference": "internal calibration fixture v1", "labelingProtocol": "three label classes assigned by controlled deterministic fixture", "count": 150, "classCounts": {"entailment": 50, "contradiction": 50, "neutral": 50}},
                "fit": {
                    "promoted": False, "eligibleForReview": True,
                    "validationSplitMethod": "deterministic-greedy-stratified-group-20pct-v1",
                    "trainingCount": 120, "trainingClassCounts": {"entailment": 40, "contradiction": 40, "neutral": 40},
                    "validationCount": 30, "validationClassCounts": {"entailment": 10, "contradiction": 10, "neutral": 10},
                    "validationGroupCount": 30,
                    "metricsBefore": {"meanCrossEntropy": 1.0, "meanMulticlassBrierScore": 0.5, "topLabelExpectedCalibrationError": 0.3},
                    "metricsAfter": {"meanCrossEntropy": 0.8, "meanMulticlassBrierScore": 0.4, "topLabelExpectedCalibrationError": 0.2},
                    "meanNllBefore": 1.0, "meanNllAfter": 0.8, "meanBrierDelta": -0.1, "eceDelta": -0.1,
                },
            }
            path.write_text(json.dumps(artifact), encoding="utf-8")
            service_path = TOOLS / "research_nli_server.py"
            service_spec = importlib.util.spec_from_file_location("kurisu_nli_service_calibration_test", service_path)
            service = importlib.util.module_from_spec(service_spec)
            assert service_spec and service_spec.loader
            service_spec.loader.exec_module(service)
            temperature, metadata = service.validate_calibration_artifact(str(path), MODEL_ID, MODEL_REVISION)
            self.assertAlmostEqual(temperature, 1.8)
            self.assertEqual(metadata["datasetSha256"], "b" * 64)
            with self.assertRaisesRegex(RuntimeError, "invalid or does not match"):
                service.validate_calibration_artifact(str(path), MODEL_ID, "c" * 40)
            artifact["fit"]["meanNllAfter"] = 1.2  # no longer agrees with metricsAfter / claimed eligibility
            path.write_text(json.dumps(artifact), encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "invalid or does not match"):
                service.validate_calibration_artifact(str(path), MODEL_ID, MODEL_REVISION)


if __name__ == "__main__":
    unittest.main()
