from __future__ import annotations

"""Unified executable spine: ground -> propose -> execute -> cross-verify -> learn.

The spine connects already-existing NΩ components instead of replacing them.  It uses
ProgramAcquisitionCoreV2 for bounded synthesis, TinyVM + HVM for independent execution,
and a portfolio scorer that prefers verified, simple and diverse programs.
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
import math
import random
import time

from .execution_contract_v2 import ExecutionContractV2, EvidenceItemV2
from .prompt_grounding_v2 import GroundedPromptV2, ground_prompt
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
from .counterexample_search_v2 import CounterexampleSearchV2
from .task_spec_v1 import CANONICAL_PROMPT

Program = List[Tuple[int, int, int]]


@dataclass(frozen=True)
class PortfolioRowV2:
    source: str
    code: Program
    train_fitness: float
    holdout_fitness: float
    adversarial_fitness: float
    hvm_agreement: float
    complexity: float
    diversity: float
    score: float
    verified: bool
    counterexamples: Tuple[Dict[str, Any], ...] = ()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "code": [list(x) for x in self.code],
            "train_fitness": self.train_fitness,
            "holdout_fitness": self.holdout_fitness,
            "adversarial_fitness": self.adversarial_fitness,
            "hvm_agreement": self.hvm_agreement,
            "complexity": self.complexity,
            "diversity": self.diversity,
            "score": self.score,
            "verified": self.verified,
            "counterexamples": list(self.counterexamples),
        }


class ExecutableSpineV2:
    VERSION = "executable-spine-v2"

    def __init__(self, root: Path, seed: int = 9021, *, max_candidates: int = 16, neural_bridge=None, evidence_ledger=None, skill_bank=None):
        self.root = Path(root)
        self.seed = int(seed)
        self.rng = random.Random(seed)
        self.max_candidates = max(2, int(max_candidates))
        self.acquisition = ProgramAcquisitionCoreV2(self.root, seed=seed ^ 0x51A7)
        self.counterexample_search = CounterexampleSearchV2(self.acquisition, seed=seed ^ 0xC0DE)
        self.neural_bridge = neural_bridge
        self.evidence_ledger = evidence_ledger
        self.skill_bank = skill_bank
        self.last_neural_error: Optional[str] = None
        self.last_skill_composition_error: Optional[str] = None

    @staticmethod
    def _complexity(code: Program) -> float:
        return float(len(code)) / 48.0

    @staticmethod
    def _distance(a: Program, b: Program) -> float:
        n = max(len(a), len(b), 1)
        mismatches = sum(1 for i in range(n) if (a[i] if i < len(a) else None) != (b[i] if i < len(b) else None))
        return mismatches / n

    def _portfolio_candidates(self, family: str, explicit: Optional[Program] = None) -> List[Tuple[str, Program]]:
        out: List[Tuple[str, Program]] = []
        if explicit:
            out.append(("explicit_program", [tuple(x) for x in explicit]))
        for code in self.acquisition.templates(family):
            out.append(("template", [tuple(x) for x in code]))

        # Keep a deterministic base program for the mutation island before adding
        # learned candidates. This ordering guarantees that a neural proposer can
        # enter the real execution portfolio instead of being starved by mutations.
        base = out[-1][1] if out else []

        if self.neural_bridge is not None:
            try:
                candidate = self.neural_bridge.propose(
                    CANONICAL_PROMPT.get(family, family),
                    family=family, beam_size=2, max_len=24,
                )
                if candidate is not None:
                    # Reserve an actual portfolio slot for the neural candidate. It
                    # remains untrusted: ranking/verification below is authoritative.
                    out.append((candidate.source, [tuple(x) for x in candidate.program]))
            except Exception as exc:
                # Candidate generation failure must not disable deterministic verification.
                self.last_neural_error = f"{type(exc).__name__}: {exc}"

        if self.skill_bank is not None:
            try:
                from .skill_composition_v1 import SkillCompositionEngineV1
                plan = SkillCompositionEngineV1(self.skill_bank).plan(str(family), max_skills=3)
                if plan is not None and plan.program:
                    # Composed skills are candidates only; execution/evidence still
                    # decides whether the composition is useful enough to survive.
                    out.append(("skill_composed_v1", [tuple(x) for x in plan.program]))
            except Exception as exc:
                self.last_skill_composition_error = f"{type(exc).__name__}: {exc}"

        if base:
            for i, code in enumerate(self.acquisition._mutate(base, n=min(8, self.max_candidates))):
                out.append((f"mutation_{i}", [tuple(x) for x in code]))

        seen = set()
        unique: List[Tuple[str, Program]] = []
        for src, code in out:
            fp = tuple(code)
            if fp in seen:
                continue
            seen.add(fp)
            unique.append((src, code))
            if len(unique) >= self.max_candidates:
                break
        return unique

    def _evaluate(self, family: str, code: Program, seed: int) -> Tuple[float, float, float, float, List[Dict[str, Any]]]:
        train, holdout, adv = self.acquisition._examples(family, seed)
        def eval_rows(rows):
            if not rows:
                return 0.0, 0.0, []
            ok = 0; agree = 0; ces = []
            for tape, expected in rows:
                tiny = run_tiny_v2(code, tape, steps=512)
                hvm = run_hvm_compiled_v2(code, tape, max_steps=512)
                good = bool(tiny.get("ok") and tiny.get("result") == (expected & 255))
                cross = bool(good and hvm.get("ok") and hvm.get("result") == tiny.get("result"))
                ok += int(good); agree += int(cross)
                if not good and len(ces) < 4:
                    ces.append({"tape": list(tape), "expected": expected, "got": tiny.get("result"), "error": tiny.get("error")})
            n = float(len(rows))
            return ok / n, agree / n, ces
        tf, _, ce_t = eval_rows(train)
        hf, ha, ce_h = eval_rows(holdout)
        af, aa, ce_a = eval_rows(adv)
        ces = (ce_t + ce_h + ce_a)[:8]
        return tf, hf, af, (ha + aa) / 2.0, ces

    def _rank(self, rows: Iterable[Tuple[str, Program, float, float, float, float, Sequence[Dict[str, Any]]]]) -> List[PortfolioRowV2]:
        accepted: List[Program] = []
        out: List[PortfolioRowV2] = []
        for source, code, tf, hf, af, ha, ces in rows:
            div = 1.0 if not accepted else min(1.0, sum(self._distance(code, x) for x in accepted) / len(accepted))
            complexity = self._complexity(code)
            # Correctness dominates. Diversity is a secondary exploration term; complexity
            # is penalized only after a program has earned evidence for correctness.
            score = 0.36 * tf + 0.38 * hf + 0.16 * af + 0.10 * ha + 0.06 * div - 0.025 * complexity
            verified = hf >= 0.875 and af >= 0.75 and ha >= 0.875
            row = PortfolioRowV2(source, code, tf, hf, af, ha, complexity, div, score, verified, tuple(ces))
            out.append(row)
            if verified:
                accepted.append(code)
        return sorted(out, key=lambda x: (x.verified, x.score, x.holdout_fitness, -x.complexity), reverse=True)

    def evaluate_program(self, family: str, code: Program, *, seed: Optional[int] = None, ood_seed: Optional[int] = None) -> Dict[str, Any]:
        """Public execution/verification API for a concrete program candidate.

        Unlike ``run``, this does not re-synthesize or re-rank the candidate, so
        development experiments can measure a repaired program without the template
        bank masking the intervention.
        """
        eval_seed = self.seed if seed is None else int(seed)
        tf, hf, af, ha, ces = self._evaluate(family, [tuple(x) for x in code], eval_seed)
        ood = 0.0
        if ood_seed is not None:
            _train, ood_rows, _adv = self.acquisition._examples(family, int(ood_seed))
            _tf2, ood, _af2, _ha2, _ces2 = self._evaluate(family, [tuple(x) for x in code], int(ood_seed))
            # The public _evaluate uses the canonical train/holdout/adv splits.  For
            # true OOD we explicitly evaluate the hidden second seed below.
            if ood_rows:
                ok = 0
                for tape, expected in ood_rows:
                    tiny = run_tiny_v2(code, tape, steps=512)
                    hvm = run_hvm_compiled_v2(code, tape, max_steps=512)
                    ok += int(bool(tiny.get("ok") and tiny.get("result") == (expected & 255) and hvm.get("ok") and hvm.get("result") == tiny.get("result")))
                ood = ok / len(ood_rows)
        return {
            "train": float(tf),
            "holdout": float(hf),
            "adversarial": float(af),
            "ood": float(ood),
            "hvm": float(ha),
            "verified": bool(hf >= 0.875 and af >= 0.75 and ha >= 0.875),
            "counterexamples": list(ces),
        }

    def run(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        started = time.perf_counter()
        context = dict(context or {})
        grounded: GroundedPromptV2 = ground_prompt(text, context)
        contract = ExecutionContractV2(task=text)
        if not grounded.grounded:
            contract.provenance = {"version": self.VERSION, "grounding_reason": grounded.reason}
            contract.elapsed_ms = round((time.perf_counter() - started) * 1000.0, 3)
            return {"handled": False, "contract": contract.to_dict(), "grounding": grounded.reason}

        spec = grounded.spec
        family = spec.family
        contract.task_family = family
        contract.task_id = int(spec.family_id)
        explicit = context.get("program")
        if explicit is not None and isinstance(explicit, list):
            try:
                explicit = [tuple(int(y) for y in x[:3]) for x in explicit]
            except Exception:
                explicit = None
        candidates = self._portfolio_candidates(family, explicit)
        ranked_raw = []
        for src, code in candidates:
            tf, hf, af, ha, ces = self._evaluate(family, code, self.seed + spec.family_id * 17)
            ranked_raw.append((src, code, tf, hf, af, ha, ces))
        ranked = self._rank(ranked_raw)
        # Failure-path refinement: use actual counterexamples to choose a new search
        # neighborhood instead of spending the same budget on blind mutations.
        refinement = None
        if ranked and not ranked[0].verified and context.get("enable_counterexample_refinement", True):
            refinement = self.counterexample_search.refine(
                family, ranked[0].code, seed=self.seed + spec.family_id * 101, rounds=2, beam=3, mutations_per_node=6
            )
            best_code = [tuple(x) for x in refinement.get("best", {}).get("code", [])]
            if best_code and tuple(best_code) != tuple(ranked[0].code):
                tf, hf, af, ha, ces = self._evaluate(family, best_code, self.seed + spec.family_id * 17)
                refined_row = self._rank([("counterexample_refinement", best_code, tf, hf, af, ha, ces)])[0]
                ranked = self._rank(ranked_raw + [(refined_row.source, refined_row.code, refined_row.train_fitness, refined_row.holdout_fitness, refined_row.adversarial_fitness, refined_row.hvm_agreement, refined_row.counterexamples)])
        if not ranked:
            contract.status = "unresolved"
            contract.provenance = {"version": self.VERSION, "family": family, "reason": "no_candidates"}
            contract.elapsed_ms = round((time.perf_counter() - started) * 1000.0, 3)
            return {"handled": True, "contract": contract.to_dict(), "grounding": grounded.reason}

        best = ranked[0]
        contract.attempts = len(ranked)
        contract.candidate_source = best.source
        contract.program = list(best.code)
        contract.answer = None
        contract.add_evidence(EvidenceItemV2("program-acquisition-v2", "holdout", best.holdout_fitness, best.holdout_fitness >= 0.875,
                                             {"family": family, "complexity": best.complexity}))
        contract.add_evidence(EvidenceItemV2("tinyvm", "execution", best.holdout_fitness, best.holdout_fitness >= 0.875,
                                             {"counterexamples": len(best.counterexamples)}))
        contract.add_evidence(EvidenceItemV2("hvm", "independent_execution", best.hvm_agreement, best.hvm_agreement >= 0.875, {}))
        contract.add_evidence(EvidenceItemV2("adversarial_holdout", "execution", best.adversarial_fitness, best.adversarial_fitness >= 0.75, {}))

        tape = context.get("tape")
        if tape is None:
            vars_ = grounded.variables
            tape = [vars_.get(k, 0) for k in ("a", "b", "c", "k", "m", "lo", "hi")]
        try:
            if tape:
                tiny = run_tiny_v2(best.code, list(tape), steps=512)
                hvm = run_hvm_compiled_v2(best.code, list(tape), max_steps=512)
                contract.answer = tiny.get("result")
                contract.add_evidence(EvidenceItemV2("request_execution", "input_instance", 1.0 if tiny.get("ok") else 0.0, bool(tiny.get("ok")), {"result": tiny.get("result")}))
                cross_ok = bool(tiny.get("ok") and hvm.get("ok") and tiny.get("result") == hvm.get("result"))
                contract.add_evidence(EvidenceItemV2("request_hvm_crosscheck", "independent_execution", 1.0 if cross_ok else 0.0, cross_ok, {}))
        except Exception as exc:
            contract.provenance["request_execution_error"] = str(exc)

        expected = context.get("expected")
        if expected is not None:
            contract_answer = contract.answer
            contract.add_evidence(EvidenceItemV2("external_expected", "exact", 1.0 if contract_answer == expected else 0.0,
                                                 contract_answer == expected, {"expected": expected}))

        contract.counterexamples = list(best.counterexamples)
        contract.confidence = max(0.0, min(1.0, 0.45 * best.holdout_fitness + 0.25 * best.adversarial_fitness + 0.20 * best.hvm_agreement + 0.10 * grounded.confidence))
        strict_ok = best.verified and (expected is None or contract.answer == expected)
        contract.status = "verified" if strict_ok else "candidate_verified_family" if best.verified else "candidate_found"
        contract.provenance = {
            "version": self.VERSION,
            "research_mode": True,
            "grounding_reason": grounded.reason,
            "family": family,
            "ranked_candidates": [r.to_dict() for r in ranked[:8]],
            "counterexample_refinement": refinement,
            "neural_candidate_enabled": bool(self.neural_bridge is not None and getattr(self.neural_bridge, "available", False)),
            "neural_candidate_source": "pure_neural_v13" if any(r.source == "pure_neural_v13" for r in ranked) else None,
            "neural_candidate_error": self.last_neural_error,
            "skill_composition_enabled": bool(self.skill_bank is not None),
            "skill_composition_error": getattr(self, "last_skill_composition_error", None),
        }
        if self.evidence_ledger is not None:
            try:
                self.evidence_ledger.append("execution_cycle", {
                    "family": family,
                    "task": text,
                    "candidate_source": best.source,
                    "candidate_count": len(ranked),
                    "verified": bool(strict_ok),
                    "answer": contract.answer,
                    "holdout": float(best.holdout_fitness),
                    "adversarial": float(best.adversarial_fitness),
                    "hvm_agreement": float(best.hvm_agreement),
                    "counterexamples": len(best.counterexamples),
                    "neural_candidate_present": any(r.source == "pure_neural_v13" for r in ranked),
                    "neural_candidate_error": self.last_neural_error,
            "skill_composition_enabled": bool(self.skill_bank is not None),
            "skill_composition_error": getattr(self, "last_skill_composition_error", None),
                    "refinement_used": refinement is not None,
                    "research_only": True,
                })
            except Exception as exc:
                # Evidence persistence is non-authoritative for correctness: an I/O
                # failure must not silently change the verification result.
                contract.provenance["evidence_ledger_error"] = f"{type(exc).__name__}: {exc}"
        contract.elapsed_ms = round((time.perf_counter() - started) * 1000.0, 3)
        return {
            "handled": True,
            "verified": contract.verified,
            "answer": contract.answer,
            "program": contract.program,
            "family": family,
            "candidate_source": contract.candidate_source,
            "confidence": contract.confidence,
            "contract": contract.to_dict(),
        }
