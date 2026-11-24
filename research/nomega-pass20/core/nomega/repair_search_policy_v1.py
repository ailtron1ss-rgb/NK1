from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence
import json, math, time


class RepairSearchPolicyV1:
    """Persistent evidence-driven policy for ordering bounded repair depths.

    The policy learns only from independently execution-verified repair outcomes.
    It stores per-family/depth attempts, verified successes and search cost so
    future repair attempts can prefer historically useful depths without ever
    bypassing execution verification.
    """

    VERSION = "1.9.5"

    def __init__(self, root: Path, seed: int = 1951, exploration: float = 0.35):
        self.root = Path(root)
        self.seed = int(seed)
        self.exploration = float(exploration)
        self.path = self.root / "runtime" / "nomega_repair_search_policy_v1.json"
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "families": {}, "events": [], "promotion": {"status": "research-only", "evidence": None}}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            blob.setdefault("version", self.VERSION)
            blob.setdefault("families", {})
            blob.setdefault("events", [])
            blob.setdefault("promotion", {"status": "research-only", "evidence": None})
            return blob
        except Exception as exc:
            return {
                **default,
                "events": [{"kind": "load_fallback", "reason": type(exc).__name__}],
            }

    def _row(self, family: str, depth: int) -> Dict[str, Any]:
        fam = self.state.setdefault("families", {}).setdefault(str(family), {})
        key = str(int(depth))
        return fam.setdefault(
            key,
            {
                "depth": int(depth),
                "attempts": 0,
                "successes": 0,
                "candidates_tested": 0,
                "verified_examples": 0,
                "last_seen": 0.0,
            },
        )

    @staticmethod
    def _ucb(row: Dict[str, Any], total: int, exploration: float) -> float:
        n = max(0, int(row.get("attempts", 0)))
        s = max(0, int(row.get("successes", 0)))
        mean = (s + 1.0) / (n + 2.0)
        cost = float(row.get("candidates_tested", 0)) / max(1, n)
        uncertainty = math.sqrt(math.log(max(2, total)) / max(1, n)) if n else 1.0
        # Prefer success probability, mildly penalize historical search cost,
        # and preserve exploration for under-observed depths.
        return mean + exploration * uncertainty - 0.015 * min(8.0, cost)

    def rank_depths(self, family: str, depths: Sequence[int]) -> list[int]:
        depths = sorted({int(x) for x in depths if int(x) >= 1})
        total = sum(
            int(v.get("attempts", 0))
            for fam in self.state.get("families", {}).values()
            for v in fam.values()
        )
        ranked = sorted(
            depths,
            key=lambda d: (-self._ucb(self._row(family, d), total + 1, self.exploration), d),
        )
        return ranked

    def observe(
        self,
        *,
        family: str,
        depth: int,
        verified: bool,
        candidates_tested: int,
        cycle_id: str,
    ) -> None:
        row = self._row(family, depth)
        row["attempts"] += 1
        row["successes"] += int(bool(verified))
        row["candidates_tested"] += max(0, int(candidates_tested))
        row["verified_examples"] += int(bool(verified))
        row["last_seen"] = time.time()
        self.state.setdefault("events", []).append(
            {
                "kind": "observe",
                "family": str(family),
                "depth": int(depth),
                "verified": bool(verified),
                "candidates_tested": int(candidates_tested),
                "cycle_id": str(cycle_id),
            }
        )
        self.state["events"] = self.state["events"][-512:]
        self._save()

    def is_promoted(self) -> bool:
        return str(self.state.get("promotion", {}).get("status", "research-only")) == "promoted"

    def set_promotion(self, status: str, evidence: Dict[str, Any] | None = None) -> None:
        if status not in {"research-only", "promoted", "revoked"}:
            raise ValueError("invalid promotion status")
        self.state["promotion"] = {"status": status, "evidence": evidence}
        self.state.setdefault("events", []).append({"kind": "promotion", "status": status})
        self.state["events"] = self.state["events"][-512:]
        self._save()

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8"
        )
