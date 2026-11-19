from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nk1_memory_evidence import build_ci_fixture_report, score_memory_holdout, samples_from_memory_report, export_memory_report


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def make_record(source_ref: str = "https://datasets.example.org/nk1-memory-v1") -> dict:
    corpus_ids = [digest(f"memory-{index}") for index in range(32)]
    train = []
    holdout = []
    for language in ("en", "ru"):
        for index in range(4):
            train.append({
                "exampleIdDigest": digest(f"{language}-train-id-{index}"),
                "queryDigest": digest(f"{language}-train-query-{index}"),
                "language": language,
                "split": "train",
            })
        for index in range(20):
            query_digest = digest(f"{language}-answerable-query-{index}")
            relevant = corpus_ids[index]
            holdout.append({
                "exampleIdDigest": digest(f"{language}-answerable-id-{index}"),
                "queryDigest": query_digest,
                "language": language,
                "split": "holdout",
                "answerable": True,
                "relevantMemoryIdDigests": [relevant],
                "baselineRankedMemory": [],
                "candidateRankedMemory": [{
                    "memoryIdDigest": relevant,
                    "quarantined": False,
                    "stale": False,
                    "future": False,
                    "dormant": False,
                    "invalidEpistemicStatus": False,
                }],
            })
        for index in range(8):
            holdout.append({
                "exampleIdDigest": digest(f"{language}-unanswerable-id-{index}"),
                "queryDigest": digest(f"{language}-unanswerable-query-{index}"),
                "language": language,
                "split": "holdout",
                "answerable": False,
                "relevantMemoryIdDigests": [],
                "baselineRankedMemory": [],
                "candidateRankedMemory": [],
            })
    dataset_fingerprint = digest("dataset-fingerprint")
    corpus_fingerprint = digest("corpus-fingerprint")
    return {
        "kind": "memory-holdout-bilingual",
        "dataset": {
            "fingerprint": dataset_fingerprint,
            "provenance": {
                "datasetId": "nk1-external-memory-holdout",
                "datasetVersion": "1.0.0",
                "sourceRef": source_ref,
                "labelingProtocol": "independent dual annotation with conflict adjudication",
                "licenseId": "CC-BY-4.0",
                "contentSha256": dataset_fingerprint,
                "contentHashValid": True,
            },
        },
        "corpus": {
            "fingerprint": corpus_fingerprint,
            "size": len(corpus_ids),
            "memoryIdDigests": corpus_ids,
        },
        "integrity": {
            "datasetValidForPromotion": True,
            "corpusValidForPromotion": True,
            "retrievalMetricsDeterministicAcrossSeeds": True,
            "datasetCorpusAndRetrievalConfigurationFingerprintsStableAcrossSeeds": True,
        },
        "experiment": {
            "k": 5,
            "retrievalConfigurationFingerprint": digest("retrieval-config"),
            "baselineConfigurationFingerprint": digest("bm25-config"),
            "seeds": [13, 29, 53, 71, 101],
            "bootstrapSamplesPerSeed": 2000,
            "thresholds": {
                "minimumTrainQueriesPerLanguage": 4,
                "minimumAnswerableHoldoutQueriesPerLanguage": 20,
                "minimumUnanswerableHoldoutQueriesPerLanguage": 8,
                "minimumRecallUplift01": 0.02,
                "maximumMrrRegression01": 0.01,
                "maximumUnsupportedRetrievalRegression01": 0.0,
            },
        },
        "train": train,
        "holdout": holdout,
    }


