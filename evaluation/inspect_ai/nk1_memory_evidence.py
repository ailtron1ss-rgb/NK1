"""Independent, query-level scorer for NK1 bilingual MemoryOS2 holdout evidence.

The producer is NK1's existing MemoryRetrievalBenchmark. This module never
retrieves memories itself: it verifies the hashed paired traces and independently
recomputes ranking, abstention, leakage, and paired-bootstrap metrics.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from nk1_evidence import canonical_json

DIGEST_RE = re.compile(r"^[a-f0-9]{64}$")
LANGUAGES = ("en", "ru")
DEFAULT_MIN_TRAIN = 4
DEFAULT_MIN_ANSWERABLE = 20
DEFAULT_MIN_UNANSWERABLE = 8


def _is_int(value: Any, minimum: int = 0) -> bool:
    return type(value) is int and value >= minimum


def _valid_digest(value: Any) -> bool:
    return isinstance(value, str) and bool(DIGEST_RE.fullmatch(value))


def _interval(values: list[float], samples: int, seed: int) -> dict[str, float | int]:
    if not values:
        return {"samples": 0, "lowerBound01": 0.0, "medianDelta01": 0.0, "upperBound01": 0.0}
    count = max(200, min(5000, int(samples)))
    state = (int(seed) & 0xFFFFFFFF) or 0x6D2B79F5
    deltas: list[float] = []
    n = len(values)
    for _ in range(count):
        total = 0.0
        for _ in range(n):
            state ^= (state << 13) & 0xFFFFFFFF
            state ^= state >> 17
            state ^= (state << 5) & 0xFFFFFFFF
            state &= 0xFFFFFFFF
            index = int((state / 4294967296.0) * n)
            total += values[index]
        deltas.append(total / n)
    deltas.sort()
    def at(percentile: float) -> float:
        index = min(len(deltas) - 1, max(0, int((len(deltas) - 1) * percentile)))
        return round(deltas[index], 4)
    return {
        "samples": count,
        "lowerBound01": at(0.025),
        "medianDelta01": at(0.5),
        "upperBound01": at(0.975),
    }


def _rank_metrics(rows: list[dict[str, Any]], arm_key: str, corpus_ids: set[str]) -> dict[str, Any]:
    answerable_outcomes: list[tuple[float, float]] = []
    unsupported: list[float] = []
    unsafe_count = 0
    unknown_result_count = 0
    duplicate_result_count = 0
    valid = True
    for row in rows:
        ranked = row.get(arm_key)
        if not isinstance(ranked, list):
            valid = False
            continue
        ids: list[str] = []
        for item in ranked:
            if not isinstance(item, dict) or not _valid_digest(item.get("memoryIdDigest")):
                valid = False
                continue
            memory_id = item["memoryIdDigest"]
            if memory_id not in corpus_ids:
                unknown_result_count += 1
                valid = False
            if memory_id in ids:
                duplicate_result_count += 1
                valid = False
            ids.append(memory_id)
            if arm_key == "candidateRankedMemory" and any(item.get(flag) is True for flag in (
                "quarantined", "stale", "future", "dormant", "invalidEpistemicStatus"
            )):
                unsafe_count += 1
        relevant = set(row.get("relevantMemoryIdDigests", []))
        is_answerable = row.get("answerable") is True
        if is_answerable:
            if not relevant:
                valid = False
                continue
            hits = relevant.intersection(ids)
            recall = len(hits) / len(relevant)
            first = next((index for index, memory_id in enumerate(ids) if memory_id in relevant), None)
            reciprocal_rank = 0.0 if first is None else 1.0 / (first + 1)
            answerable_outcomes.append((recall, reciprocal_rank))
        else:
            if relevant:
                valid = False
            unsupported.append(1.0 if ids else 0.0)
    denominator = max(1, len(answerable_outcomes))
    unsupported_denominator = max(1, len(unsupported))
    return {
        "valid": valid,
        "queries": len(rows),
        "answerableQueries": len(answerable_outcomes),
        "unanswerableQueries": len(unsupported),
        "recallAtK01": round(sum(value[0] for value in answerable_outcomes) / denominator, 4),
        "mrr01": round(sum(value[1] for value in answerable_outcomes) / denominator, 4),
        "unsupportedRetrievalRate01": round(sum(unsupported) / unsupported_denominator, 4),
        "unsafeCandidateResultCount": unsafe_count,
        "unknownResultCount": unknown_result_count,
        "duplicateResultCount": duplicate_result_count,
        "recallOutcomes": [value[0] for value in answerable_outcomes],
        "mrrOutcomes": [value[1] for value in answerable_outcomes],
        "unsupportedOutcomes": unsupported,
    }


def score_memory_holdout(record: dict[str, Any]) -> dict[str, Any]:
    """Independently re-score the bilingual, hashed, paired-query holdout."""
    if not isinstance(record, dict) or record.get("kind") != "memory-holdout-bilingual":
        return {"valid": False, "promotionEligible": False, "reason": "memory-sample-kind-invalid"}
    dataset = record.get("dataset")
    corpus = record.get("corpus")
    integrity = record.get("integrity")
    experiment = record.get("experiment")
    train = record.get("train")
    holdout = record.get("holdout")
    if not all(isinstance(value, dict) for value in (dataset, corpus, integrity, experiment)):
        return {"valid": False, "promotionEligible": False, "reason": "memory-sample-metadata-missing"}
    if not isinstance(train, list) or not isinstance(holdout, list) or len(train) + len(holdout) > 512:
        return {"valid": False, "promotionEligible": False, "reason": "memory-sample-query-sets-invalid"}

    dataset_fingerprint = dataset.get("fingerprint")
    corpus_fingerprint = corpus.get("fingerprint")
    if not _valid_digest(dataset_fingerprint) or not _valid_digest(corpus_fingerprint):
        return {"valid": False, "promotionEligible": False, "reason": "memory-fingerprint-invalid"}
    corpus_ids_raw = corpus.get("memoryIdDigests")
    if not isinstance(corpus_ids_raw, list) or not corpus_ids_raw or not all(_valid_digest(value) for value in corpus_ids_raw):
        return {"valid": False, "promotionEligible": False, "reason": "memory-corpus-id-digests-invalid"}
    if len(corpus_ids_raw) != len(set(corpus_ids_raw)):
        return {"valid": False, "promotionEligible": False, "reason": "memory-corpus-id-digests-duplicate"}
    corpus_ids = set(corpus_ids_raw)
    if not _is_int(corpus.get("size"), 1) or corpus["size"] != len(corpus_ids):
        return {"valid": False, "promotionEligible": False, "reason": "memory-corpus-size-mismatch"}

    provenance = dataset.get("provenance")
    if not isinstance(provenance, dict):
        provenance = {}
    required_provenance = ("datasetId", "datasetVersion", "sourceRef", "labelingProtocol", "licenseId")
    provenance_complete = all(isinstance(provenance.get(key), str) and provenance[key].strip() for key in required_provenance)
    content_hash_valid = (
        _valid_digest(provenance.get("contentSha256"))
        and provenance.get("contentSha256") == dataset_fingerprint
        and provenance.get("contentHashValid") is True
    )
    source_ref = str(provenance.get("sourceRef", "")).lower()
    synthetic_source = any(token in source_ref for token in (
        "fixture", "synthetic", "test-only", "hand-authored", "ci-generated",
    ))
    provenance_valid = provenance_complete and content_hash_valid and not synthetic_source

    threshold = experiment.get("thresholds") if isinstance(experiment.get("thresholds"), dict) else {}
    min_train = int(threshold.get("minimumTrainQueriesPerLanguage", DEFAULT_MIN_TRAIN))
    min_answerable = int(threshold.get("minimumAnswerableHoldoutQueriesPerLanguage", DEFAULT_MIN_ANSWERABLE))
    min_unanswerable = int(threshold.get("minimumUnanswerableHoldoutQueriesPerLanguage", DEFAULT_MIN_UNANSWERABLE))
    min_holdout = int(threshold.get("minimumHoldoutQueries", min_answerable * len(LANGUAGES)))
    min_total_unanswerable = int(threshold.get("minimumUnanswerableHoldoutQueries", min_unanswerable * len(LANGUAGES)))
    min_uplift = float(threshold.get("minimumRecallUplift01", 0.02))
    max_mrr_regression = float(threshold.get("maximumMrrRegression01", 0.01))
    max_unsupported_regression = float(threshold.get("maximumUnsupportedRetrievalRegression01", 0.0))
    seeds = experiment.get("seeds")
    bootstrap_samples = experiment.get("bootstrapSamplesPerSeed")
    k = experiment.get("k")
    if not isinstance(seeds, list) or len(seeds) < 3 or len(seeds) > 9 or not all(
        _is_int(seed, 1) and seed <= 0xFFFFFFFF for seed in seeds
    ) or len(seeds) != len(set(seeds)):
        return {"valid": False, "promotionEligible": False, "reason": "memory-bootstrap-seeds-invalid"}
    if not _is_int(bootstrap_samples, 200) or bootstrap_samples > 5000:
        return {"valid": False, "promotionEligible": False, "reason": "memory-bootstrap-sample-count-invalid"}
    if not _is_int(k, 1) or k > 10:
        return {"valid": False, "promotionEligible": False, "reason": "memory-retrieval-k-invalid"}
    if not _valid_digest(experiment.get("retrievalConfigurationFingerprint")) or not _valid_digest(experiment.get("baselineConfigurationFingerprint")):
        return {"valid": False, "promotionEligible": False, "reason": "memory-retrieval-configuration-fingerprint-invalid"}
    if not (
        4 <= min_train <= 32 and 20 <= min_answerable <= 64 and 8 <= min_unanswerable <= 32
        and min_holdout >= min_answerable * len(LANGUAGES)
        and min_total_unanswerable >= min_unanswerable * len(LANGUAGES)
        and 0 <= min_uplift <= 0.25 and 0 <= max_mrr_regression <= 0.1
        and 0 <= max_unsupported_regression <= 0.25
    ):
        return {"valid": False, "promotionEligible": False, "reason": "memory-thresholds-invalid"}

    train_keys: dict[str, set[str]] = {language: set() for language in LANGUAGES}
    train_ids: set[str] = set()
    rows_by_language: dict[str, list[dict[str, Any]]] = {language: [] for language in LANGUAGES}
    all_train_query_digests: set[str] = set()
    all_holdout_query_digests: set[str] = set()
    all_example_ids: set[str] = set()
    train_duplicate_query = False
    holdout_duplicate_query = False
    malformed = 0

    for row in train:
        if not isinstance(row, dict) or row.get("split") != "train" or row.get("language") not in LANGUAGES:
            malformed += 1
            continue
        if not _valid_digest(row.get("queryDigest")) or not _valid_digest(row.get("exampleIdDigest")):
            malformed += 1
            continue
        query_digest = row["queryDigest"]
        example_id = row["exampleIdDigest"]
        if query_digest in all_train_query_digests or example_id in all_example_ids:
            train_duplicate_query = True
            malformed += 1
            continue
        all_train_query_digests.add(query_digest)
        all_example_ids.add(example_id)
        train_ids.add(example_id)
        train_keys[row["language"]].add(query_digest)

    for row in holdout:
        if not isinstance(row, dict) or row.get("split") != "holdout" or row.get("language") not in LANGUAGES:
            malformed += 1
            continue
        if not _valid_digest(row.get("queryDigest")) or not _valid_digest(row.get("exampleIdDigest")):
            malformed += 1
            continue
        query_digest = row["queryDigest"]
        example_id = row["exampleIdDigest"]
        if query_digest in all_holdout_query_digests or example_id in all_example_ids:
            holdout_duplicate_query = True
            malformed += 1
            continue
        all_holdout_query_digests.add(query_digest)
        all_example_ids.add(example_id)
        relevant = row.get("relevantMemoryIdDigests")
        if not isinstance(relevant, list) or not all(_valid_digest(value) for value in relevant):
            malformed += 1
            continue
        if len(relevant) != len(set(relevant)) or not set(relevant).issubset(corpus_ids):
            malformed += 1
            continue
        answerable = row.get("answerable")
        if type(answerable) is not bool or (answerable and not relevant) or (not answerable and relevant):
            malformed += 1
            continue
        valid_row = True
        for arm_key in ("baselineRankedMemory", "candidateRankedMemory"):
            ranked = row.get(arm_key)
            if not isinstance(ranked, list) or len(ranked) > k:
                valid_row = False
                break
            for item in ranked:
                if not isinstance(item, dict) or not _valid_digest(item.get("memoryIdDigest")):
                    valid_row = False
                    break
                if not isinstance(item.get("quarantined"), bool) or not isinstance(item.get("stale"), bool) \
                    or not isinstance(item.get("future"), bool) or not isinstance(item.get("dormant"), bool) \
                    or not isinstance(item.get("invalidEpistemicStatus"), bool):
                    valid_row = False
                    break
        if not valid_row:
            malformed += 1
            continue
        rows_by_language[row["language"]].append(row)

    train_holdout_query_leakage = bool(all_train_query_digests.intersection(all_holdout_query_digests))
    if train_holdout_query_leakage:
        malformed += 1

    language_reports: dict[str, Any] = {}
    all_single_run_eligible = True
    all_language_structural = True
    for language in LANGUAGES:
        rows = rows_by_language[language]
        train_unique = len(train_keys[language])
        baseline = _rank_metrics(rows, "baselineRankedMemory", corpus_ids)
        candidate = _rank_metrics(rows, "candidateRankedMemory", corpus_ids)
        answerable_count = candidate["answerableQueries"]
        unanswerable_count = candidate["unanswerableQueries"]
        recall_delta = round(candidate["recallAtK01"] - baseline["recallAtK01"], 4)
        mrr_delta = round(candidate["mrr01"] - baseline["mrr01"], 4)
        unsupported_delta = round(candidate["unsupportedRetrievalRate01"] - baseline["unsupportedRetrievalRate01"], 4)
        recall_deltas = [
            candidate["recallOutcomes"][index] - baseline["recallOutcomes"][index]
            for index in range(min(len(candidate["recallOutcomes"]), len(baseline["recallOutcomes"])))
        ]
        mrr_deltas = [
            candidate["mrrOutcomes"][index] - baseline["mrrOutcomes"][index]
            for index in range(min(len(candidate["mrrOutcomes"]), len(baseline["mrrOutcomes"])))
        ]
        unsupported_deltas = [
            candidate["unsupportedOutcomes"][index] - baseline["unsupportedOutcomes"][index]
            for index in range(min(len(candidate["unsupportedOutcomes"]), len(baseline["unsupportedOutcomes"])))
        ]

        # Match NK1's separate EN/RU bootstrap streams, while recomputing them
        # from the hashed per-query paired outcomes rather than trusting report gates.
        language_seed_xor = 0x13579BDF if language == "en" else 0x2468ACE0
        recall_intervals = []
        mrr_intervals = []
        unsupported_intervals = []
        for seed in seeds:
            language_seed = ((seed ^ language_seed_xor) & 0xFFFFFFFF) or 1
            recall_intervals.append(_interval(recall_deltas, bootstrap_samples, language_seed))
            mrr_intervals.append(_interval(mrr_deltas, bootstrap_samples, language_seed ^ 0x9E3779B9))
            unsupported_intervals.append(_interval(unsupported_deltas, bootstrap_samples, language_seed ^ 0x85EBCA6B))

        recall_confident = all(float(interval["lowerBound01"]) > 0 for interval in recall_intervals)
        mrr_noninferior = all(float(interval["lowerBound01"]) >= -max_mrr_regression for interval in mrr_intervals)
        abstention_noninferior = all(float(interval["upperBound01"]) <= max_unsupported_regression for interval in unsupported_intervals)
        no_unsafe = candidate["unsafeCandidateResultCount"] == 0
        paired_valid = baseline["valid"] and candidate["valid"]
        language_leakage = bool(train_keys[language].intersection({
            row["queryDigest"] for row in rows
        }))
        gates = {
            "sufficientTrainQueries": train_unique >= min_train,
            "sufficientAnswerableHoldoutQueries": answerable_count >= min_answerable,
            "sufficientUnanswerableHoldoutQueries": unanswerable_count >= min_unanswerable,
            "minimumRecallUplift": recall_delta >= min_uplift,
            "recallUpliftConfidenceSupported": recall_confident,
            "mrrPointEstimateNonInferior": mrr_delta >= -max_mrr_regression,
            "mrrConfidenceNonInferioritySupported": mrr_noninferior,
            "noUnsafeCandidateResults": no_unsafe,
            "abstentionNonInferiority": unsupported_delta <= max_unsupported_regression,
            "abstentionConfidenceNonInferioritySupported": abstention_noninferior,
            "pairedArmsAreStructurallyValid": paired_valid,
            "noTrainHoldoutQueryLeakage": not language_leakage and not train_holdout_query_leakage,
        }
        language_eligible = all(gates.values())
        all_single_run_eligible = all_single_run_eligible and language_eligible
        all_language_structural = all_language_structural and paired_valid and not language_leakage
        language_reports[language] = {
            "trainQueries": train_unique,
            "answerableHoldoutQueries": answerable_count,
            "unanswerableHoldoutQueries": unanswerable_count,
            "baseline": {key: baseline[key] for key in ("recallAtK01", "mrr01", "unsupportedRetrievalRate01")},
            "candidate": {key: candidate[key] for key in ("recallAtK01", "mrr01", "unsupportedRetrievalRate01")},
            "deltas": {"recallAtK01": recall_delta, "mrr01": mrr_delta, "unsupportedRetrievalRate01": unsupported_delta},
            "pairedBootstrap": {
                "recallLowerBoundMin01": min(float(value["lowerBound01"]) for value in recall_intervals),
                "recallPracticalUpliftAcrossSeeds": all(float(value["lowerBound01"]) >= min_uplift for value in recall_intervals),
                "mrrLowerBoundMin01": min(float(value["lowerBound01"]) for value in mrr_intervals),
                "unsupportedUpperBoundMax01": max(float(value["upperBound01"]) for value in unsupported_intervals),
                "seedCount": len(seeds),
            },
            "unsafeCandidateResultCount": candidate["unsafeCandidateResultCount"],
            "gates": gates,
            "promotionEligible": language_eligible,
        }

    baseline_all = _rank_metrics(holdout, "baselineRankedMemory", corpus_ids)
    candidate_all = _rank_metrics(holdout, "candidateRankedMemory", corpus_ids)
    aggregate_recall_deltas = [
        candidate_all["recallOutcomes"][index] - baseline_all["recallOutcomes"][index]
        for index in range(min(len(candidate_all["recallOutcomes"]), len(baseline_all["recallOutcomes"])))
    ]
    aggregate_mrr_deltas = [
        candidate_all["mrrOutcomes"][index] - baseline_all["mrrOutcomes"][index]
        for index in range(min(len(candidate_all["mrrOutcomes"]), len(baseline_all["mrrOutcomes"])))
    ]
    aggregate_unsupported_deltas = [
        candidate_all["unsupportedOutcomes"][index] - baseline_all["unsupportedOutcomes"][index]
        for index in range(min(len(candidate_all["unsupportedOutcomes"]), len(baseline_all["unsupportedOutcomes"])))
    ]
    aggregate_recall_intervals = [_interval(aggregate_recall_deltas, bootstrap_samples, seed) for seed in seeds]
    aggregate_mrr_intervals = [_interval(aggregate_mrr_deltas, bootstrap_samples, seed ^ 0x9E3779B9) for seed in seeds]
    aggregate_unsupported_intervals = [_interval(aggregate_unsupported_deltas, bootstrap_samples, seed ^ 0x85EBCA6B) for seed in seeds]

    answerable_total = candidate_all["answerableQueries"]
    unanswerable_total = candidate_all["unanswerableQueries"]
    aggregate_recall_delta = round(candidate_all["recallAtK01"] - baseline_all["recallAtK01"], 4)
    aggregate_mrr_delta = round(candidate_all["mrr01"] - baseline_all["mrr01"], 4)
    aggregate_unsupported_delta = round(candidate_all["unsupportedRetrievalRate01"] - baseline_all["unsupportedRetrievalRate01"], 4)
    aggregate_gates = {
        "sufficientAnswerableHoldout": answerable_total >= min_holdout,
        "sufficientUnanswerableHoldout": unanswerable_total >= min_total_unanswerable,
        "minimumRecallUplift": aggregate_recall_delta >= min_uplift,
        "recallUpliftConfidenceSupported": all(float(value["lowerBound01"]) > 0 for value in aggregate_recall_intervals),
        "practicalRecallUpliftAcrossSeeds": all(float(value["lowerBound01"]) >= min_uplift for value in aggregate_recall_intervals),
        "mrrPointEstimateNonInferior": aggregate_mrr_delta >= -max_mrr_regression,
        "mrrConfidenceNonInferioritySupported": all(float(value["lowerBound01"]) >= -max_mrr_regression for value in aggregate_mrr_intervals),
        "noUnsafeCandidateResults": candidate_all["unsafeCandidateResultCount"] == 0,
        "abstentionNonInferiority": aggregate_unsupported_delta <= max_unsupported_regression,
        "abstentionConfidenceNonInferioritySupported": all(float(value["upperBound01"]) <= max_unsupported_regression for value in aggregate_unsupported_intervals),
        "pairedArmsAreStructurallyValid": baseline_all["valid"] and candidate_all["valid"],
        "noTrainHoldoutQueryLeakage": not train_holdout_query_leakage,
    }
    all_single_run_eligible = all_single_run_eligible and all(aggregate_gates.values())

    dataset_integrity_valid = integrity.get("datasetValidForPromotion") is True
    corpus_integrity_valid = integrity.get("corpusValidForPromotion") is True
    deterministic = integrity.get("retrievalMetricsDeterministicAcrossSeeds") is True
    fingerprints_stable = integrity.get("datasetCorpusAndRetrievalConfigurationFingerprintsStableAcrossSeeds") is True
    gates = {
        "wellFormedEvidence": malformed == 0,
        "datasetIntegrity": dataset_integrity_valid,
        "corpusIntegrity": corpus_integrity_valid,
        "datasetProvenance": provenance_valid,
        "notSyntheticTestData": not synthetic_source,
        "retrievalMetricsDeterministicAcrossSeeds": deterministic,
        "datasetCorpusAndRetrievalConfigurationFingerprintsStableAcrossSeeds": fingerprints_stable,
        "englishAndRussianHoldoutEligible": all_single_run_eligible and all_language_structural,
    }
    valid = (
        malformed == 0
        and all_language_structural
        and aggregate_gates["pairedArmsAreStructurallyValid"]
        and aggregate_gates["noTrainHoldoutQueryLeakage"]
    )
    promotion_eligible = valid and all(gates.values())
    return {
        "valid": valid,
        "promotionEligible": promotion_eligible,
        "evaluationClass": "synthetic-test-only" if synthetic_source else "external-labelled-holdout",
        "reason": "all-independent-memory-quality-gates-passed" if promotion_eligible else "independent-memory-quality-gates-not-met",
        "languages": language_reports,
        "aggregate": {
            "answerableHoldoutQueries": answerable_total,
            "unanswerableHoldoutQueries": unanswerable_total,
            "baseline": {key: baseline_all[key] for key in ("recallAtK01", "mrr01", "unsupportedRetrievalRate01")},
            "candidate": {key: candidate_all[key] for key in ("recallAtK01", "mrr01", "unsupportedRetrievalRate01")},
            "deltas": {"recallAtK01": aggregate_recall_delta, "mrr01": aggregate_mrr_delta, "unsupportedRetrievalRate01": aggregate_unsupported_delta},
            "pairedBootstrap": {
                "recallLowerBoundMin01": min(float(value["lowerBound01"]) for value in aggregate_recall_intervals),
                "practicalUpliftSupportedAcrossAllSeeds": aggregate_gates["practicalRecallUpliftAcrossSeeds"],
                "mrrLowerBoundMin01": min(float(value["lowerBound01"]) for value in aggregate_mrr_intervals),
                "unsupportedUpperBoundMax01": max(float(value["upperBound01"]) for value in aggregate_unsupported_intervals),
            },
            "gates": aggregate_gates,
        },
        "gates": gates,
        "malformedRows": malformed,
    }

def samples_from_memory_report(report: dict[str, Any]) -> list[dict[str, str]]:
    if not isinstance(report, dict) or report.get("schemaVersion") != 1:
        raise ValueError("unsupported-memory-experiment-report")
    if report.get("mode") != "offline-clone; no-live-state-mutation; no-automatic-promotion":
        raise ValueError("memory-experiment-mode-invalid")
    query_evidence = report.get("queryEvidence")
    if not isinstance(query_evidence, dict) or query_evidence.get("schemaVersion") != 1:
        raise ValueError("hashed-memory-query-evidence-required")
    if query_evidence.get("digestAlgorithm") != "hmac-sha256-ephemeral-per-experiment":
        raise ValueError("memory-query-evidence-must-use-ephemeral-hmac")
    if query_evidence.get("queryNormalization") != "NFKC-lower-punctuation-symbol-and-whitespace-normalization":
        raise ValueError("memory-query-evidence-normalization-mismatch")
    if query_evidence.get("datasetFingerprint") != report.get("datasetFingerprint"):
        raise ValueError("memory-query-evidence-dataset-fingerprint-mismatch")
    if query_evidence.get("corpusFingerprint") != report.get("corpusFingerprint"):
        raise ValueError("memory-query-evidence-corpus-fingerprint-mismatch")
    if not _valid_digest(query_evidence.get("retrievalConfigurationFingerprint")):
        raise ValueError("memory-retrieval-configuration-fingerprint-missing")
    if not _valid_digest(query_evidence.get("baselineConfigurationFingerprint")):
        raise ValueError("memory-baseline-configuration-fingerprint-missing")
    provenance = report.get("datasetProvenance") if isinstance(report.get("datasetProvenance"), dict) else {}
    integrity = {
        "datasetValidForPromotion": bool((report.get("datasetIntegrity") or {}).get("validForPromotion")),
        "corpusValidForPromotion": bool((report.get("corpusIntegrity") or {}).get("validForPromotion")),
        "retrievalMetricsDeterministicAcrossSeeds": bool((report.get("determinism") or {}).get("retrievalQualityMetricsStableAcrossSeeds")),
        "datasetCorpusAndRetrievalConfigurationFingerprintsStableAcrossSeeds": bool((report.get("determinism") or {}).get("datasetCorpusAndRetrievalConfigurationFingerprintsStableAcrossSeeds")),
    }
    sample = {
        "kind": "memory-holdout-bilingual",
        "dataset": {
            "fingerprint": report.get("datasetFingerprint"),
            "provenance": {
                "datasetId": provenance.get("datasetId", ""),
                "datasetVersion": provenance.get("datasetVersion", ""),
                "sourceRef": provenance.get("sourceRef", ""),
                "labelingProtocol": provenance.get("labelingProtocol", ""),
                "licenseId": provenance.get("licenseId", ""),
                "contentSha256": provenance.get("contentSha256", ""),
                "contentHashValid": provenance.get("contentHashValid") is True,
            },
        },
        "corpus": {
            "fingerprint": report.get("corpusFingerprint"),
            "size": report.get("corpusSize"),
            "memoryIdDigests": query_evidence.get("corpusMemoryIdDigests"),
        },
        "integrity": integrity,
        "experiment": {
            "k": query_evidence.get("k"),
            "retrievalConfigurationFingerprint": query_evidence.get("retrievalConfigurationFingerprint"),
            "baselineConfigurationFingerprint": query_evidence.get("baselineConfigurationFingerprint"),
            "seeds": report.get("seeds"),
            "bootstrapSamplesPerSeed": report.get("bootstrapSamplesPerSeed"),
            "thresholds": {
                **(report.get("evaluationThresholds") if isinstance(report.get("evaluationThresholds"), dict) else {}),
                "minimumTrainQueriesPerLanguage": int((report.get("evaluationThresholds") or {}).get("minimumTrainQueriesPerLanguage", 4)),
                "minimumAnswerableHoldoutQueriesPerLanguage": int((report.get("evaluationThresholds") or {}).get("minimumAnswerableHoldoutQueriesPerLanguage", 20)),
                "minimumUnanswerableHoldoutQueriesPerLanguage": int((report.get("evaluationThresholds") or {}).get("minimumUnanswerableHoldoutQueriesPerLanguage", 8)),
                "minimumRecallUplift01": float((report.get("evaluationThresholds") or {}).get("minimumRecallUplift01", 0.02)),
                "maximumMrrRegression01": float((report.get("evaluationThresholds") or {}).get("maximumMrrRegression01", (report.get("sensitivity") or {}).get("maximumMrrRegression01", 0.01))),
                "maximumUnsupportedRetrievalRegression01": float((report.get("evaluationThresholds") or {}).get("maximumUnsupportedRetrievalRegression01", 0.0)),
                "minimumHoldoutQueries": int((report.get("evaluationThresholds") or {}).get("minimumHoldoutQueries", 40)),
                "minimumUnanswerableHoldoutQueries": int((report.get("evaluationThresholds") or {}).get("minimumUnanswerableHoldoutQueries", 16)),
            },
        },
        "train": query_evidence.get("train"),
        "holdout": query_evidence.get("holdout"),
    }
    return [{"id": "nk1-memory-bilingual-holdout", "input": canonical_json(sample), "target": "independent-memory-retrieval-audit"}]


def build_ci_fixture_report() -> dict[str, Any]:
    """Clearly synthetic, deterministic scorer fixture; never real promotion evidence."""
    def fixture_digest(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    corpus_ids = [fixture_digest(f"workpass73-ci-memory-{index}") for index in range(64)]
    train: list[dict[str, Any]] = []
    holdout: list[dict[str, Any]] = []
    for language in LANGUAGES:
        for index in range(4):
            train.append({
                "exampleIdDigest": fixture_digest(f"{language}-train-id-{index}"),
                "queryDigest": fixture_digest(f"{language}-train-query-{index}"),
                "language": language,
                "split": "train",
            })
        for index in range(20):
            target = corpus_ids[index + (0 if language == "en" else 20)]
            holdout.append({
                "exampleIdDigest": fixture_digest(f"{language}-answerable-id-{index}"),
                "queryDigest": fixture_digest(f"{language}-answerable-query-{index}"),
                "language": language,
                "split": "holdout",
                "answerable": True,
                "relevantMemoryIdDigests": [target],
                "baselineRankedMemory": [],
                "candidateRankedMemory": [{
                    "memoryIdDigest": target,
                    "quarantined": False,
                    "stale": False,
                    "future": False,
                    "dormant": False,
                    "invalidEpistemicStatus": False,
                }],
            })
        for index in range(8):
            holdout.append({
                "exampleIdDigest": fixture_digest(f"{language}-unanswerable-id-{index}"),
                "queryDigest": fixture_digest(f"{language}-unanswerable-query-{index}"),
                "language": language,
                "split": "holdout",
                "answerable": False,
                "relevantMemoryIdDigests": [],
                "baselineRankedMemory": [],
                "candidateRankedMemory": [],
            })
    dataset_fingerprint = fixture_digest("workpass73-synthetic-ci-dataset")
    corpus_fingerprint = fixture_digest("workpass73-synthetic-ci-corpus")
    query_evidence = {
        "schemaVersion": 1,
        "digestAlgorithm": "hmac-sha256-ephemeral-per-experiment",
        "queryNormalization": "NFKC-lower-punctuation-symbol-and-whitespace-normalization",
        "k": 5,
        "datasetFingerprint": dataset_fingerprint,
        "corpusFingerprint": corpus_fingerprint,
        "retrievalConfigurationFingerprint": fixture_digest("workpass73-ci-config"),
        "baselineConfigurationFingerprint": fixture_digest("workpass73-ci-bm25-config"),
        "corpusMemoryIdDigests": corpus_ids,
        "train": train,
        "holdout": holdout,
    }
    return {
        "schemaVersion": 1,
        "experiment": "memoryos2-retrieval-bootstrap-seed-sensitivity",
        "mode": "offline-clone; no-live-state-mutation; no-automatic-promotion",
        "datasetFingerprint": dataset_fingerprint,
        "corpusFingerprint": corpus_fingerprint,
        "corpusSize": len(corpus_ids),
        "datasetProvenance": {
            "datasetId": "workpass73-ci-fixture",
            "datasetVersion": "synthetic-1",
            "sourceRef": "synthetic://ci-fixture",
            "labelingProtocol": "synthetic generated scorer contract; not an external annotation protocol",
            "licenseId": "LicenseRef-NK1-CI-Fixture",
            "contentSha256": dataset_fingerprint,
            "contentHashValid": True,
        },
        "datasetIntegrity": {"validForPromotion": True},
        "corpusIntegrity": {"validForPromotion": True},
        "determinism": {"retrievalQualityMetricsStableAcrossSeeds": True},
        "seeds": [13, 29, 53, 71, 101],
        "bootstrapSamplesPerSeed": 200,
        "evaluationThresholds": {
            "minimumTrainQueriesPerLanguage": 4,
            "minimumAnswerableHoldoutQueriesPerLanguage": 20,
            "minimumUnanswerableHoldoutQueriesPerLanguage": 8,
            "minimumHoldoutQueries": 40,
            "minimumUnanswerableHoldoutQueries": 16,
            "minimumRecallUplift01": 0.02,
            "maximumMrrRegression01": 0.01,
            "maximumUnsupportedRetrievalRegression01": 0.0,
        },
        "sensitivity": {"maximumMrrRegression01": 0.01},
        "queryEvidence": query_evidence,
    }


def export_memory_report(source: Path, destination: Path) -> dict[str, Any]:
    report = json.loads(source.read_text(encoding="utf-8"))
    samples = samples_from_memory_report(report)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=destination.name + ".", suffix=".tmp", dir=str(destination.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            for sample in samples:
                handle.write(canonical_json(sample) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, destination)
    except Exception:
        try:
            os.unlink(temporary_name)
        except OSError:
            pass
        raise
    return {"samples": len(samples), "datasetFingerprint": report.get("datasetFingerprint"), "corpusFingerprint": report.get("corpusFingerprint")}


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Validate/export NK1 MemoryOS2 holdout traces for Inspect AI")
    parser.add_argument("source", nargs="?", default="evaluation/inspect_ai/memory-report.json")
    parser.add_argument("--output", default="evaluation/inspect_ai/memory-samples.jsonl")
    parser.add_argument("--ci-fixture", action="store_true", help="emit a synthetic-only scorer contract fixture")
    args = parser.parse_args()
    if args.ci_fixture:
        report = build_ci_fixture_report()
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        samples = samples_from_memory_report(report)
        fd, temporary_name = tempfile.mkstemp(prefix=output.name + ".", suffix=".tmp", dir=str(output.parent))
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
                for sample in samples:
                    handle.write(canonical_json(sample) + "\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_name, output)
        except Exception:
            try:
                os.unlink(temporary_name)
            except OSError:
                pass
            raise
        result = {"samples":len(samples),"datasetFingerprint":report["datasetFingerprint"]}
    else:
        result = export_memory_report(Path(args.source), Path(args.output))
    print(f"NK1_MEMORY_INSPECT_EXPORT=PASS samples={result['samples']} dataset={result['datasetFingerprint']} synthetic_fixture={args.ci_fixture}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
