import importlib.util
import json
import pathlib
import threading
import time
import types
import urllib.error
import urllib.request
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "tools" / "research_nli_server.py"

spec = importlib.util.spec_from_file_location("kurisu_research_nli_server_test", MODULE_PATH)
service = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(service)


class FakeTensor:
    def __init__(self, batch_size=1, batched=False):
        self.batch_size = batch_size
        self.batched = batched

    def __getitem__(self, _index):
        return FakeTensor(1, False)

    def float(self):
        return self

    def __truediv__(self, _value):
        return self


class FakeProbabilities:
    def __init__(self, tensor):
        self.tensor = tensor

    def cpu(self):
        return self

    def tolist(self):
        scores = [0.04, 0.91, 0.05]
        return [scores for _ in range(self.tensor.batch_size)] if self.tensor.batched else scores


class FakeTorch:
    class _Inference:
        def __enter__(self):
            return None

        def __exit__(self, *_args):
            return False

    def inference_mode(self):
        return self._Inference()

    def softmax(self, tensor, dim=-1):
        assert dim == -1
        return FakeProbabilities(tensor)


class FakeOutput:
    def __init__(self, batch_size=1, batched=False):
        self.logits = FakeTensor(batch_size, batched)


class FakeModel:
    def __call__(self, **inputs):
        premise = inputs.get("premise", "")
        is_batch = isinstance(premise, list)
        return FakeOutput(len(premise) if is_batch else 1, is_batch)


class NliServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        service._tokenizer = lambda premise, **kwargs: {"premise": premise, "batched": isinstance(premise, list), **kwargs}
        service._model = FakeModel()
        service._torch = FakeTorch()
        service._id_to_label = {0: "contradiction", 1: "entailment", 2: "neutral"}
        service.MODEL_ID = "test-model-v1"
        service.TOKEN = ""
        cls.server = service.ThreadingHTTPServer(("127.0.0.1", 0), service.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def post(self, path, body, headers=None):
        request = urllib.request.Request(self.base + path, data=body, method="POST", headers={"content-type": "application/json", **(headers or {})})
        try:
            with urllib.request.urlopen(request, timeout=2) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read())

    def test_nli_contract_returns_scores_not_truth_claim(self):
        body = json.dumps({"premise": "A detailed release note supports this claim.", "hypothesis": "The release is safe for deployment."}).encode()
        status, payload = self.post("/v1/nli", body)
        self.assertEqual(status, 200)
        self.assertEqual(payload["modelId"], "test-model-v1")
        self.assertFalse(payload["calibrated"])
        self.assertAlmostEqual(sum(payload["scores"].values()), 1.0, places=5)

    def test_batch_contract_returns_one_score_row_per_pair(self):
        body = json.dumps({"pairs": [
            {"premise": "A detailed release note supports this claim.", "hypothesis": "The release is safe for deployment."},
            {"premise": "A detailed independent report describes the system.", "hypothesis": "The system has an operating manual."},
        ]}).encode()
        status, payload = self.post("/v1/nli/batch", body)
        self.assertEqual(status, 200)
        self.assertEqual(payload["modelId"], "test-model-v1")
        self.assertEqual(len(payload["results"]), 2)
        self.assertTrue(all(abs(sum(row["scores"].values()) - 1.0) < 0.001 for row in payload["results"]))

    def test_batch_size_and_pair_count_are_bounded(self):
        body = json.dumps({"pairs": [{"premise": "A sufficiently long premise sentence.", "hypothesis": "A sufficiently long hypothesis sentence."}] * (service.MAX_BATCH_PAIRS + 1)}).encode()
        status, payload = self.post("/v1/nli/batch", body)
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"], "batch-pairs-out-of-range")

    def test_unknown_path_is_rejected(self):
        status, payload = self.post("/not-the-api", b"{}")
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"], "not-found")

    def test_oversize_request_is_rejected_before_inference(self):
        status, payload = self.post("/v1/nli", b"{" + (b" " * (service.MAX_BODY_BYTES + 1)))
        self.assertEqual(status, 413)
        self.assertEqual(payload["error"], "body-size-out-of-range")

    def test_model_loader_pins_revision_and_requires_safetensors(self):
        from unittest.mock import patch

        tokenizer_calls = []
        model_calls = []

        class FakeTorchModule:
            @staticmethod
            def set_num_threads(value):
                self.assertGreaterEqual(value, 1)

        class FakeTokenizerClass:
            @staticmethod
            def from_pretrained(model_id, **kwargs):
                tokenizer_calls.append((model_id, kwargs))
                return lambda premise, **options: {"premise": premise, **options}

        class FakeLoadedModel:
            config = types.SimpleNamespace(
                id2label={0: "contradiction", 1: "entailment", 2: "neutral"},
                num_labels=3,
            )
            def to(self, device):
                self.assert_device = device
                return self
            def eval(self):
                return self

        class FakeModelClass:
            @staticmethod
            def from_pretrained(model_id, **kwargs):
                model_calls.append((model_id, kwargs))
                return FakeLoadedModel()

        fake_transformers = types.ModuleType("transformers")
        fake_transformers.AutoTokenizer = FakeTokenizerClass
        fake_transformers.AutoModelForSequenceClassification = FakeModelClass
        previous = (service._tokenizer, service._model, service._torch, service._id_to_label)
        try:
            service._tokenizer = service._model = service._torch = None
            service._id_to_label = {}
            with patch.dict("sys.modules", {"torch": FakeTorchModule, "transformers": fake_transformers}):
                service.load_model()
            self.assertEqual(tokenizer_calls[0][1]["revision"], service.MODEL_REVISION)
            self.assertFalse(tokenizer_calls[0][1]["trust_remote_code"])
            self.assertEqual(model_calls[0][1]["revision"], service.MODEL_REVISION)
            self.assertTrue(model_calls[0][1]["use_safetensors"])
            self.assertFalse(model_calls[0][1]["trust_remote_code"])
            self.assertEqual(service._id_to_label, {0: "contradiction", 1: "entailment", 2: "neutral"})
        finally:
            service._tokenizer, service._model, service._torch, service._id_to_label = previous

    def test_version_bound_calibration_artifact_is_validated_and_mismatch_rejected(self):
        import tempfile
        from pathlib import Path

        artifact = {
            "schemaVersion": 1,
            "kind": "local-nli-temperature-calibration",
            "method": "temperature-scaling-from-softmax-v1",
            "modelId": "test-artifact-model",
            "modelRevision": "a" * 40,
            "labels": ["entailment", "contradiction", "neutral"],
            "temperature": 1.7,
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
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "candidate.json"
            path.write_text(json.dumps(artifact), encoding="utf-8")
            temperature, metadata = service.validate_calibration_artifact(str(path), "test-artifact-model", "a" * 40)
            self.assertEqual(temperature, 1.7)
            self.assertEqual(metadata["datasetSha256"], "b" * 64)
            with self.assertRaisesRegex(RuntimeError, "invalid or does not match"):
                service.validate_calibration_artifact(str(path), "test-artifact-model", "c" * 40)
            artifact["dataset"]["classCounts"]["neutral"] = 49
            path.write_text(json.dumps(artifact), encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "invalid or does not match"):
                service.validate_calibration_artifact(str(path), "test-artifact-model", "a" * 40)

    def test_calibrated_scores_include_calibration_provenance(self):
        previous = (service._temperature, service._calibration_metadata)
        try:
            service._temperature = 1.7
            service._calibration_metadata = {"method": "temperature-scaling-from-softmax-v1", "datasetSha256": "b" * 64, "sampleCount": 90, "temperature": 1.7}
            body = json.dumps({"premise": "A detailed release note supports this claim.", "hypothesis": "The release is safe for deployment."}).encode()
            status, payload = self.post("/v1/nli", body)
            self.assertEqual(status, 200)
            self.assertTrue(payload["calibrated"])
            self.assertEqual(payload["calibration"]["datasetSha256"], "b" * 64)
            status, batch = self.post("/v1/nli/batch", json.dumps({"pairs": [{"premise": "A detailed release note supports this claim.", "hypothesis": "The release is safe for deployment."}]}).encode())
            self.assertEqual(status, 200)
            self.assertTrue(batch["calibrated"])
            self.assertTrue(batch["results"][0]["calibrated"])
        finally:
            service._temperature, service._calibration_metadata = previous

    def test_mutable_model_revision_is_rejected_and_cooled_down(self):
        previous = (service._tokenizer, service._model, service._torch, service._id_to_label,
                    service.MODEL_REVISION, service._model_load_retry_after, service._model_load_failure_code)
        try:
            service._tokenizer = service._model = service._torch = None
            service._id_to_label = {}
            service.MODEL_REVISION = "main"
            service._model_load_retry_after = 0.0
            service._model_load_failure_code = ""
            with self.assertRaisesRegex(RuntimeError, "model-revision-not-immutable"):
                service.load_model()
            self.assertEqual(service._model_load_failure_code, "model-revision-not-immutable")
            with self.assertRaisesRegex(RuntimeError, "nli-model-load-backoff:model-revision-not-immutable"):
                service.load_model()
        finally:
            (service._tokenizer, service._model, service._torch, service._id_to_label,
             service.MODEL_REVISION, service._model_load_retry_after, service._model_load_failure_code) = previous

    def test_liveness_is_separate_from_model_readiness(self):
        # Liveness stays green when the optional model has not loaded; readiness must not.
        previous = (service._model, service._model_load_retry_after, service._model_load_failure_code)
        try:
            service._model = None
            service._model_load_retry_after = time.monotonic() + 7
            service._model_load_failure_code = "model-artifacts-unavailable"
            for path in ("/healthz", "/livez"):
                request = urllib.request.Request(self.base + path, method="GET")
                with urllib.request.urlopen(request, timeout=2) as response:
                    payload = json.loads(response.read())
                self.assertTrue(payload["ok"])
                self.assertTrue(payload["live"])
                self.assertFalse(payload["ready"])
            request = urllib.request.Request(self.base + "/readyz", method="GET")
            with self.assertRaises(urllib.error.HTTPError) as raised:
                urllib.request.urlopen(request, timeout=2)
            self.assertEqual(raised.exception.code, 503)
            payload = json.loads(raised.exception.read())
            self.assertEqual(payload["modelRevision"], service.MODEL_REVISION)
            self.assertEqual(payload["failureCode"], "model-artifacts-unavailable")
            self.assertGreaterEqual(payload["retryAfterSeconds"], 1)
        finally:
            service._model, service._model_load_retry_after, service._model_load_failure_code = previous

    def test_model_loading_failure_uses_bounded_cooldown(self):
        from unittest.mock import patch

        attempts = []
        class FakeTorchModule(types.ModuleType):
            @staticmethod
            def set_num_threads(_value):
                return None
        class BrokenTokenizer:
            @staticmethod
            def from_pretrained(_model_id, **_kwargs):
                attempts.append("tokenizer")
                raise OSError("should never leak this path or registry detail")
        fake_transformers = types.ModuleType("transformers")
        fake_transformers.AutoTokenizer = BrokenTokenizer
        fake_transformers.AutoModelForSequenceClassification = types.SimpleNamespace(from_pretrained=lambda *_a, **_k: None)
        previous = (service._tokenizer, service._model, service._torch, service._id_to_label,
                    service._model_load_retry_after, service._model_load_failure_code)
        try:
            service._tokenizer = service._model = service._torch = None
            service._id_to_label = {}
            service._model_load_retry_after = 0.0
            service._model_load_failure_code = ""
            with patch.dict("sys.modules", {"torch": FakeTorchModule("torch"), "transformers": fake_transformers}):
                with self.assertRaisesRegex(RuntimeError, "model-artifacts-unavailable"):
                    service.load_model()
                self.assertEqual(service._model_load_failure_code, "model-artifacts-unavailable")
                with self.assertRaisesRegex(RuntimeError, "nli-model-load-backoff:model-artifacts-unavailable"):
                    service.load_model()
            self.assertEqual(attempts, ["tokenizer"])
        finally:
            (service._tokenizer, service._model, service._torch, service._id_to_label,
             service._model_load_retry_after, service._model_load_failure_code) = previous

    def test_bounded_server_rejects_excess_worker_without_unbounded_queue(self):
        entered = threading.Event()
        release = threading.Event()
        class SlowHandler(service.BaseHTTPRequestHandler):
            def do_GET(self):
                entered.set()
                release.wait(timeout=2)
                body = b"ok"
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            def log_message(self, *_args):
                return
        server = service.BoundedThreadingHTTPServer(("127.0.0.1", 0), SlowHandler, max_in_flight=1)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_address[1]}"
        first_status = []
        def first_request():
            try:
                with urllib.request.urlopen(base, timeout=2) as response:
                    first_status.append(response.status)
            except Exception as exc:
                first_status.append(exc)
        worker = threading.Thread(target=first_request, daemon=True)
        worker.start()
        self.assertTrue(entered.wait(timeout=1))
        try:
            try:
                with urllib.request.urlopen(base, timeout=1) as response:
                    status = response.status
                    overload_body = response.read()
            except urllib.error.HTTPError as exc:
                status = exc.code
                overload_body = exc.read()
            self.assertEqual(status, 503)
            self.assertEqual(json.loads(overload_body), {"error": "busy"})
        finally:
            release.set()
            worker.join(timeout=2)
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
        self.assertEqual(first_status, [200])


if __name__ == "__main__":
    unittest.main()
