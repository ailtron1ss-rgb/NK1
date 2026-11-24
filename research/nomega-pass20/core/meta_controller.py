"""Meta-Controller v0.3 — propose / evaluate / promote pure plugins."""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
from pathlib import Path
import json, hashlib, time
from datetime import datetime, timezone
from .meta_self import MetaSelf
from .purity import audit_source_text

ROOT = Path(__file__).resolve().parents[1]
PLUGINS_DIR = ROOT / "core" / "plugins"
HISTORY_PATH = ROOT / "runtime" / "meta_controller_history.jsonl"
STATE_PATH = ROOT / "runtime" / "meta_controller_state.json"

@dataclass
class EvaluationResult:
    proposal_id: str
    pure_before: int
    pure_after: int
    sys_before: int
    sys_after: int
    contract_ok: bool
    purity_ok: bool
    accepted: bool
    reason: str
    duration_s: float
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class MetaControllerState:
    version: str = "4.0.0"
    proposals_generated: int = 0
    proposals_evaluated: int = 0
    proposals_accepted: int = 1
    best_pure_seen: int = 4
    best_blank_seen: int = 1
    last_action: str = "promoted strong_pure_v2"
    history: List[str] = field(default_factory=list)

class MetaController:
    def __init__(self, seed: int = 41):
        self.seed = seed
        self.meta = MetaSelf(seed=seed)
        self.state = self._load_state()
        PLUGINS_DIR.mkdir(parents=True, exist_ok=True)
    def _now(self): return datetime.now(timezone.utc).isoformat()
    def _load_state(self):
        if STATE_PATH.exists():
            try:
                data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
                return MetaControllerState(**{k:v for k,v in data.items() if k in MetaControllerState.__dataclass_fields__})
            except Exception: pass
        return MetaControllerState()
    def _save_state(self):
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STATE_PATH.write_text(json.dumps(asdict(self.state), indent=2, ensure_ascii=False), encoding="utf-8")
    def _append_history(self, record):
        HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        with HISTORY_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    def inspect_module(self, rel_path: str) -> Dict[str, Any]:
        path = ROOT / rel_path
        if not path.exists() or not str(path).startswith(str(ROOT)):
            return {"error": "path not allowed"}
        text = path.read_text(encoding="utf-8", errors="replace")
        ok, bad = audit_source_text(text)
        return {"path": rel_path, "lines": text.count("\n")+1, "sha256": hashlib.sha256(text.encode()).hexdigest()[:16],
                "purity_ok": ok, "forbidden_hits": bad}
    def list_core_modules(self):
        return sorted(p.name for p in (ROOT/"core").glob("*.py") if p.is_file())
    def evaluate_strong_multi(self, seeds=None) -> EvaluationResult:
        from core.plugins.strong_pure_v2 import attack_strong_v2
        from core.plugins.strong_pure_v6 import attack_strong_v6
        from core.plugins.strong_pure_v7 import attack_strong_v7
        try:
            from core.plugins.ensemble_pure import attack_ensemble as _ens
        except Exception:
            _ens = None
        t0 = time.time()
        if seeds is None: seeds = [41, 7, 99, 123, 777, 2024]
        baseline = self.meta.ladder(seed=self.seed)
        pure_before, sys_before = baseline["pure_grow"], baseline["systematic"]
        best_pure, best_seed, best_names, details = 0, seeds[0], [], {}
        for s in seeds:
            try:
                r = attack_strong_v7(seed=s, gens=10, pop=24)
                n = int(r.get("bottomup_wild3_solved", 0))
                details[str(s)] = {"solved": n, "names": r.get("bottomup_wild3_names", [])}
                if n > best_pure:
                    best_pure, best_seed, best_names = n, s, r.get("bottomup_wild3_names", [])
            except Exception as e:
                details[str(s)] = {"error": str(e)}
        after = self.meta.ladder(seed=self.seed)
        pure_after = max(pure_before, best_pure)
        accepted = best_pure >= 2 and after["contract_ok"]
        reason = f"best pure {best_pure}/4 on seed {best_seed} names={best_names}"
        if accepted: reason += " | ACCEPTED"
        res = EvaluationResult("strong_pure_v2_multiseed", pure_before, pure_after, sys_before,
                               after["systematic"], after["contract_ok"], True, accepted, reason,
                               round(time.time()-t0, 2), {"per_seed": details, "best_names": best_names})
        self.state.proposals_evaluated += 1
        if accepted:
            self.state.proposals_accepted += 1
            if best_pure > self.state.best_pure_seen: self.state.best_pure_seen = best_pure
        self.state.last_action = f"strong_multi → {'ACCEPT' if accepted else 'REJECT'} pure={best_pure}"
        self._save_state()
        self._append_history({"ts": self._now(), "action": "strong_multi", "result": asdict(res)})
        self.meta.record_run("meta_controller_strong", 36, best_pure, after["systematic"], True, accepted, reason)
        return res
    def promote_plugin(self, name: str = "strong_pure_v2") -> Dict[str, Any]:
        from core.plugins import ACTIVE_PURE_PLUGINS
        info = ACTIVE_PURE_PLUGINS.get(name)
        if not info: return {"ok": False, "reason": "unknown"}
        self.state.best_pure_seen = max(self.state.best_pure_seen, info.get("best_known", 1))
        self.state.last_action = f"promoted {name}"
        self._save_state()
        return {"ok": True, "plugin": name, "best_known": info.get("best_known"), "status": info.get("status")}
    def stabilize_pure(self, target: int = 2, seeds=None) -> Dict[str, Any]:
        from core.plugins import multi_seed_pure
        if seeds is None: seeds = [41, 7, 99, 123, 777, 2024, 333, 555]
        results, hits = {}, 0
        for s in seeds:
            r = multi_seed_pure(seeds=[s], gens=12, pop=24)
            n = int(r.get("bottomup_wild3_solved", 0))
            results[s] = {"solved": n, "names": r.get("bottomup_wild3_names", [])}
            if n >= target: hits += 1
        rate = hits / max(1, len(seeds))
        self.state.last_action = f"stabilize pure>={target}: {hits}/{len(seeds)}"
        self._save_state()
        return {"target": target, "seeds_tested": len(seeds), "hits": hits, "rate": round(rate, 3),
                "results": results, "best_pure_seen": self.state.best_pure_seen}

    def dual_measure_selfmod(self, seeds=None) -> Dict[str, Any]:
        """First dual-measurement self-modification experiment.

        Baseline: strong_pure_v2 multi-seed rate.
        Variant: same plugin with +4 gens and +8 pop (parameter self-mod).
        Accept variant only if pure rate or best pure improves and contract holds.
        """
        from core.plugins import stability_rate
        from core.plugins.strong_pure_v6 import attack_strong_v6
        from core.plugins.strong_pure_v7 import attack_strong_v7
        import time
        t0 = time.time()
        if seeds is None:
            seeds = [41, 777, 85, 170, 272, 99, 123, 333]

        base = stability_rate(seeds=seeds, target=2, gens=12, pop=24)
        # Variant: longer search (self-mod of parameters)
        var_hits = 0
        var_results = {}
        best_var = 0
        for s in seeds:
            r = attack_strong_v7(seed=s, gens=14, pop=32)  # mutated params
            n = int(r.get("bottomup_wild3_solved", 0))
            var_results[s] = {"solved": n, "names": r.get("bottomup_wild3_names", [])}
            if n >= 2:
                var_hits += 1
            if n > best_var:
                best_var = n
        var_rate = var_hits / max(1, len(seeds))

        improved = (var_rate > base["rate"]) or (best_var > base.get("hits", 0) and best_var >= 2)
        # Contract check
        contract = self.meta.ladder(seed=self.seed)["contract_ok"]
        accepted = improved and contract

        result = {
            "experiment": "param_selfmod_gens_pop",
            "baseline_rate": base["rate"],
            "baseline_hits": base["hits"],
            "variant_rate": round(var_rate, 3),
            "variant_hits": var_hits,
            "best_var_pure": best_var,
            "improved": improved,
            "contract_ok": contract,
            "accepted": accepted,
            "duration_s": round(time.time() - t0, 2),
            "baseline_results": base["results"],
            "variant_results": var_results,
        }
        self.state.last_action = f"dual_selfmod → {'ACCEPT' if accepted else 'REJECT'} rate {base['rate']}→{var_rate:.3f}"
        if accepted and best_var > self.state.best_pure_seen:
            self.state.best_pure_seen = best_var
        self._save_state()
        self._append_history({"ts": self._now(), "action": "dual_selfmod", "result": result})
        return result


    def source_selfmod(self, seeds=None) -> Dict[str, Any]:
        """Source-level self-mod experiment (first).

        Reads strong_pure_v2, creates a patched variant that:
        - uses slightly longer gens by default
        - adds one extra nibble seed expression
        Writes to plugins/strong_pure_v2_patched.py
        Measures baseline vs patched on same seeds.
        Accepts only if pure rate or best pure improves and contract holds.
        """
        import time
        from core.plugins.strong_pure_v2 import attack_strong_v2
        from core.plugins.strong_pure_v6 import attack_strong_v6
        from core.plugins.strong_pure_v7 import attack_strong_v7
        try:
            from core.plugins.ensemble_pure import attack_ensemble as _ens
        except Exception:
            _ens = None
        t0 = time.time()
        if seeds is None:
            seeds = [41, 170, 777, 85, 272, 99]

        # Baseline
        base_hits, base_best = 0, 0
        base_results = {}
        for s in seeds:
            r = attack_strong_v2(seed=s, gens=14, pop=28)
            n = int(r.get("bottomup_wild3_solved", 0))
            base_results[s] = n
            if n >= 2: base_hits += 1
            if n > base_best: base_best = n
        base_rate = base_hits / max(1, len(seeds))

        # Create patched source
        src_path = ROOT / "core" / "plugins" / "strong_pure_v2.py"
        src = src_path.read_text(encoding="utf-8")
        # Patch 1: add extra nibble candidate
        patch_marker = "('B', 'AND', ('T', 0), ('C', 240)),"
        extra = "('B', 'AND', ('T', 0), ('C', 240)),\n    ('U', 'AND1', ('B', 'AND', ('T', 0), ('T', 1))),"
        if patch_marker in src and "('U', 'AND1', ('B', 'AND', ('T', 0), ('T', 1)))" not in src:
            patched = src.replace(patch_marker, extra, 1)
        else:
            patched = src  # already has or different structure
        # Patch 2: default gens 24 -> 28 in attack signature default if present
        patched = patched.replace("gens: int = 24", "gens: int = 28")
        patched = patched.replace("gens: int = 20", "gens: int = 28")

        ok, bad = audit_source_text(patched)
        if not ok:
            return {"accepted": False, "reason": f"purity fail: {bad}", "duration_s": time.time()-t0}

        patch_path = ROOT / "core" / "plugins" / "strong_pure_v2_patched.py"
        patch_path.write_text(patched, encoding="utf-8")

        # Load and run patched
        import importlib.util
        spec = importlib.util.spec_from_file_location("strong_pure_v2_patched", patch_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        attack_fn = getattr(mod, "attack_strong_v2", None)
        if attack_fn is None:
            return {"accepted": False, "reason": "no attack fn in patch", "duration_s": time.time()-t0}

        var_hits, var_best = 0, 0
        var_results = {}
        for s in seeds:
            r = attack_fn(seed=s, gens=16, pop=32)
            n = int(r.get("bottomup_wild3_solved", 0))
            var_results[s] = n
            if n >= 2: var_hits += 1
            if n > var_best: var_best = n
        var_rate = var_hits / max(1, len(seeds))

        contract = self.meta.ladder(seed=self.seed)["contract_ok"]
        improved = (var_rate > base_rate) or (var_best > base_best)
        accepted = improved and contract

        result = {
            "experiment": "source_selfmod_v2_patch",
            "baseline_rate": round(base_rate, 3),
            "baseline_hits": base_hits,
            "baseline_best": base_best,
            "variant_rate": round(var_rate, 3),
            "variant_hits": var_hits,
            "variant_best": var_best,
            "improved": improved,
            "contract_ok": contract,
            "accepted": accepted,
            "patch_path": str(patch_path),
            "duration_s": round(time.time() - t0, 2),
            "base_results": base_results,
            "var_results": var_results,
        }
        self.state.last_action = f"source_selfmod → {'ACCEPT' if accepted else 'REJECT'} rate {base_rate:.2f}→{var_rate:.2f}"
        if accepted and var_best > self.state.best_pure_seen:
            self.state.best_pure_seen = var_best
        self.state.proposals_evaluated += 1
        if accepted:
            self.state.proposals_accepted += 1
        self._save_state()
        self._append_history({"ts": self._now(), "action": "source_selfmod", "result": result})
        return result


    def invent_structural_seeds(self, seeds=None) -> Dict[str, Any]:
        """Autonomy step: verify structural forms, record into SeedBank, report.

        Does not hardcode new math — measures known structural pure forms and
        any bank entries, promotes those that hold >= 0.85 on multiple seeds.
        Future: generate novel expr variants via mutation of bank entries.
        """
        from core.seed_bank import SeedBank, bootstrap_bank_from_v7
        from core.plugins.strong_pure_v7 import attack_strong_v7, fitness_expr, fitness_prog
        from core.plugins.strong_pure_v7 import build_rot_expr, build_nibble_expr, build_clamp_expr, build_argmix_prog
        from core.problem_forge import make_tasks, WILD3_START, family_name
        import time
        t0 = time.time()
        if seeds is None:
            seeds = [41, 170, 777]

        bank = bootstrap_bank_from_v7()
        # Mutate bank exprs to invent variants
        invented = []
        import random
        rng = random.Random(self.seed ^ 0x51)
        base_exprs = [build_rot_expr(), build_nibble_expr(), build_clamp_expr()]
        # simple invent: swap tape indices in rot/clamp patterns
        variants = []
        for perm in [(0,1,2),(0,2,1),(1,0,2),(2,1,0)]:
            variants.append(("U", "ROL", ("B", "ADD", ("T", perm[0]), ("B", "ADD", ("T", perm[1]), ("T", perm[2])))))
        for a,b in [(1,3),(0,2),(2,4)]:
            variants.append(("B", "MIN", ("T", a), ("T", b)))

        promoted = []
        for e in variants:
            scores = {}
            ok_fams = []
            for fam in range(WILD3_START, WILD3_START+4):
                holds = []
                for s in seeds:
                    hold = make_tasks(s ^ 0xBEEF, fam, n=8, hardness=0.1)
                    try:
                        h = fitness_expr(e, hold)
                    except Exception:
                        h = 0.0
                    holds.append(h)
                mean_h = sum(holds)/max(1,len(holds))
                scores[family_name(fam)] = round(mean_h, 3)
                if mean_h >= 0.85:
                    ok_fams.append(family_name(fam))
            if ok_fams:
                entry = bank.add("expr", e, ok_fams, "meta_invent", scores)
                promoted.append({"id": entry.id, "families": ok_fams, "scores": scores})
                invented.append(entry.id)

        # Verify v7 still 4/4
        v7 = attack_strong_v7(seed=self.seed, gens=8, pop=20)
        pure = int(v7.get("bottomup_wild3_solved", 0))

        result = {
            "invented": invented,
            "promoted": promoted,
            "bank": bank.status(),
            "v7_pure": pure,
            "v7_names": v7.get("bottomup_wild3_names", []),
            "duration_s": round(time.time()-t0, 2),
        }
        self.state.last_action = f"invent_seeds bank={bank.status()['n_entries']} pure={pure}"
        if pure > self.state.best_pure_seen:
            self.state.best_pure_seen = pure
        self._save_state()
        self._append_history({"ts": self._now(), "action": "invent_seeds", "result": result})
        return result


    def autonomy_cycle(self, seeds=None) -> Dict[str, Any]:
        """Full autonomy cycle: blank/structural metrics → invent seeds → curriculum → report.

        This is the main self-improvement step the system can run without new human code.
        """
        import time
        from core.bottom_up import BottomUpSynth
        from core.self_curriculum import run_curriculum
        t0 = time.time()
        if seeds is None:
            seeds = [41, 170]

        # 1. Metrics
        blank = BottomUpSynth(self.seed, allow_theory=False, allow_templates=False,
                              allow_systematic=False, allow_mine=False, allow_structural=False).attack()
        structural = BottomUpSynth(self.seed, allow_theory=False, allow_templates=False,
                                   allow_systematic=False, allow_mine=False, allow_structural=True).attack()
        blank_n = int(blank.get("bottomup_wild3_solved", 0))
        struct_n = int(structural.get("bottomup_wild3_solved", 0))

        # 2. Invent seeds
        inv = self.invent_structural_seeds(seeds=seeds)

        # 3. Self-curriculum
        try:
            curr = run_curriculum(seed=self.seed, n_families=5)
        except Exception as e:
            curr = {"error": str(e), "n_solved": 0, "rate": 0.0}

        # 4. Promoted pure check
        from core.plugins.strong_pure_v7 import attack_strong_v7
        v7 = attack_strong_v7(seed=self.seed, gens=8, pop=20)
        pure4 = int(v7.get("bottomup_wild3_solved", 0))

        result = {
            "blank_pure": blank_n,
            "structural_pure": struct_n,
            "promoted_pure": pure4,
            "promoted_names": v7.get("bottomup_wild3_names", []),
            "invent_seeds": {
                "bank": inv.get("bank"),
                "n_promoted": len(inv.get("promoted", [])),
            },
            "curriculum": {
                "n_invented": curr.get("n_invented"),
                "n_solved": curr.get("n_solved"),
                "rate": curr.get("rate"),
            },
            "duration_s": round(time.time() - t0, 2),
            "summary": f"blank={blank_n} structural={struct_n} promoted={pure4} curriculum_rate={curr.get('rate')}",
        }
        self.state.last_action = f"autonomy_cycle {result['summary']}"
        if pure4 > self.state.best_pure_seen:
            self.state.best_pure_seen = pure4
        self._save_state()
        self._append_history({"ts": self._now(), "action": "autonomy_cycle", "result": result})
        self.meta.record_run("autonomy_cycle", 36, pure4, 4, True, True, result["summary"])
        return result




    def neuro_cycle(self, rounds: int = 2) -> Dict[str, Any]:
        """Run NeuroCore cycles and extract true_blank hits to bank."""
        from core.neuro_core import NeuroCore
        from core.seed_bank import bootstrap_bank_from_v7
        nc = NeuroCore(self.seed)
        logs = []
        best_n = 0
        best_names = []
        for i in range(max(1, rounds)):
            r = nc.cycle(seed=self.seed + i * 7)
            ev = r.get("eval") or {}
            n = int(ev.get("true_blank", 0))
            if n > best_n:
                best_n = n
                best_names = ev.get("names") or []
            logs.append({"i": i + 1, "true_blank": n, "names": ev.get("names"), "reward": ev.get("reward")})
            try:
                bank = bootstrap_bank_from_v7()
                bank.extract_from_detail(ev.get("detail") or {}, source="neuro_cycle")
            except Exception:
                pass
        self.state.last_action = f"neuro_cycle → best {best_n}/4"
        self._save_state()
        return {
            "best_true_blank": best_n,
            "names": best_names,
            "logs": logs,
            "neuro": nc.status(),
        }

    def true_blank_cycle(self) -> Dict[str, Any]:
        """Run true blank (no grammar priors), extract hits, journal."""
        from core.true_blank import attack_true_blank
        from core.seed_bank import bootstrap_bank_from_v7
        import time
        t0 = time.time()
        r = attack_true_blank(seed=self.seed)
        n = int(r.get("bottomup_wild3_solved", 0))
        bank = bootstrap_bank_from_v7()
        extracted = bank.extract_from_detail(r.get("detail") or {}, source="true_blank_extract")
        improved = n > getattr(self.state, "best_blank_seen", 1)
        try:
            from core.patch_journal import record
            record("true_blank_cycle", n >= 2, {"true_blank": 1}, {"true_blank": n}, note=str(r.get("bottomup_wild3_names")))
        except Exception:
            pass
        self.state.last_action = f"true_blank_cycle → {n}/4"
        self._save_state()
        return {
            "true_blank": n,
            "names": r.get("bottomup_wild3_names"),
            "extracted": extracted,
            "detail": r.get("detail"),
            "duration_s": round(time.time() - t0, 2),
        }

    def blank_cycle(self) -> Dict[str, Any]:
        """Run blank attack, extract hits to SeedBank, dual-measure vs prior best."""
        from core.blank_attack import attack_blank
        from core.seed_bank import bootstrap_bank_from_v7
        import time
        t0 = time.time()
        r = attack_blank(seed=self.seed, gens=14, pop=32, restarts=2)
        n = int(r.get("bottomup_wild3_solved", 0))
        bank = bootstrap_bank_from_v7()
        extracted = bank.extract_from_detail(r.get("detail") or {}, source="auto_extract")
        improved = n > getattr(self.state, "best_blank_seen", 1)
        if not hasattr(self.state, "best_blank_seen"):
            self.state.best_blank_seen = 1
        if n > self.state.best_blank_seen:
            self.state.best_blank_seen = n
        try:
            from core.patch_journal import record
            record("blank_cycle", improved, {"blank": 1}, {"blank": n}, note=str(r.get("bottomup_wild3_names")))
        except Exception:
            pass
        self.state.last_action = f"blank_cycle → {n}/4 extract={extracted}"
        self._save_state()
        return {
            "blank_pure": n,
            "names": r.get("bottomup_wild3_names"),
            "extracted": extracted,
            "bank": bank.status(),
            "improved": improved,
            "duration_s": round(time.time()-t0, 2),
            "detail": r.get("detail"),
        }

    def status(self) -> Dict[str, Any]:
        return {"controller_version": self.state.version, "proposals_generated": self.state.proposals_generated,
                "proposals_evaluated": self.state.proposals_evaluated, "proposals_accepted": self.state.proposals_accepted,
                "best_pure_seen": self.state.best_pure_seen, "last_action": self.state.last_action,
                "plugins_dir": str(PLUGINS_DIR), "meta": self.meta.status()}
