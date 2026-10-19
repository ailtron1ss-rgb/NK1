from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence
import json

from .repair_engine_v1 import RepairEngineV1
from .neural_repair_policy_v1 import NeuralRepairPolicyV1
from .execution_trace_v1 import trace_tinyvm_v1
from .execution_evidence_v2 import build_execution_evidence


class AutonomousRepairLearningLoopV1:
    VERSION = "autonomous-repair-learning-loop-v1"

    def __init__(self, root: Path, seed: int = 1709):
        self.root = Path(root)
        self.seed = int(seed)
        self.engine = RepairEngineV1(self.root, seed=seed)
        self.policy = NeuralRepairPolicyV1(self.root, seed=seed + 41, ensemble=3)
        self.log = self.root / "runtime" / "repair_learning_v1.jsonl"
        self.history = self._load_history()

    def _load_history(self):
        if not self.log.exists():
            return []
        rows = []
        for line in self.log.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
                rows.extend(row.get("attempts", []))
            except json.JSONDecodeError:
                continue
        return rows

    def repair(self, family: str, code, *, tapes: Sequence[Sequence[int]], expected_rows: Sequence[tuple[Sequence[int], int]] | None = None, max_candidates: int = 8) -> Dict[str, Any]:
        trace = trace_tinyvm_v1(code, list(tapes[0]) if tapes else [0] * 8)
        evidence = build_execution_evidence(trace, verifier_ok=False, lineage_id=self.engine._hash(code))
        state = {"error_class": self.engine.classify_failure(evidence), "failure_depth": min(1.0, float(trace.steps) / 64.0)}
        raw = self.engine._variants(code)
        candidate_rows = [{"operator": op, "code": cand, "cost": len(cand), "local_verified": False, "independent_verified": False, "counterexamples": 99} for op, cand in raw]
        ranked = self.policy.rank_candidates(candidate_rows, state=state)
        limit = max(1, int(max_candidates))
        selected = ranked[:limit]
        # Safety invariant: a deterministic baseline repair operator remains in
        # every batch even when the learned policy ranks it below the cutoff.
        baseline = next((row for row in ranked if row.get("operator") == "replace_invalid_opcode"), None)
        if baseline is not None and not any(row.get("operator") == "replace_invalid_opcode" for row in selected):
            selected = selected[: max(0, limit - 1)] + [baseline]
        if expected_rows is not None:
            rows = [(list(t), int(y)) for t, y in expected_rows]
        else:
            _, hold, _ = self.engine.acq._examples(family, self.seed + 101)
            rows = [(list(t), y) for t, y in hold if list(t) in [list(x) for x in tapes]] or [(list(t), 0) for t in tapes]
        attempts = []
        for item in selected:
            score, hvm, ces = self.engine._evaluate(item["code"], rows)
            local = score >= 0.999
            independent = local and hvm >= 0.999
            utility = float(score) + 0.25 * float(hvm) - 0.02 * float(item["cost"]) - 0.05 * float(ces)
            attempt = {
                "state": state,
                "operator": item["operator"],
                "local_verified": local,
                "independent_verified": independent,
                "counterexamples": int(ces),
                "cost": int(item["cost"]),
                "utility": utility,
                "predicted_success": item["predicted_success"],
                "prediction_uncertainty": item["prediction_uncertainty"],
                "observed_score": score,
                "hvm_score": hvm,
            }
            attempts.append(attempt)
            self.history.append(attempt)
        report = self.policy.fit(self.history, epochs=16) if len(self.history) >= 6 else None
        verified = [a for a in attempts if a["independent_verified"]]
        partial = [a for a in attempts if a["observed_score"] > 0]
        verified_rank = next((i + 1 for i, a in enumerate(attempts) if a["independent_verified"]), None)
        decision = "verified_repair" if verified else ("partial_repair" if partial else "rejected")
        best = sorted(attempts, key=lambda a: (a["independent_verified"], a["observed_score"], -a["cost"]), reverse=True)[0] if attempts else None
        result = {
            "version": self.VERSION,
            "family": family,
            "attempted": len(attempts),
            "decision": decision,
            "verified_rank": verified_rank,
            "best": best,
            "policy": None if report is None else report.to_dict(),
            "attempts": attempts,
        }
        self.log.parent.mkdir(parents=True, exist_ok=True)
        with self.log.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(result, sort_keys=True) + "\n")
        return result
