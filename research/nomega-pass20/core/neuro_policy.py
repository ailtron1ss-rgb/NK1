"""NeuroPolicy 26.0 — pure evolved search controller (ES / policy-gradient style).

Not a deep net. Not Claude.
A compact parameter vector θ controls HOW we search (mutate rate, blank vs
compose vs replay, local steps). θ is improved by evolutionary strategies
on verified holdout reward — same purity gates, no host-code, no external weights.

Inspiration: AlphaZero-style "learn the search", OpenES, REINFORCE — implemented
as pure bit/float vectors inside the sandbox.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import random
import math
import json
from pathlib import Path

from .hierarchical_vm import decode_hprog, mutate_hgenome, hprogram_fitness, MAX_PROG
from .problem_forge import (
    make_tasks, N_FAMILIES, family_name, FRONTIER_START, CLOSED_N,
    is_frontier_family, REGRESSION_N,
)
from .schema_engine import _pack
from .open_composer import compose_seq


# θ indices
I_MUT_RATE = 0
I_BLANK_P = 1
I_COMPOSE_P = 2
I_REPLAY_P = 3
I_LOCAL_STEPS = 4
I_PARENT_TEMP = 5
I_CROSS_P = 6
N_THETA = 7


def _sigmoid(x: float) -> float:
    if x >= 20:
        return 1.0
    if x <= -20:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


@dataclass
class Episode:
    family: int
    genome: int
    holdout: float
    theta_snapshot: List[float]
    success: bool


@dataclass
class NeuroPolicy:
    """Search policy with evolvable θ and experience replay."""
    seed: int = 1
    theta: List[float] = field(default_factory=lambda: [0.0] * N_THETA)
    # decoded defaults before learning: moderate mutate, some blank, little compose
    replay: List[Episode] = field(default_factory=list)
    history_reward: List[float] = field(default_factory=list)
    updates: int = 0
    sigma: float = 0.35  # ES noise
    lr: float = 0.25
    max_replay: int = 256

    def __post_init__(self):
        self.rng = random.Random(self.seed ^ 0x4E300)
        self._oracle = self.seed ^ 0xA11CE
        # sensible init in logit space
        if all(t == 0.0 for t in self.theta):
            self.theta = [
                0.0,   # mut ~0.5 sigmoid -> scale later
                0.2,   # blank
                -0.5,  # compose low
                0.0,   # replay
                0.5,   # local steps
                0.0,   # parent temp
                -0.3,  # crossover
            ]

    def decode(self, theta: Optional[List[float]] = None) -> Dict[str, float]:
        th = theta or self.theta
        return {
            "mut_rate": 0.05 + 0.40 * _sigmoid(th[I_MUT_RATE]),
            "blank_p": _sigmoid(th[I_BLANK_P]),
            "compose_p": _sigmoid(th[I_COMPOSE_P]),
            "replay_p": _sigmoid(th[I_REPLAY_P]),
            "local_steps": 1 + int(8 * _sigmoid(th[I_LOCAL_STEPS])),
            "parent_temp": 0.3 + 1.7 * _sigmoid(th[I_PARENT_TEMP]),
            "cross_p": _sigmoid(th[I_CROSS_P]),
        }

    def _eval(self, genome: int, family: int) -> Tuple[float, float, float]:
        prog = decode_hprog(genome)
        train = hprogram_fitness(prog, make_tasks(self._oracle, family, n=6, hardness=0.0))
        hold = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, family, n=8, hardness=0.1))
        hold2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, family, n=6, hardness=0.1))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, family, n=8, hardness=0.25))
        return train, min(hold, hold2), adv

    def propose(
        self,
        family: int,
        pool: List[int],
        theta: Optional[List[float]] = None,
    ) -> int:
        cfg = self.decode(theta)
        r = self.rng.random()
        # replay successful genomes for this family
        fam_replay = [e.genome for e in self.replay if e.family == family and e.success]
        if r < cfg["replay_p"] and fam_replay:
            g = self.rng.choice(fam_replay)
            return mutate_hgenome(g, cfg["mut_rate"] * 0.5, self.rng)
        r2 = self.rng.random()
        if r2 < cfg["blank_p"] or not pool:
            return self.rng.getrandbits(min(512, 16 * MAX_PROG))
        if r2 < cfg["blank_p"] + cfg["compose_p"] and len(pool) >= 2:
            return compose_seq(self.rng.choice(pool), self.rng.choice(pool))
        if r2 < cfg["blank_p"] + cfg["compose_p"] + cfg["cross_p"] and len(pool) >= 2:
            # crossover: pack half-half instruction streams
            from .hierarchical_vm import decode_hprog as dec
            p1 = [x for x in dec(self.rng.choice(pool)) if x[0] != 0]
            p2 = [x for x in dec(self.rng.choice(pool)) if x[0] != 0]
            cut = max(1, len(p1) // 2)
            merged = (p1[:cut] + p2[cut:])[:MAX_PROG]
            while len(merged) < 8:
                merged.append((0, 0, 0))
            return _pack(merged)
        parent = self.rng.choice(pool)
        return mutate_hgenome(parent, cfg["mut_rate"], self.rng)

    def local_improve(self, genome: int, family: int, theta: Optional[List[float]] = None) -> Tuple[int, float]:
        cfg = self.decode(theta)
        best_g, best_h = genome, self._eval(genome, family)[1]
        for _ in range(cfg["local_steps"]):
            cand = mutate_hgenome(best_g, cfg["mut_rate"], self.rng)
            _, h, _ = self._eval(cand, family)
            if h > best_h:
                best_g, best_h = cand, h
        return best_g, best_h

    def run_episode(self, family: int, pool: List[int], shots: int = 20, theta: Optional[List[float]] = None) -> Episode:
        th = theta or self.theta
        best_ep: Optional[Episode] = None
        local_pool = list(pool)
        for _ in range(shots):
            g = self.propose(family, local_pool, th)
            g, h = self.local_improve(g, family, th)
            train, hold, adv = self._eval(g, family)
            ok = hold >= 0.35 and train >= 0.35 and adv >= 0.20
            ep = Episode(family, g, hold, list(th), ok)
            if ok:
                local_pool.append(g)
            if best_ep is None or hold > best_ep.holdout:
                best_ep = ep
        assert best_ep is not None
        self.replay.append(best_ep)
        self.replay = self.replay[-self.max_replay:]
        return best_ep

    def es_update(self, families: List[int], pool: List[int], population: int = 8, shots: int = 12) -> float:
        """OpenAI-ES style update on mean holdout across families."""
        noise = []
        rewards = []
        for _ in range(population):
            eps = [self.rng.gauss(0, 1) for _ in range(N_THETA)]
            th = [self.theta[i] + self.sigma * eps[i] for i in range(N_THETA)]
            scores = []
            for fam in families:
                ep = self.run_episode(fam, pool, shots=shots, theta=th)
                scores.append(ep.holdout + (0.5 if ep.success else 0.0))
            R = sum(scores) / max(1, len(scores))
            noise.append(eps)
            rewards.append(R)
        # normalize rewards
        mean_r = sum(rewards) / len(rewards)
        std = max(1e-6, (sum((r - mean_r) ** 2 for r in rewards) / len(rewards)) ** 0.5)
        for i in range(N_THETA):
            grad = sum(((rewards[j] - mean_r) / std) * noise[j][i] for j in range(population)) / population
            self.theta[i] += self.lr * grad / max(self.sigma, 1e-6)
        self.updates += 1
        self.history_reward.append(mean_r)
        return mean_r

    def train(self, families: List[int], pool: List[int], rounds: int = 5, population: int = 6, shots: int = 10) -> Dict:
        curve = []
        for _ in range(rounds):
            r = self.es_update(families, pool, population=population, shots=shots)
            curve.append(round(r, 4))
        return {"updates": self.updates, "reward_curve": curve, "theta": self.decode()}

    def attack_family(self, family: int, pool: List[int], shots: int = 40) -> Optional[Episode]:
        ep = self.run_episode(family, pool, shots=shots, theta=self.theta)
        return ep if ep.success else (ep if ep.holdout >= 0.35 else None)

    def snapshot(self) -> dict:
        return {
            "version": 1,
            "updates": self.updates,
            "theta_raw": [round(x, 4) for x in self.theta],
            "theta_decoded": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in self.decode().items()},
            "replay": len(self.replay),
            "replay_successes": sum(1 for e in self.replay if e.success),
            "reward_curve_tail": self.history_reward[-8:],
        }

    def save(self, path: Path):
        path.write_text(json.dumps({"theta": self.theta, "updates": self.updates}, indent=2))

    def load(self, path: Path):
        if path.exists():
            d = json.loads(path.read_text())
            self.theta = list(d.get("theta", self.theta))
            self.updates = int(d.get("updates", 0))
