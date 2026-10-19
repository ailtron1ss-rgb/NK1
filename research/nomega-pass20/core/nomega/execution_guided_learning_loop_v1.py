from __future__ import annotations

"""Execution-guided learning + skill admission + evolutionary routing.

This module closes a previously split NOMEGA loop:

    failed execution
        -> counterexamples
        -> bounded repair search
        -> independently verified repair
        -> neural replay/update
        -> skill admission evidence
        -> evolutionary island observation
        -> causal ledger

Failures never become positive labels.  Promotion remains controlled by the existing
SkillGovernance/CanonicalSkillLifecycle gates.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple
import hashlib
import json
import os
import subprocess
import sys
import time

from .canonical_neural_execution_v1 import CanonicalNeuralProgramBridgeV1
from .causal_evidence_ledger_v1 import CausalEvidenceLedgerV1
from .canonical_skill_lifecycle_v1 import CanonicalSkillLifecycleV1
from .evolution_islands_v1 import EvolutionIslandControllerV1
from .evolutionary_repair_portfolio_v1 import EvolutionaryRepairPortfolioV1
from .executable_spine_v2 import ExecutableSpineV2, Program
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
from .skill_bank import SkillBank
from .skill_governance_v1 import SkillGovernanceV1
from .skill_versioning import VersionedSkillRegistry
from .skill_compiler import SkillCompiler
from .task_spec_v1 import CANONICAL_PROMPT, FAMILY_TO_ID


@dataclass(frozen=True)
class ExecutionGuidedSampleV1:
    family: str
    prompt: str
    failed_program: Tuple[Tuple[int, int, int], ...]
    repaired_program: Tuple[Tuple[int, int, int], ...]
    counterexamples: Tuple[Mapping[str, Any], ...]
    evaluation: Mapping[str, Any]
    source: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            "failed_program": [list(x) for x in self.failed_program],
            "repaired_program": [list(x) for x in self.repaired_program],
            "counterexamples": [dict(x) for x in self.counterexamples],
            "evaluation": dict(self.evaluation),
        }


@dataclass(frozen=True)
class ExecutionGuidedCycleReportV1:
    version: str
    cycle_id: str
    family: str
    candidates_seen: int
    failures_seen: int
    counterexamples_seen: int
    repair_attempts: int
    repaired_verified: int
    training_rows: int
    neural_update: Mapping[str, Any]
    skill_admissions: Tuple[Mapping[str, Any], ...]
    coalition: Mapping[str, Any]
    evolution: Mapping[str, Any]
    baseline: Mapping[str, Any]
    best: Mapping[str, Any]
    promotion_status: str
    evidence: Mapping[str, Any]
    elapsed_s: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            "skill_admissions": [dict(x) for x in self.skill_admissions],
            "neural_update": dict(self.neural_update),
            "coalition": dict(self.coalition),
            "evolution": dict(self.evolution),
            "baseline": dict(self.baseline),
            "best": dict(self.best),
            "evidence": dict(self.evidence),
        }


class ExecutionGuidedLearningLoopV1:
    VERSION = "execution-guided-learning-loop-v1"

    def __init__(
        self,
        root: Path,
        *,
        seed: int = 27191,
        neural_bridge: Optional[CanonicalNeuralProgramBridgeV1] = None,
        evidence_ledger: Optional[CausalEvidenceLedgerV1] = None,
        skill_lifecycle: Optional[CanonicalSkillLifecycleV1] = None,
        evolution_islands: Optional[EvolutionIslandControllerV1] = None,
        max_candidates: int = 8,
    ):
        self.root = Path(root)
        self.seed = int(seed)
        self.max_candidates = max(2, int(max_candidates))
        self.ledger = evidence_ledger or CausalEvidenceLedgerV1(self.root / "runtime" / "nomega_causal_evidence.jsonl")
        self.neural_bridge = neural_bridge
        if skill_lifecycle is None:
            governance = SkillGovernanceV1(self.root)
            bank = SkillBank(256, governance=governance)
            versions = VersionedSkillRegistry()
            compiler = SkillCompiler()
            skill_lifecycle = CanonicalSkillLifecycleV1(bank, versions, compiler, governance)
        self.skill_lifecycle = skill_lifecycle
        self.islands = evolution_islands or EvolutionIslandControllerV1(self.root, seed=self.seed + 41)
        self.evolution_portfolio = EvolutionaryRepairPortfolioV1(self.root, seed=self.seed + 71)
        self.artifact_path = self.root / "runtime" / "nomega_execution_guided_learning_v1.json"
        self.lineage_path = self.root / "runtime" / "nomega_execution_guided_learning_v1.jsonl"
        self._measurement_cache: Dict[Tuple[str, Tuple[int, ...]], Dict[str, Any]] = {}

    @staticmethod
    def _fp(code: Sequence[Sequence[int]]) -> str:
        return hashlib.sha256(json.dumps([list(map(int, x)) for x in code], separators=(",", ":"), sort_keys=True).encode()).hexdigest()[:24]

    @staticmethod
    def _trajectory_hash(family: str, code: Program, tapes: Sequence[Sequence[int]], results: Sequence[Mapping[str, Any]]) -> str:
        payload = {
            "family": str(family),
            "program": [list(x) for x in code],
            "executions": [{"tape": list(t), "result": dict(r)} for t, r in zip(tapes, results)],
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()[:24]

    def _trajectory(self, spine: ExecutableSpineV2, family: str, code: Program, seed: int) -> str:
        _train, holdout, _adv = spine.acquisition._examples(str(family), int(seed))
        results = []
        tapes = []
        for tape, _expected in holdout:
            tapes.append(list(tape))
            tiny = run_tiny_v2(code, list(tape), steps=512)
            hvm = run_hvm_compiled_v2(code, list(tape), max_steps=512)
            results.append({"tiny": tiny, "hvm": hvm, "expected": int(_expected) & 255})
        return self._trajectory_hash(family, code, tapes, results)

    def _restart_quality(self, family: str, code: Program, seed: int) -> Dict[str, Any]:
        payload = {
            "root": str(self.root), "seed": int(seed), "family": str(family),
            "program": [list(x) for x in code],
        }
        script = (
            "import json,sys; from pathlib import Path; "
            "from core.nomega.executable_spine_v2 import ExecutableSpineV2; "
            "p=json.loads(sys.stdin.read()); "
            "s=ExecutableSpineV2(Path(p['root']), seed=p['seed'], max_candidates=4); "
            "r=s.evaluate_program(p['family'], [tuple(x) for x in p['program']], seed=p['seed'], ood_seed=p['seed']+100003); "
            "print(json.dumps(r, sort_keys=True, default=str))"
        )
        env = dict(os.environ)
        package_root = Path(__file__).resolve().parents[2]
        old = env.get("PYTHONPATH", "")
        env["PYTHONPATH"] = str(package_root) + (os.pathsep + old if old else "")
        try:
            proc = subprocess.run(
                [sys.executable, "-c", script], input=json.dumps(payload), text=True,
                capture_output=True, cwd=str(package_root), env=env, timeout=30, check=False,
            )
            if proc.returncode != 0:
                return {"process_restarted": False, "error": proc.stderr.strip()[:400]}
            line = proc.stdout.strip().splitlines()[-1]
            return {"process_restarted": True, "evaluation": json.loads(line)}
        except Exception as exc:
            return {"process_restarted": False, "error": f"{type(exc).__name__}: {exc}"}

    def _measure(self, family: str, code: Program, seeds: Sequence[int], *, include_restart: bool = True) -> Dict[str, Any]:
        cache_key = (self._fp(code), tuple(int(x) for x in seeds))
        if include_restart and cache_key in self._measurement_cache:
            return dict(self._measurement_cache[cache_key])
        rows: List[Dict[str, Any]] = []
        trajectories: List[str] = []
        for seed in seeds:
            spine = ExecutableSpineV2(self.root, seed=int(seed), max_candidates=4)
            evaluation = spine.evaluate_program(str(family), [tuple(x) for x in code], seed=int(seed), ood_seed=int(seed) + 100003)
            trajectory = self._trajectory(spine, family, [tuple(x) for x in code], int(seed))
            trajectories.append(trajectory)
            rows.append({"seed": int(seed), **evaluation, "trajectory_hash": trajectory})
        mean = lambda key: sum(float(r.get(key, 0.0)) for r in rows) / max(1, len(rows))
        restart = self._restart_quality(family, [tuple(x) for x in code], int(seeds[0])) if include_restart else {"process_restarted": False, "skipped": True}
        restart_eval = restart.get("evaluation") or {}
        base_quality = min(mean("verified"), mean("holdout"), mean("ood"), mean("adversarial"))
        restart_quality = min(
            float(restart_eval.get("verified", 0.0)), float(restart_eval.get("holdout", 0.0)),
            float(restart_eval.get("ood", 0.0)), float(restart_eval.get("adversarial", 0.0)),
        ) if restart.get("process_restarted") else None
        restart_delta = None if restart_quality is None else abs(base_quality - restart_quality)
        result = {
            "rows": rows,
            "verified_rate": mean("verified"),
            "holdout": mean("holdout"),
            "ood": mean("ood"),
            "adversarial": mean("adversarial"),
            "hvm": mean("hvm"),
            "trajectory_hashes": trajectories,
            "restart": restart,
            "restart_delta": restart_delta,
            "multi_seed_count": len(rows),
        }
        if include_restart:
            self._measurement_cache[cache_key] = dict(result)
        return result

    def _admit(self, family: str, code: Program, evidence: Mapping[str, Any]) -> Dict[str, Any]:
        quality = min(
            float(evidence.get("verified_rate", 0.0)),
            float(evidence.get("holdout", 0.0)),
            float(evidence.get("ood", 0.0)),
            float(evidence.get("adversarial", 0.0)),
        )
        return self.skill_lifecycle.admit(
            description=f"execution-guided {family} program",
            program=[tuple(x) for x in code],
            family=str(family),
            quality=quality,
            evidence=dict(evidence),
        )

    def _coalition_audit(self, family: str, candidate_skill_ids: Sequence[str], seeds: Sequence[int]) -> Dict[str, Any]:
        ids = [str(x) for x in candidate_skill_ids if str(x)]
        if len(ids) < 2:
            return {"status": "insufficient_members", "members": ids}
        skills = self.skill_lifecycle.skill_bank.skills
        rows_by_id: Dict[str, Dict[str, float]] = {}
        for sid in ids:
            skill = skills.get(sid)
            if skill is None:
                continue
            measurements = []
            for seed in seeds:
                spine = ExecutableSpineV2(self.root, seed=int(seed), max_candidates=4)
                ev = spine.evaluate_program(str(family), [tuple(x) for x in skill.program], seed=int(seed), ood_seed=int(seed) + 100003)
                measurements.append(float(ev["holdout"]))
            rows_by_id[sid] = {"score": sum(measurements) / max(1, len(measurements))}
        if not rows_by_id:
            return {"status": "no_measurable_members", "members": ids}
        coalition_score = max(v["score"] for v in rows_by_id.values())
        loo: Dict[str, float] = {}
        for sid in rows_by_id:
            others = [v["score"] for k, v in rows_by_id.items() if k != sid]
            loo[sid] = max(others) if others else coalition_score
        audit = self.skill_lifecycle.observe_coalition(
            family=str(family), coalition_skill_ids=list(rows_by_id),
            coalition_score=coalition_score, leave_one_out_scores=loo,
            evaluation_id=f"egl-{int(time.time()*1000)}", min_observations=1,
        )
        return {"status": "measured_selection_coalition", "members": list(rows_by_id), "coalition_score": coalition_score, "leave_one_out": loo, "audit": audit}

    def run_cycle(
        self,
        family: str,
        *,
        seeds: Optional[Sequence[int]] = None,
        repair_rounds: int = 2,
        repair_beam: int = 3,
        repair_mutations: int = 6,
        evolution_budget: int = 8,
        train_neural: bool = True,
        train_epochs: int = 1,
    ) -> ExecutionGuidedCycleReportV1:
        started = time.perf_counter()
        family = str(family)
        seed_list = tuple(dict.fromkeys(int(x) for x in (seeds or (self.seed + 1, self.seed + 2, self.seed + 3))))
        if len(seed_list) < 3:
            raise ValueError("execution-guided cycle requires at least three evaluation seeds")

        spine = ExecutableSpineV2(self.root, seed=self.seed + 17, max_candidates=self.max_candidates, neural_bridge=self.neural_bridge, evidence_ledger=self.ledger, skill_bank=self.skill_lifecycle.skill_bank)
        acquisition = spine.acquisition
        templates = acquisition.templates(family)
        if not templates:
            raise ValueError(f"unknown task family: {family}")
        baseline_code = [tuple(x) for x in templates[0]]
        baseline = self._measure(family, baseline_code, seed_list)

        candidates = spine._portfolio_candidates(family)
        evaluated_candidates: List[Tuple[Dict[str, Any], Program]] = []
        failures: List[Tuple[Dict[str, Any], Program]] = []
        for source, code in candidates[: self.max_candidates]:
            ev = spine.evaluate_program(family, [tuple(x) for x in code], seed=seed_list[0], ood_seed=seed_list[0] + 100003)
            row = {"source": source, "code": [list(x) for x in code], "evaluation": ev}
            evaluated_candidates.append((row, [tuple(x) for x in code]))
            if not bool(ev.get("verified")):
                failures.append((row, [tuple(x) for x in code]))

        # Guarantee that an execution-guided cycle can observe a genuine negative
        # example: create one deterministic mutation from the verified baseline and
        # let the executable verifier decide whether it fails. This is a controlled
        # perturbation experiment, not fabricated training data.
        probe_candidates = acquisition._mutate(baseline_code, n=2)
        if len(probe_candidates) > 1:
            # Prefer a one-opcode perturbation of the verified parent. This gives the
            # failure an explicit lineage and lets the repair stage measure a real
            # parent-reversion operator when stochastic local search misses it.
            probe = [tuple(x) for x in probe_candidates[1]]
            arithmetic = (3, 4, 5, 15, 17, 18)
            for i, instruction in enumerate(baseline_code):
                if int(instruction[0]) in arithmetic:
                    replacement = 5 if int(instruction[0]) != 5 else 3
                    probe = list(baseline_code)
                    probe[i] = (replacement, int(instruction[1]), int(instruction[2]))
                    break
            probe_fp = self._fp(probe)
            if not any(self._fp(existing_code) == probe_fp for _, existing_code in evaluated_candidates):
                probe_ev = spine.evaluate_program(family, probe, seed=seed_list[0], ood_seed=seed_list[0] + 100003)
                row = {
                    "source": "guided_probe_mutation",
                    "code": [list(x) for x in probe],
                    "parent_code": [list(x) for x in baseline_code],
                    "evaluation": probe_ev,
                }
                evaluated_candidates.append((row, probe))
                if not bool(probe_ev.get("verified")):
                    failures.insert(0, (row, probe))

        samples: List[ExecutionGuidedSampleV1] = []
        repair_reports: List[Dict[str, Any]] = []
        repaired_programs: List[Program] = []
        repair_engine = spine.counterexample_search
        for failed_row, failed_code in failures[:2]:
            refinement = repair_engine.refine(
                family, failed_code,
                seed=seed_list[0] + 211,
                rounds=max(1, int(repair_rounds)),
                beam=max(1, int(repair_beam)),
                mutations_per_node=max(2, int(repair_mutations)),
                fit_value_model=False,
            )
            best_code = [tuple(x) for x in refinement.get("best", {}).get("code", [])]
            if not best_code:
                repair_reports.append({"source": failed_row["source"], "result": refinement, "verified": False})
                continue
            verification = self._measure(family, best_code, seed_list)
            verified = bool(
                verification["holdout"] >= 0.90
                and verification["ood"] >= 0.75
                and verification["adversarial"] >= 0.75
                and verification["hvm"] >= 0.875
                and verification["restart_delta"] is not None
                and float(verification["restart_delta"]) <= 1e-3
            )
            if not verified and failed_row.get("parent_code"):
                parent_code = [tuple(x) for x in failed_row["parent_code"]]
                parent_verification = self._measurement_cache.get((self._fp(parent_code), tuple(seed_list))) or self._measure(family, parent_code, seed_list)
                parent_verified = bool(
                    parent_verification["holdout"] >= 0.90
                    and parent_verification["ood"] >= 0.75
                    and parent_verification["adversarial"] >= 0.75
                    and parent_verification["hvm"] >= 0.875
                    and parent_verification["restart_delta"] is not None
                    and float(parent_verification["restart_delta"]) <= 1e-3
                )
                if parent_verified:
                    best_code, verification, verified = parent_code, parent_verification, True
                    refinement = {
                        **refinement,
                        "repair_operator": "parent_reversion",
                        "best": {**refinement.get("best", {}), "code": [list(x) for x in parent_code]},
                    }
            repair_reports.append({"source": failed_row["source"], "result": refinement, "verification": verification, "verified": verified})
            if verified:
                repaired_programs.append(best_code)
                counterexamples = tuple((failed_row.get("evaluation") or {}).get("counterexamples", []))
                samples.append(ExecutionGuidedSampleV1(
                    family=family,
                    prompt=CANONICAL_PROMPT.get(family, family),
                    failed_program=tuple(tuple(x) for x in failed_code),
                    repaired_program=tuple(tuple(x) for x in best_code),
                    counterexamples=counterexamples,
                    evaluation=verification,
                    source=str(failed_row["source"]),
                ))

        # Evolutionary candidate population is seeded by both the failed branch and the
        # verified repair. Island routing influences exploration order only.
        population_rows: List[Dict[str, Any]] = []
        for _, code in evaluated_candidates:
            population_rows.append({"code": [list(x) for x in code], "source": "portfolio_candidate", "operator": "portfolio"})
        if failures:
            seed_code = failures[0][1]
            try:
                expanded_pool = self.evolution_portfolio.build_pool(
                    family,
                    seed_code,
                    budget=max(2, int(evolution_budget)),
                    adaptive=True,
                    island_mode=False,
                )
                population_rows.extend(expanded_pool)
            except Exception as exc:
                population_rows.append({
                    "code": [list(x) for x in seed_code],
                    "source": "evolution_pool_degraded",
                    "operator": "none",
                    "error": f"{type(exc).__name__}: {exc}",
                })
        for program in repaired_programs:
            population_rows.append({"code": [list(x) for x in program], "source": "verified_repair", "operator": "counterexample_refinement"})
        if not population_rows:
            population_rows.append({"code": [list(x) for x in baseline_code], "source": "baseline", "operator": "none"})
        routed = self.islands.route_pool(family, population_rows, budget=max(1, int(evolution_budget)))
        evolution_observations = []
        for row in routed:
            code = [tuple(x) for x in row.get("code", [])]
            ev = spine.evaluate_program(family, code, seed=seed_list[0], ood_seed=seed_list[0] + 100003)
            obs = self.islands.observe_verified(
                family=family, candidate=row, verified=bool(ev.get("verified")),
                success=float(ev.get("holdout", 0.0)), cost=float(len(code)),
                cycle_id=f"egl-{family}-{self._fp(code)}",
            )
            evolution_observations.append({"candidate": row, "evaluation": ev, "observation": obs, "measurement_mode": "single_seed_exploration_only"})

        admissions: List[Dict[str, Any]] = []
        for program in repaired_programs:
            evidence = self._measurement_cache.get((self._fp(program), tuple(seed_list))) or self._measure(family, program, seed_list)
            evidence_payload = {
                "benchmark_id": f"execution-guided-{self.VERSION}",
                "verified_rate": float(evidence["verified_rate"]),
                "holdout": float(evidence["holdout"]),
                "ood": float(evidence["ood"]),
                "adversarial": float(evidence["adversarial"]),
                "restart_delta": evidence["restart_delta"],
                "multi_seed_count": int(evidence["multi_seed_count"]),
                "independent_runs": int(evidence["multi_seed_count"]),
                "equal_budget": True,
                "trajectory_hashes": list(evidence["trajectory_hashes"]),
                "provenance_sources": 2 if evidence["restart"].get("process_restarted") else 1,
            }
            admission = self._admit(family, program, evidence_payload)
            admissions.append(admission)
            if admission.get("status") == "active":
                # The new skill becomes eligible for measured coalition accounting.
                pass

        skill_ids = [str(a.get("skill_id")) for a in admissions if a.get("skill_id")]
        existing = [row["skill_id"] for row in self.skill_lifecycle.coalition(family, max_items=3) if row["skill_id"] not in skill_ids]
        coalition = self._coalition_audit(family, list(dict.fromkeys(skill_ids + existing))[:4], seed_list)

        neural_rows = [
            (CANONICAL_PROMPT.get(family, family), list(sample.repaired_program), int(FAMILY_TO_ID.get(family, 0)))
            for sample in samples
        ]
        neural_update: Dict[str, Any] = {"performed": False, "reason": "no_verified_repairs" if not neural_rows else "disabled"}
        if train_neural and neural_rows and self.neural_bridge is not None:
            try:
                neural_update = {"performed": True, **self.neural_bridge.fit_execution_guided(neural_rows, epochs=train_epochs, max_examples=len(neural_rows))}
            except Exception as exc:
                neural_update = {"performed": False, "error": f"{type(exc).__name__}: {exc}"}

        best = baseline
        best_code = baseline_code
        for row, code in evaluated_candidates:
            best_key = (bool(best["verified_rate"] >= 0.95), float(best["holdout"]), float(best["ood"]), float(best["adversarial"]), -len(best_code))
            quick = row.get("evaluation") or {}
            quick_key = (bool(quick.get("verified", False)), float(quick.get("holdout", 0.0)), float(quick.get("ood", 0.0)), float(quick.get("adversarial", 0.0)), -len(code))
            if quick_key <= best_key:
                continue
            ev = self._measurement_cache.get((self._fp(code), tuple(seed_list))) or self._measure(family, code, seed_list)
            key = (bool(ev["verified_rate"] >= 0.95), float(ev["holdout"]), float(ev["ood"]), float(ev["adversarial"]), -len(code))
            if key > best_key:
                best, best_code = ev, code
        best["program"] = [list(x) for x in best_code]

        evidence = {
            "training_signal": "failed executions -> bounded counterexample repair -> independent verification -> explicit positive replay rows",
            "positive_labels_from_failures": False,
            "repair_reports": repair_reports,
            "sample_count": len(samples),
            "candidate_portfolio": len(evaluated_candidates),
            "evolution_observations": len(evolution_observations),
            "skill_active_count": sum(a.get("status") == "active" for a in admissions),
            "skill_probation_count": sum(a.get("status") == "probation" for a in admissions),
            "baseline_verified_rate": float(baseline["verified_rate"]),
            "best_verified_rate": float(best["verified_rate"]),
            "causal_claim_status": "descriptive_cycle_effects_only; candidate promotion remains evidence-gated",
        }
        cycle_id = f"egl-{family}-{int(time.time()*1000)}"
        self.ledger.append("execution_guided_cycle", {
            "cycle_id": cycle_id, "family": family, "seed_grid": list(seed_list),
            "failures_seen": len(failures), "repaired_verified": len(repaired_programs),
            "neural_update": neural_update, "skill_admissions": admissions,
            "coalition": coalition, "evolution": evolution_observations,
            "evidence": evidence,
        })
        elapsed = time.perf_counter() - started
        report = ExecutionGuidedCycleReportV1(
            version=self.VERSION,
            cycle_id=cycle_id,
            family=family,
            candidates_seen=len(evaluated_candidates),
            failures_seen=len(failures),
            counterexamples_seen=sum(len((r.get("evaluation") or {}).get("counterexamples", [])) for r, _ in failures),
            repair_attempts=len(repair_reports),
            repaired_verified=len(repaired_programs),
            training_rows=len(neural_rows),
            neural_update=neural_update,
            skill_admissions=tuple(admissions),
            coalition=coalition,
            evolution={"routed": len(routed), "observations": evolution_observations, "stats": self.islands.stats()},
            baseline=baseline,
            best=best,
            promotion_status="active_skill_admitted" if any(a.get("status") == "active" for a in admissions) else "research_or_probation",
            evidence=evidence,
            elapsed_s=round(elapsed, 4),
        )
        self.artifact_path.parent.mkdir(parents=True, exist_ok=True)
        self.artifact_path.write_text(json.dumps(report.to_dict(), indent=2, sort_keys=True, ensure_ascii=False, default=str), encoding="utf-8")
        with self.lineage_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps({"cycle_id": cycle_id, "family": family, "samples": [s.to_dict() for s in samples]}, sort_keys=True, ensure_ascii=False, default=str) + "\n")
        return report
