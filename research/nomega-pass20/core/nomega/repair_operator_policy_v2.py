from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence
import json, math, time


class RepairOperatorPolicyV2:
    """Execution-grounded repair-operator policy with cross-family transfer.

    The policy never accepts a repair without execution verification. It learns
    separately from target-family evidence and a conservative global transfer
    prior. Static ordering remains the canonical default; this controller is
    research-only until held-out cross-family evidence shows lower verified
    search cost without lower success.
    """

    VERSION = "1.9.6"
    OPERATORS = ("opcode_replace", "arg_a_replace", "arg_b_replace", "insert_instruction")

    def __init__(self, root: Path, seed: int = 1961, exploration: float = 0.30, transfer_weight: float = 0.35):
        self.root = Path(root)
        self.seed = int(seed)
        self.exploration = float(exploration)
        self.transfer_weight = float(transfer_weight)
        self.path = self.root / "runtime" / "nomega_repair_operator_policy_v2.json"
        self.state = self._load()

    def _default(self) -> Dict[str, Any]:
        return {
            "version": self.VERSION,
            "operators": list(self.OPERATORS),
            "families": {},
            "global": {op: self._blank_row(op) for op in self.OPERATORS},
            "events": [],
            "promotion": {"status": "research-only", "evidence": None},
        }

    @staticmethod
    def _blank_row(operator: str) -> Dict[str, Any]:
        return {
            "operator": operator,
            "attempts": 0,
            "successes": 0,
            "candidates_tested": 0,
            "verified_examples": 0,
            "last_seen": 0.0,
        }

    def _load(self) -> Dict[str, Any]:
        default = self._default()
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            blob.setdefault("version", self.VERSION)
            blob.setdefault("operators", list(self.OPERATORS))
            blob.setdefault("families", {})
            blob.setdefault("global", {op: self._blank_row(op) for op in self.OPERATORS})
            blob.setdefault("events", [])
            blob.setdefault("promotion", {"status": "research-only", "evidence": None})
            for op in self.OPERATORS:
                blob["global"].setdefault(op, self._blank_row(op))
            return blob
        except Exception as exc:
            return {**default, "events": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    def _row(self, family: str, operator: str) -> Dict[str, Any]:
        families = self.state.setdefault("families", {})
        fam = families.setdefault(str(family), {})
        return fam.setdefault(str(operator), self._blank_row(str(operator)))

    @staticmethod
    def _mean(row: Dict[str, Any]) -> float:
        n = max(0, int(row.get("attempts", 0)))
        s = max(0, int(row.get("successes", 0)))
        return (s + 1.0) / (n + 2.0)

    @staticmethod
    def _cost(row: Dict[str, Any]) -> float:
        return float(row.get("candidates_tested", 0)) / max(1, int(row.get("attempts", 0)))

    def _score(self, family: str, operator: str, total_attempts: int) -> float:
        local = self._row(family, operator)
        global_row = self.state["global"].setdefault(operator, self._blank_row(operator))
        n = int(local.get("attempts", 0))
        total = int(global_row.get("attempts", 0))
        local_mean = self._mean(local)
        global_mean = self._mean(global_row)
        transfer = global_mean if total else 0.5
        uncertainty = math.sqrt(math.log(max(2, total_attempts + 1)) / max(1, n)) if n else 1.0
        # Global transfer is deliberately capped by transfer_weight. Local evidence wins.
        score = 0.65 * local_mean + self.transfer_weight * transfer
        score += self.exploration * uncertainty
        score -= 0.02 * min(10.0, self._cost(local))
        return score

    def rank_operators(self, family: str, operators: Sequence[str] | None = None) -> list[str]:
        ops = [str(x) for x in (operators or self.OPERATORS) if str(x) in self.OPERATORS]
        total = sum(
            int(row.get("attempts", 0))
            for fam in self.state.get("families", {}).values()
            for row in fam.values()
        )
        return sorted(ops, key=lambda op: (-self._score(family, op, total), op))

    def observe(
        self,
        *,
        family: str,
        operator: str,
        verified: bool,
        candidates_tested: int,
        cycle_id: str,
        source_family: str | None = None,
    ) -> None:
        if operator not in self.OPERATORS:
            raise ValueError(f"unknown repair operator: {operator}")
        row = self._row(family, operator)
        grow = self.state["global"].setdefault(operator, self._blank_row(operator))
        for target in (row, grow):
            target["attempts"] += 1
            target["successes"] += int(bool(verified))
            target["candidates_tested"] += max(0, int(candidates_tested))
            target["verified_examples"] += int(bool(verified))
            target["last_seen"] = time.time()
        event = {
            "kind": "observe",
            "family": str(family),
            "operator": str(operator),
            "verified": bool(verified),
            "candidates_tested": int(candidates_tested),
            "cycle_id": str(cycle_id),
        }
        if source_family is not None:
            event["source_family"] = str(source_family)
        self.state.setdefault("events", []).append(event)
        self.state["events"] = self.state["events"][-1024:]
        self._save()

    def is_promoted(self) -> bool:
        return str(self.state.get("promotion", {}).get("status", "research-only")) == "promoted"

    def set_promotion(self, status: str, evidence: Dict[str, Any] | None = None) -> None:
        if status not in {"research-only", "promoted", "revoked"}:
            raise ValueError("invalid promotion status")
        self.state["promotion"] = {"status": status, "evidence": evidence}
        self.state.setdefault("events", []).append({"kind": "promotion", "status": status})
        self.state["events"] = self.state["events"][-1024:]
        self._save()

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
