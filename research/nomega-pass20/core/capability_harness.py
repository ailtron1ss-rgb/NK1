"""Capability Harness 22.0 — regression (0..19) vs open (20..27) split."""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict
from .hierarchical_vm import decode_hprog, hprogram_fitness
from .problem_forge import make_tasks, N_FAMILIES, family_name, REGRESSION_N, OPEN_START, CLOSED_N, FRONTIER_START, WILD_START, WILD2_START, WILD3_START, HIST_CLOSED_N


@dataclass
class FamilyScore:
    family: int
    name: str
    holdout: float
    adversarial: float
    train: float
    best_genome: int = 0


@dataclass
class HarnessReport:
    families_solved: int
    mean_holdout: float
    mean_adversarial: float
    coverage: float
    per_family: List[FamilyScore]
    n_programs_tested: int
    threshold: float
    regression_solved: int = 0
    open_solved: int = 0
    regression_mean_h: float = 0.0
    open_mean_h: float = 0.0
    frontier_solved: int = 0
    frontier_mean_h: float = 0.0
    closed_solved: int = 0
    wild_solved: int = 0
    wild_mean_h: float = 0.0
    wild2_solved: int = 0
    wild2_mean_h: float = 0.0
    wild3_solved: int = 0
    wild3_mean_h: float = 0.0

    def to_dict(self) -> dict:
        return {
            "families_solved": self.families_solved,
            "regression_solved": self.regression_solved,
            "open_solved": self.open_solved,
            "mean_holdout": round(self.mean_holdout, 4),
            "regression_mean_h": round(self.regression_mean_h, 4),
            "open_mean_h": round(self.open_mean_h, 4),
            "frontier_solved": self.frontier_solved,
            "frontier_mean_h": round(self.frontier_mean_h, 4),
            "closed_solved": self.closed_solved,
            "wild_solved": self.wild_solved,
            "wild_mean_h": round(self.wild_mean_h, 4),
            "wild2_solved": self.wild2_solved,
            "wild2_mean_h": round(self.wild2_mean_h, 4),
            "wild3_solved": self.wild3_solved,
            "wild3_mean_h": round(self.wild3_mean_h, 4),
            "mean_adversarial": round(self.mean_adversarial, 4),
            "coverage": round(self.coverage, 4),
            "n_programs_tested": self.n_programs_tested,
            "threshold": self.threshold,
            "solved_names": [f.name for f in self.per_family if f.holdout >= self.threshold],
            "open_solved_names": [
                f.name for f in self.per_family
                if OPEN_START <= f.family < CLOSED_N and f.holdout >= self.threshold
            ],
            "frontier_solved_names": [
                f.name for f in self.per_family
                if FRONTIER_START <= f.family < CLOSED_N and f.holdout >= self.threshold
            ],
            "wild_solved_names": [
                f.name for f in self.per_family
                if WILD_START <= f.family < WILD2_START and f.holdout >= self.threshold
            ],
            "per_family": [
                {
                    "family": f.family,
                    "name": f.name,
                    "holdout": round(f.holdout, 3),
                    "adv": round(f.adversarial, 3),
                }
                for f in self.per_family
            ],
        }


