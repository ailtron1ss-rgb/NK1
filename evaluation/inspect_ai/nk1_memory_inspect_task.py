"""Inspect AI task for independent, bilingual NK1 memory holdout scoring.

No LLM is called. Inspect AI runs the scorer over hashed per-query traces produced
by NK1's existing MemoryRetrievalBenchmark; no memory contents or queries are loaded.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from inspect_ai import Task, task
from inspect_ai.dataset import Sample
from inspect_ai.model import ModelOutput
from inspect_ai.scorer import CORRECT, INCORRECT, Score, Target, accuracy, scorer, stderr
from inspect_ai.solver import Generate, Solver, TaskState, solver

from nk1_memory_evidence import score_memory_holdout


@solver
def nk1_memory_evidence_passthrough() -> Solver:
    """Preserve exact evaluation sample; no external model inference."""
    async def solve(state: TaskState, generate: Generate) -> TaskState:
        state.output = ModelOutput.from_content(
            model="nk1/independent-memory-holdout-audit",
            content=state.input_text,
        )
        return state
    return solve


@scorer(metrics=[accuracy(), stderr()])
def nk1_memory_holdout_scorer():
    async def score(state: TaskState, target: Target) -> Score:
        try:
            record = json.loads(state.input_text)
            result = score_memory_holdout(record)
        except Exception as error:
            result = {
                "valid": False,
                "promotionEligible": False,
                "reason": "memory-scorer-exception",
                "error": str(error)[:240],
            }
        return Score(
            value=CORRECT if result.get("valid") is True else INCORRECT,
            answer="VALID" if result.get("valid") is True else "INVALID",
            explanation=json.dumps(result, ensure_ascii=False, sort_keys=True),
        )
    return score


def _load_samples(path: Path) -> list[Sample]:
    if not path.is_file():
        raise FileNotFoundError(
            f"NK1 memory Inspect dataset not found: {path}. "
            "Run nk1_memory_evidence.py against an offline benchmark report first."
        )
    samples: list[Sample] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            if not isinstance(row, dict) or not isinstance(row.get("input"), str):
                raise ValueError(f"invalid NK1 memory Inspect sample on line {line_number}")
            samples.append(Sample(
                id=str(row.get("id") or line_number),
                input=row["input"],
                target=str(row.get("target") or "memory-audit"),
            ))
    if not samples:
        raise ValueError("NK1 memory Inspect dataset is empty")
    return samples


@task
def nk1_memory_retrieval_holdout_eval():
    configured_path = Path(os.environ.get(
        "NK1_MEMORY_INSPECT_SAMPLES", "evaluation/inspect_ai/memory-samples.jsonl"
    ))
    repository_root = Path(__file__).resolve().parents[2]
    dataset_path = configured_path if configured_path.is_absolute() else (repository_root / configured_path).resolve()
    return Task(
        dataset=_load_samples(dataset_path),
        solver=nk1_memory_evidence_passthrough(),
        scorer=nk1_memory_holdout_scorer(),
    )
