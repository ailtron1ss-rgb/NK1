"""NeuroProgrammer 27.0 — pure MLP program generator trained by ES.

A small feed-forward net: features(family, tape stats) -> instruction logits.
Weights are plain Python floats, updated by OpenAI-ES on holdout reward.
No PyTorch/TF, no host model download, no internet weights.

This is "neuro" in the evolutionary-strategies sense, not a frontier LLM.
It learns to *emit* HVM programs for oracle families — a step toward
autonomous code manipulation inside the pure sandbox.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict
import random
import math

from .hierarchical_vm import (
    decode_hprog, hprogram_fitness, mutate_hgenome, N_INSTR, MAX_PROG, run_hvm,
)
from .problem_forge import make_tasks, N_FAMILIES, family_name, FRONTIER_START, CLOSED_N
from .schema_engine import _pack

# Architecture: in_dim -> h1 -> h2 -> out
# out = MAX_EMIT * (op_logits + reg_logits + imm_logits) simplified as flat emit head
IN_DIM = 12
H1 = 12
H2 = 8
EMIT = 8          # instructions to emit per forward
OP_DIM = N_INSTR   # 22
REG_DIM = 8
IMM_DIM = 16
OUT_PER = OP_DIM + REG_DIM + IMM_DIM  # per instruction slot
OUT_DIM = EMIT * OUT_PER


def _n_weights() -> int:
    return (
        IN_DIM * H1 + H1
        + H1 * H2 + H2
        + H2 * OUT_DIM + OUT_DIM
    )


def _sigmoid(x: float) -> float:
    if x > 20:
        return 1.0
    if x < -20:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


def _tanh(x: float) -> float:
    if x > 20:
        return 1.0
    if x < -20:
        return -1.0
    return math.tanh(x)


def _softmax(xs: List[float]) -> List[float]:
    m = max(xs)
    ex = [math.exp(min(20, x - m)) for x in xs]
    s = sum(ex) or 1.0
    return [e / s for e in ex]


class MLP:
    def __init__(self, weights: Optional[List[float]] = None, seed: int = 1):
        self.n = _n_weights()
        rng = random.Random(seed ^ 0xA11B1)
        if weights is None:
            # Xavier-ish small init
            self.w = [rng.gauss(0, 0.15) for _ in range(self.n)]
        else:
            self.w = list(weights)
            if len(self.w) < self.n:
                self.w += [0.0] * (self.n - len(self.w))
            self.w = self.w[: self.n]

    def _layer(self, x: List[float], w: List[float], idx: int, in_d: int, out_d: int, bias: bool = True):
        out = []
        for o in range(out_d):
            s = 0.0
            base = idx + o * in_d
            for i in range(in_d):
                s += x[i] * w[base + i]
            if bias:
                s += w[idx + out_d * in_d + o]
            out.append(s)
        next_idx = idx + out_d * in_d + (out_d if bias else 0)
        return out, next_idx

    def forward(self, feat: List[float]) -> List[float]:
        x = feat[:IN_DIM] + [0.0] * max(0, IN_DIM - len(feat))
        x = x[:IN_DIM]
        h1, i = self._layer(x, self.w, 0, IN_DIM, H1)
        h1 = [_tanh(v) for v in h1]
        h2, i = self._layer(h1, self.w, i, H1, H2)
        h2 = [_tanh(v) for v in h2]
        out, _ = self._layer(h2, self.w, i, H2, OUT_DIM)
        return out

    def emit_program(self, feat: List[float], rng: random.Random, temperature: float = 1.0) -> int:
        logits = self.forward(feat)
        instrs = []
        for s in range(EMIT):
            base = s * OUT_PER
            op_logits = [logits[base + j] / max(0.1, temperature) for j in range(OP_DIM)]
            reg_logits = [logits[base + OP_DIM + j] / max(0.1, temperature) for j in range(REG_DIM)]
            imm_logits = [logits[base + OP_DIM + REG_DIM + j] / max(0.1, temperature) for j in range(IMM_DIM)]
            op_p = _softmax(op_logits)
            reg_p = _softmax(reg_logits)
            imm_p = _softmax(imm_logits)
            op = _sample(op_p, rng)
            a = _sample(reg_p, rng)
            b = _sample(imm_p, rng)
            instrs.append((op % N_INSTR, a % 8, b % 16))
        while len(instrs) < 16:
            instrs.append((0, 0, 0))
        return _pack(instrs)


def _sample(probs: List[float], rng: random.Random) -> int:
    r = rng.random()
    acc = 0.0
    for i, p in enumerate(probs):
        acc += p
        if r <= acc:
            return i
    return len(probs) - 1


def family_features(family: int, seed: int = 0) -> List[float]:
    """Pure features: one-hot-ish family id + deterministic task stats from oracle samples."""
    feat = [0.0] * IN_DIM
    feat[0] = (family % N_FAMILIES) / max(1, N_FAMILIES)
    feat[1] = 1.0 if family >= FRONTIER_START else 0.0
    feat[2] = 1.0 if family < 20 else 0.0
    # sample oracle stats
    tasks = make_tasks(seed ^ 0xFEA7, family, n=4, hardness=0.0)
    if tasks:
        flat = [v for inp, _ in tasks for v in inp[:4]]
        if flat:
            feat[3] = (sum(flat) / len(flat)) / 255.0
            feat[4] = (max(flat) - min(flat)) / 255.0
            feat[5] = sum(1 for v in flat if v & 1) / len(flat)
            outs = [o for _, o in tasks]
            feat[6] = (sum(outs) / len(outs)) / 255.0
            feat[7] = (max(outs) - min(outs)) / 255.0 if outs else 0.0
    # hash mix
    rng = random.Random(family * 997 ^ seed)
    for i in range(8, IN_DIM):
        feat[i] = rng.random() * 0.1
    return feat


@dataclass
class NeuroProgrammer:
    seed: int = 1
    sigma: float = 0.12
    lr: float = 0.08
    updates: int = 0
    best_reward: float = 0.0
    reward_curve: List[float] = field(default_factory=list)

    def __post_init__(self):
        self.rng = random.Random(self.seed ^ 0xA140)
        self.mlp = MLP(seed=self.seed)
        self._oracle = self.seed ^ 0xA11CE
        self.bank: List[Tuple[int, int, float]] = []  # genome, family, holdout

    def _eval_genome(self, genome: int, family: int) -> float:
        prog = decode_hprog(genome)
        hold = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, family, n=8, hardness=0.1))
        hold2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, family, n=6, hardness=0.1))
        train = hprogram_fitness(prog, make_tasks(self._oracle, family, n=6, hardness=0.0))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, family, n=6, hardness=0.2))
        h = min(hold, hold2)
        bonus = 0.4 if (h >= 0.35 and train >= 0.35 and adv >= 0.2) else 0.0
        return h + bonus

    def generate(self, family: int, temperature: float = 1.0) -> int:
        feat = family_features(family, self.seed)
        return self.mlp.emit_program(feat, self.rng, temperature=temperature)

    def es_step(self, families: List[int], population: int = 10, samples_per: int = 3) -> float:
        """ES on MLP weights; reward = mean eval of generated programs."""
        n = self.mlp.n
        noise = []
        rewards = []
        base_w = list(self.mlp.w)
        for _ in range(population):
            eps = [self.rng.gauss(0, 1) for _ in range(n)]
            cand_w = [base_w[i] + self.sigma * eps[i] for i in range(n)]
            cand = MLP(weights=cand_w, seed=self.seed)
            scores = []
            for fam in families:
                for _ in range(samples_per):
                    g = cand.emit_program(family_features(fam, self.seed), self.rng, temperature=1.2)
                    # small mutation refinement
                    g2 = mutate_hgenome(g, 0.08, self.rng)
                    s1 = self._eval_genome(g, fam)
                    s2 = self._eval_genome(g2, fam)
                    best = g2 if s2 > s1 else g
                    best_s = max(s1, s2)
                    scores.append(best_s)
                    if best_s >= 0.35:
                        self.bank.append((best, fam, best_s))
            R = sum(scores) / max(1, len(scores))
            noise.append(eps)
            rewards.append(R)
        mean_r = sum(rewards) / len(rewards)
        std = max(1e-6, (sum((r - mean_r) ** 2 for r in rewards) / len(rewards)) ** 0.5)
        grad = [0.0] * n
        for j in range(population):
            scale = (rewards[j] - mean_r) / std
            for i in range(n):
                grad[i] += scale * noise[j][i]
        for i in range(n):
            grad[i] /= population
            self.mlp.w[i] += self.lr * grad[i] / max(self.sigma, 1e-6)
        self.updates += 1
        self.reward_curve.append(mean_r)
        self.best_reward = max(self.best_reward, mean_r)
        self.bank = sorted(self.bank, key=lambda x: -x[2])[:128]
        return mean_r

    def train(self, families: List[int], rounds: int = 6, population: int = 8, samples_per: int = 2) -> Dict:
        curve = []
        for _ in range(rounds):
            r = self.es_step(families, population=population, samples_per=samples_per)
            curve.append(round(r, 4))
        return {
            "updates": self.updates,
            "reward_curve": curve,
            "best_reward": round(self.best_reward, 4),
            "bank": len(self.bank),
            "weights": self.mlp.n,
        }

    def attack(self, family: int, attempts: int = 30) -> Optional[Tuple[int, float]]:
        best_g, best_s = 0, -1.0
        for i in range(attempts):
            g = self.generate(family, temperature=1.0 + 0.05 * (i % 5))
            g = mutate_hgenome(g, 0.1, self.rng)
            s = self._eval_genome(g, family)
            if s > best_s:
                best_g, best_s = g, s
        if best_s >= 0.35:
            self.bank.append((best_g, family, best_s))
            return best_g, best_s
        return None

    def snapshot(self) -> dict:
        return {
            "version": 1,
            "weights": self.mlp.n,
            "updates": self.updates,
            "best_reward": round(self.best_reward, 4),
            "reward_curve_tail": [round(x, 4) for x in self.reward_curve[-10:]],
            "bank": len(self.bank),
            "bank_families": sorted({family_name(f) for _, f, _ in self.bank}),
        }
