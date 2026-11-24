from __future__ import annotations

"""Large-pool retrieval with active test-time hypothesis elimination."""
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List

from .program_acquisition_v2 import Program, ProgramAcquisitionCoreV2
from .program_skill_retrieval_v2 import ProgramSkillRetrievalV2
from .active_hypothesis_filter_v1 import ActiveHypothesisFilterV1
from .program_runtime_v2 import run_tiny_v2

@dataclass(frozen=True)
class RetrievalResultV2:
    family: str
    source: str
    original_verified: bool
    selected_verified: bool
    candidates_retrieved: int
    candidates_after_filter: int
    active_tests: int
    original_holdout: float
    selected_holdout: float
    original_adversarial: float
    selected_adversarial: float
    original_hvm: float
    selected_hvm: float
    code: Program
    def to_dict(self):
        d=asdict(self); d['code']=[list(x) for x in self.code]; return d

class NeuralSkillRetrievalV2:
    VERSION='neural-plus-active-skill-retrieval-v2'
    def __init__(self,root:Path,seed:int=18501):
        self.root=Path(root); self.seed=int(seed)
        self.acquisition=ProgramAcquisitionCoreV2(self.root,seed=self.seed)
        self.retrieval=ProgramSkillRetrievalV2(self.root)
        self.filter=ActiveHypothesisFilterV1()

    @staticmethod
    def _score(holdout,adv,hvm,sim,complexity):
        return .50*float(holdout)+.25*float(adv)+.20*float(hvm)+.05*float(sim)-.001*float(complexity)

    def search(self, code:Program, family:str, *, max_candidates:int=48, active_queries:int=8)->RetrievalResultV2:
        train,holdout,adv=self.acquisition._examples(family,seed=self.seed)
        def evaluate(p):
            tr,htr,_=self.acquisition._eval(p,train); ho,hho,_=self.acquisition._eval(p,holdout); af,haf,_=self.acquisition._eval(p,adv)
            hv=min(htr,hho,haf); verified=ho>=.80 and af>=.70 and hv>=.80
            return tr,ho,af,hv,verified
        original=evaluate(code)
        cand=[list(code)]; sims=[1.0]; seen={tuple(tuple(x) for x in code)}
        for hit in self.retrieval.retrieve(code,k=max(1,int(max_candidates))):
            item=hit.get('item',{}); raw=item.get('code') or item.get('program')
            if not raw: continue
            try: p=[tuple(int(v) for v in x) for x in raw]
            except (TypeError,ValueError): continue
            key=tuple(p)
            if key in seen: continue
            seen.add(key); cand.append(p); sims.append(float(hit.get('similarity',0.0)))
        tests=holdout+adv
        filtered=self.filter.filter(
            cand,tests,
            lambda p,x: run_tiny_v2(p, list(x[0]), steps=512).get("result"),
            lambda x: x[1],
            max_queries=active_queries,survivors=min(8,len(cand)),
        )
        pool=list(filtered.selected)
        best_code=list(code); best_eval=original; best_sim=1.0; best_src='neural_candidate'
        sim_by_key={tuple(p):s for p,s in zip(cand,sims)}
        for p in pool:
            ev=evaluate(p); sim=sim_by_key.get(tuple(p),0.0)
            if self._score(ev[1],ev[2],ev[3],sim,len(p)) > self._score(best_eval[1],best_eval[2],best_eval[3],best_sim,len(best_code)):
                best_code=list(p); best_eval=ev; best_sim=sim; best_src='active_verified_skill_retrieval'
        return RetrievalResultV2(
            family=family,source=best_src,original_verified=bool(original[4]),selected_verified=bool(best_eval[4]),
            candidates_retrieved=len(cand),candidates_after_filter=len(pool),active_tests=len(filtered.selected_tests),
            original_holdout=float(original[1]),selected_holdout=float(best_eval[1]),original_adversarial=float(original[2]),selected_adversarial=float(best_eval[2]),
            original_hvm=float(original[3]),selected_hvm=float(best_eval[3]),code=best_code)
