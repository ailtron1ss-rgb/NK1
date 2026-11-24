from __future__ import annotations

"""Counterexample-driven local program search.

A small, deterministic best-first refinement layer inspired by verifier-guided tree
search. It uses failures from the execution verifier as the state signal for choosing
which mutated programs deserve the next budget slice.
"""
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple
import random

from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
from .program_contract_v1 import ProgramContractV1
from .semantic_prune_v1 import SemanticPrunerV1
from .partial_program_value_v1 import PartialProgramValueV1

Program = List[Tuple[int, int, int]]


@dataclass(frozen=True)
class SearchNodeV2:
    code: Program
    depth: int
    holdout: float
    adversarial: float
    hvm: float
    complexity: float
    score: float
    counterexamples: Tuple[Dict[str, Any], ...]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": [list(x) for x in self.code], "depth": self.depth,
            "holdout": self.holdout, "adversarial": self.adversarial, "hvm": self.hvm,
            "complexity": self.complexity, "score": self.score,
            "counterexamples": list(self.counterexamples),
        }


class CounterexampleSearchV2:
    VERSION = "counterexample-search-v2"
    SEARCH_STRATEGY_VERSION = "counterexample-search-v3-value-guided"

    def __init__(self, acquisition: ProgramAcquisitionCoreV2, seed: int = 7001, *, enable_value_guidance: bool = False):
        self.acq = acquisition
        self.rng = random.Random(seed)
        self.contract = ProgramContractV1()
        self.pruner = SemanticPrunerV1(seed=seed ^ 0x51ED, trials=8, root=acquisition.root)
        self.enable_value_guidance = bool(enable_value_guidance)
        self.value_model = PartialProgramValueV1(acquisition.root, seed=seed ^ 0xA17E, ensemble=3) if self.enable_value_guidance else None

    def _eval_rows(self, code: Program, rows):
        ok = 0; agree = 0; ces = []
        for tape, expected in rows:
            tiny = run_tiny_v2(code, tape, steps=512)
            hvm = run_hvm_compiled_v2(code, tape, max_steps=512)
            good = bool(tiny.get("ok") and tiny.get("result") == (expected & 255))
            cross = bool(good and hvm.get("ok") and hvm.get("result") == tiny.get("result"))
            ok += int(good); agree += int(cross)
            if not good and len(ces) < 6:
                ces.append({"tape": list(tape), "expected": expected, "got": tiny.get("result"), "error": tiny.get("error")})
        n = max(1, len(rows))
        return ok / n, agree / n, ces

    def _node(self, code: Program, family: str, seed: int, depth: int) -> SearchNodeV2:
        contract=self.contract.check(code)
        if not contract.valid:
            return SearchNodeV2(code, depth, 0.0, 0.0, 0.0, len(code)/48.0, -1.0, tuple({"contract":contract.to_dict()} for _ in range(1)))
        _, hold, adv = self.acq._examples(family, seed)
        hf, hh, ce_h = self._eval_rows(code, hold)
        af, _, ce_a = self._eval_rows(code, adv)
        complexity = len(code) / 48.0
        score = 0.62 * hf + 0.23 * af + 0.15 * hh - 0.02 * complexity
        return SearchNodeV2(code, depth, hf, af, hh, complexity, score, tuple((ce_h + ce_a)[:8]))

    def refine(self, family: str, initial: Program, *, seed: int = 0, rounds: int = 2, beam: int = 4, mutations_per_node: int = 8, fit_value_model: bool = True) -> Dict[str, Any]:
        frontier = [self._node(initial, family, seed, 0)]
        best = frontier[0]
        history = [best]
        value_shortlisted = 0
        value_input_count = 0
        seen = {tuple(initial)}
        for depth in range(1, max(1, int(rounds)) + 1):
            expanded: List[SearchNodeV2] = []
            parents = sorted(frontier, key=lambda n: n.score, reverse=True)[:max(1, beam)]
            raw_children=[]
            for parent in parents:
                raw_children.extend(self.acq._mutate(parent.code, n=max(2, mutations_per_node)))
            pruned=self.pruner.reduce(raw_children)
            children=list(pruned["candidates"])
            if self.enable_value_guidance and self.value_model is not None and self.value_model.ready and children:
                value_input_count += len(children)
                scored=[]
                for child in children:
                    pred,unc=self.value_model.predict(self.acq._family_id(family) if hasattr(self.acq,"_family_id") else 0, child, exploration=0.35)
                    scored.append((pred,unc,child))
                scored.sort(key=lambda x:(x[0],x[1]), reverse=True)
                # Preserve exploration: keep the best predicted candidates plus one uncertain branch.
                keep=max(beam*3, beam+2)
                children=[x[2] for x in scored[:keep]]
                value_shortlisted += len(children)
                if len(scored)>keep:
                    children.append(max(scored[keep:], key=lambda x:x[1])[2])
            for child in children:
                key = tuple(child)
                if key in seen:
                    continue
                seen.add(key)
                node = self._node(child, family, seed + depth * 97, depth)
                expanded.append(node)
                if self.enable_value_guidance and self.value_model is not None:
                    self.value_model.observe_node(0 if not hasattr(self.acq,"_family_id") else self.acq._family_id(family), child, node.score, source="counterexample-search")
            if not expanded:
                break
            expanded.sort(key=lambda n: n.score, reverse=True)
            frontier = expanded[:max(1, beam)]
            history.extend(frontier)
            if frontier[0].score > best.score:
                best = frontier[0]
            if best.holdout >= 0.875 and best.adversarial >= 0.75 and best.hvm >= 0.875:
                break
        fit_report = None
        if fit_value_model and self.enable_value_guidance and self.value_model is not None and len(self.value_model.obs) >= 24:
            fit_report = self.value_model.fit(epochs=8, batch_size=32, lr=7e-4)
        return {
            "version": self.VERSION,
            "family": family,
            "initial": [list(x) for x in initial],
            "best": best.to_dict(),
            "nodes_evaluated": len(history),
            "depth_reached": max((x.depth for x in history), default=0),
            "improved": tuple(best.code) != tuple(initial),
            "history": [x.to_dict() for x in sorted(history, key=lambda n: n.score, reverse=True)[:12]],
            "search_strategy_version": self.SEARCH_STRATEGY_VERSION,
            "value_guidance_enabled": self.enable_value_guidance,
            "value_model_ready": bool(self.value_model is not None and self.value_model.ready),
            "value_samples": 0 if self.value_model is None else len(self.value_model.obs),
            "value_shortlisted": value_shortlisted,
            "value_input_count": value_input_count,
            "value_fit": None if fit_report is None else fit_report.to_dict(),
            "fit_value_model": bool(fit_value_model),
        }
