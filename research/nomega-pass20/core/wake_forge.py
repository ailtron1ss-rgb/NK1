"""WakeForge 28.0 — unique pure low-compute synthesis architecture.

Combines and adapts (without copying any single system):
  • DreamCoder  — wake/sleep + library abstractions from solutions
  • FunSearch   — island populations + strict evaluator gate (no LLM)
  • MAP-Elites  — quality-diversity grid over behavior descriptors
  • Execution-guided synthesis — mutate using partial tape traces
  • STOP-like   — meta-update of search θ from measured reward

Designed for weak phones / small CPU: O(islands * shots * eval), no GPU,
no external weights. All programs are HVM genomes; oracle is immutable.

Cycle:
  WAKE     — islands propose/evaluate under current library+θ
  COMPRESS — n-gram refactor of winners → new macros (library growth)
  DREAM    — practice on synthetic task mixtures; refine θ (ES)
  MIGRATE  — elites cross islands; fill MAP-Elites cells
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Set
from collections import Counter, defaultdict
import random
import math

from .hierarchical_vm import (
    decode_hprog, mutate_hgenome, hprogram_fitness, run_hvm, MAX_PROG, N_INSTR,
)
from .problem_forge import (
    make_tasks, N_FAMILIES, family_name, FRONTIER_START, CLOSED_N,
    REGRESSION_N, OPEN_START,
)
from .schema_engine import _pack, _enc
from .neuro_policy import NeuroPolicy


def _behavior(genome: int, holdout: float, family: int) -> Tuple[int, int, int]:
    """MAP-Elites descriptors: length bin, op-entropy bin, family group."""
    prog = [x for x in decode_hprog(genome) if x[0] != 0]
    length_bin = min(7, len(prog) // 4)
    ops = [op for op, _, _ in prog]
    if not ops:
        ent_bin = 0
    else:
        c = Counter(ops)
        n = len(ops)
        ent = -sum((v / n) * math.log(v / n + 1e-12) for v in c.values())
        ent_bin = min(7, int(ent * 2))
    if family < REGRESSION_N:
        fg = 0
    elif family < CLOSED_N:
        fg = 1
    else:
        fg = 2
    return length_bin, ent_bin, fg


def _ngrams(prog: List[Tuple[int, int, int]], n: int = 3) -> List[Tuple]:
    seq = [(op, a, b) for op, a, b in prog if op != 0]
    return [tuple(seq[i : i + n]) for i in range(max(0, len(seq) - n + 1))]


@dataclass
class Macro:
    name: str
    body: List[Tuple[int, int, int]]
    support: int
    evidence: float


@dataclass
class Island:
    id: int
    genomes: List[int] = field(default_factory=list)
    best_holdout: float = 0.0


class WakeForge:
    def __init__(self, seed: int = 1, n_islands: int = 4):
        self.seed = seed
        self.rng = random.Random(seed ^ 0xF0B6)
        self._oracle = seed ^ 0xA11CE
        self.islands = [Island(i) for i in range(n_islands)]
        self.library: List[Macro] = []
        self.map_elites: Dict[Tuple[int, int, int], Tuple[int, float]] = {}
        self.policy = NeuroPolicy(seed=seed ^ 0x51)
        self.cycles = 0
        self.wake_wins = 0
        self.macros_born = 0
        self.trace_hits = 0

    # ----- evaluation (FunSearch-style gate) -----
    def evaluate(self, genome: int, family: int) -> Tuple[float, float, float]:
        prog = decode_hprog(genome)
        train = hprogram_fitness(prog, make_tasks(self._oracle, family, n=6, hardness=0.0))
        hold = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, family, n=8, hardness=0.1))
        hold2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, family, n=6, hardness=0.1))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, family, n=6, hardness=0.2))
        return train, min(hold, hold2), adv

    def accept(self, train: float, hold: float, adv: float) -> bool:
        return hold >= 0.35 and train >= 0.35 and adv >= 0.20

    # ----- execution-guided mutation -----
    def trace_guided_mutate(self, genome: int, family: int) -> int:
        """Bias mutation using which ops change tape toward expected on train tasks."""
        self.trace_hits += 1
        prog = decode_hprog(genome)
        tasks = make_tasks(self._oracle, family, n=3, hardness=0.0)
        useful_ops: Counter = Counter()
        for inp, exp in tasks:
            s = run_hvm(prog, inputs=inp, max_steps=80)
            # if already good, light mutate
            if (s.regs[0] & 0xFF) == (exp & 0xFF):
                continue
            # try single-op replacements at random positions weighted later
            for op in range(min(12, N_INSTR)):
                useful_ops[op] += 1  # weak prior: try arithmetic/logic denser
        g = genome
        for _ in range(3):
            g = mutate_hgenome(g, 0.18, self.rng)
            if useful_ops:
                # inject a high-count op into a random slot via re-pack
                prog2 = list(decode_hprog(g))
                if prog2:
                    i = self.rng.randrange(len(prog2))
                    op = useful_ops.most_common(1)[0][0]
                    a, b = prog2[i][1], prog2[i][2]
                    prog2[i] = (op, a, b)
                    g = _pack(prog2)
        return g

    def instantiate_macro(self, macro: Macro) -> int:
        body = list(macro.body)
        # light noise
        if self.rng.random() < 0.3 and body:
            j = self.rng.randrange(len(body))
            op, a, b = body[j]
            body[j] = (op, a, (b + self.rng.randrange(3)) % 16)
        while len(body) < 8:
            body.append((0, 0, 0))
        return _pack(body)

    # ----- WAKE -----
    def wake(self, families: List[int], shots_per: int = 12) -> List[Tuple[int, int, float]]:
        found = []
        for isl in self.islands:
            pool = list(isl.genomes) or [self.rng.getrandbits(256) for _ in range(4)]
            # seed from library
            for m in self.library[:6]:
                pool.append(self.instantiate_macro(m))
            # seed from map elites
            for g, h in list(self.map_elites.values())[:8]:
                pool.append(g)
            for fam in families:
                for _ in range(shots_per):
                    r = self.rng.random()
                    if r < 0.25 and self.library:
                        g = self.instantiate_macro(self.rng.choice(self.library))
                    elif r < 0.45:
                        g = self.trace_guided_mutate(self.rng.choice(pool), fam)
                    elif r < 0.65:
                        g = self.policy.propose(fam, pool)
                    else:
                        g = mutate_hgenome(self.rng.choice(pool), 0.2, self.rng)
                    train, hold, adv = self.evaluate(g, fam)
                    if self.accept(train, hold, adv):
                        self.wake_wins += 1
                        found.append((g, fam, hold))
                        isl.genomes.append(g)
                        isl.best_holdout = max(isl.best_holdout, hold)
                        pool.append(g)
                        cell = _behavior(g, hold, fam)
                        prev = self.map_elites.get(cell)
                        if prev is None or hold > prev[1]:
                            self.map_elites[cell] = (g, hold)
            isl.genomes = isl.genomes[-24:]
        return found

    # ----- COMPRESS (DreamCoder-like library learning, n-gram / Stitch-speed) -----
    def compress(self, winners: List[Tuple[int, int, float]]):
        grams: Counter = Counter()
        evidence: Dict[Tuple, float] = defaultdict(float)
        for g, fam, hold in winners:
            prog = decode_hprog(g)
            for ng in _ngrams(prog, 3):
                grams[ng] += 1
                evidence[ng] = max(evidence[ng], hold)
            for ng in _ngrams(prog, 4):
                grams[ng] += 1
                evidence[ng] = max(evidence[ng], hold)
        # promote frequent high-evidence patterns
        for ng, cnt in grams.most_common(40):
            if cnt < 2:
                continue
            ev = evidence[ng]
            if ev < 0.4:
                continue
            body = [tuple(x) for x in ng]
            # skip if duplicate
            sig = tuple(body)
            if any(tuple(m.body) == sig for m in self.library):
                continue
            self.library.append(
                Macro(name=f"m{self.macros_born}", body=body, support=cnt, evidence=ev)
            )
            self.macros_born += 1
        self.library = sorted(self.library, key=lambda m: -m.evidence)[:48]

    # ----- DREAM (practice + policy ES) -----
    def dream(self, families: List[int], rounds: int = 2):
        pool = []
        for isl in self.islands:
            pool.extend(isl.genomes)
        for g, _ in self.map_elites.values():
            pool.append(g)
        if not pool:
            pool = [self.rng.getrandbits(128)]
        # synthetic mixture families for practice
        mix = list(families)
        if len(mix) > 3:
            mix = self.rng.sample(mix, 3)
        self.policy.train(mix, pool, rounds=rounds, population=4, shots=4)

    # ----- MIGRATE -----
    def migrate(self):
        elites = []
        for isl in self.islands:
            if isl.genomes:
                elites.append(max(isl.genomes, key=lambda g: 1))  # presence
        # pull map elites
        for g, h in sorted(self.map_elites.values(), key=lambda x: -x[1])[:6]:
            elites.append(g)
        for isl in self.islands:
            for e in elites:
                if self.rng.random() < 0.4:
                    isl.genomes.append(mutate_hgenome(e, 0.1, self.rng))
            isl.genomes = isl.genomes[-24:]

    # ----- full cycle -----
    def cycle(self, families: List[int], wake_shots: int = 10) -> Dict:
        self.cycles += 1
        winners = self.wake(families, shots_per=wake_shots)
        if winners:
            self.compress(winners)
        self.dream(families, rounds=2)
        self.migrate()
        return {
            "cycle": self.cycles,
            "wake_wins": len(winners),
            "library": len(self.library),
            "map_cells": len(self.map_elites),
            "islands": [len(i.genomes) for i in self.islands],
        }

    def run(self, families: List[int], cycles: int = 4, wake_shots: int = 10) -> Dict:
        log = []
        for _ in range(cycles):
            log.append(self.cycle(families, wake_shots=wake_shots))
        return {
            "cycles": self.cycles,
            "log": log,
            "library": len(self.library),
            "map_cells": len(self.map_elites),
            "wake_wins_total": self.wake_wins,
            "macros_born": self.macros_born,
            "trace_hits": self.trace_hits,
            "policy": self.policy.snapshot(),
        }

    def vault_genomes(self) -> List[int]:
        gs = []
        for isl in self.islands:
            gs.extend(isl.genomes)
        for g, _ in self.map_elites.values():
            gs.append(g)
        for m in self.library:
            gs.append(self.instantiate_macro(m))
        return gs

    def snapshot(self) -> dict:
        return {
            "version": 1,
            "cycles": self.cycles,
            "library": len(self.library),
            "macros_born": self.macros_born,
            "map_cells": len(self.map_elites),
            "wake_wins": self.wake_wins,
            "trace_hits": self.trace_hits,
            "top_macros": [
                {"name": m.name, "support": m.support, "ev": round(m.evidence, 3), "len": len(m.body)}
                for m in self.library[:8]
            ],
        }
