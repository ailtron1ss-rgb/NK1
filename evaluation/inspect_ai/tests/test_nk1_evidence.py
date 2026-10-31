from __future__ import annotations

import hashlib
import json
import tempfile
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nk1_evidence import (
    FULL_EDGES,
    SCHEMA_VERSION,
    bundle_digest,
    canonical_json,
    export_bundle,
    score_cycle,
    score_reality_ledger,
    score_timeline,
    validate_bundle,
)


def make_cycle(tick: int, omit_stage: str | None = None) -> dict:
    stages = ["observation", "prediction", "appraisal", "attention", "memory", "goal", "plan", "action", "outcome", "learning", "self-update"]
    ids = {stage: hashlib.sha256(f"{tick}:{stage}".encode()).hexdigest() for stage in stages}
    parent_map = {stage: [] for stage in stages}
    for child, parent, _label in FULL_EDGES:
        parent_map[child].append(ids[parent])
    events = []
    for index, stage in enumerate(stages):
        if stage == omit_stage:
            continue
        events.append({
            "idDigest": ids[stage], "tick": tick, "stage": stage,
            "parentIdDigests": sorted(set(parent_map[stage])),
            "external": stage == "observation", "confidenceBps": 8500, "atMs": 1000 + index,
        })
    return {"cycleIdDigest": hashlib.sha256(f"nk1-cycle:{tick}".encode()).hexdigest(), "tick": tick, "events": events}


def chain_cycles(cycles: list[dict]) -> tuple[list[dict], dict]:
    chained = []
    previous = None
    for index, cycle in enumerate(cycles):
        core = {"cycleIdDigest": cycle["cycleIdDigest"], "tick": cycle["tick"], "events": cycle["events"]}
        cycle_digest = hashlib.sha256(canonical_json(core).encode("utf-8")).hexdigest()
        chain_record = {
            "sequenceIndex": index,
            "tick": cycle["tick"],
            "cycleDigest": cycle_digest,
            "previousChainDigest": previous,
        }
        chain_digest = hashlib.sha256(canonical_json(chain_record).encode("utf-8")).hexdigest()
        chained.append({
            **core,
            "sequenceIndex": index,
            "previousChainDigest": previous,
            "cycleDigest": cycle_digest,
            "chainDigest": chain_digest,
        })
        previous = chain_digest
    timeline = {
        "version": 1,
        "algorithm": "sha256-canonical-json-v1",
        "cycleCount": len(chained),
        "firstTick": chained[0]["tick"] if chained else None,
        "lastTick": chained[-1]["tick"] if chained else None,
        "headDigest": previous,
    }
    return chained, timeline


def make_bundle() -> dict:
    cycles, timeline = chain_cycles([make_cycle(1), make_cycle(2, "plan")])
    bundle = {
        "schemaVersion": SCHEMA_VERSION,
        "exportedAtMs": 1700000000000,
        "eventWindow": {"limit": 256, "total": 21, "buffered": 21, "exportedOperationalEvents": 21, "oldestTick": 1, "newestTick": 2},
        "cycles": cycles,
        "timeline": timeline,
        "realityEvidence": {
            "total": 3, "observedRecent": 3,
            "classes": {"external-observation": 1, "device-observation": 1, "simulator": 1, "derived": 0, "model-generated": 0, "user-reported": 0},
            "independentSourcesByClass": {"external-observation": 1, "device-observation": 1, "simulator": 1, "derived": 0, "model-generated": 0, "user-reported": 0},
            "externalIndependentSources": 2, "simulatorIndependentSources": 1,
        },
        "cycleCounters": {"version": 2, "cycles": 2, "coreCompleteCycles": 2, "fullCompleteCycles": 1, "incompleteCycles": 1, "brokenLineages": 0, "lastTick": 2},
    }
    bundle["bundleDigest"] = bundle_digest(bundle)
    return bundle


