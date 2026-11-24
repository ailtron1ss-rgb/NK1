from __future__ import annotations

"""Trace diagnostics for evolutionary repair.

Inspired by recent evolutionary-coding analysis: distinguish genuinely new
structural edits from retuning, recombination, and reintroduction of deleted
material before treating a benchmark improvement as algorithmic progress.
"""

from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
import hashlib, json


Program = Sequence[Sequence[int]]


class EvolutionDiagnosticsV1:
    VERSION = "1.9.9"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.path = self.root / "runtime" / "nomega_evolution_diagnostics_v1.json"
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {"version": self.VERSION, "traces": [], "events": []}
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                return default
            blob.setdefault("traces", []); blob.setdefault("events", [])
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "events": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    @staticmethod
    def _rows(code: Program) -> List[Tuple[int, int, int]]:
        return [tuple(map(int, row)) for row in code]

    @staticmethod
    def _fp(row: Tuple[int, int, int]) -> str:
        return hashlib.sha1(str(row).encode()).hexdigest()[:12]

    def classify_edit(self, parent: Program, child: Program, *, deleted_history: Sequence[Sequence[int]] = ()) -> Dict[str, Any]:
        p = self._rows(parent); c = self._rows(child)
        p_set, c_set = set(p), set(c)
        removed = [x for x in p if x not in c_set]
        added = [x for x in c if x not in p_set]
        same_len = len(p) == len(c)
        opcode_changes = 0
        arg_changes = 0
        aligned = min(len(p), len(c))
        for i in range(aligned):
            if p[i] != c[i]:
                if p[i][0] != c[i][0]: opcode_changes += 1
                if p[i][1:] != c[i][1:]: arg_changes += 1
        historical_deleted = {tuple(map(int, x)) for x in deleted_history}
        reintroduced = [x for x in added if x in historical_deleted]
        if reintroduced:
            kind = "reintroduction"
        elif same_len and opcode_changes and not arg_changes:
            kind = "operator_change"
        elif same_len and arg_changes and not opcode_changes:
            kind = "parameter_retune"
        elif added and removed and len(added) == len(removed):
            kind = "substitution"
        elif added and not removed:
            kind = "insertion"
        elif removed and not added:
            kind = "deletion"
        elif added and removed:
            kind = "recombination"
        else:
            kind = "no_change"
        return {
            "kind": kind,
            "parent_len": len(p), "child_len": len(c),
            "added": [list(x) for x in added], "removed": [list(x) for x in removed],
            "opcode_changes": opcode_changes, "argument_changes": arg_changes,
            "reintroduced_count": len(reintroduced),
            "novel_structural_fraction": len([x for x in added if x not in p_set]) / max(1, len(added)),
        }

    def record(self, *, parent: Program, child: Program, family: str, outcome: Dict[str, Any], cycle_id: str, deleted_history: Sequence[Sequence[int]] = ()) -> Dict[str, Any]:
        edit = self.classify_edit(parent, child, deleted_history=deleted_history)
        row = {"family": str(family), "cycle_id": str(cycle_id), "outcome": dict(outcome), "edit": edit}
        self.state["traces"].append(row); self.state["traces"] = self.state["traces"][-1024:]
        self.state["events"].append({"kind": "trace_recorded", "family": family, "edit_kind": edit["kind"]})
        self.state["events"] = self.state["events"][-512:]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
        return row

    def mechanism_summary(self) -> Dict[str, Any]:
        traces = self.state.get("traces", [])
        counts: Dict[str, int] = {}
        for row in traces:
            k = str(row.get("edit", {}).get("kind", "unknown")); counts[k] = counts.get(k, 0) + 1
        total = max(1, len(traces))
        return {"version": self.VERSION, "traces": len(traces), "mechanisms": {k: v / total for k, v in counts.items()}, "counts": counts}

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))
