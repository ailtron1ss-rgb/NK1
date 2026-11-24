#!/usr/bin/env python3
"""Local, opt-in NLI service for Neuro Kurisu research evidence.

Install optional dependencies with:
  python -m pip install -r research/requirements-nli.txt
Run bound to loopback by default:
  python tools/research_nli_server.py
Then set KURISU_RESEARCH_NLI_ENDPOINT=http://127.0.0.1:8798/v1/nli.

No request text is logged. A non-loopback bind requires KURISU_RESEARCH_NLI_TOKEN.
The output contains model softmax scores, not calibrated truth probabilities.
"""
from __future__ import annotations

import argparse
import hmac
import json
import math
import os
import pathlib
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

MAX_BODY_BYTES = 64 * 1024
MAX_BATCH_PAIRS = 24
MAX_TEXT_CHARS = 1800
MODEL_ID = os.environ.get("KURISU_NLI_MODEL", "cross-encoder/nli-deberta-v3-xsmall").strip()
# Pin the known, reviewed upstream revision; changing the model requires choosing
# its matching immutable commit explicitly. Never load unreviewed remote model code.
DEFAULT_MODEL_REVISION = "a150876415327c80daeff35ca6f68f5ed8cf5c24"
MODEL_REVISION = os.environ.get("KURISU_NLI_REVISION", DEFAULT_MODEL_REVISION).strip()
LOCAL_FILES_ONLY = os.environ.get("KURISU_NLI_LOCAL_FILES_ONLY", "0").strip().lower() in {"1", "true", "yes", "on"}
def bounded_env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


TORCH_THREADS = bounded_env_int("KURISU_NLI_TORCH_THREADS", 2, 1, 8)
MAX_IN_FLIGHT = bounded_env_int("KURISU_NLI_MAX_IN_FLIGHT", 2, 1, 8)
MODEL_LOAD_RETRY_SECONDS = bounded_env_int("KURISU_NLI_LOAD_RETRY_SECONDS", 30, 1, 300)
CALIBRATION_FILE = os.environ.get("KURISU_NLI_CALIBRATION_FILE", "").strip()
TOKEN = os.environ.get("KURISU_RESEARCH_NLI_TOKEN", "").strip()
_model_lock = threading.Lock()
_tokenizer: Any = None
_model: Any = None
_torch: Any = None
_id_to_label: dict[int, str] = {}
_model_load_retry_after = 0.0
_model_load_failure_code = ""
_temperature = 1.0
_calibration_metadata: dict[str, Any] | None = None