class EvidenceScoringTests(unittest.TestCase):
    def test_full_cycle_passes_all_causal_edges(self):
        result = score_cycle({"tick": 1, "events": make_cycle(1)["events"]})
        self.assertTrue(result["passed"], result)
        self.assertEqual(result["validEdges"], 20)

    def test_missing_plan_fails_even_if_core_stages_are_present(self):
        result = score_cycle({"tick": 2, "events": make_cycle(2, "plan")["events"]})
        self.assertFalse(result["passed"])
        self.assertIn("plan", result["missingStages"])
        self.assertIn("action->plan", result["missingEdges"])

    def test_duplicate_stage_fails_closed(self):
        events = make_cycle(1)["events"]
        events.append(dict(events[0]))
        result = score_cycle({"tick": 1, "events": events})
        self.assertFalse(result["passed"])
        self.assertIn("observation", result["duplicateStageIds"])

    def test_tick_mismatch_fails_closed(self):
        events = make_cycle(1)["events"]
        events[0]["tick"] = 999
        result = score_cycle({"tick": 1, "events": events})
        self.assertFalse(result["passed"])
        self.assertTrue(result["invalidEventIndexes"])

    def test_reality_ledger_keeps_simulator_separate(self):
        record = {"realityEvidence": make_bundle()["realityEvidence"]}
        self.assertTrue(score_reality_ledger(record)["passed"])
        record["realityEvidence"]["externalIndependentSources"] = 4
        self.assertFalse(score_reality_ledger(record)["passed"])

    def test_timeline_verifies_ordered_hash_chain(self):
        bundle = make_bundle()
        result = score_timeline({
            "kind": "evidence-timeline",
            "timeline": bundle["timeline"],
            "cycles": bundle["cycles"],
        })
        self.assertTrue(result["passed"], result)
        self.assertEqual(result["cycleCount"], 2)
        self.assertEqual(result["firstTick"], 1)
        self.assertEqual(result["lastTick"], 2)

    def test_reordered_cycles_fail_even_after_outer_digest_recomputed(self):
        bundle = make_bundle()
        bundle["cycles"].reverse()
        bundle["bundleDigest"] = bundle_digest(bundle)
        with self.assertRaisesRegex(ValueError, "timeline sequence invalid"):
            validate_bundle(bundle)

    def test_duplicate_event_id_across_ticks_fails_closed(self):
        bundle = make_bundle()
        duplicate = dict(bundle["cycles"][1]["events"][0])
        duplicate["idDigest"] = bundle["cycles"][0]["events"][0]["idDigest"]
        bundle["cycles"][1]["events"][0] = duplicate
        bundle["cycles"], bundle["timeline"] = chain_cycles(bundle["cycles"])
        bundle["eventWindow"]["exportedOperationalEvents"] = sum(len(c["events"]) for c in bundle["cycles"])
        bundle["bundleDigest"] = bundle_digest(bundle)
        with self.assertRaisesRegex(ValueError, "timeline sequence invalid"):
            validate_bundle(bundle)

    def test_future_parent_reference_fails_closed(self):
        bundle = make_bundle()
        later_id = bundle["cycles"][1]["events"][0]["idDigest"]
        bundle["cycles"][0]["events"][0]["parentIdDigests"].append(later_id)
        bundle["cycles"], bundle["timeline"] = chain_cycles(bundle["cycles"])
        bundle["bundleDigest"] = bundle_digest(bundle)
        with self.assertRaisesRegex(ValueError, "timeline sequence invalid"):
            validate_bundle(bundle)

    def test_event_window_count_mismatch_fails_closed(self):
        bundle = make_bundle()
        bundle["eventWindow"]["exportedOperationalEvents"] -= 1
        bundle["bundleDigest"] = bundle_digest(bundle)
        with self.assertRaisesRegex(ValueError, "event window exported count"):
            validate_bundle(bundle)

    def test_bundle_digest_rejects_tampering(self):
        bundle = make_bundle()
        validate_bundle(bundle)
        bundle["cycles"][0]["events"].pop()
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            validate_bundle(bundle)

    def test_export_is_atomic_and_emits_samples(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source, destination = root / "evidence.json", root / "samples.jsonl"
            source.write_text(json.dumps(make_bundle()), encoding="utf-8")
            result = export_bundle(source, destination)
            rows = [json.loads(line) for line in destination.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(result["samples"], 4)
            self.assertEqual(len(rows), 4)
            self.assertEqual(rows[0]["id"], "evidence-timeline")
            self.assertEqual(rows[-1]["id"], "reality-ledger-accounting")


if __name__ == "__main__":
    unittest.main()
