from __future__ import annotations

"""1.29 open-ended capability evolution benchmark.

Selection uses TRAIN only.  HOLDOUT, FUTURE-HOLDOUT and cross-family transfer
are opened only after a candidate has been fixed.  This closes the previous
selection leakage where holdout could influence candidate choice.
"""

from pathlib import Path
from typing import Any
import hashlib
import json

from .capability_evolver_v1 import CapabilityEvolverV1
from .gradual_drift_benchmark_v1 import GradualDriftBenchmarkV1
from .elastic_substrate_policy_v1 import ElasticSubstratePolicyV1
from .neural_substrate_v1 import ModernNeuralSubstrateV1
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .capability_transfer_evaluator_v1 import CapabilityTransferEvaluatorV1
from .multi_source_generalist_evolution_v1 import MultiSourceGeneralistEvolutionV1


class OpenEndedEvolutionBenchmarkV1:
    VERSION = "1.29.0-dev"

    def __init__(self, root: Path, seed: int = 29101):
        self.root = Path(root)
        self.seed = int(seed)

    @staticmethod
    def _fp(value: Any) -> str:
        return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()[:20]

    @staticmethod
    def _recovery_lag(scores: list[float], *, drop_fraction: float = 0.80, recovery_fraction: float = 0.90) -> int | None:
        if len(scores) < 2:
            return 0
        anchor = float(scores[0])
        if anchor <= 0.0:
            return 0
        drop = next((i for i, score in enumerate(scores[1:], start=1) if float(score) < anchor * drop_fraction), None)
        if drop is None:
            return 0
        target = anchor * recovery_fraction
        recover = next((i for i, score in enumerate(scores[drop:], start=drop) if float(score) >= target), None)
        return len(scores) - drop if recover is None else recover - drop

    def run_seed(self, seed: int) -> dict[str, Any]:
        seed = int(seed)
        drift = GradualDriftBenchmarkV1(self.root, seed=seed + 11)
        evolver = CapabilityEvolverV1(self.root, seed=seed + 13)
        acq = ProgramAcquisitionCoreV2(self.root, seed=seed + 17)
        cases = [("sum3", "xor3"), ("mul2", "sub_offset")]
        families = []
        for family_a, family_b in cases:
            stream = drift.build_stream(family_a, family_b, phases=5, rows_per_phase=10)
            incumbent = [tuple(x) for x in acq.templates(family_a)[0]]
            static_scores: list[float] = []
            evolved_scores: list[float] = []
            future_scores: list[float] = []
            train_scores: list[float] = []
            ranks: list[int] = []
            discovery_counts: list[int] = []
            selections: list[dict[str, Any]] = []
            for phase in stream:
                _, static_hvm = drift._evaluate_program(incumbent, phase.holdout_rows)
                static_scores.append(static_hvm)
                report = evolver.discover(
                    family_a,
                    incumbent,
                    phase.train_rows,
                    budget=8,
                    generations=2,
                )
                candidate = [tuple(x) for x in (report.best_code or tuple(incumbent))]
                # Candidate is selected exclusively from TRAIN by CapabilityEvolverV1.
                train_tiny, train_hvm = drift._evaluate_program(candidate, phase.train_rows)
                hold_tiny, hold_hvm = drift._evaluate_program(candidate, phase.holdout_rows)
                future_tiny, future_hvm = drift._evaluate_program(candidate, phase.future_holdout)
                incumbent_train_hvm = drift._evaluate_program(incumbent, phase.train_rows)[1]
                train_scores.append(float(train_hvm))
                evolved_scores.append(float(hold_hvm))
                future_scores.append(float(future_hvm))
                discovery_counts.append(report.candidates)
                rank = 1 if train_hvm >= incumbent_train_hvm else 2
                ranks.append(rank)
                selected_fp = self._fp(candidate)
                incumbent_before = [tuple(x) for x in incumbent]
                selections.append({
                    "phase": int(phase.index),
                    "selection_source": "train_only",
                    "candidate_fingerprint": selected_fp,
                    "train_tiny": float(train_tiny),
                    "train_hvm": float(train_hvm),
                    "holdout_hvm": float(hold_hvm),
                    "future_hidden_hvm": float(future_hvm),
                    "future_holdout_opened_after_selection": True,
                    "best_operator": report.best_operator,
                    "baseline_program": [list(x) for x in incumbent_before],
                    "selected_program": [list(x) for x in candidate],
                    "train_selected": float(train_hvm),
                    "train_baseline": float(incumbent_train_hvm),
                    "candidate_count": int(report.candidates),
                    "selected_candidate_hash": selected_fp,
                })
                if train_hvm > drift._evaluate_program(incumbent, phase.train_rows)[1] + 1e-9:
                    incumbent = candidate
            phase_gains = [e - s for e, s in zip(evolved_scores, static_scores)]
            future_gains = [f - s for f, s in zip(future_scores, static_scores)]
            train_selected_rows = sorted(
                selections,
                key=lambda row: (float(row.get("train_hvm", 0.0)) - float(row.get("train_baseline", 0.0)), -int(row.get("candidate_count", 10**9))),
                reverse=True,
            )
            families.append({
                "source_family": family_a,
                "target_family": family_b,
                "static_scores": static_scores,
                "evolved_scores": evolved_scores,
                "future_hidden_scores": future_scores,
                "phase_gains": phase_gains,
                "future_hidden_gains": future_gains,
                "static_mean": sum(static_scores) / max(1, len(static_scores)),
                "evolved_mean": sum(evolved_scores) / max(1, len(evolved_scores)),
                "future_hidden_mean": sum(future_scores) / max(1, len(future_scores)),
                "mean_phase_gain": sum(phase_gains) / max(1, len(phase_gains)),
                "mean_future_hidden_gain": sum(future_gains) / max(1, len(future_gains)),
                "final_gain": evolved_scores[-1] - static_scores[-1],
                "future_final_gain": future_scores[-1] - static_scores[-1],
                "adaptation_recovery_lag": self._recovery_lag(evolved_scores),
                "mean_candidate_rank": sum(ranks) / max(1, len(ranks)),
                "candidate_counts": discovery_counts,
                "selection_audit": selections,
                "best_train_only_candidate": train_selected_rows[0] if train_selected_rows else None,
            })

        substrate = ModernNeuralSubstrateV1(6, exc_neurons=4, inh_neurons=2, seed=seed + 29)
        elastic = ElasticSubstratePolicyV1(seed=seed + 31)
        structural = []
        for uncertainty, plasticity_gap, target in ((0.8, 0.30, 0.70), (0.2, -0.05, 0.60), (0.2, -0.20, 0.50)):
            plan = elastic.propose(
                active_fraction=float(substrate.synapse_mask.mean()),
                target_fraction=target,
                uncertainty=uncertainty,
                plasticity_gap=plasticity_gap,
            )
            evaluator = elastic.structural_evaluator(plan)
            # One controlled negative transaction is intentional: it validates the
            # rollback branch under a stricter downstream gate instead of relying on
            # stochastic utility to happen to reject a proposal. The penalty applies
            # only when topology actually changes, so the pre-transaction score stays
            # unchanged while the mutated state is correctly rejected.
            if len(structural) == 2 and plan.mode != "defer":
                base_evaluator = evaluator
                active_before = int((substrate.synapse_mask > 0).sum().item())
                def strict_negative_probe(candidate, _base=base_evaluator, _active=active_before):
                    active_after = int((candidate.synapse_mask > 0).sum().item())
                    return float(_base(candidate)) - (0.20 if active_after != _active else 0.0)
                evaluator = strict_negative_probe
            result = elastic.apply(
                substrate, plan, evaluator=evaluator, min_gain=0.0
            )
            structural.append({"plan": plan.to_dict(), "result": result.to_dict(), "evaluator": "strict_negative_probe" if len(structural) == 2 and plan.mode != "defer" else "structural_health"})
        return {"version": self.VERSION, "seed": seed, "families": families, "structural": structural}

    def run(self, seeds=(2901, 2902, 2903)) -> dict[str, Any]:
        rows = [self.run_seed(seed) for seed in seeds]
        family_rows = [f for r in rows for f in r["families"]]
        static_mean = sum(x["static_mean"] for x in family_rows) / max(1, len(family_rows))
        evolved_mean = sum(x["evolved_mean"] for x in family_rows) / max(1, len(family_rows))
        final_gain = sum(x["final_gain"] for x in family_rows) / max(1, len(family_rows))
        phase_gain = sum(x["mean_phase_gain"] for x in family_rows) / max(1, len(family_rows))
        future_gain = sum(x["mean_future_hidden_gain"] for x in family_rows) / max(1, len(family_rows))
        future_positive = sum(x["mean_future_hidden_gain"] > 0.0 for x in family_rows) / max(1, len(family_rows))
        rollback = sum(int(x["result"]["rollback"]) for r in rows for x in r["structural"])
        commit = sum(int(x["result"]["accepted"]) for r in rows for x in r["structural"])
        transfer = CapabilityTransferEvaluatorV1(self.root, seed=self.seed + 901).run(
            pairs=(("sum3", "xor3"), ("xor3", "sum3"), ("mul2", "sum3")),
            seeds=tuple(int(x) + 6000 for x in seeds),
        )
        generalist = MultiSourceGeneralistEvolutionV1(self.root, seed=self.seed + 1901).run(
            source_families=("sum3", "xor3", "mul2", "sub_offset"),
            target_families=("minmax3", "sequence_diff", "nested3", "compose_sum_xor"),
            seeds=tuple(int(x) + 8000 for x in seeds),
            candidate_cap=384,
        )
        evidence = {
            "version": self.VERSION,
            "seeds": [int(x) for x in seeds],
            "runs": rows,
            "selection_protocol": "train_only_selection_then_holdout_future_hidden_and_cross_family_transfer",
            "summary": {
                "static_mean": static_mean,
                "evolved_mean": evolved_mean,
                "mean_final_gain": final_gain,
                "mean_phase_gain": phase_gain,
                "mean_future_hidden_gain": future_gain,
                "future_hidden_positive_fraction": future_positive,
                "structural_rollbacks": rollback,
                "structural_commits": commit,
                "capability_transfer": transfer["summary"],
                "generalist_unseen_family": generalist["summary"],
                "promotion": "research-only",
                "reason": "open_ended_evolution_requires_positive_multi_seed_holdout_future_gain_and_transfer_generalization",
            },
            "transfer": transfer,
            "generalist_unseen_family": generalist,
        }
        path = self.root / "runtime" / "nomega_1_29_open_ended_multiseed.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(evidence, indent=2, sort_keys=True), encoding="utf-8")
        return evidence


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    print(json.dumps(OpenEndedEvolutionBenchmarkV1(root).run(), indent=2, sort_keys=True))
