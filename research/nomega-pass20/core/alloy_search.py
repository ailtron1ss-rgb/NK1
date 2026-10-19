
"""AlloySearch 33.0 — unique combination for wild inventivity.

Alloy = Rift residual bias + CoOccurrence transitions + WakeForge macros
+ generic bit-fold shapes as *primitives* (not family keys).

No new human answer-keys per wild family. Shapes are reusable ops
(popcnt, mask-add, dual-fold) available to any family.
"""
from __future__ import annotations
from typing import List, Optional, Tuple
import random

from .hierarchical_vm import decode_hprog, mutate_hgenome, hprogram_fitness
from .problem_forge import make_tasks, WILD_START, N_FAMILIES, family_name
from .rift_search import RiftSearch
from .co_occurrence import CoOccurrencePrior
from .wake_forge import WakeForge
from .generic_skeletons import (
    skeleton_popcnt_tape8, skeleton_mask_add, skeleton_fold_add_xor,
    skeleton_popcnt_byte, _pack, all_skeletons,
)


class AlloySearch:
    def __init__(self, seed: int = 1):
        self.seed = seed
        self.rng = random.Random(seed ^ 0xA110)
        self.rift = RiftSearch(seed=seed)
        self.co = CoOccurrencePrior(seed=seed)
        self.forge = WakeForge(seed=seed, n_islands=3)
        self._oracle = seed ^ 0xA11CE
        self.wins = 0

    def seed_pool(self, extra: Optional[List[int]] = None) -> List[int]:
        pool = []
        for fn in (skeleton_popcnt_tape8, skeleton_mask_add, skeleton_fold_add_xor, skeleton_popcnt_byte):
            try:
                pool.append(_pack(fn()))
            except Exception:
                pass
        for t in all_skeletons(self.rng):
            try:
                pool.append(_pack(list(t) + [(0, 0, 0)] * 2))
            except Exception:
                pass
        if extra:
            pool.extend(extra)
        for g in pool:
            self.co.observe(g)
        return pool

    def _eval(self, g: int, fam: int) -> Tuple[float, float, float]:
        prog = decode_hprog(g)
        tr = hprogram_fitness(prog, make_tasks(self._oracle, fam, n=6))
        h1 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, fam, n=8, hardness=0.1))
        h2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, fam, n=6, hardness=0.2))
        return tr, min(h1, h2), adv

    def attack_wild(self, shots_per: int = 40) -> dict:
        pool = self.seed_pool()
        # seed forge islands
        for i, g in enumerate(pool[:12]):
            self.forge.islands[i % 3].genomes.append(g)
        wild = list(range(WILD_START, N_FAMILIES))
        self.forge.run(wild, cycles=3, wake_shots=max(6, shots_per // 6))
        pool.extend(self.forge.vault_genomes())
        found = {}
        for fam in wild:
            best_h, best_g = -1.0, None
            for _ in range(shots_per):
                r = self.rng.random()
                if r < 0.3:
                    g = self.rift.rift_mutate(self.rng.choice(pool), fam)
                elif r < 0.55:
                    g = self.co.sample_program(16)
                elif r < 0.75:
                    g = mutate_hgenome(self.rng.choice(pool), 0.2, self.rng)
                else:
                    g = self.rng.getrandbits(256)
                tr, hold, adv = self._eval(g, fam)
                self.rift.learn_from_pair(pool[0], g, fam)
                if hold > best_h:
                    best_h, best_g = hold, g
                if hold >= 0.35 and tr >= 0.35 and adv >= 0.20:
                    self.wins += 1
                    found[family_name(fam)] = round(hold, 3)
                    pool.append(g)
                    self.co.observe(g)
                    break
            if family_name(fam) not in found and best_g is not None and best_h >= 0.35:
                found[family_name(fam)] = round(best_h, 3)
                pool.append(best_g)
        return {
            "found": found,
            "n": len(found),
            "forge": self.forge.snapshot(),
            "rift": self.rift.snapshot(),
            "co": self.co.snapshot(),
        }

    def vault(self) -> List[int]:
        return self.forge.vault_genomes() + [e.genome for e in self.rift.replay if getattr(e, "success", False)] if hasattr(self.rift, "replay") else self.forge.vault_genomes()
