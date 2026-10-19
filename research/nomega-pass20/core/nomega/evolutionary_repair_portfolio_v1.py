from __future__ import annotations

"""AlphaEvolve/DGM-inspired bounded repair portfolio.

The portfolio combines local mutations of the failed program with verified
archive parents, preserves diversity, and keeps candidate generation separate
from execution verification. It is intentionally bounded and reversible.
"""

from pathlib import Path
import hashlib
from typing import Any, Dict, Iterable, List, Sequence, Tuple
import random

from .evolution_archive_v1 import EvolutionArchiveV1
from .program_acquisition_v2 import Program, ProgramAcquisitionCoreV2
from .repair_operator_policy_v2 import RepairOperatorPolicyV2
from .evolution_islands_v1 import EvolutionIslandControllerV1

class EvolutionaryRepairPortfolioV1:
    VERSION='1.12.0'
    def __init__(self, root:Path, seed:int=1977):
        self.root=Path(root); self.seed=int(seed)
        self.archive=EvolutionArchiveV1(self.root)
        self.policy=RepairOperatorPolicyV2(self.root,seed=seed+31)
        self.islands=EvolutionIslandControllerV1(self.root, seed=seed+37)

    def _mutate_local(self, code:Program, seed:int, count:int=8)->List[Program]:
        acq=ProgramAcquisitionCoreV2(self.root,seed=seed)
        out=[]
        for p in acq._mutate(code,n=max(2,int(count))): out.append(p)
        return out


    def observe_verified(self, *, family:str, candidate:Dict[str,Any], verified:bool, success:float, cost:float, cycle_id:str)->Dict[str,Any]:
        return self.islands.observe_verified(family=family, candidate=candidate, verified=verified, success=success, cost=cost, cycle_id=cycle_id)

    @staticmethod
    def _fp(code:Program)->Tuple[Tuple[int,int,int],...]:
        return tuple(tuple(map(int,x)) for x in code)

    def build_pool(self, family:str, raw_code:Program, *, budget:int=24, adaptive:bool=True, island_mode:bool=False)->List[Dict[str,Any]]:
        # Python's built-in hash is process-randomized; use a stable family digest so
        # evolutionary routing/replay is reproducible across fresh processes.
        family_seed = int(hashlib.sha256(str(family).encode('utf-8')).hexdigest()[:8], 16) % 10000
        rng=random.Random(self.seed+family_seed)
        pool=[]
        local=self._mutate_local(raw_code,self.seed+17,budget)
        for cand in local:
            pool.append({'operator':'local_mutation','code':cand,'source':'raw_local'})
        # Verified parents are treated as evolutionary seeds, never as proof of the current repair.
        for parent in self.archive.select_parents(family,k=4):
            p=[tuple(x) for x in parent.get('code',[])]
            for cand in self._mutate_local(p,self.seed+parent.get('uses',0)+len(pool),4):
                pool.append({'operator':str(parent.get('operator','archive_parent')),'code':cand,'source':'verified_archive_parent'})
        unique={self._fp(x['code']):x for x in pool}
        pool=list(unique.values())
        if adaptive:
            preferred=set(self.policy.rank_operators(family))
            def rank(row):
                op=row['operator']; return (1 if op in preferred else 0, 1 if row['source']=='verified_archive_parent' else 0, rng.random())
            pool.sort(key=rank,reverse=True)
        else:
            rng.shuffle(pool)
        if island_mode:
            return self.islands.route_pool(family, pool, budget=max(1,int(budget)))
        return pool[:max(1,int(budget))]
