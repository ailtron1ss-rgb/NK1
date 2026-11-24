from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Sequence
import random

from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
from .program_acquisition_v2 import ProgramAcquisitionCoreV2, Program


@dataclass(frozen=True)
class DriftPhaseV1:
    index: int
    mix: float
    visible_phase: int
    train_rows: tuple[tuple[list[int], int], ...]
    holdout_rows: tuple[tuple[list[int], int], ...]
    future_holdout: tuple[tuple[list[int], int], ...]


class GradualDriftBenchmarkV1:
    VERSION = "gradual-drift-benchmark-v1"

    def __init__(self, root: Path | None = None, seed: int = 14021):
        self.root = Path(root) if root is not None else Path(".")
        self.seed = int(seed)
        self.acq = ProgramAcquisitionCoreV2(self.root, seed=seed + 5)

    @staticmethod
    def _oracle(family: str, tape: Sequence[int]) -> int:
        x = list(map(int, tape))
        if family == "sum3":
            return sum(x[:3]) & 255
        if family == "xor3":
            return (x[0] ^ x[1] ^ x[2]) & 255
        if family == "mul2":
            return (x[0] * x[1]) & 255
        if family == "sub_offset":
            return (x[0] - x[1] + x[2]) & 255
        raise KeyError(family)

    def _rows(self, family_a: str, family_b: str, phase_idx: int, phases: int, count: int, rng: random.Random) -> list[tuple[list[int], int]]:
        mix = phase_idx / max(1, phases - 1)
        out: list[tuple[list[int], int]] = []
        for _ in range(count):
            tape = [rng.randrange(16) for _ in range(4)]
            family = family_b if rng.random() < mix else family_a
            out.append((tape, self._oracle(family, tape)))
        return out

    def build_stream(self, family_a: str, family_b: str, *, phases: int = 5, rows_per_phase: int = 8) -> tuple[DriftPhaseV1, ...]:
        phases = max(2, int(phases))
        rng = random.Random(self.seed)
        all_phases: list[DriftPhaseV1] = []
        for idx in range(phases):
            train = self._rows(family_a, family_b, idx, phases, rows_per_phase, rng)
            holdout = self._rows(family_a, family_b, idx, phases, max(4, rows_per_phase // 2), rng)
            future = self._rows(family_a, family_b, phases - 1 - idx, phases, max(4, rows_per_phase // 2), rng)
            all_phases.append(DriftPhaseV1(idx, idx / (phases - 1), idx, tuple(train), tuple(holdout), tuple(future)))
        return tuple(all_phases)

    @staticmethod
    def measure_lag(scores: Sequence[float], *, threshold: float = 0.75) -> dict:
        first = None
        for i, score in enumerate(scores):
            if float(score) >= float(threshold):
                first = i
                break
        return {"lag": 0 if first is None else int(first), "first_above_threshold": first, "threshold": float(threshold)}

    @staticmethod
    def _evaluate_program(program: Program, rows: Sequence[tuple[Sequence[int], int]]) -> tuple[float, float]:
        tiny = 0
        hvm = 0
        for tape, expected in rows:
            a = run_tiny_v2(program, list(tape), 512)
            tiny_good = bool(a.get("ok")) and int(a.get("result", -1)) == int(expected)
            tiny += int(tiny_good)
            if tiny_good:
                b = run_hvm_compiled_v2(program, list(tape), 512)
                hvm += int(bool(b.get("ok")) and int(b.get("result", -1)) == int(expected))
        n = max(1, len(rows))
        return tiny / n, hvm / n

    def evaluate_strategy(self, strategy: Callable[[DriftPhaseV1], Program], stream: Sequence[DriftPhaseV1], *, budget: int = 8) -> dict:
        phase_scores = []
        chosen_fingerprints = []
        for phase in stream:
            program = strategy(phase)
            tiny, hvm = self._evaluate_program(program, phase.holdout_rows)
            phase_scores.append(float(hvm))
            chosen_fingerprints.append(hash(tuple(program)))
        lag = self.measure_lag(phase_scores)
        return {
            "version": self.VERSION, "phase_scores": phase_scores,
            "mean_score": sum(phase_scores) / max(1, len(phase_scores)),
            "final_score": phase_scores[-1] if phase_scores else 0.0,
            "adaptation_lag": lag["lag"], "chosen": chosen_fingerprints,
            "budget": int(budget),
        }
