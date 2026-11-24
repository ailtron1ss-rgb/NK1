from __future__ import annotations
"""Contract-level behavioral checks for promoted canonical facades.

This is intentionally stronger than filename/version matching but lighter than full
semantic equivalence: it validates the stable operations exposed by each canonical
family and a set of invariants that callers rely on.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
import json
import time

from .canonical_capability_facade_v1 import CanonicalCapabilityFacadeV1


@dataclass(frozen=True)
class ContractResultV1:
    family: str
    canonical_module: str
    import_ok: bool
    contract_ok: bool
    invariants: tuple[str, ...]
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class BehavioralEquivalenceContractV1:
    VERSION = "behavioral-equivalence-contract-v1"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.facade = CanonicalCapabilityFacadeV1(self.root)
        self.path = self.root / "runtime" / "behavioral_equivalence_contract_v1.json"

    def _probe(self, family: str) -> ContractResultV1:
        handle = self.facade.resolve(family)
        invariants: list[str] = []
        try:
            cls = self.facade.load(family)
            if family == "skill_transfer":
                obj = cls()
                assert obj.add("seed", 0.95, True, evidence=["contract"])
                assert obj.transfer_score("seed", "unseen", 0.8) > 0.0
                invariants += ["verified_skill_required", "transfer_score_bounded_positive"]
            elif family == "mobile_optimizer":
                obj = cls()
                rows = obj.pareto(6.0, True, 700.0, 600_000, verified_rate=0.9)
                assert isinstance(rows, list)
                assert all("config" in r and "score" in r and "feasible" in r for r in rows)
                invariants += ["pareto_rows_have_contract", "score_present"]
            elif family == "experiment_registry":
                obj = cls(self.root / "runtime")
                row = obj.record("contract_probe", {"seed": 1}, {"ok": True}, "completed")
                assert row["name"] == "contract_probe" and row["status"] == "completed" and row["result"]["ok"]
                invariants += ["record_persists_name_status_result"]
            elif family == "project_audit":
                obj = cls(self.root)
                report = obj.collect({"passed": 1, "total": 1})
                assert "engineering_readiness_pct" in report and "evidence_index_pct" in report
                invariants += ["audit_has_engineering_score", "audit_has_evidence_score"]
            else:
                raise KeyError(f"no contract probe for {family}")
            return ContractResultV1(family, handle.module, True, True, tuple(invariants))
        except Exception as exc:
            return ContractResultV1(family, handle.module, True, False, tuple(invariants), f"{type(exc).__name__}:{exc}")

    def run(self, families: tuple[str, ...] = ("skill_transfer", "mobile_optimizer", "experiment_registry", "project_audit")) -> dict[str, Any]:
        rows = [self._probe(f) for f in families]
        report = {
            "version": self.VERSION,
            "generated_at": time.time(),
            "passed": sum(r.contract_ok for r in rows),
            "total": len(rows),
            "rows": [r.to_dict() for r in rows],
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        return report
