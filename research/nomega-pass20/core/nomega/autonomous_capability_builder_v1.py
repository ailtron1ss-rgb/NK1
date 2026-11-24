from __future__ import annotations

"""Promotion-eligible autonomous capability builder.

Builds a concrete executable capability artifact outside the source tree, validates
it with matched multi-seed execution/verification, records an immutable manifest,
and promotes it into the runtime artifact lifecycle only when every gate passes.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Mapping, Sequence
import hashlib
import json
import time
import zipfile

from .candidate_artifact_lifecycle_v1 import CandidateArtifactLifecycleV1
from .executable_spine_v2 import ExecutableSpineV2
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .verified_neural_substrate_bridge_v1 import VerifiedNeuralSubstrateBridgeV1
from .task_spec_v1 import FAMILY_TO_ID

Program = list[tuple[int, int, int]]


@dataclass(frozen=True)
class AutonomousBuildReportV1:
    version: str
    build_id: str
    family: str
    accepted: bool
    promotion_eligible: bool
    mean_holdout_gain: float
    mean_ood_gain: float
    positive_seed_fraction: float
    verified_seed_fraction: float
    restart_consistent: bool
    equal_budget: bool
    artifact_id: str | None
    parent_artifact_id: str | None
    archive_path: str | None
    manifest_path: str
    reason: str
    seeds: tuple[int, ...]
    candidate_hash: str
    substrate_guided: bool = False
    substrate_exact_train_evaluations: int = 0
    substrate_predicted_evaluations: int = 0
    substrate_rank_correlation: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        row = asdict(self)
        row["seeds"] = list(self.seeds)
        return row


class AutonomousCapabilityBuilderV1:
    VERSION = "autonomous-capability-builder-v1"

    def __init__(self, root: Path, *, seed: int = 26071, max_candidates: int = 16):
        self.root = Path(root)
        self.seed = int(seed)
        self.max_candidates = max(2, int(max_candidates))
        self.lifecycle = CandidateArtifactLifecycleV1(self.root)
        self.build_root = self.root / "runtime" / "autonomous_builds_v1"
        self.index_path = self.root / "runtime" / "autonomous_builder_v1.jsonl"

    @staticmethod
    def _normalize(code: Sequence[Sequence[int]]) -> Program:
        out: Program = []
        for row in code:
            if len(row) < 3:
                raise ValueError("program instruction must contain at least three integers")
            out.append((int(row[0]), int(row[1]), int(row[2])))
        if not out:
            raise ValueError("program must not be empty")
        return out

    @staticmethod
    def _hash(value: Any) -> str:
        payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()[:24]

    def _evaluate_pair(self, family: str, baseline: Program, candidate: Program, seed: int) -> dict[str, Any]:
        spine = ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates)
        started = time.perf_counter()
        base = spine.evaluate_program(family, baseline, seed=int(seed), ood_seed=int(seed) + 10001)
        cand = spine.evaluate_program(family, candidate, seed=int(seed), ood_seed=int(seed) + 10001)
        elapsed = (time.perf_counter() - started) * 1000.0

        restart = ExecutableSpineV2(self.root, seed=int(seed), max_candidates=self.max_candidates)
        restart_eval = restart.evaluate_program(family, candidate, seed=int(seed), ood_seed=int(seed) + 10001)
        restart_delta = float(restart_eval["holdout"]) - float(cand["holdout"])
        return {
            "seed": int(seed),
            "baseline": base,
            "candidate": cand,
            "holdout_gain": float(cand["holdout"] - base["holdout"]),
            "ood_gain": float(cand["ood"] - base["ood"]),
            "restart_delta": restart_delta,
            "latency_ms": elapsed,
            "equal_budget": True,
        }

    def _train_score(self, family: str, code: Program, seed: int) -> float:
        acq = ProgramAcquisitionCoreV2(self.root, seed=int(seed) + 17)
        train, _holdout, _adv = acq._examples(family, int(seed))
        ok = 0
        for tape, expected in train:
            from .program_runtime_v2 import run_tiny_v2
            result = run_tiny_v2(code, tape, steps=512)
            ok += int(bool(result.get("ok") and result.get("result") == (expected & 255)))
        return ok / max(1, len(train))

    def _train_only_refine(self, family: str, code: Program, seeds: Sequence[int], *, rounds: int = 3, budget: int | None = None, substrate_guided: bool = True) -> tuple[Program, dict[str, Any]]:
        """Improve a candidate using TRAIN only; never opens HOLDOUT/FUTURE during construction."""
        current = [tuple(x) for x in code]
        cap = max(8, int(budget or self.max_candidates))
        substrate = VerifiedNeuralSubstrateBridgeV1(seed=self.seed + 7001) if substrate_guided else None
        guidance_examples: list[dict[str, Any]] = []
        exact_evals = 0
        predicted_evals = 0
        last_rank_corr = 0.0
        for round_index in range(max(0, int(rounds))):
            seed = int(seeds[round_index % len(seeds)]) if seeds else self.seed + round_index
            acq = ProgramAcquisitionCoreV2(self.root, seed=seed + 17 + round_index)
            raw_mutations = list(acq._mutate(current, n=max(cap * 2, cap + 4)))
            pool = [current] + [[tuple(x) for x in candidate] for candidate in raw_mutations]
            # First round needs exact TRAIN labels to bootstrap the substrate. Later
            # rounds use the learned substrate only to select a small exact-eval subset.
            if substrate is not None and guidance_examples and substrate.report() is not None:
                select_k = min(max(2, cap // 2), len(pool))
                ranked = substrate.rank(pool, family_id=int(FAMILY_TO_ID.get(family, 0)), top_k=select_k)
                selected = [row[1] for row in ranked]
                predicted_evals += len(selected)
            else:
                selected = pool[:cap]

            scored_rows = []
            for cand in selected:
                train_score = self._train_score(family, cand, seed)
                exact_evals += 1
                scored_rows.append((train_score, -len(cand), cand))
                if substrate is not None:
                    guidance_examples.append({"code": cand, "train_score": train_score, "family_id": int(FAMILY_TO_ID.get(family, 0))})
            if substrate is not None and guidance_examples:
                report = substrate.fit_verified(guidance_examples[-min(len(guidance_examples), cap * 2):], epochs=4, local_plasticity=True)
                last_rank_corr = float(report.train_rank_correlation)

            scored_rows.sort(key=lambda row: (float(row[0]), int(row[1])), reverse=True)
            best = scored_rows[0][2]
            current_score = self._train_score(family, current, seed)
            if float(scored_rows[0][0]) > float(current_score):
                current = [tuple(x) for x in best]
            # Do not terminate after a non-improving round: the next round is still
            # allowed to use the learned substrate ranking to search a new mutation
            # neighborhood. This keeps the neural guide on the actual development path.

        guidance_report = {
            "enabled": bool(substrate is not None),
            "exact_train_evaluations": int(exact_evals),
            "predicted_evaluations": int(predicted_evals),
            "rank_correlation": float(last_rank_corr),
            "examples": len(guidance_examples),
        }
        return current, guidance_report

    def build(
        self,
        *,
        family: str,
        candidate_code: Sequence[Sequence[int]],
        baseline_code: Sequence[Sequence[int]],
        seeds: Sequence[int] = (26071, 26072, 26073),
        context: Mapping[str, Any] | None = None,
        min_mean_holdout_gain: float = 0.01,
        min_mean_ood_gain: float = 0.0,
        substrate_guided: bool = True,
    ) -> dict[str, Any]:
        family = str(family)
        candidate = self._normalize(candidate_code)
        baseline = self._normalize(baseline_code)
        seed_values = tuple(int(x) for x in seeds)
        if not seed_values:
            raise ValueError("at least one seed is required")

        # Builder search is TRAIN-only and semantics-free: it can refine a proposed
        # artifact without ever opening hidden holdout/future data during construction.
        candidate_before_refinement = list(candidate)
        candidate, substrate_guidance = self._train_only_refine(
            family, candidate, seed_values, rounds=3, budget=self.max_candidates, substrate_guided=substrate_guided
        )

        candidate_hash = self._hash({"family": family, "code": candidate})
        build_id = self._hash({"family": family, "candidate_hash": candidate_hash, "seeds": seed_values, "parent": self.lifecycle.replay_context().get("active_artifact_id")})
        build_dir = self.build_root / build_id
        build_dir.mkdir(parents=True, exist_ok=True)

        rows = [self._evaluate_pair(family, baseline, candidate, seed) for seed in seed_values]
        mean_holdout = sum(r["holdout_gain"] for r in rows) / len(rows)
        mean_ood = sum(r["ood_gain"] for r in rows) / len(rows)
        positive_fraction = sum(r["holdout_gain"] > 0.0 for r in rows) / len(rows)
        verified_fraction = sum(bool(r["candidate"].get("verified")) for r in rows) / len(rows)
        restart_consistent = all(abs(float(r["restart_delta"])) <= 1e-9 for r in rows)
        equal_budget = all(bool(r["equal_budget"]) for r in rows)

        gates = {
            "mean_holdout_gain": mean_holdout >= float(min_mean_holdout_gain),
            "mean_ood_gain": mean_ood >= float(min_mean_ood_gain),
            "positive_seed_fraction": positive_fraction >= 2.0 / 3.0,
            "verified_seed_fraction": verified_fraction >= 1.0,
            "restart_consistency": restart_consistent,
            "equal_budget": equal_budget,
        }
        accepted = all(gates.values())
        reason = "all_builder_gates_passed" if accepted else ";".join(name for name, ok in gates.items() if not ok)

        parent = self.lifecycle.current()
        manifest = {
            "version": self.VERSION,
            "build_id": build_id,
            "family": family,
            "candidate_hash": candidate_hash,
            "parent_artifact_id": parent.artifact_id if parent else None,
            "context": dict(context or {}),
            "seeds": list(seed_values),
            "gates": gates,
            "rows": rows,
            "candidate_code_before_refinement": [list(row) for row in candidate_before_refinement],
            "candidate_code": [list(row) for row in candidate],
            "baseline_code": [list(row) for row in baseline],
            "substrate_guidance": substrate_guidance,
            "created_at": time.time(),
        }
        (build_dir / "candidate.json").write_text(json.dumps({"family": family, "code": manifest["candidate_code"]}, indent=2), encoding="utf-8")
        (build_dir / "baseline.json").write_text(json.dumps({"family": family, "code": manifest["baseline_code"]}, indent=2), encoding="utf-8")
        manifest_path = build_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")

        artifact_id = None
        lifecycle_payload = {
            "builder": self.VERSION,
            "family": family,
            "code": [list(row) for row in candidate],
            "candidate_hash": candidate_hash,
            "build_id": build_id,
            "gates": gates,
            "rows": rows,
            "substrate_guidance": substrate_guidance,
        }
        record = self.lifecycle.register_candidate(
            candidate=lifecycle_payload,
            candidate_hash=candidate_hash,
            cycle_id=f"builder-{build_id}",
            experiment_id=build_id,
            evaluation={"gates": gates, "mean_holdout_gain": mean_holdout, "mean_ood_gain": mean_ood},
        )
        self.lifecycle.update_evaluation(record.artifact_id, {"gates": gates, "rows": rows, "candidate_hash": candidate_hash})
        if accepted:
            promoted = self.lifecycle.promote(record.artifact_id, reason=reason)
            artifact_id = promoted.artifact_id
        else:
            self.lifecycle.reject(record.artifact_id, reason=reason)

        archive_path = build_dir.with_suffix(".zip")
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in (build_dir / "candidate.json", build_dir / "baseline.json", manifest_path):
                archive.write(path, arcname=path.name)

        report = AutonomousBuildReportV1(
            version=self.VERSION,
            build_id=build_id,
            family=family,
            accepted=accepted,
            promotion_eligible=accepted,
            mean_holdout_gain=round(mean_holdout, 9),
            mean_ood_gain=round(mean_ood, 9),
            positive_seed_fraction=round(positive_fraction, 9),
            verified_seed_fraction=round(verified_fraction, 9),
            restart_consistent=restart_consistent,
            equal_budget=equal_budget,
            artifact_id=artifact_id,
            parent_artifact_id=parent.artifact_id if parent else None,
            archive_path=str(archive_path),
            manifest_path=str(manifest_path),
            reason=reason,
            seeds=seed_values,
            candidate_hash=candidate_hash,
            substrate_guided=bool(substrate_guidance.get("enabled", False)),
            substrate_exact_train_evaluations=int(substrate_guidance.get("exact_train_evaluations", 0)),
            substrate_predicted_evaluations=int(substrate_guidance.get("predicted_evaluations", 0)),
            substrate_rank_correlation=float(substrate_guidance.get("rank_correlation", 0.0)),
        )
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        with self.index_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(report.to_dict(), sort_keys=True, ensure_ascii=False) + "\n")
        return report.to_dict()
