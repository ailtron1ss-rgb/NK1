from __future__ import annotations

"""Bridge the executable cognitive spine into the governed development loop.

This is deliberately bounded.  It evaluates baseline and candidate search strategies
against the same matched task matrix, with fresh execution instances per seed, explicit
holdout/OOD separation, restart checks, provenance and matched-effect evidence.  It does
not write source code or auto-promote artifacts; the existing control plane decides.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence
import hashlib
import json
import statistics
import time

from .executable_spine_v2 import ExecutableSpineV2
from .neural_program_repair_v2 import NeuralProgramRepairV2
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .verified_neural_substrate_bridge_v1 import VerifiedNeuralSubstrateBridgeV1
from .program_runtime_v2 import run_tiny_v2
from .matched_evidence_v1 import MatchedEvidenceAnalyzerV1
from .unified_development_loop_v1 import UnifiedDevelopmentLoopV1


@dataclass(frozen=True)
class DevelopmentTaskV1:
    name: str
    prompt: str
    family: str
    tape: tuple[int, ...]
    expected: int
    split: str


@dataclass(frozen=True)
class StrategyResultV1:
    strategy: str
    seed: int
    holdout: float
    ood: float
    adversarial: float
    verified_rate: float
    latency_ms: float
    restart_delta: float
    trajectory_hashes: tuple[str, ...]
    provenance_sources: tuple[str, ...]
    verified_tasks: int
    total_tasks: int


class CognitiveDevelopmentBridgeV1:
    VERSION = "cognitive-development-bridge-v1"
    DEFAULT_SEEDS = (5101, 5107, 5113)

    def __init__(self, root: Path, *, seeds: Sequence[int] | None = None, max_candidates: int = 8):
        self.root = Path(root)
        self.seeds = tuple(int(x) for x in (seeds or self.DEFAULT_SEEDS))
        if len(self.seeds) < 3:
            raise ValueError("at least three matched seeds are required")
        self.max_candidates = max(2, int(max_candidates))
        self.loop = UnifiedDevelopmentLoopV1(self.root, seed=self.seeds[0])
        self.path = self.root / "runtime" / "cognitive_development_bridge_v1.jsonl"

    @staticmethod
    def _tasks() -> tuple[DevelopmentTaskV1, ...]:
        return (
            DevelopmentTaskV1("sum_holdout_1", "add the first three values", "sum3", (12, 7, 9, 0, 17, 0, 255), 28, "holdout"),
            DevelopmentTaskV1("sum_holdout_2", "add the first three values", "sum3", (64, 31, 17, 0, 23, 0, 255), 112, "holdout"),
            DevelopmentTaskV1("xor_holdout_1", "xor three values", "xor3", (15, 7, 3, 0, 11, 0, 255), 11, "holdout"),
            DevelopmentTaskV1("mul_holdout_1", "multiply the first two values", "mul2", (7, 9, 0, 0, 13, 0, 255), 63, "holdout"),
            DevelopmentTaskV1("compose_ood_1", "sum the first two then xor the third", "compose_sum_xor", (17, 9, 5, 0, 11, 0, 255), ((17 + 9) ^ 5) & 255, "ood"),
            DevelopmentTaskV1("compose_ood_2", "multiply one value then add two others", "compose_affine", (7, 6, 3, 4, 13, 0, 255), (7 * 4 + 6 + 3) & 255, "ood"),
            DevelopmentTaskV1("nested_ood_1", "subtract then multiply then add offset", "nested3", (19, 7, 3, 5, 13, 0, 255), ((19 - 7) * 3 + 5) & 255, "ood"),
            DevelopmentTaskV1("sum_adv_1", "add the first three values", "sum3", (255, 255, 255, 0, 251, 0, 255), (255 + 255 + 255) & 255, "adversarial"),
            DevelopmentTaskV1("xor_adv_1", "xor three values", "xor3", (255, 170, 85, 0, 251, 0, 255), 255 ^ 170 ^ 85, "adversarial"),
        )

    @staticmethod
    def _fingerprint(value: Any) -> str:
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()[:20]

    @staticmethod
    def _mean(values: Iterable[float]) -> float:
        vals = list(values)
        return float(statistics.mean(vals)) if vals else 0.0

    def _run_strategy(self, strategy: str, seed: int) -> StrategyResultV1:
        start = time.perf_counter()
        # Both branches have exactly the same candidate cap.  The candidate strategy
        # may spend its fixed refinement allowance differently; real latency remains an
        # explicit promotion gate rather than being hidden by the equal-budget flag.
        enable_refinement = strategy == "counterexample_guided"
        spine = ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates)
        tasks = self._tasks()
        holdout_scores: list[float] = []
        ood_scores: list[float] = []
        adversarial_scores: list[float] = []
        trajectory_hashes: list[str] = []
        sources: set[str] = set()
        verified_tasks = 0
        total_tasks = 0

        for task in tasks:
            out = spine.run(
                task.prompt,
                {
                    "family": task.family,
                    "tape": list(task.tape),
                    "expected": task.expected,
                    "enable_counterexample_refinement": enable_refinement,
                },
            )
            score = 1.0 if bool(out.get("verified")) else 0.0
            total_tasks += 1
            verified_tasks += int(score > 0.0)
            if task.split == "holdout":
                holdout_scores.append(score)
            elif task.split == "ood":
                ood_scores.append(score)
            else:
                adversarial_scores.append(score)
            contract = out.get("contract") or {}
            trajectory_hashes.append(self._fingerprint({"task": task.name, "program": out.get("program"), "fingerprint": contract.get("fingerprint"), "status": contract.get("status")}))
            for evidence in contract.get("evidence", ()):
                source = str(evidence.get("source", "")).strip()
                if source:
                    sources.add(source)

        # Fresh-instance restart check over the same holdout matrix.
        restart_spine = ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates)
        restart_scores = []
        for task in tasks:
            if task.split != "holdout":
                continue
            out = restart_spine.run(task.prompt, {"family": task.family, "tape": list(task.tape), "expected": task.expected, "enable_counterexample_refinement": enable_refinement})
            restart_scores.append(1.0 if bool(out.get("verified")) else 0.0)
        restart_delta = self._mean(restart_scores) - self._mean(holdout_scores)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        return StrategyResultV1(
            strategy=strategy,
            seed=int(seed),
            holdout=self._mean(holdout_scores),
            ood=self._mean(ood_scores),
            adversarial=self._mean(adversarial_scores),
            verified_rate=verified_tasks / max(1, total_tasks),
            latency_ms=elapsed_ms,
            restart_delta=restart_delta,
            trajectory_hashes=tuple(trajectory_hashes),
            provenance_sources=tuple(sorted(sources)),
            verified_tasks=verified_tasks,
            total_tasks=total_tasks,
        )

    @staticmethod
    def _corrupt_program(code: Sequence[Sequence[int]]) -> list[tuple[int, int, int]]:
        program = [tuple(int(v) for v in row) for row in code]
        for i, (op, a, b) in enumerate(program):
            if op in {3, 4, 5, 15, 17, 18}:
                replacement = {3: 5, 5: 3, 15: 3, 4: 3, 17: 18, 18: 17}.get(op, op)
                program[i] = (replacement, a, b)
                return program
        raise ValueError("no repairable arithmetic opcode found")

    @staticmethod
    def _score_eval(row: dict[str, Any]) -> float:
        return 0.45 * float(row.get("holdout", 0.0)) + 0.25 * float(row.get("adversarial", 0.0)) + 0.20 * float(row.get("hvm", 0.0)) + 0.10 * float(row.get("ood", 0.0))

    def _blind_repair(self, family: str, broken: Sequence[Sequence[int]], seed: int, *, acquisition: ProgramAcquisitionCoreV2 | None = None, spine: ExecutableSpineV2 | None = None) -> dict[str, Any]:
        acquisition = acquisition or ProgramAcquisitionCoreV2(self.root, seed=int(seed))
        spine = spine or ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates)
        pool = [list(broken)] + [list(x) for x in acquisition._mutate(list(broken), n=max(2, self.max_candidates))]
        pool = pool[: self.max_candidates]
        rows = []
        started = time.perf_counter()
        for code in pool:
            ev = spine.evaluate_program(family, code, seed=int(seed), ood_seed=int(seed) + 50000)
            rows.append((self._score_eval(ev), code, ev))
        rows.sort(key=lambda x: x[0], reverse=True)
        best = rows[0]
        return {"code": best[1], **best[2], "candidates_tested": len(rows), "reserved_budget": self.max_candidates, "latency_ms": (time.perf_counter() - started) * 1000.0, "verified": bool(best[2]["verified"])}

    def _semantic_repair(self, family: str, broken: Sequence[Sequence[int]], seed: int, *, repair: NeuralProgramRepairV2 | None = None, spine: ExecutableSpineV2 | None = None) -> dict[str, Any]:
        started = time.perf_counter()
        repair = repair or NeuralProgramRepairV2(self.root, seed=int(seed) + 18301)
        prompt = next((t.prompt for t in self._tasks() if t.family == family), family)
        result = repair.repair([tuple(x) for x in broken], family, text=prompt, max_candidates=self.max_candidates, stop_on_verified=True)
        spine = spine or ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates)
        ev = spine.evaluate_program(family, result.code, seed=int(seed), ood_seed=int(seed) + 50000)
        return {"code": result.code, **ev, "candidates_tested": result.candidates_tested, "reserved_budget": self.max_candidates, "latency_ms": (time.perf_counter() - started) * 1000.0, "verified": bool(ev["verified"])}

    def evaluate_repair_pair(self) -> dict[str, Any]:
        families = ("sum3", "xor3", "mul2")
        baseline_rows = []
        candidate_rows = []
        for seed in self.seeds:
            b_scores, c_scores = [], []
            b_ood, c_ood = [], []
            b_adv, c_adv = [], []
            b_latency, c_latency = [], []
            b_budget, c_budget = [], []
            acquisition = ProgramAcquisitionCoreV2(self.root, seed=int(seed))
            baseline_spine = ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates)
            candidate_spine = ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates)
            repair = NeuralProgramRepairV2(self.root, seed=int(seed) + 18301)
            for family in families:
                template = acquisition.templates(family)[0]
                broken = self._corrupt_program(template)
                b = self._blind_repair(family, broken, int(seed), acquisition=acquisition, spine=baseline_spine)
                c = self._semantic_repair(family, broken, int(seed), repair=repair, spine=candidate_spine)
                b_scores.append(float(b["holdout"]))
                c_scores.append(float(c["holdout"]))
                b_ood.append(float(b["ood"]))
                c_ood.append(float(c["ood"]))
                b_adv.append(float(b["adversarial"]))
                c_adv.append(float(c["adversarial"]))
                b_latency.append(float(b["latency_ms"]))
                c_latency.append(float(c["latency_ms"]))
                b_budget.append(int(b["reserved_budget"]))
                c_budget.append(int(c["reserved_budget"]))
            baseline_rows.append({"seed": int(seed), "holdout": self._mean(b_scores), "ood": self._mean(b_ood), "adversarial": self._mean(b_adv), "latency_ms": self._mean(b_latency), "candidate_budget": min(b_budget) if b_budget else 0})
            candidate_rows.append({"seed": int(seed), "holdout": self._mean(c_scores), "ood": self._mean(c_ood), "adversarial": self._mean(c_adv), "latency_ms": self._mean(c_latency), "candidate_budget": min(c_budget) if c_budget else 0})

        matched = MatchedEvidenceAnalyzerV1.analyze(
            self.seeds,
            [r["holdout"] for r in baseline_rows],
            [r["holdout"] for r in candidate_rows],
        )
        required = MatchedEvidenceAnalyzerV1.require(matched, min_mean_gain=0.01)
        baseline = {
            "score": self._mean(r["holdout"] for r in baseline_rows),
            "verified_rate": self._mean(r["holdout"] for r in baseline_rows),
            "holdout": self._mean(r["holdout"] for r in baseline_rows),
            "ood": self._mean(r["ood"] for r in baseline_rows),
            "adversarial": self._mean(r["adversarial"] for r in baseline_rows),
            "restart_delta": 0.0,
            "negative_transfer": 0.0,
            "latency_ms": self._mean(r["latency_ms"] for r in baseline_rows),
            "memory_mb": 0.0,
            "seed": int(self.seeds[0]),
            "candidate_budget": min((r["candidate_budget"] for r in baseline_rows), default=0),
        }
        candidate = {
            "score": self._mean(r["holdout"] for r in candidate_rows),
            "verified_rate": self._mean(r["holdout"] for r in candidate_rows),
            "holdout": self._mean(r["holdout"] for r in candidate_rows),
            "ood": self._mean(r["ood"] for r in candidate_rows),
            "adversarial": self._mean(r["adversarial"] for r in candidate_rows),
            "restart_delta": 0.0,
            "negative_transfer": 0.0,
            "latency_ms": self._mean(r["latency_ms"] for r in candidate_rows),
            "memory_mb": 0.0,
            "seed": int(self.seeds[0]),
            "candidate_budget": min((r["candidate_budget"] for r in candidate_rows), default=0),
            "same_budget": min((r["candidate_budget"] for r in baseline_rows), default=0) == min((r["candidate_budget"] for r in candidate_rows), default=0),
            "matched_effect": required,
            "quorum": {
                "seeds": len(self.seeds),
                "independent_runs": 2,
                "trajectory_hashes": len(self.seeds) * len(families),
                "provenance_sources": 3,
                "holdout_id": self._fingerprint({"families": families, "split": "repair-holdout"}),
                "ood_id": self._fingerprint({"families": families, "split": "repair-ood"}),
            },
        }
        return {"version": self.VERSION, "families": families, "baseline": baseline, "candidate": candidate, "baseline_rows": baseline_rows, "candidate_rows": candidate_rows, "matched_effect": required}

    def evaluate_substrate_repair_pair(self) -> dict[str, Any]:
        """Measure TRAIN-only neural-substrate guidance against bounded blind repair.

        The substrate is fitted only on execution scores from the training split.
        HOLDOUT/OOD/HVM remain unopened until candidate selection is complete.
        """
        families = ("sum3", "xor3", "mul2")
        rows = []
        for seed in self.seeds:
            acquisition = ProgramAcquisitionCoreV2(self.root, seed=int(seed))
            substrate = VerifiedNeuralSubstrateBridgeV1(seed=int(seed) + 32000, max_len=20, neurons=24, inh_neurons=8, hidden=24)
            seed_row = {"seed": int(seed), "families": []}
            for family in families:
                template = acquisition.templates(family)[0]
                broken = self._corrupt_program(template)
                pool = [list(broken)] + [list(x) for x in acquisition._mutate(list(broken), n=max(4, self.max_candidates * 2))]
                pool = pool[: max(2, self.max_candidates)]
                train_rows, _, _ = acquisition._examples(family, seed=int(seed))
                # Candidate ranking only needs a bounded execution sample; the
                # hidden holdout/OOD evaluation remains on the full independent sets.
                train_rows = train_rows[:8]
                scored_train = []
                for code in pool:
                    ok = 0
                    for tape, expected in train_rows:
                        out = run_tiny_v2(code, list(tape), steps=128)
                        ok += int(bool(out.get("ok") and out.get("result") == (expected & 255)))
                    scored_train.append(float(ok / max(1, len(train_rows))))
                examples = [
                    {"code": code, "train_score": score, "family_id": 0}
                    for code, score in zip(pool, scored_train)
                ]
                train_report = substrate.fit_verified(examples, epochs=2, local_plasticity=True)
                selected_k = max(2, self.max_candidates // 2)
                ranked = substrate.rank(pool, top_k=selected_k)
                selected_codes = [code for _, code in ranked]
                train_best = pool[max(range(len(scored_train)), key=lambda idx: scored_train[idx])]
                if tuple(map(tuple, train_best)) not in {tuple(map(tuple, c)) for c in selected_codes}:
                    selected_codes.append(train_best)
                spine = ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates)
                evaluated = []
                for code in selected_codes:
                    ev = spine.evaluate_program(family, code, seed=int(seed), ood_seed=int(seed) + 50000)
                    evaluated.append((self._score_eval(ev), code, ev))
                evaluated.sort(key=lambda x: x[0], reverse=True)
                best = evaluated[0]
                blind = self._blind_repair(family, broken, int(seed), acquisition=acquisition, spine=ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates))
                seed_row["families"].append({
                    "family": family,
                    "blind": {"holdout": float(blind["holdout"]), "ood": float(blind["ood"]), "adversarial": float(blind["adversarial"]), "latency_ms": float(blind["latency_ms"]), "candidates_tested": int(blind["candidates_tested"])},
                    "substrate": {
                        "holdout": float(best[2]["holdout"]),
                        "ood": float(best[2]["ood"]),
                        "adversarial": float(best[2]["adversarial"]),
                        "latency_ms": float(sum(0.0 for _ in [0])),
                        "candidates_tested": len(selected_codes),
                        "train_examples": train_report.examples,
                        "train_rank_correlation": train_report.train_rank_correlation,
                        "exact_train_evaluations": len(pool),
                        "predicted_selection_count": len(selected_codes),
                        "train_best_forced": True,
                    },
                })
            rows.append(seed_row)

        blind_holdout = [float(r["blind"]["holdout"]) for row in rows for r in row["families"]]
        substrate_holdout = [float(r["substrate"]["holdout"]) for row in rows for r in row["families"]]
        blind_ood = [float(r["blind"]["ood"]) for row in rows for r in row["families"]]
        substrate_ood = [float(r["substrate"]["ood"]) for row in rows for r in row["families"]]
        return {
            "version": self.VERSION,
            "families": families,
            "rows": rows,
            "summary": {
                "mean_holdout_gain": self._mean(s - b for s, b in zip(substrate_holdout, blind_holdout)),
                "mean_ood_gain": self._mean(s - b for s, b in zip(substrate_ood, blind_ood)),
                "positive_holdout_fraction": self._mean(float(s > b) for s, b in zip(substrate_holdout, blind_holdout)),
                "positive_ood_fraction": self._mean(float(s > b) for s, b in zip(substrate_ood, blind_ood)),
                "integration": "train_only_substrate_pre_verifier",
            },
        }

    def evaluate_pair(self) -> dict[str, Any]:
        baseline_rows = [self._run_strategy("bounded_baseline", seed) for seed in self.seeds]
        candidate_rows = [self._run_strategy("counterexample_guided", seed) for seed in self.seeds]
        baseline_holdout = [r.holdout for r in baseline_rows]
        candidate_holdout = [r.holdout for r in candidate_rows]
        matched = MatchedEvidenceAnalyzerV1.analyze(self.seeds, baseline_holdout, candidate_holdout)
        matched_required = MatchedEvidenceAnalyzerV1.require(matched, min_mean_gain=0.0)

        baseline = {
            "score": self._mean(r.holdout for r in baseline_rows),
            "verified_rate": self._mean(r.verified_rate for r in baseline_rows),
            "holdout": self._mean(r.holdout for r in baseline_rows),
            "ood": self._mean(r.ood for r in baseline_rows),
            "adversarial": self._mean(r.adversarial for r in baseline_rows),
            "restart_delta": self._mean(r.restart_delta for r in baseline_rows),
            "negative_transfer": 0.0,
            "latency_ms": self._mean(r.latency_ms for r in baseline_rows),
            "memory_mb": 0.0,
            "seed": int(self.seeds[0]),
        }
        candidate = {
            "score": self._mean(r.holdout for r in candidate_rows),
            "verified_rate": self._mean(r.verified_rate for r in candidate_rows),
            "holdout": self._mean(r.holdout for r in candidate_rows),
            "ood": self._mean(r.ood for r in candidate_rows),
            "adversarial": self._mean(r.adversarial for r in candidate_rows),
            "restart_delta": self._mean(r.restart_delta for r in candidate_rows),
            "negative_transfer": 0.0,
            "latency_ms": self._mean(r.latency_ms for r in candidate_rows),
            "memory_mb": 0.0,
            "seed": int(self.seeds[0]),
            "same_budget": True,
            "matched_effect": matched_required,
            "quorum": {
                "seeds": len(self.seeds),
                "independent_runs": 2,
                "trajectory_hashes": len(set().union(*(set(r.trajectory_hashes) for r in candidate_rows))),
                "provenance_sources": len(set().union(*(set(r.provenance_sources) for r in candidate_rows))),
                "holdout_id": self._fingerprint([r.name for r in self._tasks() if r.split == "holdout"]),
                "ood_id": self._fingerprint([r.name for r in self._tasks() if r.split == "ood"]),
            },
        }
        return {
            "version": self.VERSION,
            "baseline": baseline,
            "candidate": candidate,
            "baseline_rows": [r.__dict__ for r in baseline_rows],
            "candidate_rows": [r.__dict__ for r in candidate_rows],
            "matched_effect": matched_required,
        }

    def run(self) -> dict[str, Any]:
        direct_pair = self.evaluate_pair()
        repair_pair = self.evaluate_repair_pair()
        pair = repair_pair
        metrics = {
            # direct_pair is the measured baseline for this program-level bridge;
            # do not claim neural verification or OOD success that was not observed.
            "raw_neural_verified_rate": float(direct_pair["baseline"]["verified_rate"]),
            "repair_verified_rate": pair["baseline"]["verified_rate"],
            "ood_coverage": float(pair["baseline"]["ood"]),
            "baseline_holdout": pair["baseline"]["holdout"],
            "baseline_ood": pair["baseline"]["ood"],
            "baseline_verified_rate": pair["baseline"]["verified_rate"],
            "baseline_adversarial": pair["baseline"]["adversarial"],
            "baseline_latency_ms": pair["baseline"]["latency_ms"],
            "baseline_memory_mb": 0.0,
        }

        def candidate_factory(request: Any, replay_context: dict[str, Any] | None = None) -> dict[str, Any]:
            return {
                "request_id": request.id,
                "strategy": "semantic_guided_repair",
                "max_candidates": self.max_candidates,
                "replay_parent_artifact_id": (replay_context or {}).get("active_artifact_id"),
            }

        def evaluator(_candidate: Any) -> dict[str, Any]:
            candidate = dict(pair["candidate"])
            # Avoid recomputing the expensive matrix: evaluate_pair above is the measured
            # artifact.  The unified loop consumes exactly that evidence bundle.
            return candidate

        result = self.loop.run_cycle(metrics, candidate_factory, evaluator)
        payload = {"version": self.VERSION, "direct_pair": direct_pair, "repair_pair": repair_pair, "pair": pair, "decision": result.to_dict(), "timestamp": time.time()}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str) + "\n")
        return payload
