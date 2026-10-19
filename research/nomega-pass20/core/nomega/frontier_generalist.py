from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Sequence
import torch
import torch.nn as nn
import torch.nn.functional as F

from .generalist_core import AdaptiveGeneralist, encode_text
from .task_generator_v3 import TaskV3

class FrontierGeneralist(AdaptiveGeneralist):
    """Research-only Generalist whose family head is driven by an explicit family vocabulary."""
    def __init__(self, families, latent_dim=64, hidden=72, vocab=2048, actions=8):
        super().__init__(latent_dim, hidden, vocab, actions)
        self.frontier_families=list(families)
        self.family_head=nn.Linear(latent_dim,len(self.frontier_families))
        self.family_to_id={n:i for i,n in enumerate(self.frontier_families)}

@dataclass
class FrontierTrainReport:
    before: Dict[str,float]
    after: Dict[str,float]
    steps:int
    parameters:int

class FrontierGeneralistTrainer:
    def __init__(self,model:FrontierGeneralist,lr:float=3e-4,seed:int=137):
        self.model=model; self.opt=torch.optim.AdamW(model.parameters(),lr=lr,weight_decay=1e-4); self.seed=seed; self.steps=0
    def _batch(self,rows:Sequence[TaskV3]):
        ids=torch.stack([encode_text(x.text,vocab=self.model.vocab) for x in rows])
        family=torch.tensor([self.model.family_to_id[x.family] for x in rows],dtype=torch.long)
        difficulty=torch.tensor([float(x.difficulty)/3.5 for x in rows]).clamp(.01,.99)
        novelty=torch.tensor([.2+.7*(1.0 if x.adversarial else (0.6 if x.compositional else .25)) for x in rows]).clamp(.01,.99)
        pol=[]
        for x in rows:
            if x.family in {'xor','xor_then_parity'}: pol.append(1)
            elif x.family.startswith('program'): pol.append(4)
            elif x.family in {'sequence_diff'}: pol.append(3)
            elif x.family in {'dot','dot_then_mod'}: pol.append(2)
            else: pol.append(0)
        return ids,family,torch.tensor(pol),difficulty,novelty
    def step(self,rows):
        ids,fam,pol,diff,nov=self._batch(rows); self.model.train(); out=self.model(ids)
        vt=1-.6*diff; ut=.2+.65*diff; ct=(.25+.7*diff).clamp(.05,.98)
        loss=F.cross_entropy(out.family_logits,fam)+.55*F.cross_entropy(out.policy_logits,pol)+.15*F.mse_loss(out.value.squeeze(-1),vt)+.12*F.mse_loss(out.novelty.squeeze(-1),nov)+.12*F.mse_loss(out.uncertainty.squeeze(-1),ut)+.10*F.mse_loss(out.compute.squeeze(-1),ct)
        self.opt.zero_grad(set_to_none=True); loss.backward(); nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step(); self.steps+=1
        return float(loss.detach())
    @torch.no_grad()
    def evaluate(self,rows):
        ids,fam,pol,diff,_=self._batch(rows); self.model.eval(); out=self.model(ids)
        return {'family_acc':float((out.family_logits.argmax(-1)==fam).float().mean()),'policy_acc':float((out.policy_logits.argmax(-1)==pol).float().mean()),'value_mae':float((out.value.squeeze(-1)-(1-.6*diff)).abs().mean()),'ece_like':float((out.uncertainty.squeeze(-1)-(.2+.65*diff)).abs().mean())}

def save_frontier_checkpoint(path:Path,model:FrontierGeneralist,trainer:FrontierGeneralistTrainer,extra:Dict[str,Any]|None=None):
    path.parent.mkdir(parents=True,exist_ok=True); torch.save({'model':model.state_dict(),'optimizer':trainer.opt.state_dict(),'steps':trainer.steps,'families':model.frontier_families,'architecture':{'latent_dim':model.latent_dim,'hidden':model.hidden,'vocab':model.vocab,'actions':model.actions},'extra':extra or {},'version':'1.1.0'},path)
