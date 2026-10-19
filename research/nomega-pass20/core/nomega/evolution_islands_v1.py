from __future__ import annotations

"""Bounded evolutionary islands with controlled migration.

Inspired by open evolutionary coding systems that preserve multiple search
regions and migrate verified knowledge between them.  This implementation is
small, deterministic and evidence-first: islands influence candidate ordering,
never verification truth.
"""

from pathlib import Path
from typing import Any, Dict, List, Mapping, Sequence
import hashlib
import json
import math
import time


class EvolutionIslandControllerV1:
    VERSION = "1.12.0"
    THEMES = ("quality", "novelty", "efficiency", "robustness")

    def __init__(self, root: Path, *, islands: int = 4, seed: int = 11241, migration_interval: int = 4):
        self.root = Path(root)
        self.seed = int(seed)
        self.islands = max(2, int(islands))
        self.migration_interval = max(1, int(migration_interval))
        self.path = self.root / "runtime" / "nomega_evolution_islands_v1.json"
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        default = {
            "version": self.VERSION,
            "islands": {str(i): {"theme": self.THEMES[i % len(self.THEMES)], "candidates": [], "events": 0} for i in range(self.islands)},
            "migrations": [],
            "observations": [],
        }
        if not self.path.exists():
            return default
        try:
            blob = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(blob, dict):
                raise ValueError("island state must be an object")
            for key, value in default.items():
                blob.setdefault(key, value)
            for i in range(self.islands):
                blob.setdefault("islands", {}).setdefault(str(i), default["islands"][str(i)])
            blob["version"] = self.VERSION
            return blob
        except Exception as exc:
            return {**default, "observations": [{"kind": "load_fallback", "reason": type(exc).__name__}]}

    @staticmethod
    def fingerprint(candidate: Mapping[str, Any]) -> str:
        code = candidate.get("code", [])
        payload = json.dumps(code, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]

    def _island_for(self, candidate: Mapping[str, Any]) -> int:
        fp = self.fingerprint(candidate)
        return int(fp[:8], 16) % self.islands

    def _score(self, candidate: Mapping[str, Any], theme: str) -> float:
        verified = 1.0 if bool(candidate.get("verified", False)) else 0.0
        success = float(candidate.get("success", 0.0))
        cost = float(candidate.get("search_cost", 0.0))
        complexity = float(candidate.get("complexity", 0.0))
        novelty = float(candidate.get("novelty", 0.0))
        source = str(candidate.get("source", ""))
        archive_bonus = 0.08 if source == "verified_archive_parent" else 0.0
        if theme == "quality":
            return 1.5 * verified + 1.0 * success - 0.02 * cost + archive_bonus
        if theme == "novelty":
            return 1.0 * novelty + 0.25 * success - 0.005 * complexity + 0.02 * ("local" in source)
        if theme == "efficiency":
            return 0.8 * success - 0.05 * cost - 0.01 * complexity
        return 0.7 * verified + 0.7 * success + 0.2 * novelty - 0.03 * abs(success - verified)

    def route_pool(self, family: str, candidates: Sequence[Mapping[str, Any]], *, budget: int) -> List[Dict[str, Any]]:
        for raw in candidates:
            row = dict(raw)
            row["fingerprint"] = self.fingerprint(row)
            idx = self._island_for(row)
            island = self.state["islands"][str(idx)]
            known = {r.get("fingerprint") for r in island.get("candidates", [])}
            if row["fingerprint"] not in known:
                island.setdefault("candidates", []).append({"family": str(family), **row})
        selected: List[Dict[str, Any]] = []
        cursor = 0
        used_operators: set[str] = set()
        target_budget = max(1, int(budget))
        while len(selected) < target_budget:
            made = False
            for i in range(self.islands):
                island_id = (cursor + i) % self.islands
                island = self.state["islands"][str(island_id)]
                rows = [r for r in island.get("candidates", []) if r.get("family") == str(family)]
                if not rows:
                    continue
                theme = str(island.get("theme", "quality"))
                rows.sort(key=lambda r: (-self._score(r, theme), str(r.get("fingerprint", ""))))
                unused = [r for r in rows if str(r.get("operator", "")) not in used_operators]
                pick = dict((unused or rows)[0])
                fp = pick.get("fingerprint")
                if fp not in {x.get("fingerprint") for x in selected}:
                    pick["island_id"] = int(island_id)
                    pick["island_theme"] = theme
                    selected.append(pick)
                    used_operators.add(str(pick.get("operator", "")))
                    made = True
                    if len(selected) >= target_budget:
                        break
            cursor += 1
            if not made:
                break
            if cursor > self.islands * max(2, target_budget):
                break
        if len(selected) < int(budget):
            fallback = list(candidates)
            fallback.sort(key=lambda r: (str(r.get("operator", "")), self.fingerprint(r)))
            seen = {x.get("fingerprint") for x in selected}
            for row in fallback:
                fp = self.fingerprint(row)
                if fp in seen:
                    continue
                selected.append({**dict(row), "fingerprint": fp, "island_id": self._island_for(row)})
                seen.add(fp)
                if len(selected) >= int(budget):
                    break
        self._trim()
        self._save()
        return selected[: max(1, int(budget))]

    def observe_verified(self, *, family: str, candidate: Mapping[str, Any], verified: bool, success: float, cost: float, cycle_id: str) -> Dict[str, Any]:
        fp = self.fingerprint(candidate)
        idx = int(candidate.get("island_id", self._island_for(candidate))) % self.islands
        island = self.state["islands"][str(idx)]
        row = next((r for r in island.get("candidates", []) if r.get("fingerprint") == fp), None)
        if row is None:
            row = {"family": str(family), **dict(candidate), "fingerprint": fp}
            island.setdefault("candidates", []).append(row)
        row["verified"] = bool(verified)
        row["success"] = float(success)
        row["search_cost"] = float(cost)
        island["events"] = int(island.get("events", 0)) + 1
        self.state["observations"].append({"ts": time.time(), "family": str(family), "fingerprint": fp, "island": idx, "verified": bool(verified), "success": float(success), "search_cost": float(cost), "cycle_id": str(cycle_id)})
        migrated = self.migrate(family=str(family)) if island["events"] % self.migration_interval == 0 else []
        self._trim(); self._save()
        return {"island_id": idx, "fingerprint": fp, "migrated": migrated}

    def migrate(self, *, family: str) -> List[Dict[str, Any]]:
        moves: List[Dict[str, Any]] = []
        best_rows: List[tuple[int, Dict[str, Any]]] = []
        for idx in range(self.islands):
            island = self.state["islands"][str(idx)]
            rows = [r for r in island.get("candidates", []) if r.get("family") == str(family) and bool(r.get("verified", False))]
            if not rows:
                continue
            theme = str(island.get("theme", "quality"))
            rows.sort(key=lambda r: (-self._score(r, theme), str(r.get("fingerprint", ""))))
            best_rows.append((idx, rows[0]))
        if len(best_rows) < 2:
            return moves
        for idx, row in best_rows:
            dest = (idx + 1) % self.islands
            target = self.state["islands"][str(dest)]
            fps = {r.get("fingerprint") for r in target.get("candidates", [])}
            if row.get("fingerprint") in fps:
                continue
            clone = dict(row)
            clone["migrated_from"] = idx
            target.setdefault("candidates", []).append(clone)
            moves.append({"family": str(family), "fingerprint": row.get("fingerprint"), "source_island": idx, "destination_island": dest})
        if moves:
            self.state["migrations"].extend([{**m, "ts": time.time()} for m in moves])
            self.state["migrations"] = self.state["migrations"][-512:]
        return moves

    def stats(self) -> Dict[str, Any]:
        return {
            "version": self.VERSION,
            "islands": self.islands,
            "themes": {str(i): self.state["islands"][str(i)].get("theme") for i in range(self.islands)},
            "candidate_counts": {str(i): len(self.state["islands"][str(i)].get("candidates", [])) for i in range(self.islands)},
            "migrations": len(self.state.get("migrations", [])),
            "verified_observations": sum(bool(x.get("verified")) for x in self.state.get("observations", [])),
        }

    def snapshot(self) -> Dict[str, Any]:
        return json.loads(json.dumps(self.state))

    def _trim(self) -> None:
        for island in self.state.get("islands", {}).values():
            rows = island.get("candidates", [])
            if len(rows) > 256:
                theme = str(island.get("theme", "quality"))
                rows.sort(key=lambda r: (-self._score(r, theme), str(r.get("fingerprint", ""))))
                island["candidates"] = rows[:256]
        self.state["observations"] = self.state.get("observations", [])[-1024:]

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
