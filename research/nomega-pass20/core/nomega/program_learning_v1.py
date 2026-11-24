from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Sequence, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F
from .generalist_core import encode_text

@dataclass
class ProgramLearningReport:
    loss: float
    steps: int
    train_score: float
    holdout_score: float

class ProgramSelectorV1(nn.Module):
    """Small trainable selector mapping task text + program opcode histogram to program utility."""
    def __init__(self,vocab=2048,hidden=48,program_dim=20):
        super().__init__(); self.vocab=vocab; self.emb=nn.Embedding(vocab,hidden); self.text=nn.Linear(hidden,hidden); self.prog=nn.Linear(program_dim,hidden); self.out=nn.Sequential(nn.SiLU(),nn.Linear(hidden,1),nn.Sigmoid())
    def forward(self,ids,prog):
        t=self.text(self.emb(ids).mean(1)); p=self.prog(prog); return self.out(torch.tanh(t+p)).squeeze(-1)

def program_hist(code:Sequence[Tuple[int,int,int]],dim=20):
    x=torch.zeros(dim)
    for op,_,_ in code:
        if 0<=int(op)<dim:x[int(op)]+=1
    return x / max(1.0,float(len(code)))

class ProgramSelectorTrainerV1:
    def __init__(self,model:ProgramSelectorV1|None=None,seed=93):
        torch.manual_seed(seed); self.model=model or ProgramSelectorV1(); self.opt=torch.optim.AdamW(self.model.parameters(),lr=3e-4)
    def fit(self,rows:List[Dict[str,Any]],steps=16):
        scored=[r for r in rows if r.get('best')]
        if not scored:return ProgramLearningReport(0.,0,0.,0.)
        last=0.
        for _ in range(max(1,steps)):
            losses=[]
            for r in scored:
                b=r['best']; ids=encode_text(r['family'],self.model.vocab).unsqueeze(0); ph=program_hist([tuple(x) for x in b['code']]).unsqueeze(0); y=torch.tensor([float(b['score'])])
                pred=self.model(ids,ph); losses.append(F.mse_loss(pred,y))
            loss=torch.stack(losses).mean(); self.opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step(); last=float(loss.detach())
        pred=[]; target=[]
        with torch.no_grad():
            for r in scored:
                b=r['best']; x=self.model(encode_text(r['family'],self.model.vocab).unsqueeze(0),program_hist([tuple(x) for x in b['code']]).unsqueeze(0)); pred.append(float(x)); target.append(float(b['score']))
        return ProgramLearningReport(last,len(scored)*max(1,steps),float(sum(abs(a-b) for a,b in zip(pred,target))/len(pred)),float(sum(target)/len(target)))