class MemoryHoldoutScoringTests(unittest.TestCase):
    def test_independent_scorer_recomputes_bilingual_recall_mrr_and_abstention(self):
        result = score_memory_holdout(make_record())
        self.assertTrue(result["valid"], result)
        self.assertTrue(result["promotionEligible"], result)
        self.assertEqual(result["languages"]["en"]["baseline"]["recallAtK01"], 0.0)
        self.assertEqual(result["languages"]["en"]["candidate"]["recallAtK01"], 1.0)
        self.assertEqual(result["languages"]["ru"]["candidate"]["mrr01"], 1.0)
        self.assertEqual(result["languages"]["en"]["candidate"]["unsupportedRetrievalRate01"], 0.0)
        self.assertTrue(result["gates"]["englishAndRussianHoldoutEligible"])

    def test_synthetic_fixture_is_valid_for_ci_but_never_promotion_evidence(self):
        result = score_memory_holdout(make_record("synthetic://ci-fixture"))
        self.assertTrue(result["valid"], result)
        self.assertFalse(result["promotionEligible"])
        self.assertEqual(result["evaluationClass"], "synthetic-test-only")
        self.assertFalse(result["gates"]["notSyntheticTestData"])

    def test_train_holdout_query_leakage_blocks_a_valid_promotion(self):
        record = make_record()
        record["train"][0]["queryDigest"] = record["holdout"][0]["queryDigest"]
        result = score_memory_holdout(record)
        self.assertFalse(result["valid"], result)
        self.assertFalse(result["promotionEligible"])
        self.assertFalse(result["languages"]["en"]["gates"]["noTrainHoldoutQueryLeakage"])

    def test_candidate_stale_or_quarantined_memory_blocks_promotion(self):
        record = make_record()
        record["holdout"][0]["candidateRankedMemory"][0]["stale"] = True
        result = score_memory_holdout(record)
        self.assertTrue(result["valid"], result)
        self.assertFalse(result["promotionEligible"])
        self.assertEqual(result["languages"]["en"]["unsafeCandidateResultCount"], 1)
        self.assertFalse(result["languages"]["en"]["gates"]["noUnsafeCandidateResults"])

    def test_unknown_memory_digest_and_duplicate_ranked_id_are_invalid(self):
        record = make_record()
        record["holdout"][0]["candidateRankedMemory"][0]["memoryIdDigest"] = digest("not-in-corpus")
        result = score_memory_holdout(record)
        self.assertFalse(result["valid"])
        record = make_record()
        duplicate = dict(record["holdout"][0]["candidateRankedMemory"][0])
        record["holdout"][0]["candidateRankedMemory"].append(duplicate)
        result = score_memory_holdout(record)
        self.assertFalse(result["valid"])

    def test_missing_answerable_or_unanswerable_minimums_do_not_qualify(self):
        record = make_record()
        record["holdout"] = [row for row in record["holdout"] if not (
            row["language"] == "ru" and row["answerable"] is False
        )][:]  # keep RU answerable rows, remove all RU unanswerable queries
        result = score_memory_holdout(record)
        self.assertTrue(result["valid"], result)
        self.assertFalse(result["promotionEligible"])
        self.assertFalse(result["languages"]["ru"]["gates"]["sufficientUnanswerableHoldoutQueries"])

    def test_ci_fixture_scores_as_structurally_valid_but_never_as_external_promotion_evidence(self):
        report = build_ci_fixture_report()
        sample = json.loads(samples_from_memory_report(report)[0]["input"])
        result = score_memory_holdout(sample)
        self.assertTrue(result["valid"], result)
        self.assertFalse(result["promotionEligible"])
        self.assertEqual(result["evaluationClass"], "synthetic-test-only")
        self.assertFalse(result["gates"]["notSyntheticTestData"])
        self.assertEqual(result["aggregate"]["answerableHoldoutQueries"], 40)
        self.assertEqual(result["aggregate"]["unanswerableHoldoutQueries"], 16)

    def test_report_export_uses_hashed_trace_and_omits_raw_query_fields(self):
        record = make_record()
        report = {
            "schemaVersion": 1,
            "mode": "offline-clone; no-live-state-mutation; no-automatic-promotion",
            "datasetFingerprint": record["dataset"]["fingerprint"],
            "corpusFingerprint": record["corpus"]["fingerprint"],
            "corpusSize": record["corpus"]["size"],
            "datasetProvenance": record["dataset"]["provenance"],
            "datasetIntegrity": {"validForPromotion": True},
            "corpusIntegrity": {"validForPromotion": True},
            "determinism": {"retrievalQualityMetricsStableAcrossSeeds": True},
            "seeds": record["experiment"]["seeds"],
            "bootstrapSamplesPerSeed": record["experiment"]["bootstrapSamplesPerSeed"],
            "sensitivity": {"maximumMrrRegression01": 0.01},
            "queryEvidence": {
                "schemaVersion": 1,
                "digestAlgorithm": "hmac-sha256-ephemeral-per-experiment",
                "queryNormalization": "NFKC-lower-punctuation-symbol-and-whitespace-normalization",
                "datasetFingerprint": record["dataset"]["fingerprint"],
                "corpusFingerprint": record["corpus"]["fingerprint"],
                "retrievalConfigurationFingerprint": digest("retrieval-config"),
                "baselineConfigurationFingerprint": digest("bm25-config"),
                "k": 5,
                "corpusMemoryIdDigests": record["corpus"]["memoryIdDigests"],
                "train": record["train"],
                "holdout": record["holdout"],
            },
        }
        samples = samples_from_memory_report(report)
        self.assertEqual(len(samples), 1)
        serialized = json.dumps(samples, sort_keys=True)
        self.assertNotIn("answerable-query-0", serialized)
        self.assertNotIn("memory-0", serialized)
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "report.json"
            output = Path(directory) / "samples.jsonl"
            source.write_text(json.dumps(report), encoding="utf-8")
            result = export_memory_report(source, output)
            self.assertEqual(result["samples"], 1)
            row = json.loads(output.read_text(encoding="utf-8").splitlines()[0])
            self.assertEqual(row["id"], "nk1-memory-bilingual-holdout")


if __name__ == "__main__":
    unittest.main()
