"""Nullseed Mind LTS 7.0 — cognitive layer over pure-search substrate.

Brain functions (bounded, phone-safe, no host eval):
1. Episodic memory — history of autonomy cycles and outcomes
2. Semantic memory — beliefs about what raises metrics
3. Drives — ordered goals (raise blank pure, grow curriculum, invent seeds)
4. Planner — choose next action from drives + beliefs
5. Learning — update beliefs from measured outcomes
6. think() → one cognitive step; run() → multi-step session

This is NOT consciousness. It IS a closed goal-directed control loop
that compounds experience across runs via persistent JSON state.
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import json
import time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
MIND_PATH = ROOT / "runtime" / "mind_state.json"
EPISODES_PATH = ROOT / "runtime" / "mind_episodes.jsonl"

# --- Drives (priority order) ---
DRIVES = [
    ("raise_blank_pure", "Increase pure invent without structural seeds"),
    ("expand_curriculum", "Invent and solve more self-generated task families"),
    ("grow_seed_bank", "Discover and promote structural seed variants"),
    ("maintain_structural_4", "Keep structural/promoted pure at 4/4"),
    ("source_improve", "Attempt source-level self-mod when stagnant"),
]

ACTIONS = [
    "measure",          # blank + structural metrics
    "invent_seeds",     # MetaController invent_structural_seeds
    "curriculum",       # self_curriculum.run_curriculum
    "autonomy_cycle",   # full MetaController.autonomy_cycle
    "strong_eval",      # promoted pure v7
    "source_selfmod",   # source patch experiment
    "reflect",          # update beliefs only
]


@dataclass
class Belief:
    key: str
    value: float  # 0..1 confidence or expected utility
    evidence: int = 0
    note: str = ""


@dataclass
class Episode:
    ts: str
    action: str
    drive: str
    outcome: Dict[str, Any]
    reward: float
    beliefs_snapshot: Dict[str, float] = field(default_factory=dict)


@dataclass
class MindState:
    version: str = "7.0.0"
    cycles: int = 0
    total_reward: float = 0.0
    best_blank_pure: int = 1
    best_true_blank: int = 1
    best_structural_pure: int = 4
    best_curriculum_rate: float = 0.0
    stagnation: int = 0
    last_action: str = ""
    last_drive: str = ""
    beliefs: Dict[str, float] = field(default_factory=dict)
    goal_progress: float = 0.0


class Mind:
    """Goal-directed cognitive controller."""

    def __init__(self, seed: int = 41):
        self.seed = seed
        self.state = self._load()
        if not self.state.beliefs:
            self.state.beliefs = {
                "invent_seeds_helps": 0.5,
                "curriculum_helps": 0.5,
                "source_selfmod_helps": 0.3,
                "autonomy_cycle_helps": 0.6,
                "blank_pure_is_hard": 0.9,
                "structural_is_solved": 0.95,
            }

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _load(self) -> MindState:
        if MIND_PATH.exists():
            try:
                data = json.loads(MIND_PATH.read_text(encoding="utf-8"))
                return MindState(**{k: v for k, v in data.items() if k in MindState.__dataclass_fields__})
            except Exception:
                pass
        return MindState()

    def _save(self) -> None:
        try:
            MIND_PATH.parent.mkdir(parents=True, exist_ok=True)
            MIND_PATH.write_text(json.dumps(asdict(self.state), indent=2, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass

    def _append_episode(self, ep: Episode) -> None:
        try:
            EPISODES_PATH.parent.mkdir(parents=True, exist_ok=True)
            with EPISODES_PATH.open("a", encoding="utf-8") as f:
                f.write(json.dumps(asdict(ep), ensure_ascii=False) + "\n")
        except OSError:
            pass

    # --- Perception ---
    def perceive(self) -> Dict[str, Any]:
        from core.bottom_up import BottomUpSynth
        from core.plugins.strong_pure_v7 import attack_strong_v7
        from core.blank_attack import attack_blank
        from core.true_blank import attack_true_blank
        blank = attack_blank(seed=self.seed, gens=6, pop=16, restarts=1)
        true_b = attack_true_blank(seed=self.seed)
        structural = BottomUpSynth(
            self.seed, allow_theory=False, allow_templates=False,
            allow_systematic=False, allow_mine=False, allow_structural=True,
        ).attack()
        v7 = attack_strong_v7(seed=self.seed, gens=6, pop=16)
        return {
            "blank_pure": int(blank.get("bottomup_wild3_solved", 0)),
            "true_blank": int(true_b.get("bottomup_wild3_solved", 0)),
            "true_blank_names": true_b.get("bottomup_wild3_names"),
            "structural_pure": int(structural.get("bottomup_wild3_solved", 0)),
            "promoted_pure": int(v7.get("bottomup_wild3_solved", 0)),
            "promoted_names": v7.get("bottomup_wild3_names", []),
            "stagnation": self.state.stagnation,
            "cycles": self.state.cycles,
        }

    # --- Drive selection ---
    def select_drive(self, perception: Dict[str, Any]) -> str:
        blank = perception.get("blank_pure", 1)
        structural = perception.get("structural_pure", 4)
        stag = perception.get("stagnation", 0)
        if blank < 3:
            return "raise_blank_pure"
        if structural < 4:
            return "maintain_structural_4"
        if stag >= 3:
            return "source_improve"
        if self.state.best_curriculum_rate < 0.8:
            return "expand_curriculum"
        return "grow_seed_bank"

    # --- Planner ---
    def plan(self, drive: str, perception: Dict[str, Any]) -> str:
        b = self.state.beliefs
        if drive == "raise_blank_pure":
            if self.state.cycles % 3 == 2:
                return "neuro_boost"
            if perception.get("cycles", 0) % 3 == 0:
                return "measure"
            return "curriculum" if b.get("curriculum_helps", 0.5) >= 0.4 else "invent_seeds"
        if drive == "maintain_structural_4":
            return "strong_eval" if perception.get("structural_pure", 0) < 4 else "autonomy_cycle"
        if drive == "expand_curriculum":
            return "curriculum"
        if drive == "grow_seed_bank":
            return "invent_seeds"
        if drive == "source_improve":
            return "source_selfmod" if b.get("source_selfmod_helps", 0.3) > 0.25 else "autonomy_cycle"
        return "autonomy_cycle"

    # --- Act ---
    def act(self, action: str) -> Dict[str, Any]:
        from core.meta_controller import MetaController
        mc = MetaController(self.seed)
        if action == "measure":
            return {"type": "measure", **self.perceive()}
        if action == "invent_seeds":
            r = mc.invent_structural_seeds(seeds=[self.seed, 170])
            return {"type": "invent_seeds", "bank": r.get("bank"), "n_promoted": len(r.get("promoted", [])), "v7_pure": r.get("v7_pure")}
        if action == "curriculum":
            from core.self_curriculum import run_curriculum
            r = run_curriculum(seed=self.seed, n_families=5)
            return {"type": "curriculum", "rate": r.get("rate"), "n_solved": r.get("n_solved"), "n_invented": r.get("n_invented")}
        if action == "autonomy_cycle":
            r = mc.autonomy_cycle(seeds=[self.seed, 170])
            return {"type": "autonomy_cycle", "summary": r.get("summary"), "blank_pure": r.get("blank_pure"),
                    "structural_pure": r.get("structural_pure"), "curriculum": r.get("curriculum")}
        if action == "strong_eval":
            from core.plugins.strong_pure_v7 import attack_strong_v7
            r = attack_strong_v7(seed=self.seed, gens=8, pop=20)
            return {"type": "strong_eval", "pure": r.get("bottomup_wild3_solved"), "names": r.get("bottomup_wild3_names")}
        if action == "source_selfmod":
            try:
                r = mc.source_selfmod(seeds=[self.seed, 170, 777])
                return {"type": "source_selfmod", "accepted": r.get("accepted"), "improved": r.get("improved"),
                        "baseline_rate": r.get("baseline_rate"), "variant_rate": r.get("variant_rate")}
            except Exception as e:
                return {"type": "source_selfmod", "error": str(e), "accepted": False}
        if action == "neuro_boost":
            from core.meta_controller import MetaController
            r = MetaController(self.seed).neuro_cycle(rounds=2)
            return {
                "type": "neuro_boost",
                "summary": r.get("logs"),
                "true_blank": r.get("best_true_blank"),
                "blank_pure": r.get("best_true_blank"),
                "names": r.get("names"),
            }
        if action == "reflect":
            return {"type": "reflect", "beliefs": dict(self.state.beliefs)}
        return {"type": "unknown", "action": action}

    # --- Reward & learning ---
    def reward(self, action: str, outcome: Dict[str, Any], perception_before: Dict[str, Any]) -> float:
        r = 0.0
        if action in ("measure", "strong_eval", "autonomy_cycle"):
            blank = outcome.get("blank_pure", perception_before.get("blank_pure", 1))
            structural = outcome.get("structural_pure", outcome.get("pure", perception_before.get("structural_pure", 4)))
            if isinstance(structural, int) and structural >= 4:
                r += 0.3
            if isinstance(blank, int) and blank > self.state.best_blank_pure:
                r += 2.0  # rare breakthrough
            if isinstance(blank, int) and blank > perception_before.get("blank_pure", 1):
                r += 1.0
        if action == "curriculum":
            rate = float(outcome.get("rate", 0) or 0)
            r += rate
            if rate > self.state.best_curriculum_rate:
                r += 0.5
        if action == "invent_seeds":
            r += 0.2 * int(outcome.get("n_promoted", 0) or 0)
            if int(outcome.get("v7_pure", 0) or 0) >= 4:
                r += 0.3
        if action == "source_selfmod":
            if outcome.get("accepted"):
                r += 1.5
            elif outcome.get("improved"):
                r += 0.5
            else:
                r -= 0.1
        return round(r, 3)

    def learn(self, action: str, reward: float, outcome: Dict[str, Any]) -> None:
        lr = 0.15
        key_map = {
            "invent_seeds": "invent_seeds_helps",
            "curriculum": "curriculum_helps",
            "source_selfmod": "source_selfmod_helps",
            "autonomy_cycle": "autonomy_cycle_helps",
        }
        if action in key_map:
            k = key_map[action]
            old = self.state.beliefs.get(k, 0.5)
            # reward signal normalized roughly to [-1, 1]
            signal = max(-1.0, min(1.0, reward / 2.0))
            self.state.beliefs[k] = round(max(0.05, min(0.99, old + lr * (signal - (old - 0.5)))), 3)
        blank = outcome.get("blank_pure")
        if isinstance(blank, int):
            if blank <= 1:
                self.state.beliefs["blank_pure_is_hard"] = min(0.99, self.state.beliefs.get("blank_pure_is_hard", 0.9) + 0.01)
            if blank > self.state.best_blank_pure:
                self.state.best_blank_pure = blank
                self.state.stagnation = 0
                self.state.beliefs["blank_pure_is_hard"] = max(0.3, self.state.beliefs.get("blank_pure_is_hard", 0.9) - 0.2)
        structural = outcome.get("structural_pure", outcome.get("pure"))
        if isinstance(structural, int) and structural >= 4:
            self.state.beliefs["structural_is_solved"] = 0.99
            self.state.best_structural_pure = max(self.state.best_structural_pure, structural)
        rate = outcome.get("rate")
        if isinstance(rate, (int, float)) and rate > self.state.best_curriculum_rate:
            self.state.best_curriculum_rate = float(rate)

    # --- Main cognitive step ---
    def think(self) -> Dict[str, Any]:
        """One full cognitive cycle: perceive → drive → plan → act → reward → learn."""
        t0 = time.time()
        perception = self.perceive()
        drive = self.select_drive(perception)
        action = self.plan(drive, perception)
        outcome = self.act(action)
        # merge perception into outcome for reward where needed
        if "blank_pure" not in outcome and "blank_pure" in perception:
            outcome = {
                **outcome,
                "blank_pure": perception["blank_pure"],
                "structural_pure": perception["structural_pure"],
                "true_blank": perception.get("true_blank"),
                "true_blank_names": perception.get("true_blank_names"),
            }
        rew = self.reward(action, outcome, perception)
        self.learn(action, rew, outcome)

        # stagnation
        if rew < 0.15:
            self.state.stagnation += 1
        else:
            self.state.stagnation = max(0, self.state.stagnation - 1)

        self.state.cycles += 1
        self.state.total_reward = round(self.state.total_reward + rew, 3)
        self.state.last_action = action
        self.state.last_drive = drive
        self.state.goal_progress = round(
            0.25 * min(1.0, self.state.best_structural_pure / 4)
            + 0.35 * min(1.0, self.state.best_blank_pure / 4)
            + 0.20 * min(1.0, self.state.best_curriculum_rate)
            + 0.20 * min(1.0, self.state.cycles / 20),
            3,
        )
        self._save()

        ep = Episode(
            ts=self._now(), action=action, drive=drive, outcome=outcome,
            reward=rew, beliefs_snapshot=dict(self.state.beliefs),
        )
        self._append_episode(ep)

        return {
            "cycle": self.state.cycles,
            "drive": drive,
            "action": action,
            "outcome": outcome,
            "reward": rew,
            "beliefs": dict(self.state.beliefs),
            "stagnation": self.state.stagnation,
            "goal_progress": self.state.goal_progress,
            "best_blank_pure": self.state.best_blank_pure,
            "best_structural_pure": self.state.best_structural_pure,
            "duration_s": round(time.time() - t0, 2),
        }

    def run(self, steps: int = 3) -> Dict[str, Any]:
        """Multi-step cognitive session."""
        results = []
        for _ in range(max(1, steps)):
            results.append(self.think())
        return {
            "steps": steps,
            "results": results,
            "final_beliefs": dict(self.state.beliefs),
            "total_reward": self.state.total_reward,
            "goal_progress": self.state.goal_progress,
            "cycles": self.state.cycles,
        }

    def status(self) -> Dict[str, Any]:
        return {
            "mind_version": self.state.version,
            "cycles": self.state.cycles,
            "total_reward": self.state.total_reward,
            "best_blank_pure": self.state.best_blank_pure,
            "best_structural_pure": self.state.best_structural_pure,
            "best_curriculum_rate": self.state.best_curriculum_rate,
            "stagnation": self.state.stagnation,
            "last_action": self.state.last_action,
            "last_drive": self.state.last_drive,
            "beliefs": dict(self.state.beliefs),
            "goal_progress": self.state.goal_progress,
            "drives": [d[0] for d in DRIVES],
        }


def quick_mind_status(seed: int = 41) -> Dict[str, Any]:
    return Mind(seed=seed).status()