def validate_calibration_artifact(path: str, model_id: str, model_revision: str) -> tuple[float, dict[str, Any]]:
    """Load a calibration candidate only when it is bound to this exact model revision."""
    if not path:
        return 1.0, {}
    try:
        artifact_path = pathlib.Path(path)
        if artifact_path.stat().st_size > 64 * 1024:
            raise ValueError("oversize")
        artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
        dataset = artifact.get("dataset") if isinstance(artifact, dict) else None
        fit = artifact.get("fit") if isinstance(artifact, dict) else None
        counts = dataset.get("classCounts") if isinstance(dataset, dict) else None
        temperature = float(artifact.get("temperature"))
        if artifact.get("schemaVersion") != 1 or artifact.get("kind") != "local-nli-temperature-calibration":
            raise ValueError("schema")
        if artifact.get("method") != "temperature-scaling-from-softmax-v1":
            raise ValueError("method")
        if artifact.get("modelId") != model_id or artifact.get("modelRevision") != model_revision:
            raise ValueError("model-mismatch")
        if artifact.get("labels") != ["entailment", "contradiction", "neutral"]:
            raise ValueError("labels")
        if not isinstance(dataset, dict) or not re.fullmatch(r"[a-f0-9]{64}", str(dataset.get("sha256", ""))):
            raise ValueError("dataset-hash")
        if not str(dataset.get("sourceReference", "")).strip()[:500] or not str(dataset.get("labelingProtocol", "")).strip()[:500]:
            raise ValueError("dataset-provenance")
        sample_count = dataset.get("count")
        if not isinstance(sample_count, int) or isinstance(sample_count, bool) or sample_count < 150:
            raise ValueError("sample-count")
        required_labels = {"entailment", "contradiction", "neutral"}
        if not isinstance(counts, dict) or set(counts) != required_labels:
            raise ValueError("class-counts")
        if any(not isinstance(counts[label], int) or isinstance(counts[label], bool) or counts[label] < 50 for label in required_labels):
            raise ValueError("class-counts")
        if sum(counts.values()) != sample_count or not isinstance(fit, dict):
            raise ValueError("fit-provenance")
        train_counts = fit.get("trainingClassCounts")
        validation_counts = fit.get("validationClassCounts")
        train_count = fit.get("trainingCount")
        validation_count = fit.get("validationCount")
        group_count = fit.get("validationGroupCount")
        if (fit.get("validationSplitMethod") != "deterministic-greedy-stratified-group-20pct-v1"
                or not isinstance(train_counts, dict) or set(train_counts) != required_labels
                or not isinstance(validation_counts, dict) or set(validation_counts) != required_labels
                or not isinstance(train_count, int) or isinstance(train_count, bool)
                or not isinstance(validation_count, int) or isinstance(validation_count, bool)
                or not isinstance(group_count, int) or isinstance(group_count, bool) or group_count < 1):
            raise ValueError("split-provenance")
        if (sum(train_counts.values()) != train_count or sum(validation_counts.values()) != validation_count
                or train_count + validation_count != sample_count):
            raise ValueError("split-counts")
        if any(not isinstance(train_counts[label], int) or isinstance(train_counts[label], bool) or train_counts[label] < 20 for label in required_labels):
            raise ValueError("training-counts")
        if any(not isinstance(validation_counts[label], int) or isinstance(validation_counts[label], bool) or validation_counts[label] < 10 for label in required_labels):
            raise ValueError("validation-counts")
        if any(train_counts[label] + validation_counts[label] != counts[label] for label in required_labels):
            raise ValueError("class-split-counts")
        before_metrics = fit.get("metricsBefore")
        after_metrics = fit.get("metricsAfter")
        if not isinstance(before_metrics, dict) or not isinstance(after_metrics, dict):
            raise ValueError("validation-metrics")
        try:
            nll_before = float(fit.get("meanNllBefore"))
            nll_after = float(fit.get("meanNllAfter"))
            brier_delta = float(fit.get("meanBrierDelta"))
            ece_delta = float(fit.get("eceDelta"))
            metrics_before_nll = float(before_metrics.get("meanCrossEntropy"))
            metrics_after_nll = float(after_metrics.get("meanCrossEntropy"))
            metrics_before_brier = float(before_metrics.get("meanMulticlassBrierScore"))
            metrics_after_brier = float(after_metrics.get("meanMulticlassBrierScore"))
            metrics_before_ece = float(before_metrics.get("topLabelExpectedCalibrationError"))
            metrics_after_ece = float(after_metrics.get("topLabelExpectedCalibrationError"))
        except (TypeError, ValueError):
            raise ValueError("validation-metrics") from None
        all_metrics = (nll_before, nll_after, brier_delta, ece_delta, metrics_before_nll,
                       metrics_after_nll, metrics_before_brier, metrics_after_brier,
                       metrics_before_ece, metrics_after_ece)
        if any(not math.isfinite(value) for value in all_metrics):
            raise ValueError("validation-metrics")
        if (abs(metrics_before_nll - nll_before) > 5e-6
                or abs(metrics_after_nll - nll_after) > 5e-6
                or abs((metrics_after_brier - metrics_before_brier) - brier_delta) > 5e-6
                or abs((metrics_after_ece - metrics_before_ece) - ece_delta) > 5e-6):
            raise ValueError("validation-metrics-inconsistent")
        if (fit.get("promoted") is not False or fit.get("eligibleForReview") is not True
                or nll_after >= nll_before - 1e-4 or brier_delta > 0.01 or ece_delta > 0.03):
            raise ValueError("fit-not-eligible")
        if not math.isfinite(temperature) or not 0.05 <= temperature <= 20.0:
            raise ValueError("temperature")
        metadata = {
            "method": "temperature-scaling-from-softmax-v1",
            "datasetSha256": str(dataset["sha256"]),
            "sampleCount": sample_count,
            "temperature": temperature,
        }
        return temperature, metadata
    except Exception:
        # Never expose artifact contents, paths or parse details in health/error responses.
        raise RuntimeError("NLI calibration artifact is invalid or does not match the pinned model") from None


