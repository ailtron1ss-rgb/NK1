from __future__ import annotations

"""Persistent multi-cycle self-development trajectory with no reset."""

from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Sequence
import json
import time

from .development_frontier_selector_v1 import DevelopmentFrontierSelectorV1
from .metaproductivity_v1 import MetaproductivityTrackerV1
from .unified_development_loop_v1 import UnifiedDevelopmentLoopV1


class LongHorizonSelfDevelopmentV1:
    VERSION = "long-horizon-self-development-v1"

    def __init__(self, root: Path, *, seed: int = 8147):
        self.root = Path(root)
        self.seed = int(seed)
        self.frontier = DevelopmentFrontierSelectorV1(self.root, seed=seed + 1)
        self.loop = UnifiedDevelopmentLoopV1(self.root, seed=seed + 2)
        self.meta = MetaproductivityTrackerV1(self.root)
        self.path = self.root / "runtime" / "long_horizon_self_development_v1.jsonl"
        self.state_path = self.root / "runtime" / "long_horizon_self_development_state_v1.json"
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        if not self.state_path.exists():
            return {"version": self.VERSION, "runs": [], "cycles": []}
        try:
            blob = json.loads(self.state_path.read_text(encoding="utf-8"))
            if isinstance(blob, dict):
                blob.setdefault("runs", [])
                blob.setdefault("cycles", [])
                blob["version"] = self.VERSION
                return blob
        except (OSError, json.JSONDecodeError, TypeError):
            return {"version": self.VERSION, "runs": [], "cycles": []}
        return {"version": self.VERSION, "runs": [], "cycles": []}

    def run(
        self,
        metrics_provider: Callable[[Mapping[str, Any]], Dict[str, Any]],
        candidate_factory: Callable[..., Any],
        evaluator: Callable[[Any], Dict[str, Any]],
        *,
        cycles: int = 3,
        allow_stagnation_escape: bool = True,
    ) -> Dict[str, Any]:
        started = time.perf_counter()
        previous: Dict[str, Any] = {"cycle_index": -1, "status": "initial"}
        rows: list[dict[str, Any]] = []
        for idx in range(max(1, int(cycles))):
            metrics = dict(metrics_provider(previous))
            decision = self.frontier.select(metrics, cycle_index=idx)
            metrics["__selected_bottleneck__"] = decision.selected.name
            metrics["__selected_intervention__"] = decision.selected.action
            metrics["__frontier_decision_id__"] = decision.decision_id
            result = self.loop.run_cycle(metrics, candidate_factory, evaluator, allow_stagnation_escape=allow_stagnation_escape)
            result_dict = result.to_dict()
            active = self.loop.current_artifact() or {}
            parent_hash = str(result.evidence.get("parent_candidate_hash") or result.evidence.get("parent_artifact_id") or "")
            report = self.meta.report(parent_hash) if parent_hash else None
            row = {
                "cycle_index": idx,
                "cycle_id": result.cycle_id,
                "bottleneck": decision.selected.name,
                "intervention": decision.selected.action,
                "frontier_decision_id": decision.decision_id,
                "status": result.status,
                "accepted": result.accepted,
                "gain": result.gain,
                "active_artifact_id": active.get("artifact_id"),
                "parent_artifact_id": active.get("parent_artifact_id"),
                "metaproductivity": report.to_dict() if report else None,
                "elapsed_s": round(time.perf_counter() - started, 6),
            }
            rows.append(row)
            previous = row | {"metrics": metrics, "result": result_dict}
            self.state["cycles"].append(row)
            self.state["cycles"] = self.state["cycles"][-512:]
            self._append(row)
        run_id = f"lh-{int(time.time() * 1000)}-{self.seed}"
        accepted = sum(bool(row["accepted"]) for row in rows)
        gains = [float(row["gain"]) for row in rows]
        active = self.loop.current_artifact()
        report = {
            "version": self.VERSION,
            "run_id": run_id,
            "cycles": rows,
            "accepted_cycles": accepted,
            "mean_gain": sum(gains) / max(1, len(gains)),
            "positive_gain_cycles": sum(1 for gain in gains if gain > 0.0),
            "active_artifact": active,
            "no_reset": True,
            "persistent_root": True,
            "elapsed_s": time.perf_counter() - started,
            "status": "completed",
        }
        self.state["runs"].append(report)
        self.state["runs"] = self.state["runs"][-128:]
        self._save()
        return report

    def _append(self, row: Dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, sort_keys=True, ensure_ascii=False, default=str) + "\n")

    def _save(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(self.state, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
