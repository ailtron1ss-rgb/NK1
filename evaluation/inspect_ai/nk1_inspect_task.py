"""Inspect AI task for NK1's deterministic, independent evidence audit.

This task intentionally does not call a language model. Inspect AI provides
reproducible sample lifecycle, scorer execution, metrics and an auditable log.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from inspect_ai import Task, task
from inspect_ai.dataset import Sample
from inspect_ai.model import ModelOutput
from inspect_ai.scorer import CORRECT, INCORRECT, Score, Target, accuracy, scorer, stderr
from inspect_ai.solver import Generate, Solver, TaskState, solver

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nk1_evidence import score_record


@solver
def nk1_evidence_passthrough() -> Solver:
    """Run without external model calls; preserve exact exported sample input."""
    async def solve(state: TaskState, generate: Generate) -> TaskState:
        state.output = ModelOutput.from_content(
            model="nk1/independent-evidence-audit",
            content=state.input_text,
        )
        return state

    return solve


@scorer(metrics=[accuracy(), stderr()])
def nk1_independent_evidence_scorer():
    async def score(state: TaskState, target: Target) -> Score:
        try:
            record = json.loads(state.input_text)
            result = score_record(record)
        except Exception as error:  # malformed external evidence must score incorrect, not crash the batch
            result = {"passed": False, "reason": "scorer-exception", "error": str(error)[:240]}
        return Score(
            value=CORRECT if result.get("passed") is True else INCORRECT,
            answer="PASS" if result.get("passed") is True else "FAIL",
            explanation=json.dumps(result, ensure_ascii=False, sort_keys=True),
        )

    return score


def _load_samples(path: Path) -> list[Sample]:
    if not path.is_file():
        raise FileNotFoundError(
            f"NK1 Inspect dataset not found: {path}. Run nk1_evidence.py first."
        )
    samples: list[Sample] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            if not isinstance(row, dict) or not isinstance(row.get("input"), str):
                raise ValueError(f"invalid Inspect sample on line {line_number}")
            samples.append(Sample(
                id=str(row.get("id") or line_number),
                input=row["input"],
                target=str(row.get("target") or "audit"),
            ))
    if not samples:
        raise ValueError("NK1 Inspect dataset is empty")
    return samples


@task
def nk1_independent_evidence_eval():
    configured_path = Path(os.environ.get(
        "NK1_INSPECT_SAMPLES", "evaluation/inspect_ai/samples.jsonl"
    ))
    repository_root = Path(__file__).resolve().parents[2]
    dataset_path = configured_path if configured_path.is_absolute() else (repository_root / configured_path).resolve()
    return Task(
        dataset=_load_samples(dataset_path),
        solver=nk1_evidence_passthrough(),
        scorer=nk1_independent_evidence_scorer(),
    )
