from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Sequence
import torch
import torch.nn.functional as F
from .apex_brain_v4 import ApexBrainV4
from .generalist_core import encode_text

@dataclass
class JointTrainV4Result:
    before:Dict[str,float]; after:Dict[str,float]; loss:float; steps:int

class JointLearningV4:
    """Joint training with task labels, route targets, consistency and distillation."""
    def __init__(self,families:Sequence[str],seed=71,latent=64,hidden=96,vocab=1024,actions=8):
        torch.manual_seed(seed); self.model=ApexBrainV4(families,latent,hidden,vocab,actions); self.opt=torch.optim.AdamW(self.model.parameters(),lr=2e-4,weight_decay=1e-4); self.steps=0
    def batch(self,tasks):
        ids=torch.stack([encode_text(t.text,self.model.vocab) for t in tasks]); fam=torch.tensor([self.model.family_to_id[t.family] for t in tasks]); diff=torch.tensor([min(1.,t.difficulty/6.) for t in tasks]);
        return ids,fam,diff
    def evaluate(self,tasks):
        if not tasks: return {'family_acc':0.,'value_mae':1.,'uncertainty_mae':1.}
        ids,f,d=self.batch(tasks); self.model.eval(); o=self.model(ids)
        return {'family_acc':float(((o.family_logits.argmax(-1)==f).float().mean()).detach()),'value_mae':float(((o.value.squeeze(-1)-(1-.55*d)).abs().mean()).detach()),'uncertainty_mae':float(((o.uncertainty.squeeze(-1)-(.2+.7*d)).abs().mean()).detach())}
    def train(self,tasks,teacher=None,steps=12)->Dict[str,float]:
        ids,f,d=self.batch(tasks); last=0.
        for _ in range(max(1,steps)):
            self.model.train(); o=self.model(ids); loss=F.cross_entropy(o.family_logits,f)+.2*F.mse_loss(o.value.squeeze(-1),1-.55*d)+.15*F.mse_loss(o.uncertainty.squeeze(-1),.2+.7*d)
            p=self.model(ids, [o.latent.detach(), o.latent.detach()]); loss+=.03*self.model.consistency_loss(o.latent,p.latent)
            if teacher is not None: loss+=.08*self.model.distill_loss(teacher,ids)
            self.opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step(); self.steps+=1; last=float(loss.detach())
        return {'loss':last,'steps':self.steps}
    def save(self,path:Path,meta:Dict[str,Any]):
        path.parent.mkdir(parents=True,exist_ok=True); torch.save({'state_dict':self.model.state_dict(),'architecture':{'families':self.model.families,'latent_dim':self.model.latent_dim,'hidden':self.model.hidden,'vocab':self.model.vocab,'actions':self.model.actions},'meta':meta,'steps':self.steps},path); return str(path)
