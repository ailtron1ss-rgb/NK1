from __future__ import annotations

"""Long-horizon no-reset autonomous development runner.

It connects frontier selection, registered interventions, promotion-eligible building,
and persistent artifact lineage.  The runner never resets the lifecycle; every
promoted artifact becomes the parent context for the next cycle.
"""

from pathlib import Path
from typing import Any, Mapping
import json
import time

from .self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1
from .autonomous_capability_builder_v1 import AutonomousCapabilityBuilderV1


class AutonomousDevelopmentRunnerV1:
    VERSION = "autonomous-development-runner-v1"

    def __init__(self, root: Path, *, seed: int = 29117, max_candidates: int = 16):
        self.root = Path(root)
        self.seed = int(seed)
        self.orchestrator = SelfDevelopmentOrchestratorV1(self.root, seed=seed + 1)
        self.builder = AutonomousCapabilityBuilderV1(self.root, seed=seed + 2, max_candidates=max_candidates)
        self.path = self.root / "runtime" / "autonomous_development_runner_v1.jsonl"
        self.state_path = self.root / "runtime" / "autonomous_development_runner_v1.json"
        self.state = self._load()

    def _load(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return {"version": self.VERSION, "runs": [], "cycles": []}
        try:
            blob = json.loads(self.state_path.read_text(encoding="utf-8"))
            if isinstance(blob, dict):
                blob.setdefault("runs", [])
                blob.setdefault("cycles", [])
                blob["version"] = self.VERSION
                return blob
        except (OSError, json.JSONDecodeError, TypeError):
            return {"version": self.VERSION, "runs": [], "cycles": []}
        return {"version": self.VERSION, "runs": [], "cycles": []}

    @staticmethod
    def _next_metrics(previous: Mapping[str, Any] | None) -> dict[str, Any]:
        row = dict(previous or {})
        intervention = str(row.get("action") or row.get("intervention", ""))
        intervention_alias = {
            "generalist_capability_transfer": "learn_multi_source_generalist_operator_policy",
            "capability_transfer": "cross_family_repair_operator_transfer",
            "open_ended_capability_evolution": "evolve_verified_capability",
            "architecture_consolidation": "consolidate_versioned_families",
            "autonomous_capability_builder": "build_and_promote_capability_artifact",
        }
        intervention = intervention_alias.get(intervention, intervention)
        metrics = dict(row.get("metrics") or {})
        # Keep previous measurements as evidence, while making failed generalist
        # transfer the explicit bottleneck for the next cycle.
        # Missing evidence is explicitly UNKNOWN.  Never turn absence of a
        # measurement into optimistic evidence; downstream gates must decide how
        # to handle an unknown metric rather than receiving a fabricated success.
        metrics.setdefault("normalized_search_cost", None)
        metrics.setdefault("raw_neural_verified_rate", None)
        metrics.setdefault("repair_verified_rate", None)
        metrics.setdefault("ood_coverage", None)
        metrics.setdefault("transfer_generalization", None)
        metrics.setdefault("generalist_unseen_family_future_gain", None)
        if intervention == "learn_multi_source_generalist_operator_policy":
            metrics["generalist_unseen_family_future_gain"] = float(metrics.get("builder_ood_gain", metrics.get("generalist_unseen_family_future_gain") if metrics.get("generalist_unseen_family_future_gain") is not None else 0.0))
        return metrics

    def run(
        self,
        *,
        cycles: int = 3,
        intervention_context: Mapping[str, Any] | None = None,
        builder_seeds: tuple[int, ...] = (29117, 29118, 29119),
    ) -> dict[str, Any]:
        started = time.perf_counter()
        previous: dict[str, Any] = {}
        rows: list[dict[str, Any]] = []
        base_context = dict(intervention_context or {})

        refresh_every = max(0, int(base_context.pop("refresh_interventions_every", 0)))
        for index in range(max(1, int(cycles))):
            metrics = self._next_metrics(previous)
            context = dict(base_context)
            if refresh_every > 0:
                context["reuse_cached"] = bool(index > 0 and index % refresh_every != 0)
            intervention = self.orchestrator.run_autonomous_intervention(metrics, context=context)
            intervention_result = intervention["intervention"]
            selected_action = str((intervention.get("frontier") or {}).get("selected", {}).get("action", ""))
            build_report = None

            if intervention_result.get("name") in {
                "generalist_capability_transfer",
                "capability_transfer",
                "open_ended_capability_evolution",
            }:
                selected = list((intervention_result.get("summary") or {}).get("selected_candidates") or [])
                # STRICT: candidate choice uses TRAIN evidence only. HOLDOUT/FUTURE are
                # opened only inside the promotion-eligible builder.
                selected.sort(
                    key=lambda row: (
                        float(row.get("train_selected", row.get("train_hvm", row.get("transferred_train_score", 0.0)))) -
                        float(row.get("train_baseline", row.get("target_train_baseline", row.get("target_broken_train_score", 0.0)))),
                        -int(row.get("candidate_count", row.get("candidates_tested", 10**9))),
                    ),
                    reverse=True,
                )
                active = self.builder.lifecycle.current()
                active_code = None
                if active is not None and isinstance(active.payload, dict):
                    active_code = active.payload.get("code")
                for portfolio_rank, best in enumerate(selected[:8]):
                    if not best.get("selected_program") or not best.get("baseline_program"):
                        continue
                    selected_code = [list(map(int, row[:3])) for row in best["selected_program"]]
                    if active_code is not None:
                        active_norm = [list(map(int, row[:3])) for row in active_code]
                        if selected_code == active_norm:
                            build_report = {
                                "accepted": False,
                                "promotion_eligible": False,
                                "artifact_id": active.artifact_id,
                                "parent_artifact_id": active.parent_artifact_id,
                                "mean_holdout_gain": float((active.evaluation or {}).get("mean_holdout_gain", 0.0)),
                                "mean_ood_gain": float((active.evaluation or {}).get("mean_ood_gain", 0.0)),
                                "positive_seed_fraction": float((active.evaluation or {}).get("positive_seed_fraction", 1.0)),
                                "retained_active": True,
                                "substrate_guided": False,
                                "substrate_exact_train_evaluations": 0,
                                "substrate_predicted_evaluations": 0,
                                "substrate_rank_correlation": 0.0,
                            }
                            break
                    build_report = self.builder.build(
                        family=str(best["target_family"]),
                        candidate_code=best["selected_program"],
                        baseline_code=best["baseline_program"],
                        seeds=builder_seeds,
                        context={
                            "cycle_index": index,
                            "portfolio_rank": portfolio_rank,
                            "source_families": best.get("source_families", ()),
                            "selected_candidate_hash": best.get("selected_candidate_hash", best.get("candidate_fingerprint", "")),
                            "selection_protocol": "train_only",
                        },
                        min_mean_holdout_gain=0.01,
                        min_mean_ood_gain=0.0,
                    )
                    if bool(build_report.get("accepted")) or bool(build_report.get("retained_active")):
                        break

            # A cycle that produces no new promotion must still carry forward the
            # real active artifact.  This is retention of measured state, not a
            # fabricated success metric, and preserves no-reset lineage semantics.
            if build_report is None:
                active = self.builder.lifecycle.current()
                if active is not None:
                    evaluation = active.evaluation or {}
                    build_report = {
                        "accepted": False,
                        "promotion_eligible": False,
                        "artifact_id": active.artifact_id,
                        "parent_artifact_id": active.parent_artifact_id,
                        "mean_holdout_gain": float(evaluation.get("mean_holdout_gain", 0.0)),
                        "mean_ood_gain": float(evaluation.get("mean_ood_gain", 0.0)),
                        "positive_seed_fraction": float(evaluation.get("positive_seed_fraction", 0.0)),
                        "retained_active": True,
                        "substrate_guided": False,
                        "substrate_exact_train_evaluations": 0,
                        "substrate_predicted_evaluations": 0,
                        "substrate_rank_correlation": 0.0,
                    }

            cycle_metrics = dict(intervention.get("metrics") or {})
            if build_report:
                cycle_metrics.update({
                    "builder_holdout_gain": float(build_report["mean_holdout_gain"]),
                    "builder_ood_gain": float(build_report["mean_ood_gain"]),
                    "builder_positive_seed_fraction": float(build_report["positive_seed_fraction"]),
                    "builder_substrate_guided": bool(build_report.get("substrate_guided", False)),
                    "builder_substrate_exact_train_evaluations": int(build_report.get("substrate_exact_train_evaluations", 0)),
                    "builder_substrate_predicted_evaluations": int(build_report.get("substrate_predicted_evaluations", 0)),
                    "builder_substrate_rank_correlation": float(build_report.get("substrate_rank_correlation", 0.0)),
                })
            row = {
                "cycle_index": index,
                "cycle_id": intervention["cycle_id"],
                "bottleneck": intervention["frontier"]["selected"]["name"],
                "intervention": intervention_result.get("name"),
                "action": selected_action,
                "status": intervention_result.get("status"),
                "promotion_eligible": bool((build_report or {}).get("promotion_eligible", False)),
                "accepted": bool((build_report or {}).get("accepted", False)),
                "retained_active": bool((build_report or {}).get("retained_active", False)),
                "artifact_id": (build_report or {}).get("artifact_id"),
                "parent_artifact_id": (build_report or {}).get("parent_artifact_id"),
                "metrics": cycle_metrics,
                "frontier_decision_id": intervention["frontier"]["decision_id"],
                "elapsed_s": round(time.perf_counter() - started, 6),
            }
            rows.append(row)
            previous = row
            self.state["cycles"].append(row)
            self.state["cycles"] = self.state["cycles"][-512:]
            self._append(row)

        report = {
            "version": self.VERSION,
            "cycles": rows,
            "cycle_count": len(rows),
            "accepted_builds": sum(bool(row["accepted"]) for row in rows),
            "no_reset": True,
            "active_artifact": self.builder.lifecycle.replay_context().get("active_artifact"),
            "lineage_depth": int((self.builder.lifecycle.current().lineage_depth if self.builder.lifecycle.current() else -1)),
            "elapsed_s": time.perf_counter() - started,
            "status": "completed",
        }
        self.state["runs"].append(report)
        self.state["runs"] = self.state["runs"][-128:]
        self._save()
        return report

    def _append(self, row: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, sort_keys=True, ensure_ascii=False, default=str) + "\n")

    def _save(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(self.state, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