class CapabilityHarness:
    def __init__(self, seed: int = 1, threshold: float = 0.35):
        self.seed = seed
        self.threshold = threshold
        self._oracle = seed ^ 0xA11CE
        self.history: List[dict] = []

    def evaluate_programs(self, genomes: List[int], hardness: float = 0.15, linked_list=None) -> HarnessReport:
        if linked_list is not None:
            self._linked = list(linked_list)
        best: Dict[int, FamilyScore] = {
            fam: FamilyScore(fam, family_name(fam), 0.0, 0.0, 0.0) for fam in range(N_FAMILIES)
        }
        for g in genomes:
            prog = decode_hprog(g)
            for fam in range(N_FAMILIES):
                train = hprogram_fitness(prog, make_tasks(self._oracle, fam, n=6, hardness=0.0))
                hold = hprogram_fitness(
                    prog, make_tasks(self._oracle ^ 0xDEAD, fam, n=8, hardness=hardness * 0.5)
                )
                adv = hprogram_fitness(
                    prog, make_tasks(self._oracle ^ 0xAD00, fam, n=8, hardness=hardness)
                )
                cur = best[fam]
                if hold > cur.holdout or (hold == cur.holdout and adv > cur.adversarial):
                    best[fam] = FamilyScore(fam, family_name(fam), hold, adv, train, g)

        # LinkedProgram bank (CALL/RET subroutines) — unique composition path
        for lp in getattr(self, "_linked", []) or []:
            try:
                for fam in range(N_FAMILIES):
                    train = lp.fitness(make_tasks(self._oracle, fam, n=6, hardness=0.0))
                    hold = lp.holdout(self._oracle, fam)
                    adv = lp.fitness(make_tasks(self._oracle ^ 0xAD00, fam, n=6, hardness=hardness))
                    cur = best[fam]
                    if hold > cur.holdout or (hold == cur.holdout and adv > cur.adversarial):
                        best[fam] = FamilyScore(fam, family_name(fam), hold, adv, train, 0)
            except Exception:
                pass

        scores = [best[i] for i in range(N_FAMILIES)]
        solved = sum(1 for s in scores if s.holdout >= self.threshold)
        reg = [s for s in scores if s.family < REGRESSION_N]
        opn = [s for s in scores if OPEN_START <= s.family < HIST_CLOSED_N]
        frn = [s for s in scores if FRONTIER_START <= s.family < CLOSED_N]
        clo = [s for s in scores if s.family < CLOSED_N]
        wld = [s for s in scores if WILD_START <= s.family < WILD2_START]
        wld2 = [s for s in scores if WILD2_START <= s.family < WILD3_START]
        wld3 = [s for s in scores if s.family >= WILD3_START]
        report = HarnessReport(
            families_solved=solved,
            mean_holdout=sum(s.holdout for s in scores) / N_FAMILIES,
            mean_adversarial=sum(s.adversarial for s in scores) / N_FAMILIES,
            coverage=sum(1 for s in scores if s.holdout >= 0.2) / N_FAMILIES,
            per_family=scores,
            n_programs_tested=len(genomes),
            threshold=self.threshold,
            regression_solved=sum(1 for s in reg if s.holdout >= self.threshold),
            open_solved=sum(1 for s in opn if s.holdout >= self.threshold),
            regression_mean_h=sum(s.holdout for s in reg) / max(1, len(reg)),
            open_mean_h=sum(s.holdout for s in opn) / max(1, len(opn)),
            frontier_solved=sum(1 for s in frn if s.holdout >= self.threshold),
            frontier_mean_h=sum(s.holdout for s in frn) / max(1, len(frn)),
            closed_solved=sum(1 for s in clo if s.holdout >= self.threshold),
            wild_solved=sum(1 for s in wld if s.holdout >= self.threshold),
            wild_mean_h=sum(s.holdout for s in wld) / max(1, len(wld)),
            wild2_solved=sum(1 for s in wld2 if s.holdout >= self.threshold),
            wild2_mean_h=sum(s.holdout for s in wld2) / max(1, len(wld2)),
            wild3_solved=sum(1 for s in wld3 if s.holdout >= self.threshold),
            wild3_mean_h=sum(s.holdout for s in wld3) / max(1, len(wld3)),
        )
        self.history.append(report.to_dict())
        self.history = self.history[-32:]
        return report

    def delta(self, before: HarnessReport, after: HarnessReport) -> dict:
        return {
            "families_solved_delta": after.families_solved - before.families_solved,
            "regression_solved_delta": after.regression_solved - before.regression_solved,
            "open_solved_delta": after.open_solved - before.open_solved,
            "frontier_solved_delta": after.frontier_solved - before.frontier_solved,
            "mean_holdout_delta": round(after.mean_holdout - before.mean_holdout, 4),
            "open_mean_h_delta": round(after.open_mean_h - before.open_mean_h, 4),
            "frontier_mean_h_delta": round(after.frontier_mean_h - before.frontier_mean_h, 4),
            "coverage_delta": round(after.coverage - before.coverage, 4),
        }
