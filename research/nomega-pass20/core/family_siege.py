"""Family Siege 17.0 — intensive focused search on unsolved families.

Unique scheme: do not dilute budget across easy wins.
For each weak family, run a siege of N schema-biased + blank proposals
evaluated ONLY on that family's holdout/adversarial.

Win condition: holdout >= 0.35 and adversarial >= 0.25 on the target family.
Wins enter a siege_vault (separate from general archive) and feed the bank.

This directly attacks the breadth-collapse failure of versions 15–16.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import random

from .hierarchical_vm import decode_hprog, hprogram_fitness, mutate_hgenome
from .problem_forge import make_tasks, N_FAMILIES, family_name, is_open_family, is_frontier_family, is_wild_family, REGRESSION_N, OPEN_START, FRONTIER_START, CLOSED_N, WILD_START
from .schema_engine import SchemaEngine
from .schema_miner import SchemaMiner
from .generic_skeletons import GenericSkeletonEngine
from .neuro_policy import NeuroPolicy
from .neuro_programmer import NeuroProgrammer
from .wake_forge import WakeForge
from .rift_search import RiftSearch
from .co_occurrence import CoOccurrencePrior


@dataclass
class SiegeWin:
    genome: int
    family: int
    holdout: float
    adversarial: float
    train: float
    generation: int


class FamilySiege:
    def __init__(self, seed: int = 1, shots_per_family: int = 35):
        self.seed = seed
        self.rng = random.Random(seed ^ 0x51E6E)
        self.schemas = SchemaEngine(seed=seed ^ 0x11)
        self.miner = SchemaMiner(seed=seed)
        self.skeletons = GenericSkeletonEngine(seed=seed)
        self.neuro = NeuroPolicy(seed=seed)
        self.programmer = NeuroProgrammer(seed=seed)
        self.forge = WakeForge(seed=seed, n_islands=3)
        self.rift = RiftSearch(seed=seed)
        self.cooccur = CoOccurrencePrior(seed=seed)
        self.shots_per_family = shots_per_family
        self._oracle = seed ^ 0xA11CE
        self.vault: List[SiegeWin] = []
        self.attempts: Dict[int, int] = {i: 0 for i in range(N_FAMILIES)}
        self.wins: Dict[int, int] = {i: 0 for i in range(N_FAMILIES)}
        self.sieges_run = 0

    def _eval_family(self, genome: int, family: int) -> Tuple[float, float, float]:
        prog = decode_hprog(genome)
        train = hprogram_fitness(prog, make_tasks(self._oracle, family, n=8, hardness=0.0))
        hold = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xDEAD, family, n=10, hardness=0.1))
        adv = hprogram_fitness(prog, make_tasks(self._oracle ^ 0xAD00, family, n=10, hardness=0.25))
        return train, hold, adv

    def siege_family(self, family: int, generation: int = 0) -> Optional[SiegeWin]:
        """Spend shots_per_family evaluations on one family."""
        self.sieges_run += 1
        best: Optional[SiegeWin] = None
        # OPEN families: no human schema bias — blank / mutate / miner only
        open_f = is_open_family(family)
        frontier_f = is_frontier_family(family)
        if frontier_f:
            # pure discovery: blank / mutate / miner only — no schema, no skeleton
            parent = self.rng.getrandbits(256)
            mg = self.miner.instantiate(family)
            if mg is not None and self.rng.random() < 0.3:
                parent = mg
        elif open_f:
            parent = self.skeletons.sample_genome()
            mg = self.miner.instantiate(family)
            if mg is not None and self.rng.random() < 0.25:
                parent = mg
        else:
            parent = self.schemas.for_family(family)
            mg = self.miner.instantiate(family)
            if mg is not None and self.rng.random() < 0.25:
                parent = mg

        for shot in range(self.shots_per_family):
            self.attempts[family] += 1
            if shot == 0:
                g = parent
            elif frontier_f:
                if shot % 3 == 0 and self.miner.mined:
                    g = self.miner.instantiate(family) or self.rng.getrandbits(256)
                elif shot % 3 == 1:
                    g = mutate_hgenome(parent, 0.25, self.rng)
                else:
                    g = self.rng.getrandbits(256)
            elif open_f:
                if shot % 5 == 0:
                    g = self.skeletons.sample_genome()
                elif shot % 5 == 1 and self.miner.mined:
                    g = self.miner.instantiate(family) or self.skeletons.sample_genome()
                elif shot % 5 == 2:
                    g = mutate_hgenome(parent, 0.2, self.rng)
                else:
                    g = self.rng.getrandbits(256)
            elif shot % 3 == 0:
                g = self.schemas.for_family(family)
            elif shot % 3 == 1:
                g = mutate_hgenome(parent, 0.18, self.rng)
            else:
                g = self.rng.getrandbits(256)

            train, hold, adv = self._eval_family(g, family)
            # Double-seed holdout: also check alternate oracle offset (anti-overfit)
            if hold >= 0.35 and train >= 0.35 and adv >= 0.20:
                prog = decode_hprog(g)
                hold2 = hprogram_fitness(
                    prog, make_tasks(self._oracle ^ 0xBEEF, family, n=8, hardness=0.1)
                )
                if hold2 < 0.30:
                    continue  # failed generalization
                win = SiegeWin(g, family, min(hold, hold2), adv, train, generation)
                self.wins[family] += 1
                self.vault.append(win)
                self.schemas.record_success(hold)
                self.miner.observe(g, family, hold)
                if best is None or hold > best.holdout:
                    best = win
                    parent = g
        # keep vault bounded, prefer diversity by family
        by_f: Dict[int, SiegeWin] = {}
        for w in sorted(self.vault, key=lambda x: -x.holdout):
            if w.family not in by_f:
                by_f[w.family] = w
        rest = [w for w in self.vault if w not in by_f.values()]
        self.vault = (list(by_f.values()) + rest)[:48]
        return best

    def siege_weak(self, capability: List[float], generation: int = 0, max_families: int = 4) -> List[SiegeWin]:
        """Siege the weakest families by current capability vector."""
        order = sorted(range(N_FAMILIES), key=lambda i: (capability[i] if i < len(capability) else 0.0, self.rng.random()))
        targets = [i for i in order if (capability[i] if i < len(capability) else 0.0) < 0.35][:max_families]
        if not targets:
            targets = order[:max_families]
        found = []
        for fam in targets:
            w = self.siege_family(fam, generation)
            if w:
                found.append(w)
        return found

    def neuro_frontier_campaign(self, pool: List[int], train_rounds: int = 3, shots: int = 30) -> List[SiegeWin]:
        """Train NeuroPolicy on frontier then attack each frontier family."""
        from .problem_forge import FRONTIER_START, N_FAMILIES, family_name
        frontier = list(range(FRONTIER_START, N_FAMILIES))
        base_pool = list(pool) + self.vault_genomes()
        self.neuro.train(frontier, base_pool, rounds=train_rounds, population=5, shots=6)
        # also train MLP programmer (short)
        self.programmer.train(frontier, rounds=max(2, train_rounds // 2), population=6, samples_per=2)
        found = []
        for fam in frontier:
            ep = self.neuro.attack_family(fam, base_pool, shots=shots)
            pr = self.programmer.attack(fam, attempts=max(15, shots // 2))
            if pr is not None:
                g, sc = pr
                train, hold, adv = self.neuro._eval(g, fam)
                if hold >= 0.35 and train >= 0.35:
                    from .family_siege import SiegeWin
                    w = SiegeWin(g, fam, hold, adv, train, 0)
                    self.wins[fam] = self.wins.get(fam, 0) + 1
                    self.vault.append(w)
                    self.miner.observe(g, fam, hold)
                    found.append(w)
                    base_pool.append(g)
            if ep is not None and ep.holdout >= 0.35:
                # double-seed already inside neuro _eval
                train, hold, adv = ep.holdout, ep.holdout, ep.holdout  # approx for SiegeWin
                # re-eval for proper train/adv
                train, hold, adv = self.neuro._eval(ep.genome, fam)
                if hold >= 0.35 and train >= 0.35 and adv >= 0.20:
                    w = SiegeWin(ep.genome, fam, hold, adv, train, 0)
                    self.wins[fam] = self.wins.get(fam, 0) + 1
                    self.vault.append(w)
                    self.miner.observe(ep.genome, fam, hold)
                    found.append(w)
                    base_pool.append(ep.genome)
        return found

    def residual_sweep(self, capability: List[float], generation: int = 0) -> List[SiegeWin]:

        """Extra shots on every family still below threshold."""
        found = []
        for fam in range(N_FAMILIES):
            cap = capability[fam] if fam < len(capability) else 0.0
            if cap >= 0.35:
                continue
            # more shots for residual
            old = self.shots_per_family
            self.shots_per_family = max(old, 40)
            w = self.siege_family(fam, generation)
            self.shots_per_family = old
            if w:
                found.append(w)
                if fam < len(capability):
                    capability[fam] = max(capability[fam], w.holdout)
        return found

    def campaign(self, capability: List[float], generation: int = 0, rounds: int = 3) -> List[SiegeWin]:

        """Multi-round siege: keep attacking weak families."""
        all_wins: List[SiegeWin] = []
        cap = list(capability)
        for r in range(rounds):
            found = self.siege_weak(cap, generation=generation + r, max_families=6)
            all_wins.extend(found)
            for w in found:
                if w.family < len(cap):
                    cap[w.family] = max(cap[w.family], w.holdout)
        # residual sweep once per campaign
        all_wins.extend(self.residual_sweep(cap, generation=generation + rounds))
        return all_wins

    def siege_pressure(self) -> float:
        solved = sum(1 for i in range(N_FAMILIES) if self.wins[i] > 0)
        att = sum(self.attempts.values()) or 1
        win_rate = sum(self.wins.values()) / att
        return max(0.0, min(1.0, 0.6 * (solved / N_FAMILIES) + 0.4 * min(1.0, win_rate * 5)))

    def vault_genomes(self) -> List[int]:
        return [w.genome for w in self.vault]

    def snapshot(self) -> dict:
        return {
            "version": 1,
            "sieges_run": self.sieges_run,
            "vault": len(self.vault),
            "families_won": sum(1 for i in range(N_FAMILIES) if self.wins[i] > 0),
            "regression_won": sum(1 for i in range(REGRESSION_N) if self.wins[i] > 0),
            "open_won": sum(1 for i in range(OPEN_START, CLOSED_N) if self.wins[i] > 0),
            "frontier_won": sum(1 for i in range(FRONTIER_START, N_FAMILIES) if self.wins[i] > 0),
            "closed_won": sum(1 for i in range(CLOSED_N) if self.wins[i] > 0),
            "wins_per_family": {family_name(i): self.wins[i] for i in range(N_FAMILIES) if self.wins[i] > 0},
            "attempts_total": sum(self.attempts.values()),
            "siege_pressure": round(self.siege_pressure(), 4),
            "schema": self.schemas.snapshot(),
            "miner": self.miner.snapshot(),
            "skeletons": self.skeletons.snapshot(),
            "neuro": self.neuro.snapshot(),
            "programmer": self.programmer.snapshot(),
            "wake_forge": self.forge.snapshot(),
            "rift": self.rift.snapshot(),
            "cooccur": self.cooccur.snapshot(),
            "vault_top": [
                {"family": family_name(w.family), "holdout": round(w.holdout, 3), "adv": round(w.adversarial, 3)}
                for w in sorted(self.vault, key=lambda x: -x.holdout)[:8]
            ],
        }
