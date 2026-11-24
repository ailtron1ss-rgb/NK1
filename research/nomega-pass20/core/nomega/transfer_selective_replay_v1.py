from __future__ import annotations

"""Transfer-selective replay based on task semantic signatures.

The policy is inspired by the 2026 view that transfer should be treated as an
explicit selection objective rather than assuming that all replay is useful.
It remains an evidence-layer component until a paired downstream training
experiment proves causal improvement.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence
import json, math, time

from .task_spec_v1 import CANONICAL_PROMPT, parse_task_spec


@dataclass(frozen=True)
class TaskSignatureV1:
    family: str
    operators: tuple[str, ...]
    operand_count: int
    constraint_keys: tuple[str, ...]
    output: str = "r0"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SelectiveReplayDecisionV1:
    key: str
    source_family: str
    target_family: str
    compatibility: float
    expected_transfer: float
    transfer_confidence: float
    reward: float
    confidence: float
    negative_risk: float
    anchor: bool
    score: float
    reason: str


class TransferSelectiveReplayV1:
    VERSION = "1.9.9"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_transfer_selective_replay_v1.json"
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "decisions": [], "events": []}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            for k, v in default.items():
                blob.setdefault(k, v)
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "events": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    @staticmethod
    def _clip(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
        return max(lo, min(hi, float(x)))

    @staticmethod
    def _jaccard(a: Iterable[str], b: Iterable[str]) -> float:
        aa, bb = set(a), set(b)
        if not aa and not bb:
            return 1.0
        return len(aa & bb) / max(1, len(aa | bb))

    @classmethod
    def signature_for_family(cls, family: str) -> TaskSignatureV1:
        spec = parse_task_spec(CANONICAL_PROMPT.get(str(family), str(family)))
        if not spec.semantic_valid:
            return TaskSignatureV1(str(family), (), 0, ())
        return TaskSignatureV1(
            family=spec.family,
            operators=tuple(spec.operators),
            operand_count=sum(1 for x in spec.operand_refs if str(x).startswith("x")),
            constraint_keys=tuple(sorted((spec.constraints or {}).keys())),
            output=str(spec.output),
        )

    @classmethod
    def signature_for_record(cls, row: Dict[str, Any]) -> TaskSignatureV1:
        prov = row.get("provenance") or {}
        sig = prov.get("task_signature")
        if isinstance(sig, dict) and sig.get("family"):
            return TaskSignatureV1(
                family=str(sig.get("family")),
                operators=tuple(map(str, sig.get("operators") or ())),
                operand_count=int(sig.get("operand_count", 0)),
                constraint_keys=tuple(map(str, sig.get("constraint_keys") or ())),
                output=str(sig.get("output", "r0")),
            )
        return cls.signature_for_family(str(row.get("family", "")))

    @classmethod
    def compatibility(cls, source: TaskSignatureV1, target: TaskSignatureV1) -> float:
        op_set = cls._jaccard(source.operators, target.operators)
        ordered = 0.0
        if source.operators and target.operators:
            matches = sum(1 for i in range(min(len(source.operators), len(target.operators))) if source.operators[i] == target.operators[i])
            ordered = matches / max(len(source.operators), len(target.operators))
        constraints = cls._jaccard(source.constraint_keys, target.constraint_keys)
        operand = math.exp(-abs(source.operand_count - target.operand_count))
        output = 1.0 if source.output == target.output else 0.0
        return float(max(0.0, min(1.0, 0.34 * op_set + 0.30 * ordered + 0.18 * constraints + 0.12 * operand + 0.06 * output)))

    def _transfer_posterior(self, transfer_state: Dict[str, Any], source: str, target: str) -> tuple[float, float, float]:
        if not source or not target or source == target:
            return 0.0, 0.0, 0.0
        row = transfer_state.get(f"{source}->{target}") or {}
        n = int(row.get("attempts", 0))
        if n <= 0:
            return 0.0, 0.0, 0.0
        mean = float(row.get("sum_delta", 0.0)) / n
        # Shrink low-sample estimates toward neutral transfer.
        confidence = 1.0 - math.exp(-n / 3.0)
        expected = mean * confidence
        negative = max(0.0, -expected)
        return self._clip(expected), confidence, self._clip(negative)

    def rank(
        self,
        records: Sequence[Dict[str, Any]],
        *,
        target_family: str,
        max_items: int = 16,
        transfer_state: Dict[str, Any] | None = None,
        anchor_families: Sequence[str] = (),
        per_family_cap: int = 4,
    ) -> List[SelectiveReplayDecisionV1]:
        target = self.signature_for_family(target_family)
        transfers = transfer_state or {}
        anchors = {str(x) for x in anchor_families}
        candidates: List[SelectiveReplayDecisionV1] = []
        for row in records:
            if not row.get("verified") or row.get("status") in {"candidate", "quarantined"}:
                continue
            source = str(row.get("family", ""))
            sig = self.signature_for_record(row)
            compatibility = self.compatibility(sig, target)
            expected, tconf, negative = self._transfer_posterior(transfers, source, target_family)
            reward = self._clip(float(row.get("reward", 0.0)), 0.0, 1.0)
            confidence = self._clip(float(row.get("confidence", 0.0)), 0.0, 1.0)
            anchor = source in anchors
            anchor_bonus = 0.12 if anchor else 0.0
            score = (
                0.42 * compatibility
                + 0.22 * max(0.0, expected)
                + 0.17 * reward
                + 0.11 * confidence
                + anchor_bonus
                - 0.34 * negative
            )
            reason = "semantic_compatibility"
            if negative > 0.05:
                reason = "negative_transfer_guard"
            elif anchor:
                reason = "anchor_plus_compatibility"
            candidates.append(SelectiveReplayDecisionV1(
                key=str(row.get("key")), source_family=source, target_family=str(target_family),
                compatibility=float(compatibility), expected_transfer=float(expected),
                transfer_confidence=float(tconf), reward=float(reward), confidence=float(confidence),
                negative_risk=float(negative), anchor=anchor, score=float(score), reason=reason,
            ))
        candidates.sort(key=lambda x: (-x.anchor, -x.score, x.key))
        chosen: List[SelectiveReplayDecisionV1] = []
        counts: Dict[str, int] = {}
        for item in candidates:
            if len(chosen) >= max_items:
                break
            if counts.get(item.source_family, 0) >= per_family_cap:
                continue
            chosen.append(item)
            counts[item.source_family] = counts.get(item.source_family, 0) + 1
        self._record(chosen, target_family=target_family)
        return chosen

    def _record(self, decisions: Sequence[SelectiveReplayDecisionV1], *, target_family: str) -> None:
        self.state.setdefault("decisions", []).append({
            "ts": time.time(), "target_family": target_family,
            "items": [asdict(x) for x in decisions],
        })
        self.state["decisions"] = self.state["decisions"][-256:]
        self.state.setdefault("events", []).append({
            "kind": "selective_replay_decision", "target_family": target_family,
            "count": len(decisions),
            "negative_guarded": sum(x.negative_risk > 0.05 for x in decisions),
        })
        self.state["events"] = self.state["events"][-512:]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))
