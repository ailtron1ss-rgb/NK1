#!/usr/bin/env python3
"""Fit a conservative, version-bound scalar temperature for the local NLI service.

This uses a dedicated labelled *calibration* JSONL file, never the final evaluation
holdout. The output contains no premise/hypothesis text, is private by default,
and is only a candidate artifact: the service does not promote model/config changes.
Each of the three NLI labels must have at least 50 examples before an artifact is
written. Non-loopback transmission requires the explicit --allow-remote flag.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import pathlib
import sys
import tempfile
import time
import urllib.error
from collections import Counter
from typing import Any

import evaluate_research_nli as nli_eval

LABELS = nli_eval.LABELS
MIN_PER_CLASS = 50
MIN_VALIDATION_PER_CLASS = 10
MIN_TRAIN_PER_CLASS = 20
MIN_TEMPERATURE = 0.05
MAX_TEMPERATURE = 20.0


def softmax_temperature(scores: dict[str, float], temperature: float) -> dict[str, float]:
    if not math.isfinite(temperature) or not MIN_TEMPERATURE <= temperature <= MAX_TEMPERATURE:
        raise ValueError("temperature is outside the permitted range")
    logs = [math.log(max(1e-12, float(scores[label]))) / temperature for label in LABELS]
    maximum = max(logs)
    exps = [math.exp(value - maximum) for value in logs]
    denominator = sum(exps)
    return {label: exps[index] / denominator for index, label in enumerate(LABELS)}


def mean_nll(rows: list[dict[str, Any]], probabilities: list[dict[str, float]], temperature: float) -> float:
    if len(rows) != len(probabilities) or not rows:
        raise ValueError("calibration rows and predictions must have equal non-zero length")
    total = 0.0
    for row, score in zip(rows, probabilities):
        scaled = softmax_temperature(score, temperature)
        total -= math.log(max(1e-12, scaled[row["label"]]))
    return total / len(rows)


def fit_temperature(rows: list[dict[str, Any]], probabilities: list[dict[str, float]]) -> float:
    """Deterministic golden-section minimization in log-temperature space."""
    left, right = math.log(MIN_TEMPERATURE), math.log(MAX_TEMPERATURE)
    ratio = (math.sqrt(5.0) - 1.0) / 2.0
    x1 = right - ratio * (right - left)
    x2 = left + ratio * (right - left)
    f1 = mean_nll(rows, probabilities, math.exp(x1))
    f2 = mean_nll(rows, probabilities, math.exp(x2))
    for _ in range(96):
        if f1 <= f2:
            right, x2, f2 = x2, x1, f1
            x1 = right - ratio * (right - left)
            f1 = mean_nll(rows, probabilities, math.exp(x1))
        else:
            left, x1, f1 = x1, x2, f2
            x2 = left + ratio * (right - left)
            f2 = mean_nll(rows, probabilities, math.exp(x2))
    candidates = [1.0, math.exp((left + right) / 2), MIN_TEMPERATURE, MAX_TEMPERATURE]
    # Stable tie-break: prefer identity scaling if it is equally good within numerical noise.
    losses = [(mean_nll(rows, probabilities, t), 0 if t == 1.0 else 1, t) for t in candidates]
    return min(losses)[2]


def atomic_private_write(path: pathlib.Path, payload: dict[str, Any], force: bool) -> None:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        raise FileExistsError("output already exists; choose a new path or pass --force")
    serialized = (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    fd, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temp = pathlib.Path(name)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(serialized)
            stream.flush()
            os.fsync(stream.fileno())
        if force:
            os.replace(temp, path)
        else:
            # Hard-link publication is atomic and fails if another process created the target.
            os.link(temp, path)
            temp.unlink(missing_ok=True)
        try:
            dir_fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        except OSError:
            pass
        os.chmod(path, 0o600)
    finally:
        temp.unlink(missing_ok=True)



def split_calibration_rows(rows: list[dict[str, Any]], probabilities: list[dict[str, float]]) -> tuple[list[dict[str, Any]], list[dict[str, float]], list[dict[str, Any]], list[dict[str, float]], dict[str, int], dict[str, int], int]:
    """Make a deterministic group-aware train/validation split without crossing group IDs."""
    if len(rows) != len(probabilities) or not rows:
        raise ValueError("calibration rows and predictions must have equal non-zero length")
    groups: dict[str, list[int]] = {}
    for index, row in enumerate(rows):
        group_id = str(row.get("groupId") or row["id"])
        groups.setdefault(group_id, []).append(index)
    total_counts = Counter(row["label"] for row in rows)
    if any(total_counts[label] < MIN_PER_CLASS for label in LABELS):
        raise ValueError(f"at least {MIN_PER_CLASS} calibration examples per class are required")
    target = {label: max(MIN_VALIDATION_PER_CLASS, int(math.ceil(total_counts[label] * 0.2))) for label in LABELS}
    target = {label: min(target[label], total_counts[label] - MIN_TRAIN_PER_CLASS) for label in LABELS}
    group_counts = {group: Counter(rows[i]["label"] for i in indexes) for group, indexes in groups.items()}
    validation_counts: Counter[str] = Counter()
    selected: set[str] = set()
    # Greedily satisfy under-filled class quotas. Stable hashing makes the tie-break reproducible,
    # while group-level assignment keeps near-related examples together when callers provide groupId.
    while any(validation_counts[label] < target[label] for label in LABELS):
        best: tuple[float, str] | None = None
        for group in groups:
            if group in selected:
                continue
            counts = group_counts[group]
            score = 0.0
            valid = True
            for label in LABELS:
                deficit = max(0, target[label] - validation_counts[label])
                add = counts[label]
                if total_counts[label] - validation_counts[label] - add < MIN_TRAIN_PER_CLASS:
                    valid = False
                    break
                score += min(deficit, add) - 0.35 * max(0, add - deficit)
            if not valid or score <= 0:
                continue
            tie = hashlib.sha256(group.encode("utf-8")).hexdigest()
            candidate = (score, tie)
            if best is None or candidate[0] > best[0] or (candidate[0] == best[0] and candidate[1] < best[1]):
                best = candidate
                best_group = group
        if best is None:
            raise ValueError("calibration data cannot form a group-disjoint validation split with >=10 validation and >=20 training examples per class; provide more independent groups")
        selected.add(best_group)
        validation_counts.update(group_counts[best_group])
    validation_indexes = [i for i, row in enumerate(rows) if str(row.get("groupId") or row["id"]) in selected]
    training_indexes = [i for i, row in enumerate(rows) if str(row.get("groupId") or row["id"]) not in selected]
    train_rows = [rows[i] for i in training_indexes]
    train_scores = [probabilities[i] for i in training_indexes]
    validation_rows = [rows[i] for i in validation_indexes]
    validation_scores = [probabilities[i] for i in validation_indexes]
    train_counts = Counter(row["label"] for row in train_rows)
    actual_validation_counts = Counter(row["label"] for row in validation_rows)
    if any(train_counts[label] < MIN_TRAIN_PER_CLASS for label in LABELS) or any(actual_validation_counts[label] < MIN_VALIDATION_PER_CLASS for label in LABELS):
        raise ValueError("group-disjoint calibration split does not contain enough samples per class")
    return train_rows, train_scores, validation_rows, validation_scores, dict(train_counts), dict(actual_validation_counts), len(selected)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=pathlib.Path, help="labelled JSONL calibration set (not the final test/holdout)")
    parser.add_argument("--endpoint", default=os.environ.get("KURISU_RESEARCH_NLI_ENDPOINT", "http://127.0.0.1:8798/v1/nli"))
    parser.add_argument("--token", default=os.environ.get("KURISU_RESEARCH_NLI_TOKEN", ""))
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--batch-size", type=int, default=nli_eval.MAX_BATCH)
    parser.add_argument("--allow-remote", action="store_true", help="explicitly allow sending calibration text to a non-loopback endpoint")
    parser.add_argument("--dataset-source", required=True, help="dataset origin/version or stable internal reference (max 500 chars)")
    parser.add_argument("--labeling-protocol", required=True, help="how labels were assigned/reviewed (max 500 chars)")
    parser.add_argument("--output", type=pathlib.Path, required=True, help="private calibration artifact output path")
    parser.add_argument("--force", action="store_true", help="atomically replace an existing output artifact")
    args = parser.parse_args()
    try:
        if args.output.resolve() == args.dataset.resolve():
            raise ValueError("output path must not overwrite the calibration dataset")
        dataset_source = str(args.dataset_source).strip()[:500]
        labeling_protocol = str(args.labeling_protocol).strip()[:500]
        if not dataset_source or not labeling_protocol:
            raise ValueError("dataset source and labeling protocol must be non-empty")
        endpoint = nli_eval.batch_endpoint(args.endpoint, args.allow_remote)
        rows, dataset_hash = nli_eval.load_dataset(args.dataset)
        counts = Counter(row["label"] for row in rows)
        missing = {label: MIN_PER_CLASS - counts[label] for label in LABELS if counts[label] < MIN_PER_CLASS}
        if missing:
            raise ValueError(f"at least {MIN_PER_CLASS} calibration examples per class are required; deficient class count(s): {missing}")
        batch_size = nli_eval.bounded_int(args.batch_size, nli_eval.MAX_BATCH, 1, nli_eval.MAX_BATCH)
        timeout = max(1.0, min(120.0, float(args.timeout)))
        opener = nli_eval.urllib.request.build_opener(nli_eval.NoRedirect)
        predictions: list[dict[str, float]] = []
        model_identity: tuple[str, str] | None = None
        started = time.monotonic()
        for offset in range(0, len(rows), batch_size):
            chunk = rows[offset:offset + batch_size]
            response = nli_eval.request_batch(opener, endpoint, [{"premise": row["premise"], "hypothesis": row["hypothesis"]} for row in chunk], args.token.strip(), timeout)
            top_identity = (str(response.get("modelId", "")).strip(), str(response.get("modelRevision", "")).strip())
            if not all(top_identity):
                raise RuntimeError("NLI service response is missing model identity/revision")
            if model_identity is None:
                model_identity = top_identity
            elif top_identity != model_identity:
                raise RuntimeError("model identity/revision changed between calibration batches")
            for result in response["results"]:
                identity = (str(result.get("modelId", "")).strip(), str(result.get("modelRevision", "")).strip())
                if identity != model_identity:
                    raise RuntimeError("model identity/revision mismatch inside calibration batch")
                score = result.get("scores")
                if not isinstance(score, dict) or set(score) != set(LABELS):
                    raise RuntimeError("NLI service result is missing the exact three-label score contract")
                values = {label: float(score[label]) for label in LABELS}
                if any(not math.isfinite(value) or value < 0 or value > 1 for value in values.values()) or abs(sum(values.values()) - 1.0) > 0.03:
                    raise RuntimeError("NLI service returned invalid score values")
                total = sum(values.values())
                predictions.append({label: value / total for label, value in values.items()})
        if len(predictions) != len(rows) or model_identity is None:
            raise RuntimeError("calibration inference returned an incomplete result set")
        train_rows, train_predictions, validation_rows, validation_predictions, train_counts, validation_counts, validation_group_count = split_calibration_rows(rows, predictions)
        temperature = fit_temperature(train_rows, train_predictions)
        validation_calibrated = [softmax_temperature(row, temperature) for row in validation_predictions]
        # Eligibility is computed on a group-disjoint validation fold, never on the examples used to fit T.
        before = nli_eval.evaluate_metrics(validation_rows, validation_predictions)
        after = nli_eval.evaluate_metrics(validation_rows, validation_calibrated)
        nll_before = mean_nll(validation_rows, validation_predictions, 1.0)
        nll_after = mean_nll(validation_rows, validation_predictions, temperature)
        brier_before = float(before["meanMulticlassBrierScore"])
        brier_after = float(after["meanMulticlassBrierScore"])
        ece_before = float(before["topLabelExpectedCalibrationError"])
        ece_after = float(after["topLabelExpectedCalibrationError"])
        eligible_for_review = nll_after < nll_before - 1e-4 and brier_after <= brier_before + 0.01 and ece_after <= ece_before + 0.03
        class_counts = {label: counts[label] for label in LABELS}
        artifact = {
            "schemaVersion": 1,
            "kind": "local-nli-temperature-calibration",
            "method": "temperature-scaling-from-softmax-v1",
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "modelId": model_identity[0],
            "modelRevision": model_identity[1],
            "labels": list(LABELS),
            "temperature": round(temperature, 10),
            "dataset": {"pathName": args.dataset.name[:160], "sourceReference": dataset_source, "labelingProtocol": labeling_protocol, "sha256": dataset_hash, "count": len(rows), "classCounts": class_counts, "textIncludedInArtifact": False},
            "fit": {
                "algorithm": "golden-section-minimize-mean-nll-in-log-temperature-space",
                "temperatureBounds": {"minimum": MIN_TEMPERATURE, "maximum": MAX_TEMPERATURE},
                "minimumExamplesPerClass": MIN_PER_CLASS,
                "validationSplitMethod": "deterministic-greedy-stratified-group-20pct-v1",
                "trainingCount": len(train_rows),
                "trainingClassCounts": {label: train_counts.get(label, 0) for label in LABELS},
                "validationCount": len(validation_rows),
                "validationClassCounts": {label: validation_counts.get(label, 0) for label in LABELS},
                "validationGroupCount": validation_group_count,
                "metricsBefore": before,
                "metricsAfter": after,
                "meanNllBefore": round(nll_before, 8),
                "meanNllAfter": round(nll_after, 8),
                "meanNllImprovement": round(nll_before - nll_after, 8),
                "meanBrierDelta": round(brier_after - brier_before, 8),
                "eceDelta": round(ece_after - ece_before, 8),
                "eligibleForReview": eligible_for_review,
                "promoted": False,
            },
            "execution": {"elapsedMs": round((time.monotonic() - started) * 1000, 3), "sourceTextIncluded": False},
            "warning": "Candidate calibration artifact only. Use a domain-relevant calibration set distinct from the final evaluation holdout; do not infer world-truth probability or automatically promote thresholds.",
        }
        atomic_private_write(args.output, artifact, args.force)
        print(json.dumps({"ok": True, "output": args.output.name, "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(), "sampleCount": len(rows), "trainCount": len(train_rows), "validationCount": len(validation_rows), "validationGroupCount": validation_group_count, "modelId": model_identity[0], "modelRevision": model_identity[1], "temperature": artifact["temperature"], "meanNllImprovement": artifact["fit"]["meanNllImprovement"], "eligibleForReview": artifact["fit"]["eligibleForReview"], "promoted": False}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, RuntimeError, nli_eval.urllib.error.URLError, nli_eval.urllib.error.HTTPError, json.JSONDecodeError) as exc:
        print(f"research NLI calibration failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