def _record_model_load_failure(code: str) -> None:
    global _model_load_retry_after, _model_load_failure_code
    _model_load_failure_code = code
    _model_load_retry_after = time.monotonic() + MODEL_LOAD_RETRY_SECONDS


def load_model() -> None:
    global _tokenizer, _model, _torch, _id_to_label, _model_load_retry_after, _model_load_failure_code, _temperature, _calibration_metadata
    if _model is not None:
        return
    with _model_lock:
        if _model is not None:
            return
        now = time.monotonic()
        if now < _model_load_retry_after:
            raise RuntimeError(f"nli-model-load-backoff:{_model_load_failure_code or 'model-unavailable'}") from None
        if not re.fullmatch(r"[0-9a-f]{40}", MODEL_REVISION):
            _record_model_load_failure("model-revision-not-immutable")
            raise RuntimeError("nli-model-load-failed:model-revision-not-immutable") from None
        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
        except ImportError:
            _record_model_load_failure("optional-dependencies-missing")
            raise RuntimeError("nli-model-load-failed:optional-dependencies-missing") from None
        try:
            # Cap CPU oversubscription on agent workstations and CI hosts.
            torch.set_num_threads(TORCH_THREADS)
            load_options = {
                "revision": MODEL_REVISION,
                "local_files_only": LOCAL_FILES_ONLY,
                "trust_remote_code": False,
            }
            tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, **load_options)
            # Explicitly require safetensors; do not silently fall back to pickle weights.
            model = AutoModelForSequenceClassification.from_pretrained(
                MODEL_ID, use_safetensors=True, **load_options
            )
            model.to("cpu")
            model.eval()
            labels = {int(key): str(value).strip().lower() for key, value in model.config.id2label.items()}
            required = {"entailment", "contradiction", "neutral"}
            if len(labels) != 3 or set(labels.values()) != required or model.config.num_labels != 3:
                _record_model_load_failure("nli-label-contract-invalid")
                raise RuntimeError("NLI model label contract is invalid")
            # Validate calibration only after the serving model's exact label identity is known.
            temperature, calibration_metadata = validate_calibration_artifact(CALIBRATION_FILE, MODEL_ID, MODEL_REVISION)
            _torch, _tokenizer, _model, _id_to_label = torch, tokenizer, model, labels
            _temperature, _calibration_metadata = temperature, calibration_metadata or None
            _model_load_retry_after = 0.0
            _model_load_failure_code = ""
        except RuntimeError as exc:
            if str(exc).startswith("NLI model label contract"):
                _record_model_load_failure("nli-label-contract-invalid")
                raise RuntimeError("nli-model-load-failed:nli-label-contract-invalid") from None
            if str(exc).startswith("NLI calibration artifact"):
                _record_model_load_failure("calibration-artifact-invalid")
                raise RuntimeError("nli-model-load-failed:calibration-artifact-invalid") from None
            _record_model_load_failure("model-artifacts-unavailable")
            raise RuntimeError("nli-model-load-failed:model-artifacts-unavailable") from None
        except Exception:
            # Do not expose file paths, registry URLs, or request data in status output.
            _record_model_load_failure("model-artifacts-unavailable")
            raise RuntimeError("nli-model-load-failed:model-artifacts-unavailable") from None


