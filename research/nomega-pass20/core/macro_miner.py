"""MacroMiner 46.0 — multi-phase mine→search→mine without IR bootstrap by default.

Phase A: random explore, bank dense hits
Phase B: macro-compose search, bank successes
Phase C: re-harvest + focused mutate on best per family
"""
from __future__ import annotations
from collections import Counter
from typing import List, Tuple, Dict, Optional
import random

from .hierarchical_vm import decode_hprog, mutate_hgenome, hprogram_fitness, MAX_PROG
from .schema_engine import _pack
from .problem_forge import make_tasks, WILD_START, N_FAMILIES, family_name
from .pure_wild import _short_genome, _crossover

Instr = Tuple[int, int, int]


def ngrams(prog: List[Instr], n: int) -> List[Tuple[Instr, ...]]:
    if len(prog) < n:
        return []
    return [tuple(prog[i : i + n]) for i in range(len(prog) - n + 1)]


class MacroBank:
    def __init__(self):
        self.count: Counter = Counter()
        self.macros: List[List[Instr]] = []
        self.winners: List[int] = []

    def observe(self, genome: int, weight: float = 1.0):
        prog = [x for x in decode_hprog(genome) if x[0] != 0]
        for n in (2, 3, 4):
            for g in ngrams(prog, n):
                self.count[g] += weight / n

    def harvest(self, top_k: int = 60, min_count: float = 0.8):
        self.macros = []
        for gram, c in self.count.most_common(top_k * 3):
            if c >= min_count and len(gram) >= 2:
                self.macros.append(list(gram))
            if len(self.macros) >= top_k:
                break
        return len(self.macros)

    def sample_program(self, rng: random.Random, n_macros: int = 4) -> int:
        if not self.macros:
            return _short_genome(rng, 12)
        prog: List[Instr] = []
        for _ in range(n_macros):
            prog.extend(rng.choice(self.macros))
        if rng.random() < 0.3 and self.winners:
            # splice with winner decode
            w = decode_hprog(rng.choice(self.winners))
            cut = rng.randrange(1, max(2, min(8, len(w))))
            prog = list(w[:cut]) + prog
        prog = prog[:56]
        while len(prog) < 6:
            prog.append((rng.randrange(1, 12), rng.randrange(8), rng.randrange(16)))
        return _pack(prog)

    def add_winner(self, g: int):
        self.winners.append(g)
        self.observe(g, weight=3.0)
        if len(self.winners) > 30:
            self.winners = self.winners[-30:]


class MacroPureSearch:
    def __init__(self, seed: int = 1, shots_per: int = 90, bootstrap_ir: bool = False, phases: int = 3):
        self.seed = seed
        self.shots_per = shots_per
        self.bootstrap_ir = bootstrap_ir
        self.phases = phases
        self.rng = random.Random(seed ^ 0x3AC00)
        self.bank = MacroBank()
        self._oracle = seed ^ 0xA11CE

    def _bootstrap(self):
        if not self.bootstrap_ir:
            return
        try:
            from .linear_ir import all_templates, compile_ir
            for tmpl in all_templates(allow_popcnt=True):
                self.bank.observe(_pack(compile_ir(tmpl)[:64]), weight=2.0)
            self.bank.harvest(top_k=50, min_count=0.5)
        except Exception:
            pass

    def _dense(self, g: int, fam: int) -> float:
        return hprogram_fitness(decode_hprog(g), make_tasks(self._oracle, fam, n=8))

    def _gates(self, g: int, fam: int):
        prog = decode_hprog(g)
        tr = hprogram_fitness(prog, make_tasks(self._oracle, fam, n=6))
        h1 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, fam, n=8, hardness=0.1))
        h2 = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xBEEF, fam, n=6, hardness=0.1))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, fam, n=6, hardness=0.2))
        return tr, min(h1, h2), adv

    def _propose(self, parent: int) -> int:
        r = self.rng.random()
        if r < 0.35 and self.bank.macros:
            return self.bank.sample_program(self.rng, n_macros=self.rng.randint(2, 6))
        if r < 0.55 and len(self.bank.winners) >= 2:
            return _crossover(self.rng.choice(self.bank.winners), parent, self.rng)
        if r < 0.8:
            return mutate_hgenome(parent, 0.3, self.rng)
        return _short_genome(self.rng, self.rng.choice([8, 10, 12, 16]))

    def attack(self) -> Dict:
        self._bootstrap()
        found: Dict[str, float] = {}
        best_g: Dict[int, int] = {}
        best_h: Dict[int, float] = {f: -1.0 for f in range(WILD_START, N_FAMILIES)}

        for phase in range(self.phases):
            # explore / mine
            explore = max(20, self.shots_per // 3)
            for fam in range(WILD_START, N_FAMILIES):
                for _ in range(explore):
                    g = self._propose(best_g.get(fam, _short_genome(self.rng, 10)))
                    d = self._dense(g, fam)
                    if d >= 0.2:
                        self.bank.observe(g, weight=1.0 + d)
                    if d >= 0.35:
                        tr, hold, adv = self._gates(g, fam)
                        if hold > best_h[fam]:
                            best_h[fam] = hold
                            best_g[fam] = g
                        if hold >= 0.35 and tr >= 0.35 and adv >= 0.20:
                            found[family_name(fam)] = round(hold, 3)
                            self.bank.add_winner(g)
            self.bank.harvest(top_k=60, min_count=0.6)

            # focused shots on unsolved
            for fam in range(WILD_START, N_FAMILIES):
                if family_name(fam) in found:
                    continue
                parent = best_g.get(fam, self.bank.sample_program(self.rng))
                for _ in range(self.shots_per // self.phases):
                    g = self._propose(parent)
                    tr, hold, adv = self._gates(g, fam)
                    if tr >= 0.25:
                        self.bank.observe(g, weight=1.5)
                    if hold > best_h[fam]:
                        best_h[fam] = hold
                        best_g[fam] = g
                        parent = g
                    if hold >= 0.35 and tr >= 0.35 and adv >= 0.20:
                        found[family_name(fam)] = round(hold, 3)
                        self.bank.add_winner(g)
                        break
            self.bank.harvest(top_k=60, min_count=0.5)

        for fam, h in best_h.items():
            if family_name(fam) not in found and h >= 0.35:
                found[family_name(fam)] = round(h, 3)

        return {
            "macro_pure_solved": len(found),
            "macro_pure_names": found,
            "n_macros_final": len(self.bank.macros),
            "n_winners": len(self.bank.winners),
            "bootstrap_ir": self.bootstrap_ir,
            "phases": self.phases,
            "shots_per": self.shots_per,
        }
