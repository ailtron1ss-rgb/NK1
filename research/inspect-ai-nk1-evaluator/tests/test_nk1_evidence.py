from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nk1_evidence import EvidenceFormatError, load_evidence_jsonl, validate_evidence_record


def valid_record(sample_id="nk1-cycle-1"):
    stages = ("observation", "prediction", "appraisal", "attention", "memory", "goal", "plan", "action", "outcome", "learning", "self-update")
    ids = {stage: f"event-{i}" for i, stage in enumerate(stages)}
    parents = {
        "prediction": ["observation"], "appraisal": ["observation", "prediction"],
        "attention": ["appraisal", "prediction"], "memory": ["attention", "observation"],
        "goal": ["appraisal", "memory"], "plan": ["goal", "prediction"],
        "action": ["prediction", "observation", "plan"], "outcome": ["action", "prediction"],
        "learning": ["outcome", "action"], "self-update": ["learning", "outcome"],
    }
    events = [{"id": ids[s], "tick": 1, "stage": s, "at": 1000, "source": "test",
               "parentIds": [ids[p] for p in parents.get(s, [])], "external": False,
               "confidence01": 0.8, "payload": {}} for s in stages]
    return {
        "schemaVersion": "nk1.inspect-evidence/v1", "sampleId": sample_id, "exportedAt": 2000, "tick": 1,
        "cycle": {"stageIds": ids, "ambiguousStages": [], "verdict": {
            "tick": 1, "complete": True, "coreComplete": True, "fullComplete": True,
            "integrity01": 1.0, "coreIntegrity01": 1.0, "fullIntegrity01": 1.0,
            "missingStages": [], "coreMissingStages": [], "fullMissingStages": [],
            "invalidStages": [], "missingEdges": [], "coreMissingEdges": [], "fullMissingEdges": []}, "events": events},
        "receiptAudit": {"receiptCount": 0, "intactReceiptCount": 0, "invalidReceiptCount": 0,
            "externalPostconditionClaimCount": 0, "externallyCorroboratedCount": 0, "receipts": []},
    }


def add_verified_receipt(record):
    execution_id, projection_hash, observation_id = "exec-12345678-1234-1234-1234-123456789abc", "a" * 64, "obs-1"
    action_id, outcome_id, evidence_id = "cef-action-1", "cef-outcome-1", "cef-evidence-1"
    decision_id = record["cycle"]["stageIds"]["action"]
    action = {"id": action_id, "tick": 1, "stage": "tool-action", "at": 1000, "source": "action-gateway",
              "parentIds": [decision_id], "external": False, "confidence01": 0.9,
              "payload": {"executionId": execution_id, "tool": "device.camera", "decisionId": decision_id, "decisionLinked": True}}
    outcome = {"id": outcome_id, "tick": 1, "stage": "tool-outcome", "at": 1000, "source": "action-gateway-outcome",
               "parentIds": [action_id], "external": False, "confidence01": 0.9,
               "payload": {"executionId": execution_id, "tool": "device.camera", "ok": True, "verified": True, "outcomeClass": "verified"}}
    evidence = {"id": evidence_id, "tick": 1, "stage": "tool-evidence", "at": 1000, "source": "outcome-verification",
                "parentIds": [outcome_id], "external": True, "confidence01": 0.9,
                "payload": {"executionId": execution_id, "tool": "device.camera", "verificationBasis": "external-postcondition",
                            "externalObservation": True, "observationId": observation_id, "observationIntegrated": True,
                            "expectedPostconditionPresent": True, "observedPostconditionPresent": True}}
    post_hash = "b" * 64
    external = {"id": "cef-external-1", "tick": 1, "stage": "external-evidence", "at": 1001,
                "source": "external-observer-fabric", "parentIds": [outcome_id], "external": True, "confidence01": 0.98,
                "payload": {"executionId": execution_id, "toolId": "device.camera", "observationId": observation_id,
                            "verified": True, "confidence01": 0.98, "independenceKey": "device:camera:front",
                            "expectedPostconditionHash": post_hash, "observedPostconditionHash": post_hash,
                            "expectedPostconditionPresent": True, "observedPostconditionPresent": True,
                            "evidenceStatus": "corroborated", "projectionHash": projection_hash}}
    record["receiptAudit"] = {"receiptCount": 1, "intactReceiptCount": 1, "invalidReceiptCount": 0,
        "externalPostconditionClaimCount": 1, "externallyCorroboratedCount": 1,
        "receipts": [{"executionId": execution_id, "projectionHash": projection_hash, "action": action,
            "outcome": outcome, "evidence": evidence,
            "externalObservations": [{"observationId": observation_id, "projectionHash": projection_hash, "event": external, "issues": []}],
            "receiptRevisions": [], "externalPostconditionClaim": True, "externalPostconditionVerified": True,
            "integrity01": 1, "issues": []}]}