class Handler(BaseHTTPRequestHandler):
    server_version = "KurisuResearchNLI/1.0"

    def log_message(self, _format: str, *_args: Any) -> None:
        # Avoid logging claims or webpage excerpts, which may contain personal/project data.
        return

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.send_header("cache-control", "no-store")
        self.send_header("x-content-type-options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        if self.path in ("/healthz", "/livez"):
            self._send(200, {"ok": True, "live": True, "ready": _model is not None})
            return
        if self.path == "/readyz":
            ready = _model is not None
            retry_after = max(0, int(_model_load_retry_after - time.monotonic()))
            self._send(200 if ready else 503, {
                "ok": ready, "ready": ready, "modelId": MODEL_ID,
                "modelRevision": MODEL_REVISION, "loaded": ready,
                "calibrated": ready and _calibration_metadata is not None,
                "failureCode": _model_load_failure_code or ("warming-up" if not ready else ""),
                "retryAfterSeconds": retry_after,
            })
            return
        self._send(404, {"error": "not-found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in ("/v1/nli", "/v1/nli/batch"):
            self._send(404, {"error": "not-found"})
            return
        is_batch = self.path == "/v1/nli/batch"
        if TOKEN:
            provided = self.headers.get("authorization", "")
            expected = f"Bearer {TOKEN}"
            if not hmac.compare_digest(provided, expected):
                self._send(401, {"error": "unauthorized"})
                return
        elif self.client_address[0] not in ("127.0.0.1", "::1"):
            self._send(403, {"error": "token-required-for-non-loopback"})
            return
        if self.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
            self._send(415, {"error": "application-json-required"})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
        except ValueError:
            self._send(400, {"error": "invalid-content-length"})
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self._send(413, {"error": "body-size-out-of-range"})
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except Exception:
            self._send(400, {"error": "invalid-json"})
            return
        if is_batch:
            raw_pairs = payload.get("pairs") if isinstance(payload, dict) else None
            if not isinstance(raw_pairs, list) or not (1 <= len(raw_pairs) <= MAX_BATCH_PAIRS):
                self._send(400, {"error": "batch-pairs-out-of-range"})
                return
            pairs = []
            for row in raw_pairs:
                premise = row.get("premise") if isinstance(row, dict) else None
                hypothesis = row.get("hypothesis") if isinstance(row, dict) else None
                if not isinstance(premise, str) or not isinstance(hypothesis, str):
                    self._send(400, {"error": "premise-and-hypothesis-required"})
                    return
                premise, hypothesis = premise.strip(), hypothesis.strip()
                if not (8 <= len(premise) <= MAX_TEXT_CHARS and 8 <= len(hypothesis) <= 600):
                    self._send(400, {"error": "text-size-out-of-range"})
                    return
                pairs.append((premise, hypothesis))
        else:
            premise = payload.get("premise") if isinstance(payload, dict) else None
            hypothesis = payload.get("hypothesis") if isinstance(payload, dict) else None
            if not isinstance(premise, str) or not isinstance(hypothesis, str):
                self._send(400, {"error": "premise-and-hypothesis-required"})
                return
            premise, hypothesis = premise.strip(), hypothesis.strip()
            if not (8 <= len(premise) <= MAX_TEXT_CHARS and 8 <= len(hypothesis) <= 600):
                self._send(400, {"error": "text-size-out-of-range"})
                return
            pairs = [(premise, hypothesis)]
        try:
            load_model()
            with _model_lock:
                premises = [row[0] for row in pairs]
                hypotheses = [row[1] for row in pairs]
                inputs = _tokenizer(premises if is_batch else premises[0], text_pair=hypotheses if is_batch else hypotheses[0], padding=is_batch, truncation=True, max_length=512, return_tensors="pt")
                with _torch.inference_mode():
                    logits = _model(**inputs).logits
                    # Temperature scaling is enabled only by a validated artifact bound
                    # to this exact immutable model revision. Otherwise this is raw softmax.
                    scaled_logits = logits.float() if abs(_temperature - 1.0) < 1e-12 else logits.float() / _temperature
                    if is_batch:
                        probability_rows = _torch.softmax(scaled_logits, dim=-1).cpu().tolist()
                    else:
                        probability_rows = [_torch.softmax(scaled_logits[0], dim=-1).cpu().tolist()]
            if len(probability_rows) != len(pairs):
                self._send(503, {"error": "model-batch-shape-invalid"})
                return
            results = []
            for probabilities in probability_rows:
                if not isinstance(probabilities, (list, tuple)) or len(probabilities) != 3:
                    self._send(503, {"error": "model-label-contract-invalid"})
                    return
                scores: dict[str, float] = {"entailment": 0.0, "contradiction": 0.0, "neutral": 0.0}
                for index, value in enumerate(probabilities):
                    label = _id_to_label.get(index, "").replace("label_", "")
                    if label in scores:
                        scores[label] = max(0.0, min(1.0, float(value)))
                if set(_id_to_label.values()) != set(scores) or abs(sum(scores.values()) - 1.0) > 0.02:
                    self._send(503, {"error": "model-label-contract-invalid"})
                    return
                results.append({"modelId": MODEL_ID, "modelRevision": MODEL_REVISION, "scores": scores, "calibrated": _calibration_metadata is not None, "calibration": _calibration_metadata})
            if is_batch:
                self._send(200, {"modelId": MODEL_ID, "modelRevision": MODEL_REVISION, "results": results, "calibrated": _calibration_metadata is not None, "calibration": _calibration_metadata})
            else:
                self._send(200, results[0])
        except Exception:
            # Do not leak file paths, model-loading details, or inference input.
            self._send(503, {"error": "nli-model-unavailable"})


class BoundedThreadingHTTPServer(ThreadingHTTPServer):
    """Bound concurrent request threads to avoid unbounded local inference queues."""
    daemon_threads = True
    request_queue_size = 16

    def __init__(self, server_address, handler_class, *, max_in_flight: int = MAX_IN_FLIGHT):
        self._request_slots = threading.BoundedSemaphore(max(1, min(8, int(max_in_flight))))
        super().__init__(server_address, handler_class)

    def process_request(self, request, client_address):
        if not self._request_slots.acquire(blocking=False):
            # Refuse overload promptly rather than creating an unbounded thread queue.
            try:
                request.sendall(
                    b"HTTP/1.1 503 Service Unavailable\r\n"
                    b"Content-Type: application/json\r\n"
                    b"Cache-Control: no-store\r\n"
                    b"Retry-After: 1\r\n"
                    b"Connection: close\r\n"
                    b"Content-Length: 16\r\n\r\n"
                    b'{"error":"busy"}'
                )
            except OSError:
                pass
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._request_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._request_slots.release()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=os.environ.get("KURISU_NLI_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("KURISU_NLI_PORT", "8798")))
    parser.add_argument("--lazy-model-load", action="store_true", help="serve liveness/readiness while the model warms in a background thread")
    args = parser.parse_args()
    if args.port < 1 or args.port > 65535:
        raise SystemExit("--port must be between 1 and 65535")
    if args.host not in ("127.0.0.1", "::1", "localhost") and not TOKEN:
        raise SystemExit("Set KURISU_RESEARCH_NLI_TOKEN before binding beyond loopback")
    # Default startup remains strict and warms the model before opening the port.
    # Orchestrated/offline environments may opt into liveness while the optional model
    # downloads or is unavailable; /readyz stays 503 and inference remains fail-closed.
    if not args.lazy_model_load:
        load_model()
    server = BoundedThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    if args.lazy_model_load:
        def warm_model() -> None:
            try:
                load_model()
            except Exception:
                pass  # /readyz exposes a bounded, sanitized failure code.
        threading.Thread(target=warm_model, name="kurisu-nli-warmup", daemon=True).start()
    print(f"NLI service listening on {args.host}:{args.port}; model={MODEL_ID}@{MODEL_REVISION}; in_flight={MAX_IN_FLIGHT}; local_files_only={LOCAL_FILES_ONLY}; lazy_model_load={args.lazy_model_load}; request text logging disabled")
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
