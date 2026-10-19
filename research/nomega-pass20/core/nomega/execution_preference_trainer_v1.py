from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Sequence, Tuple, Optional
import random, time, torch
import torch.nn.functional as F

from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, Program
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .verifiable_dense_reward_v1 import VerifiableDenseRewardV1, DenseRewardV1

@dataclass(frozen=True)
class PreferenceTrainReportV1:
    rows: int
    pairs: int
    epochs: int
    steps: int
    loss: float
    mean_reward_gap: float
    elapsed_s: float
    holdout_before: float
    holdout_after: float

    def to_dict(self): return asdict(self)

class ExecutionPreferenceTrainerV1:
    """Train proposer ranking from execution-grounded dense rewards.

    The objective is pairwise preference learning: a program that receives a higher
    verifier-derived reward should receive a higher model likelihood. This avoids
    inventing a learned reward model and uses exact execution as the target signal.
    """
    VERSION = "execution-preference-trainer-v1"
    def __init__(self, root: Path, model: NeuralProgramSynthesizerV2, seed: int = 7301):
        self.root=Path(root); self.model=model; self.seed=int(seed); self.rng=random.Random(seed)
        self.rewarder=VerifiableDenseRewardV1(self.root)

    def _examples(self, family: str, seed: int):
        return ProgramAcquisitionCoreV2(self.root, seed=seed)._examples(family, seed)

    def _candidate_pool(self, acq: ProgramAcquisitionCoreV2, family: str, seed: int, n: int = 18):
        out=[]; seen=set()
        for src, code in [("template",p) for p in acq.templates(family)]:
            seq=[code] + acq._mutate(code,max(2,n))
            for x in seq:
                key=tuple(tuple(z) for z in x)
                if key not in seen: seen.add(key); out.append(x)
        return out[:n]

    def _likelihood_score(self, text: str, code: Program, family_id: int) -> torch.Tensor:
        out=self.model.forward_teacher(text,code,family_id)
        op=F.cross_entropy(out['op'].reshape(-1,self.model.op_head.out_features), out['op_y'], reduction='mean')
        aa=F.cross_entropy(out['a'].reshape(-1,self.model.a_head.out_features), out['a_y'], reduction='mean')
        bb=F.cross_entropy(out['b'].reshape(-1,self.model.b_head.out_features), out['b_y'], reduction='mean')
        return -(op + 0.5*aa + 0.5*bb)

    @torch.no_grad()
    def _coverage(self, families: Sequence[str], seed: int) -> float:
        acq=ProgramAcquisitionCoreV2(self.root,seed=seed)
        good=0
        for i,f in enumerate(families):
            text=f.replace('_',' ')
            code=self.model.generate_constrained(text,i,max_len=min(48,self.model.max_len))
            _,ho,adv=acq._examples(f,seed+i)
            r=self.rewarder.score(code,ho)
            ar=self.rewarder.score(code,adv)
            if r.pass_rate>=0.8 and ar.pass_rate>=0.75 and r.hvm_agreement>=0.8: good+=1
        return good/max(1,len(families))

    def fit(self, families: Sequence[str], *, epochs: int = 3, pairs_per_family: int = 5, lr: float = 2e-4, seed: int = 9101, extra_rows_by_family: Optional[Dict[str, Sequence[Tuple[List[int], int]]]] = None) -> PreferenceTrainReportV1:
        acq=ProgramAcquisitionCoreV2(self.root,seed=seed); pairs=[]
        for i,f in enumerate(families):
            _, hold, _ = self._examples(f,seed+i)
            if extra_rows_by_family and f in extra_rows_by_family:
                hold = list(hold) + [([int(x)&255 for x in tape], int(expected)&255) for tape, expected in extra_rows_by_family[f]]
            pool=self._candidate_pool(acq,f,seed+i,max(8,pairs_per_family*4))
            scored=[]
            for code in pool:
                r=self.rewarder.score(code,hold); scored.append((r,code))
            scored.sort(key=lambda x:x[0].reward,reverse=True)
            for j in range(min(pairs_per_family,len(scored)//2)):
                pos=scored[j]; neg=scored[-(j+1)]
                if pos[0].reward <= neg[0].reward + 1e-4: continue
                pairs.append((f,i,pos[1],neg[1],pos[0],neg[0]))
        before=self._coverage(families,seed+101)
        opt=torch.optim.AdamW(self.model.parameters(),lr=float(lr),weight_decay=1e-4)
        self.model.train(); t=time.perf_counter(); last=0.0; steps=0; gaps=[]
        for ep in range(max(1,int(epochs))):
            self.rng.shuffle(pairs)
            for f,fid,pos,neg,pr,nr in pairs:
                ps=self._likelihood_score(f.replace('_',' '),pos,fid)
                ns=self._likelihood_score(f.replace('_',' '),neg,fid)
                # Softplus margin loss; reward gap determines target margin but is capped.
                gap=float(max(0.05,min(2.0,pr.reward-nr.reward)))
                loss=F.softplus(-(ps-ns-gap))
                opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.parameters(),1.0); opt.step()
                last=float(loss.detach()); steps+=1; gaps.append(gap)
        after=self._coverage(families,seed+101)
        report=PreferenceTrainReportV1(len(families),len(pairs),max(1,int(epochs)),steps,last,sum(gaps)/max(1,len(gaps)),time.perf_counter()-t,before,after)
        out=self.root/'runtime'/'execution_preference_train_v1.json'; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(__import__('json').dumps(report.to_dict(),indent=2))
        return report
