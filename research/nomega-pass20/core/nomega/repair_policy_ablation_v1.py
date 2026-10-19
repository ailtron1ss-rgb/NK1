from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Sequence
import json, statistics

from .program_acquisition_v2 import ProgramAcquisitionCoreV2, Program
from .repair_search_policy_v1 import RepairSearchPolicyV1


class RepairPolicyAblationV1:
    """Equal-budget static-vs-adaptive repair-search ablation.

    Cases are corrupted verified programs. Evaluation cases are discovered by a
    deterministic search for cases with an execution-verified repair inside the
    bounded mutation envelope. The controller is warmed only on disjoint cases.
    """

    VERSION = "1.9.5"

    def __init__(self, root: Path, seed: int = 19520):
        self.root = Path(root)
        self.seed = int(seed)

    def _make_cases(self, family: str = "sum3", needed: int = 10) -> List[Dict[str, Any]]:
        anchor = ProgramAcquisitionCoreV2(self.root, seed=self.seed)
        base = anchor.templates(family)[0]
        _, holdout, _ = anchor._examples(family, 12345)
        cases: List[Dict[str, Any]] = []
        case_id = 0
        for mutation_seed in range(self.seed, self.seed + 300):
            acq = ProgramAcquisitionCoreV2(self.root, seed=mutation_seed)
            broken = acq._mutate(base, 20)[1:]
            for raw_index, raw in enumerate(broken):
                fitness, agreement, _ = acq._eval(raw, holdout)
                if fitness >= 0.8 and agreement >= 0.8:
                    continue
                found = False
                for depth in range(1, 6):
                    probe = ProgramAcquisitionCoreV2(self.root, seed=100000 + mutation_seed * 7 + depth)
                    candidates = probe._mutate(raw, depth + 1)[1:]
                    for cand_index, cand in enumerate(candidates):
                        cf, ca, _ = probe._eval(cand, holdout)
                        if cf >= 0.8 and ca >= 0.8:
                            candidate_pools = {}
                            for d in range(1, 6):
                                probe_d = ProgramAcquisitionCoreV2(self.root, seed=100000 + mutation_seed * 7 + d)
                                candidate_pools[str(d)] = [list(x) for x in probe_d._mutate(raw, d + 1)[1:]]
                            cases.append(
                                {
                                    "id": f"{family}-{case_id}",
                                    "family": family,
                                    "raw": raw,
                                    "raw_fitness": fitness,
                                    "raw_agreement": agreement,
                                    "holdout": holdout,
                                    "known_min_depth": depth,
                                    "mutation_seed": mutation_seed,
                                    "raw_index": raw_index,
                                    "verified_repair": cand,
                                    "candidate_pools": candidate_pools,
                                }
                            )
                            case_id += 1
                            found = True
                            break
                    if found:
                        break
                if len(cases) >= needed:
                    return cases
        return cases

    @staticmethod
    def _search_case(root: Path, case: Dict[str, Any], order: Sequence[int], budget: int) -> Dict[str, Any]:
        family = str(case["family"])
        raw = case["raw"]
        holdout = case["holdout"]
        tested = 0
        depth_counts: Dict[str, int] = {}
        for depth in order:
            candidates = case.get("candidate_pools", {}).get(str(int(depth)), [])
            acq = ProgramAcquisitionCoreV2(root, seed=300000 + int(case["mutation_seed"]) * 13 + int(depth))
            for idx, cand in enumerate(candidates):
                if tested >= budget:
                    break
                tested += 1
                depth_counts[str(int(depth))] = depth_counts.get(str(int(depth)), 0) + 1
                cf, ca, ce = acq._eval([tuple(x) for x in cand], holdout)
                if cf >= 0.8 and ca >= 0.8:
                    return {
                        "case_id": case["id"],
                        "family": family,
                        "success": True,
                        "candidates_tested": tested,
                        "verified_depth": int(depth),
                        "depth_counts": depth_counts,
                        "counterexamples": ce,
                    }
            if tested >= budget:
                break
        return {
            "case_id": case["id"],
            "family": family,
            "success": False,
            "candidates_tested": tested,
            "verified_depth": None,
            "depth_counts": depth_counts,
            "counterexamples": [],
        }

    def run(self, *, warmup: int = 4, evaluation: int = 6, budget: int = 20) -> Dict[str, Any]:
        cases = self._make_cases(needed=max(1, warmup + evaluation))
        if len(cases) < warmup + evaluation:
            raise RuntimeError(f"could not build enough repair cases: {len(cases)}")
        warm_cases = cases[:warmup]
        eval_cases = cases[warmup:warmup + evaluation]

        adaptive_root = self.root / "runtime" / "repair_policy_ablation_adaptive"
        adaptive_root.mkdir(parents=True, exist_ok=True)
        policy = RepairSearchPolicyV1(adaptive_root, seed=self.seed)

        warm_results = []
        for case in warm_cases:
            result = self._search_case(adaptive_root, case, (1, 2, 3, 4, 5), budget)
            warm_results.append(result)
            for depth, count in result["depth_counts"].items():
                policy.observe(
                    family=case["family"],
                    depth=int(depth),
                    verified=(result["success"] and int(depth) == int(result["verified_depth"])),
                    candidates_tested=count,
                    cycle_id=f"warm-{case['id']}",
                )

        static_results = [self._search_case(self.root, case, (1, 2, 3, 4, 5), budget) for case in eval_cases]
        adaptive_results = []
        for case in eval_cases:
            order = policy.rank_depths(case["family"], (1, 2, 3, 4, 5))
            adaptive_results.append(self._search_case(adaptive_root, case, order, budget))

        def summarize(rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
            successes = [r for r in rows if r["success"]]
            costs = [int(r["candidates_tested"]) for r in rows]
            return {
                "success_rate": len(successes) / max(1, len(rows)),
                "mean_candidates_tested": statistics.mean(costs) if costs else 0.0,
                "median_candidates_tested": statistics.median(costs) if costs else 0.0,
                "mean_success_cost": statistics.mean([int(r["candidates_tested"]) for r in successes]) if successes else None,
                "results": list(rows),
            }

        static = summarize(static_results)
        adaptive = summarize(adaptive_results)
        return {
            "version": self.VERSION,
            "family": "sum3",
            "warmup_cases": [x["id"] for x in warm_cases],
            "evaluation_cases": [x["id"] for x in eval_cases],
            "budget": int(budget),
            "warmup": warm_results,
            "static": static,
            "adaptive": adaptive,
            "adaptive_less_or_equal_mean_cost": adaptive["mean_candidates_tested"] <= static["mean_candidates_tested"],
            "adaptive_success_not_lower": adaptive["success_rate"] >= static["success_rate"],
            "policy_state": policy.snapshot(),
            "promotion_candidate": (
                adaptive["success_rate"] >= static["success_rate"]
                and adaptive["mean_candidates_tested"] < static["mean_candidates_tested"]
            ),
            "promotion_rule": "adaptive success rate must not fall and mean verified-search cost must strictly fall under identical held-out cases and budget",
        }
