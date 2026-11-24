"""MetaSelf 1.8 — self-audit and history substrate."""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
from pathlib import Path
import json, hashlib
from datetime import datetime, timezone

from .invent_law import validate_invent_result, law_summary, FROZEN_MAX_FAMILY

ROOT = Path(__file__).resolve().parents[1]
HISTORY_PATH = ROOT / "runtime" / "meta_history.jsonl"
SELF_STATE_PATH = ROOT / "runtime" / "meta_self_state.json"

@dataclass
class RunSnapshot:
    ts: str
    profile: str
    closed: int
    wild3_pure: int
    wild3_sys: int
    invent_mode: bool
    green: bool
    purity_ok: bool
    law_flags: List[str]
    seed: int
    note: str = ""
    hash: str = ""
    def compute_hash(self) -> str:
        payload = f"{self.ts}|{self.profile}|{self.closed}|{self.wild3_pure}|{self.wild3_sys}|{self.seed}"
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

@dataclass
class MetaSelfState:
    version: str = "1.8.0"
    created: str = ""
    last_update: str = ""
    baseline_pure: int = 1
    baseline_sys: int = 4
    runs: int = 0
    best_pure: int = 2
    best_sys: int = 4
    consecutive_no_improve: int = 0
    recommendations: List[str] = field(default_factory=list)
    purity_score: float = 1.0

class MetaSelf:
    def __init__(self, seed: int = 41):
        self.seed = seed
        self.state = self._load_state()
    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()
    def _load_state(self) -> MetaSelfState:
        if SELF_STATE_PATH.exists():
            try:
                data = json.loads(SELF_STATE_PATH.read_text(encoding="utf-8"))
                return MetaSelfState(**{k: v for k, v in data.items() if k in MetaSelfState.__dataclass_fields__})
            except Exception:
                pass
        return MetaSelfState(created=self._now(), last_update=self._now(), best_pure=2)
    def _save_state(self) -> None:
        SELF_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        SELF_STATE_PATH.write_text(json.dumps(asdict(self.state), indent=2, ensure_ascii=False), encoding="utf-8")
    def _append_history(self, snap: RunSnapshot) -> None:
        HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        with HISTORY_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(snap), ensure_ascii=False) + "\n")
    def audit_report(self, report: Dict[str, Any]) -> Dict[str, Any]:
        law = validate_invent_result(report)
        return {"law": law, "purity_ok": law.get("ok", False), "flags": law.get("flags", []), "summary": law_summary()}
    def record_run(self, profile: str, closed: int, wild3_pure: int, wild3_sys: int,
                   invent_mode: bool = False, green: bool = False, note: str = "") -> RunSnapshot:
        snap = RunSnapshot(ts=self._now(), profile=profile, closed=closed, wild3_pure=wild3_pure,
                           wild3_sys=wild3_sys, invent_mode=invent_mode, green=green,
                           purity_ok=closed >= 36 and wild3_pure <= wild3_sys, law_flags=[], seed=self.seed, note=note)
        snap.hash = snap.compute_hash()
        self._append_history(snap)
        self.state.runs += 1
        self.state.last_update = snap.ts
        if wild3_pure > self.state.best_pure:
            self.state.best_pure = wild3_pure
            self.state.consecutive_no_improve = 0
        else:
            self.state.consecutive_no_improve += 1
        if wild3_sys > self.state.best_sys:
            self.state.best_sys = wild3_sys
        self._save_state()
        return snap
    def ladder(self, seed: Optional[int] = None) -> Dict[str, Any]:
        from .bottom_up import BottomUpSynth
        s = seed if seed is not None else self.seed
        rows = {}
        for label, kw in [
            ("theory+templates", dict(allow_theory=True, allow_templates=True, allow_systematic=True, allow_mine=True)),
            ("systematic", dict(allow_theory=False, allow_templates=False, allow_systematic=True, allow_mine=False)),
            ("io-mine", dict(allow_theory=False, allow_templates=False, allow_systematic=False, allow_mine=True)),
            ("pure_structural", dict(allow_theory=False, allow_templates=False, allow_systematic=False, allow_mine=False, allow_structural=True)),
            ("pure_blank", dict(allow_theory=False, allow_templates=False, allow_systematic=False, allow_mine=False, allow_structural=False)),
        ]:
            try:
                res = BottomUpSynth(seed=s, **kw).attack()
                n = res.get("bottomup_wild3_solved", 0)
            except Exception:
                n = -1
            rows[label] = n
        pure = rows.get("pure_structural", rows.get("pure_grow", 0))
        blank = rows.get("pure_blank", 0)
        sysm = rows.get("systematic", 0)
        promoted = 0
        promoted_names = []
        try:
            from core.plugins import multi_seed_pure
            pr = multi_seed_pure(seeds=[s], gens=8, pop=20)
            promoted = int(pr.get("bottomup_wild3_solved", 0))
            promoted_names = pr.get("bottomup_wild3_names", [])
        except Exception:
            pass
        return {"seed": s, "ladder": rows, "contract_ok": (pure >= 3) and (sysm >= 3) and (pure <= sysm),
                "pure_grow": pure, "pure_blank": blank, "systematic": sysm,
                "promoted_pure": promoted, "promoted_pure_names": promoted_names,
                "freeze_message": "pure structural >= 3; systematic >= 3; pure <= systematic"}
    def status(self) -> Dict[str, Any]:
        ladder = self.ladder()
        return {"meta_version": self.state.version, "runs": self.state.runs, "best_pure": self.state.best_pure,
                "best_sys": self.state.best_sys, "consecutive_no_improve": self.state.consecutive_no_improve,
                "recommendations": self.state.recommendations, "ladder": ladder,
                "history_path": str(HISTORY_PATH), "state_path": str(SELF_STATE_PATH), "law": law_summary()}
    def propose_next_action(self) -> str:
        if self.state.best_pure <= 1:
            return "RECOMMEND: Continue pure search pressure. Do NOT add seed-priors."
        if self.state.best_pure >= 2 and self.state.consecutive_no_improve >= 3:
            return "RECOMMEND: Stabilize pure>=2 across more seeds, then attack clamp/argmix."
        return "RECOMMEND: Maintain freeze, measure stability, push pure higher."
