from __future__ import annotations

"""Cross-family operator-transfer evaluator for the 1.29 development spine.

Protocol:
1. Corrupt a source-family program.
2. Learn which operator primitives repair that source on TRAIN.
3. Transfer the learned operator ranking to a different target family.
4. The target may use TRAIN to choose among transferred candidates.
5. HOLDOUT and FUTURE-HOLDOUT are opened only after that choice is fixed.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Sequence
import hashlib
import json

from .capability_evolver_v1 import CapabilityEvolverV1, OperatorGenomeV1
from .gradual_drift_benchmark_v1 import GradualDriftBenchmarkV1
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
from .semantic_repair_v2 import semantic_targeted_mutations
from .task_spec_v1 import CANONICAL_PROMPT


@dataclass(frozen=True)
class TransferPairResultV1:
    source_family: str
    target_family: str
    source_train_score: float
    target_broken_train_score: float
    transferred_train_score: float
    target_holdout_score: float
    future_hidden_score: float
    train_gain: float
    holdout_gain: float
    future_hidden_gain: float
    learned_operator_ranking: tuple[str, ...]
    candidates_tested: int
    baseline_program: tuple[tuple[int, int, int], ...] = ()
    selected_program: tuple[tuple[int, int, int], ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _fp(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()[:20]


class CapabilityTransferEvaluatorV1:
    VERSION = "capability-transfer-evaluator-v2"
    PRIMITIVES = ("replace_opcode", "swap_adjacent", "replace_operand", "duplicate_instruction", "drop_instruction", "insert_load")

    def __init__(self, root: Path, *, seed: int = 31129):
        self.root = Path(root)
        self.seed = int(seed)

    @staticmethod
    def _corrupt(code: Sequence[Sequence[int]]) -> list[tuple[int, int, int]]:
        mapping = {3: 5, 5: 3, 15: 4, 4: 15, 17: 18, 18: 17}
        out = [tuple(map(int, row)) for row in code]
        for i, row in enumerate(out):
            if row[0] in mapping:
                out[i] = (mapping[row[0]], row[1], row[2])
                return out
        raise ValueError("program has no transferable arithmetic corruption target")

    @staticmethod
    def _score(code: Sequence[Sequence[int]], rows: Sequence[tuple[Sequence[int], int]]) -> float:
        if not rows:
            return 0.0
        good = 0
        for tape, expected in rows:
            tiny = run_tiny_v2(code, list(tape), 512)
            tiny_good = bool(tiny.get("ok")) and int(tiny.get("result", -1)) == (int(expected) & 255)
            if not tiny_good:
                continue
            hvm = run_hvm_compiled_v2(code, list(tape), 512)
            good += int(bool(hvm.get("ok")) and int(hvm.get("result", -1)) == (int(expected) & 255))
        return good / max(1, len(rows))

    def _learn_operator_ranking(self, family: str, broken: Sequence[Sequence[int]], rows: Sequence[tuple[Sequence[int], int]], seed: int) -> tuple[tuple[str, float], ...]:
        baseline = self._score(broken, rows)
        # Learn operator usefulness on SOURCE TRAIN by exhaustively checking a bounded
        # semantic repair neighborhood.  The target never sees these source scores.
        best_by_primitive: dict[str, float] = {name: 0.0 for name in self.PRIMITIVES}
        for candidate in semantic_targeted_mutations(list(broken), CANONICAL_PROMPT.get(family, family), limit=24):
            gain = float(self._score(candidate, rows) - baseline)
            if gain <= 0.0:
                continue
            # All semantic operator replacements are a replace_opcode profile; operand
            # rearrangements are detected separately and only credited to that primitive.
            primitive = "replace_opcode"
            if any(tuple(candidate[i]) != tuple(broken[i]) and candidate[i][0] == broken[i][0] for i in range(min(len(candidate), len(broken)))):
                primitive = "replace_operand"
            best_by_primitive[primitive] = max(best_by_primitive[primitive], gain)
        # Retain generic probe evidence as a fallback for families whose semantic parser
        # cannot generate a useful neighborhood.
        if not any(best_by_primitive.values()):
            for offset, primitive in enumerate(self.PRIMITIVES):
                probe = CapabilityEvolverV1(self.root, seed=int(seed) + 100 + offset)
                genome = OperatorGenomeV1((primitive,), 1, 1.0)
                candidate = probe.apply_operator(broken, genome)
                score = self._score(candidate, rows)
                best_by_primitive[primitive] = max(0.0, float(score - baseline))
        ranked = sorted(best_by_primitive.items(), key=lambda item: (-item[1], self.PRIMITIVES.index(item[0])))
        return tuple((name, float(gain)) for name, gain in ranked if gain > 0.0)

    def _target_pool(self, family: str, broken: Sequence[Sequence[int]], ranking: tuple[tuple[str, float], ...], seed: int) -> list[list[tuple[int, int, int]]]:
        pool: list[list[tuple[int, int, int]]] = [list(map(tuple, broken))]
        seen = {tuple(pool[0])}
        learned = [name for name, _ in ranking]
        for offset, primitive in enumerate(learned[:4]):
            probe = CapabilityEvolverV1(self.root, seed=int(seed) + 500 + offset)
            genome = OperatorGenomeV1((primitive,), 1, 1.0)
            candidate = probe.apply_operator(broken, genome)
            key = tuple(candidate)
            if key not in seen:
                seen.add(key)
                pool.append(candidate)
        if "replace_opcode" in learned:
            for candidate in semantic_targeted_mutations(list(broken), CANONICAL_PROMPT.get(family, family), limit=8):
                key = tuple(tuple(x) for x in candidate)
                if key not in seen and len(pool) < 10:
                    seen.add(key)
                    pool.append([tuple(x) for x in candidate])
        return pool[:10]

    def evaluate_pair(self, source_family: str, target_family: str, *, seed: int | None = None) -> TransferPairResultV1:
        seed = self.seed if seed is None else int(seed)
        source_drift = GradualDriftBenchmarkV1(self.root, seed=seed + 5)
        target_drift = GradualDriftBenchmarkV1(self.root, seed=seed + 15)
        source_phase = source_drift.build_stream(source_family, source_family, phases=2, rows_per_phase=16)[0]
        target_stream = target_drift.build_stream(target_family, target_family, phases=3, rows_per_phase=16)
        target_phase = target_stream[0]
        future_phase = target_stream[-1]

        acq_source = ProgramAcquisitionCoreV2(self.root, seed=seed + 21)
        acq_target = ProgramAcquisitionCoreV2(self.root, seed=seed + 31)
        source_code = [tuple(x) for x in acq_source.templates(source_family)[0]]
        target_code = [tuple(x) for x in acq_target.templates(target_family)[0]]
        source_broken = self._corrupt(source_code)
        target_broken = self._corrupt(target_code)

        ranking = self._learn_operator_ranking(source_family, source_broken, source_phase.train_rows, seed)
        source_pool = self._target_pool(source_family, source_broken, ranking, seed)
        source_train_score = max(self._score(candidate, source_phase.train_rows) for candidate in source_pool)

        target_pool = self._target_pool(target_family, target_broken, ranking, seed + 700)
        scored = [(self._score(candidate, target_phase.train_rows), candidate) for candidate in target_pool]
        scored.sort(key=lambda x: (-x[0], len(x[1]), tuple(x[1])))
        transferred_train, transferred = scored[0]
        broken_target_train = self._score(target_broken, target_phase.train_rows)
        target_holdout = self._score(transferred, target_phase.holdout_rows)
        hidden_future = self._score(transferred, future_phase.future_holdout)
        broken_holdout = self._score(target_broken, target_phase.holdout_rows)
        broken_future = self._score(target_broken, future_phase.future_holdout)

        return TransferPairResultV1(
            source_family=source_family,
            target_family=target_family,
            source_train_score=source_train_score,
            target_broken_train_score=broken_target_train,
            transferred_train_score=transferred_train,
            target_holdout_score=target_holdout,
            future_hidden_score=hidden_future,
            train_gain=transferred_train - broken_target_train,
            holdout_gain=target_holdout - broken_holdout,
            future_hidden_gain=hidden_future - broken_future,
            learned_operator_ranking=tuple(name for name, _ in ranking),
            candidates_tested=len(target_pool),
            baseline_program=tuple(tuple(int(v) for v in row) for row in target_broken),
            selected_program=tuple(tuple(int(v) for v in row) for row in transferred),
        )

    def run(self, pairs=(('sum3', 'xor3'), ('xor3', 'sum3'), ('mul2', 'sum3')), seeds=(31129, 31131, 31133)) -> dict[str, Any]:
        rows: list[dict[str, Any]] = []
        for seed in seeds:
            for source, target in pairs:
                rows.append(self.evaluate_pair(source, target, seed=int(seed)).to_dict() | {"seed": int(seed)})
        mean = lambda key: sum(float(row[key]) for row in rows) / max(1, len(rows))
        result = {
            "version": self.VERSION,
            "seeds": [int(x) for x in seeds],
            "pairs": [list(x) for x in pairs],
            "selection_protocol": "source_train_operator_learning_then_target_train_selection_then_hidden_holdout_then_future_holdout",
            "rows": rows,
            "summary": {
                "mean_train_gain": mean("train_gain"),
                "mean_holdout_gain": mean("holdout_gain"),
                "mean_future_hidden_gain": mean("future_hidden_gain"),
                "positive_holdout_fraction": sum(float(r["holdout_gain"]) > 0 for r in rows) / max(1, len(rows)),
                "positive_future_fraction": sum(float(r["future_hidden_gain"]) > 0 for r in rows) / max(1, len(rows)),
            },
        }
        path = self.root / "runtime" / "nomega_1_29_capability_transfer_v1.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
        return result
