from __future__ import annotations

"""Multi-source generalist capability evolution for unseen task families.

Protocol:
1. Learn a primitive-level repair profile from several *source* families.
2. The target family is never used to build the profile and its semantic label is
   not used when generating candidate programs.
3. For each unseen target, construct a bounded generic mutation neighborhood from
   the damaged target program only.
4. Select a candidate using TARGET TRAIN only.
5. Open HOLDOUT and FUTURE only after selection is frozen.

The module is intentionally black-box at the target: candidate generation uses
instruction/opcode structure and the learned primitive profile, not target semantic
metadata. It is therefore suitable as a stronger generalization gate than the
previous single-source transfer benchmark.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable, Sequence
import hashlib
import json

from .capability_evolver_v1 import CapabilityEvolverV1, OperatorGenomeV1
from .capability_transfer_evaluator_v1 import CapabilityTransferEvaluatorV1
from .program_acquisition_v2 import ProgramAcquisitionCoreV2, Program


@dataclass(frozen=True)
class SourceProfileRowV1:
    family: str
    corruption: str
    train_baseline: float
    best_gain: float
    primitive_scores: dict[str, float]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class GeneralistTargetResultV1:
    source_families: tuple[str, ...]
    target_family: str
    train_baseline: float
    train_selected: float
    holdout_baseline: float
    holdout_selected: float
    future_baseline: float
    future_selected: float
    holdout_gain: float
    future_gain: float
    candidate_count: int
    selected_candidate_hash: str
    profile: tuple[tuple[str, float], ...]
    baseline_program: tuple[tuple[int, int, int], ...] = ()
    selected_program: tuple[tuple[int, int, int], ...] = ()

    def to_dict(self) -> dict[str, Any]:
        row = asdict(self)
        row["profile"] = [[str(name), float(score)] for name, score in self.profile]
        row["source_families"] = list(self.source_families)
        return row


class MultiSourceGeneralistEvolutionV1:
    VERSION = "multi-source-generalist-evolution-v1"
    PRIMITIVES = (
        "replace_opcode",
        "replace_operand",
        "swap_adjacent",
        "duplicate_instruction",
        "drop_instruction",
        "insert_load",
    )
    OPCODES = (1, 3, 4, 5, 6, 7, 13, 14, 15, 17, 18)
    BINARY_OPS = (3, 4, 5, 6, 7, 15, 17, 18)

    def __init__(self, root: Path, *, seed: int = 44017):
        self.root = Path(root)
        self.seed = int(seed)
        self.acq = ProgramAcquisitionCoreV2(self.root, seed=seed + 11)
        self.transfer = CapabilityTransferEvaluatorV1(self.root, seed=seed + 17)

    @staticmethod
    def _fp(code: Sequence[Sequence[int]]) -> str:
        payload = [list(map(int, row)) for row in code]
        return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:24]

    @staticmethod
    def _score(code: Program, rows: Sequence[tuple[Sequence[int], int]]) -> float:
        return CapabilityTransferEvaluatorV1._score(code, rows)

    @staticmethod
    def _corrupt(code: Sequence[Sequence[int]], mode: str) -> list[tuple[int, int, int]]:
        out = [tuple(map(int, row)) for row in code]
        if not out:
            return out
        if mode == "opcode":
            mapping = {3: 5, 5: 3, 15: 4, 4: 15, 17: 4, 18: 17}
            for i, (op, a, b) in enumerate(out):
                if op in mapping:
                    out[i] = (mapping[op], a, b)
                    return out
        elif mode == "operand":
            for i, (op, a, b) in enumerate(out):
                if op in MultiSourceGeneralistEvolutionV1.BINARY_OPS:
                    out[i] = (op, b, a)
                    return out
        elif mode == "drop":
            for i, (op, _a, _b) in enumerate(out[:-2]):
                if op in MultiSourceGeneralistEvolutionV1.BINARY_OPS:
                    del out[i]
                    return out
        raise ValueError(f"no supported corruption for mode={mode}")

    @classmethod
    def _mutation_neighborhood(cls, code: Sequence[Sequence[int]], primitive: str, *, cap: int = 256) -> list[Program]:
        base = [tuple(map(int, row)) for row in code]
        out: list[Program] = []
        seen = {tuple(base)}

        def add(candidate: Sequence[Sequence[int]]) -> None:
            if len(out) >= int(cap):
                return
            normalized = [tuple(map(int, row)) for row in candidate][:48]
            key = tuple(normalized)
            if key not in seen:
                seen.add(key)
                out.append(normalized)

        if primitive == "replace_opcode":
            for i, (op, a, b) in enumerate(base):
                for target in cls.OPCODES:
                    if target == op:
                        continue
                    p = list(base)
                    p[i] = (target, a, b)
                    add(p)
        elif primitive == "replace_operand":
            for i, (op, a, b) in enumerate(base):
                if op not in cls.BINARY_OPS:
                    continue
                for aa in range(4):
                    for bb in range(4):
                        p = list(base)
                        p[i] = (op, aa, bb)
                        add(p)
        elif primitive == "swap_adjacent":
            for i in range(max(0, len(base) - 1)):
                p = list(base)
                p[i], p[i + 1] = p[i + 1], p[i]
                add(p)
        elif primitive == "duplicate_instruction":
            for i in range(len(base)):
                p = list(base)
                p.insert(min(len(p), i + 1), p[i])
                add(p)
        elif primitive == "drop_instruction":
            for i in range(max(0, len(base) - 2)):
                p = list(base)
                p.pop(i)
                add(p)
        elif primitive == "insert_load":
            for i in range(len(base) + 1):
                for register in range(4):
                    p = list(base)
                    p.insert(min(i, len(p)), (1, register, 0))
                    add(p)
        return out[: int(cap)]

    def _learn_source_row(self, family: str, corruption: str, *, seed: int) -> SourceProfileRowV1:
        train, _holdout, _adv = self.acq._examples(family, seed)
        template = self.acq.templates(family)[0]
        broken = self._corrupt(template, corruption)
        baseline = self._score(broken, train)
        primitive_scores: dict[str, float] = {}
        for primitive in self.PRIMITIVES:
            candidates = self._mutation_neighborhood(broken, primitive, cap=192)
            best = 0.0
            for candidate in candidates:
                best = max(best, float(self._score(candidate, train) - baseline))
            primitive_scores[primitive] = round(max(0.0, best), 6)
        return SourceProfileRowV1(
            family=str(family),
            corruption=str(corruption),
            train_baseline=float(baseline),
            best_gain=float(max(primitive_scores.values() or [0.0])),
            primitive_scores=primitive_scores,
        )

    def learn_profile(
        self,
        source_families: Sequence[str],
        *,
        seeds: Sequence[int] | None = None,
        corruption_modes: Sequence[str] = ("opcode", "operand", "drop"),
    ) -> tuple[tuple[str, float], tuple[SourceProfileRowV1, ...]]:
        families = tuple(str(x) for x in source_families)
        if not families:
            raise ValueError("at least one source family is required")
        seed_list = tuple(int(x) for x in seeds) if seeds is not None else tuple(self.seed + i * 17 for i in range(len(families)))
        rows: list[SourceProfileRowV1] = []
        aggregate = {primitive: [] for primitive in self.PRIMITIVES}
        for index, family in enumerate(families):
            mode = str(corruption_modes[index % len(corruption_modes)])
            row = self._learn_source_row(family, mode, seed=seed_list[index % len(seed_list)])
            rows.append(row)
            for primitive, score in row.primitive_scores.items():
                aggregate[primitive].append(float(score))
        ranked = sorted(
            (
                (primitive, sum(values) / max(1, len(values)))
                for primitive, values in aggregate.items()
                if any(float(value) > 0.0 for value in values)
            ),
            key=lambda item: (-float(item[1]), self.PRIMITIVES.index(item[0])),
        )
        return tuple(ranked), tuple(rows)

    def _target_pool(self, broken: Sequence[Sequence[int]], profile: Sequence[tuple[str, float]], *, cap: int = 384) -> list[Program]:
        pool: list[Program] = [list(map(tuple, broken))]
        seen = {tuple(pool[0])}
        # Allocate search budget proportionally to learned source utility; never use target semantics.
        positive = [(str(name), max(0.0, float(score))) for name, score in profile if float(score) > 0.0]
        if not positive:
            positive = [("replace_opcode", 1.0)]
        total = sum(score for _, score in positive)
        for primitive, score in positive:
            primitive_cap = max(8, min(192, int(round(cap * score / max(total, 1e-9)))))
            for candidate in self._mutation_neighborhood(broken, primitive, cap=primitive_cap):
                key = tuple(candidate)
                if key not in seen and len(pool) < int(cap):
                    seen.add(key)
                    pool.append(candidate)
        return pool[: int(cap)]

    def evaluate_unseen_target(
        self,
        target_family: str,
        profile: Sequence[tuple[str, float]],
        *,
        seed: int,
        source_families: Sequence[str],
        candidate_cap: int = 384,
    ) -> GeneralistTargetResultV1:
        train, holdout, _adv = self.acq._examples(target_family, seed)
        future = self.acq._examples(target_family, seed + 10001)[0]
        template = self.acq.templates(target_family)[0]
        broken = self._corrupt(template, "opcode")
        pool = self._target_pool(broken, profile, cap=candidate_cap)
        # Critical rule: selection score is TRAIN only.
        scored = [(self._score(candidate, train), len(candidate), candidate) for candidate in pool]
        scored.sort(key=lambda row: (-float(row[0]), int(row[1]), tuple(row[2])))
        train_selected, _complexity, selected = scored[0]
        holdout_baseline = self._score(broken, holdout)
        future_baseline = self._score(broken, future)
        holdout_selected = self._score(selected, holdout)
        future_selected = self._score(selected, future)
        return GeneralistTargetResultV1(
            source_families=tuple(str(x) for x in source_families),
            target_family=str(target_family),
            train_baseline=float(self._score(broken, train)),
            train_selected=float(train_selected),
            holdout_baseline=float(holdout_baseline),
            holdout_selected=float(holdout_selected),
            future_baseline=float(future_baseline),
            future_selected=float(future_selected),
            holdout_gain=float(holdout_selected - holdout_baseline),
            future_gain=float(future_selected - future_baseline),
            candidate_count=len(pool),
            selected_candidate_hash=self._fp(selected),
            profile=tuple((str(name), float(score)) for name, score in profile),
            baseline_program=tuple(tuple(int(v) for v in row) for row in broken),
            selected_program=tuple(tuple(int(v) for v in row) for row in selected),
        )

    def run(
        self,
        *,
        source_families: Sequence[str] = ("sum3", "xor3", "mul2", "sub_offset"),
        target_families: Sequence[str] = ("minmax3", "sequence_diff", "nested3", "compose_sum_xor"),
        seeds: Sequence[int] = (4401, 4402, 4403),
        candidate_cap: int = 384,
    ) -> dict[str, Any]:
        source_families = tuple(str(x) for x in source_families)
        target_families = tuple(str(x) for x in target_families)
        seed_values = tuple(int(x) for x in seeds)
        rows: list[dict[str, Any]] = []
        profiles: list[dict[str, Any]] = []
        for run_index, seed in enumerate(seed_values):
            profile, source_rows = self.learn_profile(
                source_families,
                seeds=tuple(seed + 31 * i for i in range(len(source_families))),
            )
            profiles.append({
                "seed": seed,
                "source_rows": [row.to_dict() for row in source_rows],
                "profile": [[name, score] for name, score in profile],
            })
            for target_index, target_family in enumerate(target_families):
                result = self.evaluate_unseen_target(
                    target_family,
                    profile,
                    seed=seed + 500 + target_index * 7 + run_index * 101,
                    source_families=source_families,
                    candidate_cap=candidate_cap,
                )
                rows.append(result.to_dict() | {"seed": seed})
        mean = lambda key: sum(float(row[key]) for row in rows) / max(1, len(rows))
        summary = {
            "mean_holdout_gain": mean("holdout_gain"),
            "mean_future_gain": mean("future_gain"),
            "positive_holdout_fraction": sum(float(row["holdout_gain"]) > 0.0 for row in rows) / max(1, len(rows)),
            "positive_future_fraction": sum(float(row["future_gain"]) > 0.0 for row in rows) / max(1, len(rows)),
            "target_family_count": len(target_families),
            "source_family_count": len(source_families),
            "candidate_cap": int(candidate_cap),
            "unseen_target_protocol": True,
            "selection_protocol": "multi_source_train_profile_then_target_train_selection_then_hidden_holdout_then_future_hidden",
        }
        result = {
            "version": self.VERSION,
            "source_families": list(source_families),
            "target_families": list(target_families),
            "seeds": list(seed_values),
            "profiles": profiles,
            "rows": rows,
            "summary": summary,
        }
        path = self.root / "runtime" / "nomega_1_29_multisource_generalist_evolution_v1.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
        return result
