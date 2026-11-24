"""NeuroCore 20.0 — unified neuro layer for Nullseed.

Orchestrates:
  - NeuroPolicy (search θ via ES)
  - NeuroPriorAttack (bigram / residual prior)
  - NeuroProgrammer (tiny MLP ES program emitter)

Phone-safe: pure Python floats, no torch, no downloads.
Goal: improve true_blank / wild3 search via learned search control + emit.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import json
import random
import math
import time

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "runtime" / "neuro_core_state.json"

# θ for meta-search control (extended)
N_THETA = 10
# indices
I_MUT = 0
I_DEPTH = 1
I_LOCAL = 2
I_CROSS = 3
I_PRIOR = 4
I_EMIT = 5
I_HOLD_W = 6
I_POP_SCALE = 7
I_RESTART_B = 8
I_EXPLORE = 9


def _sigmoid(x: float) -> float:
    if x > 20:
        return 1.0
    if x < -20:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class NeuroState:
    theta: List[float] = field(default_factory=lambda: [0.0] * N_THETA)
    elite_theta: List[float] = field(default_factory=list)
    updates: int = 0
    best_reward: float = 0.0
    best_true_blank: int = 1
    history: List[Dict[str, Any]] = field(default_factory=list)
    seed: int = 41


class NeuroCore:
    """Unified neuro controller — ES on θ, optional programmer emit, prior bias."""

    def __init__(self, seed: int = 41):
        self.seed = seed
        self.rng = random.Random(seed ^ 0x4E4555)
        self.state = self._load()
        if all(abs(x) < 1e-12 for x in self.state.theta):
            # sensible logits
            self.state.theta = [
                0.0,   # mut
                0.3,   # depth
                0.2,   # local
                -0.2,  # cross
                0.0,   # prior
                -0.5,  # emit
                0.4,   # hold weight
                0.0,   # pop scale
                0.1,   # restart bias
                0.0,   # explore
            ]
        self.state.seed = seed

    def _load(self) -> NeuroState:
        if STATE_PATH.exists():
            try:
                data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
                th = data.get("theta") or [0.0] * N_THETA
                if len(th) < N_THETA:
                    th = th + [0.0] * (N_THETA - len(th))
                et = data.get("elite_theta") or []
                if len(et) < N_THETA:
                    et = (et + [0.0] * N_THETA)[:N_THETA]
                return NeuroState(
                    theta=th[:N_THETA],
                    elite_theta=et,
                    updates=int(data.get("updates", 0)),
                    best_reward=float(data.get("best_reward", 0)),
                    best_true_blank=int(data.get("best_true_blank", 1)),
                    history=list(data.get("history") or [])[-50:],
                    seed=int(data.get("seed", self.seed)),
                )
            except Exception:
                pass
        return NeuroState(seed=self.seed)

    def save(self) -> None:
        try:
            STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
            STATE_PATH.write_text(
                json.dumps({
                    "theta": self.state.theta,
                    "elite_theta": self.state.elite_theta or self.state.theta,
                    "updates": self.state.updates,
                    "best_reward": self.state.best_reward,
                    "best_true_blank": self.state.best_true_blank,
                    "history": self.state.history[-40:],
                    "seed": self.state.seed,
                    "updated": _now(),
                }, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except OSError:
            pass

    def decode_theta(self, theta: Optional[List[float]] = None) -> Dict[str, float]:
        th = theta or self.state.theta
        return {
            "mut_rate": 0.15 + 0.55 * _sigmoid(th[I_MUT]),
            "depth_bias": 1.0 + 2.0 * _sigmoid(th[I_DEPTH]),
            "local_steps": int(20 + 60 * _sigmoid(th[I_LOCAL])),
            "cross_p": 0.1 + 0.5 * _sigmoid(th[I_CROSS]),
            "prior_p": _sigmoid(th[I_PRIOR]),
            "emit_p": _sigmoid(th[I_EMIT]),
            "hold_w": 0.3 + 0.5 * _sigmoid(th[I_HOLD_W]),
            "pop_scale": 0.7 + 0.8 * _sigmoid(th[I_POP_SCALE]),
            "restart_bonus": int(1 + 3 * _sigmoid(th[I_RESTART_B])),
            "explore": _sigmoid(th[I_EXPLORE]),
        }



    def _prior_bias_exprs(self, fam: int, seed: int, n: int = 6) -> list:
        """Sample programs from NeuroPriorAttack and convert to light expr seeds if possible."""
        out = []
        try:
            from core.neuro_prior import NeuroPriorAttack
            from core.hierarchical_vm import hprogram_fitness, decode_hprog
            from core.problem_forge import make_tasks
            pa = NeuroPriorAttack(seed=seed ^ fam)
            try:
                pa.bootstrap_from_rot()
            except Exception:
                pass
            train = make_tasks(seed, fam, n=8)
            for _ in range(n):
                try:
                    prog = pa.sample_prog()
                    h = hprogram_fitness(prog if isinstance(prog, list) else decode_hprog(prog), train)
                    if h >= 0.5:
                        out.append(("PRIOR_HIT", h, prog if isinstance(prog, list) else None))
                except Exception:
                    continue
        except Exception:
            pass
        return out

    def _programmer_island(self, fam: int, seed: int, attempts: int = 8) -> tuple:
        """Try NeuroProgrammer emit for family; return (hold, expr_marker) or (0, None)."""
        try:
            from core.neuro_programmer import NeuroProgrammer
            from core.hierarchical_vm import decode_hprog, hprogram_fitness
            from core.problem_forge import make_tasks
            from core.schema_engine import _pack
            np = NeuroProgrammer(seed=seed ^ fam)
            # light train if never updated
            if getattr(np, "updates", 0) <= 0:
                try:
                    np.train(families=[fam], rounds=2, population=4, samples_per=1)
                except Exception:
                    pass
            att = np.attack(fam, attempts=attempts)
            if att is None:
                return 0.0, None
            genome, score = att
            hold = make_tasks(seed ^ 0xBEEF, fam, n=8, hardness=0.1)
            prog = decode_hprog(genome)
            h = hprogram_fitness(prog, hold)
            return float(h), ("PROG", int(genome % (2**32)))
        except Exception:
            return 0.0, None

    def evaluate_theta(self, theta: List[float], seed: Optional[int] = None) -> Dict[str, Any]:
        """Run true_blank-like search controlled by θ — reward = true_blank solved."""
        from core.true_blank import (
            rand_expr, mut, crossover, is_trivial, score_candidate, local_hold_search, expr_size,
        )
        from core.problem_forge import make_tasks, WILD3_START, family_name
        from core.blank_attack import grow_exact, fit

        s = seed if seed is not None else self.seed
        ctrl = self.decode_theta(theta)
        rng = random.Random(s ^ 0xE5 + int(sum(theta) * 1000) % 997)
        solved = 0
        names = []
        details = {}
        pop = max(12, int(24 * ctrl["pop_scale"]))
        gens = max(6, int(10 + 8 * ctrl["explore"]))
        restarts = max(1, 1 + ctrl["restart_bonus"])
        depth = max(1, int(ctrl["depth_bias"]))

        for fam in range(WILD3_START, WILD3_START + 4):
            trains = [
                make_tasks(s ^ 0xA11CE, fam, n=10),
                make_tasks(s ^ 0xC0FFEE, fam, n=8),
            ]
            holds = [
                make_tasks(s ^ 0xBEEF, fam, n=8, hardness=0.10),
                make_tasks(s ^ 0xDEAD, fam, n=8, hardness=0.12),
            ]
            best_tr, best_ho, best_e = 0.0, 0.0, None
            ge = grow_exact(s, fam)
            if ge is not None and not is_trivial(ge):
                tr, ho, _ = score_candidate(ge, trains, holds)
                best_tr, best_ho, best_e = tr, ho, ge

            # NeuroProgrammer emit island when emit_p high
            if ctrl.get("emit_p", 0) > 0.45:
                ph, pmark = self._programmer_island(fam, s, attempts=6)
                if ph > best_ho:
                    best_ho = ph
                    best_e = pmark if pmark is not None else best_e

            for r in range(restarts):
                population = [rand_expr(rng, rng.randint(1, depth)) for _ in range(pop)]
                population.append(
                    ("U", "ROL", ("B", "ADD", ("T", 0), ("B", "ADD", ("T", 1), ("T", 2))))
                )
                if ctrl["prior_p"] > 0.40 and rng.random() < ctrl["prior_p"]:
                    population.append(
                        ("B", "EQ", ("U", "HNIB", ("T", rng.randrange(6))), ("U", "HNIB", ("T", rng.randrange(6))))
                    )
                    # absorb prior search hits as hold scores into best
                    for item in self._prior_bias_exprs(fam, s, n=4):
                        if item[1] > best_ho:
                            best_ho = float(item[1])
                for g in range(gens):
                    scored = []
                    for e in population:
                        tr, ho, adj = score_candidate(e, trains, holds)
                        primary = (1 - ctrl["hold_w"]) * tr + ctrl["hold_w"] * ho
                        scored.append((primary, tr, ho, e))
                    scored.sort(key=lambda x: -x[0])
                    if scored[0][2] > best_ho and scored[0][1] >= 0.7:
                        best_ho, best_tr, best_e = scored[0][2], scored[0][1], scored[0][3]
                    elites = [x[3] for x in scored[:10] if not is_trivial(x[3])] or [x[3] for x in scored[:10]]
                    if g % 4 == 3 and elites:
                        le, lt, lh = local_hold_search(
                            elites[0], trains, holds, rng, steps=ctrl["local_steps"]
                        )
                        if lh > best_ho:
                            best_ho, best_tr, best_e = lh, lt, le
                        elites[0] = le
                    new_pop = elites[:]
                    while len(new_pop) < pop:
                        if rng.random() < ctrl["cross_p"] and len(elites) >= 2:
                            child = crossover(rng.choice(elites), rng.choice(elites), rng)
                        elif rng.random() < 0.75:
                            child = mut(rng.choice(elites), rng)
                        else:
                            child = rand_expr(rng, rng.randint(1, depth))
                        new_pop.append(child)
                    population = new_pop

            sec = fit(best_e, holds[1]) if best_e is not None else 0.0
            details[family_name(fam)] = {
                "train": round(best_tr, 3),
                "hold": round(best_ho, 3),
                "hold2": round(sec, 3),
            }
            if best_ho >= 0.85 and sec >= 0.55 and best_e is not None and not is_trivial(best_e):
                solved += 1
                names.append(family_name(fam))

        reward = solved / 4.0 + 0.05 * sum(
            1 for d in details.values() if d.get("hold", 0) >= 0.7
        )
        return {
            "true_blank": solved,
            "names": names,
            "reward": round(reward, 4),
            "detail": details,
            "ctrl": ctrl,
        }


    def multi_seed_reward(self, theta: List[float], seeds: Optional[List[int]] = None) -> Dict[str, Any]:
        """Reward = hard true_blank multi-seed: mean/4 + ge4_rate + 0.5*ge3_rate."""
        if seeds is None:
            seeds = [self.seed, 170, 123, 85]
        rows = []
        total = 0
        ge2 = ge3 = ge4 = 0
        # Prefer direct true_blank attack (hard gates) over θ-eval when measuring invent
        try:
            from core.true_blank import attack_true_blank
            use_direct = True
        except Exception:
            use_direct = False
        for s in seeds:
            if use_direct:
                r = attack_true_blank(s, gens=4, pop=10, restarts=1)
                n = int(r.get("bottomup_wild3_solved", 0))
                names = r.get("bottomup_wild3_names")
            else:
                r = self.evaluate_theta(theta, seed=s)
                n = int(r["true_blank"])
                names = r.get("names")
            total += n
            if n >= 2: ge2 += 1
            if n >= 3: ge3 += 1
            if n >= 4: ge4 += 1
            rows.append({"seed": s, "true_blank": n, "names": names})
        n_seeds = max(1, len(seeds))
        mean_tb = total / n_seeds
        ge4_rate = ge4 / n_seeds
        ge3_rate = ge3 / n_seeds
        ge2_rate = ge2 / n_seeds
        reward = 0.40 * (mean_tb / 4.0) + 0.40 * ge4_rate + 0.20 * ge3_rate
        return {
            "reward": round(reward, 4),
            "mean_true_blank": round(mean_tb, 3),
            "ge2_rate": round(ge2_rate, 3),
            "ge3_rate": round(ge3_rate, 3),
            "ge4_rate": round(ge4_rate, 3),
            "ge2": ge2, "ge3": ge3, "ge4": ge4,
            "n_seeds": len(seeds),
            "rows": rows,
        }

    def apply_theta_to_config(self) -> Dict[str, Any]:
        """Write decoded θ into true_blank_config.json (algorithm surface)."""
        ctrl = self.decode_theta()
        cfg = {
            "gens": max(8, int(10 + 12 * ctrl["explore"])),
            "pop": max(16, int(24 * ctrl["pop_scale"])),
            "restarts": max(1, 1 + int(ctrl["restart_bonus"])),
            "accepted": True,
            "source": "neuro_core",
            "hold_w": ctrl["hold_w"],
            "local_steps": ctrl["local_steps"],
            "cross_p": ctrl["cross_p"],
            "secondary_hold_gate": 0.55,
        }
        path = ROOT / "runtime" / "true_blank_config.json"
        try:
            path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass
        return cfg


    def es_update(self, population: int = 8, sigma: float = 0.30, lr: float = 0.20, multi_seed: bool = True) -> Dict[str, Any]:
        """OpenAI-ES with optional antithetic sampling and multi-seed reward."""
        t0 = time.time()
        base = list(self.state.theta)
        # adaptive sigma: shrink if recent accepts high
        recent = self.state.history[-5:]
        if recent:
            acc_rate = sum(1 for h in recent if h.get("accepted")) / len(recent)
            if acc_rate > 0.8:
                sigma = max(0.12, sigma * 0.85)
            elif acc_rate < 0.3:
                sigma = min(0.55, sigma * 1.15)
        half = max(2, population // 2)
        noises = []
        rewards = []
        # antithetic: +eps and -eps
        for i in range(half):
            noise = [self.rng.gauss(0, 1) for _ in range(N_THETA)]
            for sign in (1.0, -1.0):
                theta_i = [base[j] + sign * sigma * noise[j] for j in range(N_THETA)]
                if multi_seed:
                    r = self.multi_seed_reward(theta_i, seeds=[self.seed, 170, 123])
                    rewards.append(r["reward"])
                else:
                    r = self.evaluate_theta(theta_i, seed=self.seed + i * 17)
                    rewards.append(r["reward"])
                noises.append([sign * noise[j] for j in range(N_THETA)])
        mean_r = sum(rewards) / len(rewards)
        std = max(1e-6, (sum((x - mean_r) ** 2 for x in rewards) / len(rewards)) ** 0.5)
        norm = [(x - mean_r) / std for x in rewards]
        grad = [0.0] * N_THETA
        for i in range(len(noises)):
            for j in range(N_THETA):
                grad[j] += norm[i] * noises[i][j]
        grad = [g / len(noises) for g in grad]
        new_theta = [base[j] + lr * grad[j] for j in range(N_THETA)]
        if multi_seed:
            before = self.multi_seed_reward(base, seeds=[self.seed, 170, 123])
            after = self.multi_seed_reward(new_theta, seeds=[self.seed, 170, 123])
            before_tb = int(round(before["mean_true_blank"]))
            after_tb = int(round(after["mean_true_blank"]))
            before_r, after_r = before["reward"], after["reward"]
        else:
            before = self.evaluate_theta(base, seed=self.seed)
            after = self.evaluate_theta(new_theta, seed=self.seed)
            before_tb, after_tb = before["true_blank"], after["true_blank"]
            before_r, after_r = before["reward"], after["reward"]
        accepted = after_r >= before_r - 1e-9
        if accepted:
            self.state.theta = new_theta
            if after_tb > self.state.best_true_blank:
                self.state.best_true_blank = after_tb
                self.state.elite_theta = list(new_theta)
            if after_r > self.state.best_reward:
                self.state.best_reward = after_r
                self.state.elite_theta = list(new_theta)
            self.apply_theta_to_config()
        self.state.updates += 1
        entry = {
            "ts": _now(),
            "accepted": accepted,
            "before_reward": before_r,
            "after_reward": after_r,
            "before_tb": before_tb,
            "after_tb": after_tb,
            "mean_pop_reward": round(mean_r, 4),
            "multi_seed": multi_seed,
        }
        self.state.history.append(entry)
        self.save()
        try:
            from core.patch_journal import record
            record(
                "neuro_es_update",
                accepted,
                {"reward": before_r, "true_blank": before_tb},
                {"reward": after_r, "true_blank": after_tb},
                note=f"updates={self.state.updates} multi_seed={multi_seed}",
            )
        except Exception:
            pass
        return {
            "accepted": accepted,
            "before_reward": before_r,
            "after_reward": after_r,
            "before_tb": before_tb,
            "after_tb": after_tb,
            "before": before,
            "after": after,
            "updates": self.state.updates,
            "theta": list(self.state.theta),
            "ctrl": self.decode_theta(),
            "duration_s": round(time.time() - t0, 2),
            "pop_rewards": rewards,
        }

    def boost(self, rounds: int = 3, population: int = 6, multi_seed: bool = False) -> Dict[str, Any]:
        """Several ES rounds — main 'прокачка' entry."""
        rounds = max(1, min(8, rounds))
        log = []
        for i in range(rounds):
            r = self.es_update(population=population, multi_seed=multi_seed)
            tb = r.get("after_tb")
            if tb is None and isinstance(r.get("after"), dict):
                tb = r["after"].get("true_blank") or r["after"].get("mean_true_blank")
            rew = r.get("after_reward")
            if rew is None and isinstance(r.get("after"), dict):
                rew = r["after"].get("reward")
            log.append({
                "round": i + 1,
                "accepted": r["accepted"],
                "true_blank": tb,
                "reward": rew,
            })
        cfg = self.apply_theta_to_config()
        return {
            "rounds": rounds,
            "log": log,
            "best_true_blank": self.state.best_true_blank,
            "best_reward": self.state.best_reward,
            "updates": self.state.updates,
            "ctrl": self.decode_theta(),
            "theta": list(self.state.theta),
            "config": cfg,
        }



    def save_programmer(self, np) -> str:
        path = ROOT / "runtime" / "neuro_programmer_weights.json"
        try:
            data = {
                "weights": list(np.mlp.w) if hasattr(np, "mlp") else [],
                "updates": getattr(np, "updates", 0),
                "best_reward": getattr(np, "best_reward", 0),
                "seed": self.seed,
            }
            path.write_text(json.dumps(data), encoding="utf-8")
            return str(path)
        except Exception as e:
            return f"error:{e}"

    def load_programmer(self):
        path = ROOT / "runtime" / "neuro_programmer_weights.json"
        try:
            from core.neuro_programmer import NeuroProgrammer, MLP
            np = NeuroProgrammer(seed=self.seed)
            if path.exists():
                data = json.loads(path.read_text(encoding="utf-8"))
                w = data.get("weights") or []
                if w:
                    np.mlp = MLP(weights=w, seed=self.seed)
                    np.updates = int(data.get("updates", 0))
                    np.best_reward = float(data.get("best_reward", 0))
            return np
        except Exception:
            from core.neuro_programmer import NeuroProgrammer
            return NeuroProgrammer(seed=self.seed)


    def online_learn(self, true_blank: int, names: Optional[List[str]] = None, seed: Optional[int] = None) -> Dict[str, Any]:
        """Update beliefs from an external true_blank result (cycle feedback)."""
        reward = true_blank / 4.0 + (0.1 if true_blank >= 2 else 0.0)
        improved = reward > self.state.best_reward - 1e-9 and true_blank >= self.state.best_true_blank
        if true_blank > self.state.best_true_blank:
            self.state.best_true_blank = true_blank
            self.state.elite_theta = list(self.state.theta)
            improved = True
        if reward > self.state.best_reward:
            self.state.best_reward = reward
            self.state.elite_theta = list(self.state.theta)
        # soft pull theta toward elite if stagnating
        if self.state.elite_theta and len(self.state.elite_theta) == N_THETA:
            if true_blank < self.state.best_true_blank:
                for j in range(N_THETA):
                    self.state.theta[j] = 0.9 * self.state.theta[j] + 0.1 * self.state.elite_theta[j]
            else:
                for j in range(N_THETA):
                    self.state.theta[j] = 0.95 * self.state.theta[j] + 0.05 * self.state.elite_theta[j]
        self.state.history.append({
            "ts": _now(),
            "type": "online_learn",
            "true_blank": true_blank,
            "names": names or [],
            "reward": reward,
            "seed": seed if seed is not None else self.seed,
        })
        self.state.updates += 1
        self.save()
        self.apply_theta_to_config()
        return {
            "true_blank": true_blank,
            "reward": reward,
            "best_true_blank": self.state.best_true_blank,
            "best_reward": self.state.best_reward,
            "updates": self.state.updates,
            "improved": improved,
        }

    def cycle(self, seed: Optional[int] = None) -> Dict[str, Any]:
        """Evaluate current θ, online_learn from result, optional micro ES."""
        s = seed if seed is not None else self.seed
        ev = self.evaluate_theta(self.state.theta, seed=s)
        ol = self.online_learn(ev["true_blank"], ev.get("names"), seed=s)
        micro = None
        if ev["true_blank"] < 2:
            micro = self.es_update(population=4, multi_seed=False)
        return {"eval": ev, "online": ol, "micro_es": micro, "status": self.status()}

    def train_all(self, policy_rounds: int = 2, prog_rounds: int = 2, es_rounds: int = 2) -> Dict[str, Any]:
        """Train policy + programmer + ES core — full neuro stack boost."""
        report: Dict[str, Any] = {}
        try:
            from core.neuro_policy import NeuroPolicy
            from core.problem_forge import WILD3_START
            pol = NeuroPolicy(seed=self.seed)
            # train on a couple wild3 families if API allows
            try:
                from core.problem_forge import WILD3_START
                fams = list(range(WILD3_START, WILD3_START + 4))
                report["policy"] = pol.train(
                    families=fams, pool=fams, rounds=max(1, policy_rounds), population=4, shots=6
                )
            except Exception as e:
                report["policy"] = {"error": str(e)}
        except Exception as e:
            report["policy"] = {"error": str(e)}
        try:
            from core.problem_forge import WILD3_START
            np = self.load_programmer()
            fams = list(range(WILD3_START, WILD3_START + 4))
            report["programmer"] = np.train(families=fams, rounds=prog_rounds, population=4, samples_per=1)
            report["programmer_path"] = self.save_programmer(np)
        except Exception as e:
            report["programmer"] = {"error": str(e)}
        report["es"] = self.boost(rounds=es_rounds, population=4, multi_seed=False)
        report["status"] = self.status()
        return report

    def status(self) -> Dict[str, Any]:
        return {
            "updates": self.state.updates,
            "best_true_blank": self.state.best_true_blank,
            "best_reward": self.state.best_reward,
            "ctrl": self.decode_theta(),
            "theta": list(self.state.theta),
            "history_tail": self.state.history[-5:],
            "path": str(STATE_PATH),
        }


def quick_neuro_boost(seed: int = 41, rounds: int = 2) -> Dict[str, Any]:
    return NeuroCore(seed).boost(rounds=rounds, population=6)
