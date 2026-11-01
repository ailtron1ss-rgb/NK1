"""Inspect AI task for deterministic NK1 cognitive/evidence contract scoring.

No language model is invoked. Inspect AI runs its normal task/scorer lifecycle over
immutable JSONL evidence exported by the TypeScript adapter.
"""
from __future__ import annotations

import json
from typing import Any

from inspect_ai import Task, task
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.scorer import Score, mean, scorer
from inspect_ai.solver import Generate, TaskState, solver

from nk1_evidence import load_evidence_jsonl, validate_evidence_record


def _record_from_state(state: TaskState) -> tuple[dict[str, Any], dict[str, Any]]:
    raw_input = state.input
    if not isinstance(raw_input, str):
        return {}, {"passed": False, "issues": ["inspect-sample-input-not-text"]}
    try:
        record = json.loads(raw_input)
    except (json.JSONDecodeError, ValueError):
        return {}, {"passed": False, "issues": ["inspect-sample-input-invalid-json"]}
    return record, validate_evidence_record(record)


@solver
def preserve_evidence():
    """A no-op solver: it never calls Generate or any model/provider."""
    async def solve(state: TaskState, generate: Generate) -> TaskState:
        return state
    return solve


@scorer(metrics=[mean()])
def nk1_full_cycle_score():
    async def score(state: TaskState, target: str) -> Score:
        record, result = _record_from_state(state)
        value = 1.0 if result.get("full_cycle") == 1.0 and result.get("passed") else 0.0
        return Score(value=value, answer="full-cycle-pass" if value else "full-cycle-fail",
                     explanation="Recomputed 11-stage causal lineage and exact EventFabric edges.",
                     metadata={"sampleId": record.get("sampleId"), "tick": result.get("tick"), "issues": result.get("issues", [])})
    return score


@scorer(metrics=[mean()])
def nk1_receipt_integrity_score():
    async def score(state: TaskState, target: str) -> Score:
        record, result = _record_from_state(state)
        value = float(result.get("receipt_integrity", 0.0))
        return Score(value=value, answer="receipt-integrity-pass" if value == 1.0 else "receipt-integrity-fail",
                     explanation="Recomputed receipt event identity, tool, tick and parent-link integrity.",
                     metadata={"sampleId": record.get("sampleId"), "receiptCount": result.get("receipt_count"), "invalidReceipts": result.get("invalid_receipts"), "issues": result.get("issues", [])})
    return score


@scorer(metrics=[mean()])
def nk1_external_postcondition_score():
    async def score(state: TaskState, target: str) -> Score:
        record, result = _record_from_state(state)
        value = float(result.get("external_postcondition_integrity", 0.0))
        return Score(value=value, answer="external-evidence-pass" if value == 1.0 else "external-evidence-fail",
                     explanation="External claims require a linked independent observation and matching postcondition hashes.",
                     metadata={"sampleId": record.get("sampleId"), "claims": result.get("external_postcondition_claims"), "corroborated": result.get("external_postcondition_verified"), "issues": result.get("issues", [])})
    return score


@scorer(metrics=[mean()])
def nk1_export_validity_score():
    async def score(state: TaskState, target: str) -> Score:
        _, result = _record_from_state(state)
        value = 1.0 if result.get("passed") else 0.0
        return Score(value=value, answer="export-valid" if value else "export-invalid",
                     explanation="All independent structural checks passed; this is not a semantic intelligence score.",
                     metadata={"issues": result.get("issues", []), "missingStages": result.get("missing_stages", []), "missingEdges": result.get("missing_edges", [])})
    return score


@task
def nk1_cognitive_evidence(evidence_path: str) -> Task:
    """Score an immutable NK1 evidence JSONL file without calling a model."""
    records = load_evidence_jsonl(evidence_path)
    samples = [Sample(id=record["sampleId"],
                      input=json.dumps(record, ensure_ascii=False, separators=(",", ":")),
                      target=record["sampleId"]) for record in records]
    return Task(
        dataset=MemoryDataset(samples, name="nk1-cognitive-event-evidence"),
        solver=preserve_evidence(),
        scorer=[nk1_full_cycle_score(), nk1_receipt_integrity_score(),
                nk1_external_postcondition_score(), nk1_export_validity_score()],
        model=None,
        metadata={"evidenceSchema": "nk1.inspect-evidence/v1", "modelInvocation": False,
                  "purpose": "independent-structural-evidence-audit"},
        description="NK1 11-stage cognitive-cycle, action receipt and external postcondition evidence audit.",
    )
