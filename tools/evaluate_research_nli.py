#!/usr/bin/env python3
"""Evaluate the configured local NLI service on a fixed labelled JSONL holdout.

Input rows: {"id": "optional-stable-id", "premise": "...", "hypothesis": "...",
             "label": "entailment|contradiction|neutral"}
The report deliberately excludes premise/hypothesis text, records a SHA-256 of the exact
input file, and never claims softmax values are calibrated probabilities. It does not
choose thresholds or promote model/configuration changes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from typing import Any
from urllib.parse import urlparse, urlunparse

LABELS = ("entailment", "contradiction", "neutral")
MAX_ROWS = 10_000
MAX_LINE_BYTES = 8_192
MAX_BATCH = 24
MAX_RESPONSE_BYTES = 64 * 1024


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def bounded_int(value: Any, default: int, lower: int, upper: int) -> int:
    try:
        num = int(value)
    except (TypeError, ValueError):
        num = default
    return max(lower, min(upper, num))


def batch_endpoint(raw: str, allow_remote: bool = False) -> str:
    url = urlparse(str(raw or ""))
    if url.scheme not in ("http", "https") or not url.hostname:
        raise ValueError("endpoint must be an absolute HTTP(S) URL")
    if url.username or url.password or url.query or url.fragment:
        raise ValueError("endpoint cannot include userinfo, query, or fragment")
    host = url.hostname.lower().strip("[]")
    is_loopback = host in ("localhost", "127.0.0.1", "::1") or host.endswith(".localhost")
    if url.scheme != "https" and not is_loopback:
        raise ValueError("plain HTTP is permitted only for loopback endpoints")
    if not is_loopback and not allow_remote:
        raise ValueError("non-loopback evaluation requires explicit --allow-remote")
    path = url.path.rstrip("/")
    if not path:
        path = "/v1/nli"
    if path.endswith("/batch"):
        batch_path = path
    else:
        batch_path = path + "/batch"
    return urlunparse((url.scheme, url.netloc, batch_path, "", "", ""))


def load_dataset(path: pathlib.Path) -> tuple[list[dict[str, str]], str]:
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    rows: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for line_number, line in enumerate(raw.splitlines(), 1):
        if not line.strip():
            continue
        if len(line) > MAX_LINE_BYTES:
            raise ValueError(f"line {line_number} exceeds the {MAX_LINE_BYTES}-byte limit")
        try:
            row = json.loads(line)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ValueError(f"line {line_number} is not valid JSONL") from exc
        if not isinstance(row, dict):
            raise ValueError(f"line {line_number} must be a JSON object")
        premise = row.get("premise")
        hypothesis = row.get("hypothesis")
        label = str(row.get("label", "")).strip().lower()
        example_id = str(row.get("id", f"line-{line_number}")).strip()[:160]
        if not isinstance(premise, str) or not isinstance(hypothesis, str):
            raise ValueError(f"line {line_number} requires string premise and hypothesis")
        premise, hypothesis = premise.strip(), hypothesis.strip()
        if not (8 <= len(premise) <= 1800 and 8 <= len(hypothesis) <= 600):
            raise ValueError(f"line {line_number} has text outside bounded length limits")
        if label not in LABELS:
            raise ValueError(f"line {line_number} label must be one of {','.join(LABELS)}")
        if not example_id or example_id in seen_ids:
            raise ValueError(f"line {line_number} has a blank or duplicate id")
        seen_ids.add(example_id)
        raw_group_id = row.get("groupId", example_id)
        if not isinstance(raw_group_id, str):
            raise ValueError(f"line {line_number} groupId must be a string when present")
        group_id = raw_group_id.strip()[:160]
        if not group_id:
            raise ValueError(f"line {line_number} groupId cannot be blank")
        rows.append({"id": example_id, "groupId": group_id, "premise": premise, "hypothesis": hypothesis, "label": label})
        if len(rows) > MAX_ROWS:
            raise ValueError(f"dataset exceeds the {MAX_ROWS}-row safety limit")
    if not rows:
        raise ValueError("dataset contains no labelled rows")
    missing = [label for label in LABELS if not any(row["label"] == label for row in rows)]
    if missing:
        raise ValueError(f"dataset needs examples for all three labels; missing {missing}")
    return rows, digest


def evaluate_metrics(rows: list[dict[str, Any]], probability_rows: list[dict[str, float]], bins: int = 10) -> dict[str, Any]:
    bins = max(1, min(100, int(bins)))
    if len(rows) != len(probability_rows):
        raise ValueError("row and prediction counts differ")
    confusion = {actual: {pred: 0 for pred in LABELS} for actual in LABELS}
    correct = 0
    cross_entropy = 0.0
    brier_sum = 0.0
    confidence_rows: list[tuple[float, float]] = []
    for row, probs in zip(rows, probability_rows):
        if set(probs) != set(LABELS):
            raise ValueError("prediction scores must contain exactly the three NLI labels")
        values = [float(probs[label]) for label in LABELS]
        if any(not math.isfinite(x) or x < 0 or x > 1 for x in values) or abs(sum(values) - 1.0) > 0.03:
            raise ValueError("model returned invalid NLI scores")
        total = sum(values)
        normalized = {label: float(probs[label]) / total for label in LABELS}
        predicted = max(LABELS, key=lambda label: (normalized[label], -LABELS.index(label)))
        actual = row["label"]
        confusion[actual][predicted] += 1
        correct += int(predicted == actual)
        cross_entropy -= math.log(max(1e-12, normalized[actual]))
        brier_sum += sum((normalized[label] - (1.0 if label == actual else 0.0)) ** 2 for label in LABELS)
        confidence_rows.append((normalized[predicted], float(predicted == actual)))
    per_class = {}
    f1_values = []
    for label in LABELS:
        tp = confusion[label][label]
        fp = sum(confusion[actual][label] for actual in LABELS if actual != label)
        fn = sum(confusion[label][pred] for pred in LABELS if pred != label)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        support = sum(confusion[label].values())
        per_class[label] = {"support": support, "precision": round(precision, 6), "recall": round(recall, 6), "f1": round(f1, 6)}
        f1_values.append(f1)
    calibration = []
    ece = 0.0
    for index in range(max(1, bins)):
        low, high = index / bins, (index + 1) / bins
        selected = [(conf, hit) for conf, hit in confidence_rows if conf >= low and (conf < high or index == bins - 1)]
        if not selected:
            continue
        mean_conf = sum(conf for conf, _ in selected) / len(selected)
        accuracy = sum(hit for _, hit in selected) / len(selected)
        ece += len(selected) / len(confidence_rows) * abs(mean_conf - accuracy)
        calibration.append({"lower": round(low, 4), "upper": round(high, 4), "count": len(selected), "meanConfidence": round(mean_conf, 6), "accuracy": round(accuracy, 6)})
    supports = [per_class[label]["support"] for label in LABELS]
    return {
        "count": len(rows),
        "accuracy": round(correct / len(rows), 6),
        "macroF1": round(sum(f1_values) / len(f1_values), 6),
        "perClass": per_class,
        "confusionMatrix": confusion,
        "meanCrossEntropy": round(cross_entropy / len(rows), 6),
        "meanMulticlassBrierScore": round(brier_sum / len(rows), 6),
        "topLabelExpectedCalibrationError": round(ece, 6),
        "calibrationBins": calibration,
        "classBalance": {"minimumClassSupport": min(supports), "maximumClassSupport": max(supports)},
    }


def request_batch(opener: Any, endpoint: str, pairs: list[dict[str, str]], token: str, timeout: float) -> dict[str, Any]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps({"pairs": pairs}, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(endpoint, data=body, method="POST", headers=headers)
    with opener.open(request, timeout=timeout) as response:
        declared = int(response.headers.get("Content-Length", "0") or 0)
        if declared > MAX_RESPONSE_BYTES:
            raise RuntimeError("NLI response exceeds size limit")
        data = response.read(MAX_RESPONSE_BYTES + 1)
        if len(data) > MAX_RESPONSE_BYTES:
            raise RuntimeError("NLI response exceeds size limit")
        payload = json.loads(data)
        if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
            raise RuntimeError("NLI service returned a malformed batch response")
        if len(payload["results"]) != len(pairs):
            raise RuntimeError("NLI service returned a different result count than requested")
        return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=pathlib.Path, help="labelled JSONL holdout; text is sent only to the configured NLI endpoint")
    parser.add_argument("--endpoint", default=os.environ.get("KURISU_RESEARCH_NLI_ENDPOINT", "http://127.0.0.1:8798/v1/nli"))
    parser.add_argument("--token", default=os.environ.get("KURISU_RESEARCH_NLI_TOKEN", ""))
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--batch-size", type=int, default=MAX_BATCH)
    parser.add_argument("--allow-remote", action="store_true", help="explicitly allow sending evaluation text to a non-loopback service")
    parser.add_argument("--output", type=pathlib.Path, help="optional private JSON output path; text samples are never included")
    args = parser.parse_args()
    try:
        endpoint = batch_endpoint(args.endpoint, args.allow_remote)
        rows, dataset_hash = load_dataset(args.dataset)
        batch_size = bounded_int(args.batch_size, MAX_BATCH, 1, MAX_BATCH)
        timeout = max(1.0, min(120.0, float(args.timeout)))
        opener = urllib.request.build_opener(NoRedirect)
        predictions: list[dict[str, float]] = []
        service_meta: dict[str, Any] = {}
        start = time.monotonic()
        for offset in range(0, len(rows), batch_size):
            chunk = rows[offset:offset + batch_size]
            payload = request_batch(opener, endpoint, [{"premise": row["premise"], "hypothesis": row["hypothesis"]} for row in chunk], args.token.strip(), timeout)
            service_meta = {"modelId": str(payload.get("modelId", "unknown"))[:200], "modelRevision": str(payload.get("modelRevision", "unknown"))[:200]}
            for result in payload["results"]:
                scores = result.get("scores") if isinstance(result, dict) else None
                if not isinstance(scores, dict):
                    raise RuntimeError("NLI service result is missing scores")
                predictions.append({label: float(scores[label]) for label in LABELS})
        metrics = evaluate_metrics(rows, predictions)
        result = {
            "schemaVersion": 1,
            "kind": "local-nli-labelled-holdout-evaluation",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "dataset": {"pathName": args.dataset.name, "sha256": dataset_hash, "count": len(rows), "textIncludedInReport": False},
            "service": service_meta,
            "endpointHost": urlparse(endpoint).hostname,
            "elapsedMs": round((time.monotonic() - start) * 1000, 3),
            "metrics": metrics,
            "interpretation": {
                "rawScoresAreCalibrated": False,
                "promotionOrThresholdTuningPerformed": False,
                "minimumRecommendedPerClassForPilot": 10,
                "minimumRecommendedPerClassForStableThresholdReview": 30,
                "warning": "Evaluate on a genuinely held-out, domain-relevant set. Do not choose thresholds on this evaluation split; SNLI/MNLI-trained English models may not generalize to other languages/domains.",
            },
        }
        serialized = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            temp = args.output.with_name(f".{args.output.name}.{os.getpid()}.tmp")
            try:
                fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "w", encoding="utf-8") as stream:
                    stream.write(serialized)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temp, args.output)
                os.chmod(args.output, 0o600)
            finally:
                try:
                    temp.unlink()
                except FileNotFoundError:
                    pass
        else:
            print(serialized, end="")
        return 0
    except (OSError, ValueError, RuntimeError, urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        # Keep output diagnostic but never echo premise/hypothesis contents.
        print(f"research NLI evaluation failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
