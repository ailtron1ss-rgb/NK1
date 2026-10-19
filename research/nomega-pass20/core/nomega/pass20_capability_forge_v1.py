from __future__ import annotations

"""PASS20 integrated capability forge.

This is the orchestration layer joining experience consolidation, structured
skill composition, adversarial test generation and cost-aware evidence triage.
It never bypasses the canonical executable verifier.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Sequence
import time

from .adaptive_evidence_scheduler_v1 import AdaptiveEvidenceSchedulerV1
from .adversarial_evolution_arena_v1 import AdversarialEvolutionArenaV1
from .causal_evidence_ledger_v1 import CausalEvidenceLedgerV1
from .experience_wiki_v1 import ExperienceWikiV1
from .execution_guided_learning_loop_v1 import ExecutionGuidedLearningLoopV1
from .skill_composition_v1 import SkillCompositionEngineV1


@dataclass(frozen=True)
class CapabilityForgeReportV1:
    version: str
    cycle_id: str
    family: str
    experience_id: str
    knowledge_id: str
    composed_plan: Optional[Mapping[str, Any]]
    adversarial_tests: int
    scheduler: Mapping[str, Any]
    execution_cycle: Mapping[str, Any]
    elapsed_s: float

    def to_dict(self):
        return asdict(self)


class CapabilityForgeV1:
    VERSION = "pass20-capability-forge-v1"

    def __init__(self, root: Path, *, seed: int = 42020, neural_bridge=None):
        self.root = Path(root)
        self.seed = int(seed)
        self.ledger = CausalEvidenceLedgerV1(self.root / "runtime" / "nomega_causal_evidence.jsonl")
        self.wiki = ExperienceWikiV1(self.root)
        self.arena = AdversarialEvolutionArenaV1(seed=self.seed + 9)
        self.scheduler = AdaptiveEvidenceSchedulerV1()
        self.egl = ExecutionGuidedLearningLoopV1(self.root, seed=self.seed + 17, neural_bridge=neural_bridge, evidence_ledger=self.ledger)

    def _schedule(self, family: str, candidate_codes: Mapping[str, Any]) -> Dict[str, Any]:
        from .executable_spine_v2 import ExecutableSpineV2
        seed = self.seed + 101
        spine = ExecutableSpineV2(self.root, seed=seed, max_candidates=4, evidence_ledger=self.ledger)
        cache: Dict[tuple[str, str], Dict[str, Any]] = {}
        def evaluate(cid: str, stage: str):
            key = (cid, stage)
            if key in cache:
                return cache[key]
            code = candidate_codes[cid]
            # Stage-specific subset avoids repeating the most expensive checks.
            if stage == "smoke":
                train, holdout, adv, hvm, _ = spine._evaluate(family, [tuple(x) for x in code], seed)
                row = {"verified": 1.0 if holdout >= 0.875 else 0.0, "holdout": holdout, "hvm": hvm, "adversarial": adv}
            else:
                row = spine.evaluate_program(family, [tuple(x) for x in code], seed=seed, ood_seed=seed + 100003)
            cache[key] = row
            return row
        result = self.scheduler.schedule(list(candidate_codes), evaluate)
        return result.to_dict()

    def run(self, family: str, *, train_neural: bool = True) -> CapabilityForgeReportV1:
        started = time.perf_counter()
        family = str(family)
        execution = self.egl.run_cycle(family, train_neural=train_neural, evolution_budget=8)
        best = dict(execution.best)
        evidence = dict(execution.evidence)
        trajectory = str(evidence.get("trajectory_hash", f"cycle-{execution.cycle_id}"))
        eid = self.wiki.record_experience(
            task_family=family,
            outcome=str(execution.promotion_status),
            evidence=evidence,
            trajectory_hash=trajectory,
            source="pass20_execution_guided",
            skill_ids=[x.get("skill_id", "") for x in execution.skill_admissions],
        )
        kid = self.wiki.consolidate(
            topic=f"execution:{family}",
            statement=f"Verified execution evidence for {family} is retained as reusable experience; promotion remains governed by independent verification.",
            confidence=float(min(1.0, best.get("verified_rate", 0.0) if best else 0.0)),
            source_experience_ids=[eid],
        )
        plan = SkillCompositionEngineV1(self.egl.skill_lifecycle.skill_bank).plan(family, max_skills=3)
        adversarial_count = self.arena.seed_from_failures(list(evidence.get("counterexamples", [])), budget=12).__len__()
        candidate_codes = {"best": best.get("program", [])}
        scheduler = self._schedule(family, candidate_codes) if candidate_codes["best"] else {"survivors": (), "spent": 0.0, "stages": ()}
        self.wiki.link_skill(
            skill_id=str(execution.skill_admissions[0].get("skill_id")) if execution.skill_admissions else "",
            knowledge_ids=[kid] if execution.skill_admissions else [],
            experience_ids=[eid],
        ) if execution.skill_admissions else None
        report = CapabilityForgeReportV1(
            self.VERSION, execution.cycle_id, family, eid, kid,
            plan.to_dict() if plan else None, adversarial_count, scheduler,
            execution.to_dict(), round(time.perf_counter() - started, 3),
        )
        self.ledger.append("pass20_capability_forge", report.to_dict())
        return report