class EvidenceValidationTests(unittest.TestCase):
    def test_valid_full_cycle_passes(self):
        result = validate_evidence_record(valid_record())
        self.assertTrue(result["passed"], result["issues"])
        self.assertEqual(result["full_cycle_integrity"], 1.0)

    def test_missing_causal_edge_fails_even_when_all_stages_exist(self):
        row = valid_record()
        next(e for e in row["cycle"]["events"] if e["stage"] == "prediction")["parentIds"] = []
        v = row["cycle"]["verdict"]
        v.update(fullComplete=False, complete=False, integrity01=0.975, fullIntegrity01=0.975,
                 missingEdges=["prediction->observation"], fullMissingEdges=["prediction->observation"])
        result = validate_evidence_record(row)
        self.assertFalse(result["passed"])
        self.assertIn("prediction->observation", result["missing_edges"])

    def test_duplicate_stage_id_cannot_satisfy_two_phases(self):
        row = valid_record()
        row["cycle"]["stageIds"]["prediction"] = row["cycle"]["stageIds"]["observation"]
        result = validate_evidence_record(row)
        self.assertFalse(result["passed"])
        self.assertTrue(any("duplicate-event-id" in issue for issue in result["invalid_stages"]))

    def test_declared_complete_flag_is_not_trusted(self):
        row = valid_record()
        row["cycle"]["verdict"]["fullComplete"] = False
        result = validate_evidence_record(row)
        self.assertFalse(result["passed"])
        self.assertIn("declared-full-complete-mismatch", result["issues"])

    def test_linked_receipt_and_independent_postcondition_pass(self):
        row = valid_record(); add_verified_receipt(row)
        result = validate_evidence_record(row)
        self.assertTrue(result["passed"], result["issues"])
        self.assertEqual(result["receipt_count"], 1)
        self.assertEqual(result["external_postcondition_verified"], 1)

    def test_external_claim_without_independent_observation_fails(self):
        row = valid_record(); add_verified_receipt(row)
        receipt = row["receiptAudit"]["receipts"][0]
        receipt.update(externalObservations=[], externalPostconditionVerified=False, integrity01=0,
                       issues=["external-postcondition-not-corroborated"])
        row["receiptAudit"].update(intactReceiptCount=0, invalidReceiptCount=1, externallyCorroboratedCount=0)
        result = validate_evidence_record(row)
        self.assertFalse(result["passed"])
        self.assertIn("external-postcondition-not-corroborated", result["issues"])

    def test_external_projection_binding_mismatch_fails(self):
        row = valid_record(); add_verified_receipt(row)
        row["receiptAudit"]["receipts"][0]["externalObservations"][0]["projectionHash"] = "c" * 64
        result = validate_evidence_record(row)
        self.assertFalse(result["passed"])
        self.assertIn("external-projection-binding-mismatch", result["issues"])

    def test_jsonl_loader_rejects_duplicate_ids_and_nonfinite_json(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.jsonl"
            row = valid_record()
            path.write_text(json.dumps(row) + "\n" + json.dumps(row) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(EvidenceFormatError, "duplicate-sample-id"):
                load_evidence_jsonl(path)
            path.write_text('{"sampleId":"one","bad":NaN}\n', encoding="utf-8")
            with self.assertRaisesRegex(EvidenceFormatError, "invalid-json"):
                load_evidence_jsonl(path)


if __name__ == "__main__":
    unittest.main()
