from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Sequence
import json, time
import torch
import torch.nn as nn
import torch.nn.functional as F
from .task_generator_v4 import TaskV4
from .generalist_core import AdaptiveGeneralist, encode_text
from .trace_learning_v2 import RuntimeTraceDataset
from .frontier_generalist import FrontierGeneralist

@dataclass
class JointResult:
    before: Dict[str,float]
    after: Dict[str,float]
    trace_rows: int
    consistency: float
    promoted: bool
    checkpoint: str

class JointGeneralistV2:
    """Train a dynamic-family controller on synthetic tasks + real execution traces.

    The objective mixes task supervision, route consistency and trace quality. It is
    research-oriented and promotion-gated; it never silently replaces the stable model.
    """
    def __init__(self, families:Sequence[str], latent_dim=64, hidden=72, vocab=2048, actions=8, seed=503):
        self.model=FrontierGeneralist(list(families),latent_dim,hidden,vocab,actions)
        self.opt=torch.optim.AdamW(self.model.parameters(),lr=2.5e-4,weight_decay=1e-4)
        self.seed=seed; self.steps=0

    def _batch(self, rows:Sequence[TaskV4]):
        ids=torch.stack([encode_text(x.text,vocab=self.model.vocab) for x in rows])
        fam=torch.tensor([self.model.family_to_id[x.family] for x in rows])
        pol=[]
        for x in rows:
            if x.family in {'xor3','parity_mix','invariant_xor','compose_nested_parity'}: pol.append(1)
            elif x.family.startswith('program'): pol.append(4)
            elif 'sequence' in x.family: pol.append(3)
            elif x.family in {'dot2_mod','compose_mod_chain','mul2'}: pol.append(2)
            elif x.family in {'compose_min_max','minmax3'}: pol.append(0)
            else: pol.append(0)
        d=torch.tensor([min(1.,x.difficulty/5.) for x in rows]); return ids,fam,torch.tensor(pol),d

    def evaluate(self,rows):
        if not rows: return {'family_acc':0.,'policy_acc':0.,'value_mae':1.,'uncertainty_mae':1.}
        ids,f,p,d=self._batch(rows); self.model.eval(); out=self.model(ids)
        return {'family_acc':float((out.family_logits.argmax(-1)==f).float().mean().detach()),'policy_acc':float((out.policy_logits.argmax(-1)==p).float().mean().detach()),'value_mae':float((out.value.squeeze(-1)-(1-.55*d)).abs().mean().detach()),'uncertainty_mae':float((out.uncertainty.squeeze(-1)-(.2+.7*d)).abs().mean().detach())}

    def train(self, rows:Sequence[TaskV4], traces:RuntimeTraceDataset|None=None, steps:int=24):
        if not rows: return {'loss':0.,'steps':0}
        ids,f,p,d=self._batch(rows)
        route_target=torch.zeros((len(rows), self.model.actions))
        if traces is not None:
            trace_by={t.text:t for t in traces.rows}
            for i,x in enumerate(rows):
                t=trace_by.get(x.text)
                if t and t.expert_ids:
                    mapping={'symbolic':0,'neural_invent':4,'planner':3,'memory':5,'skill':4}
                    for e in t.expert_ids:
                        if e in mapping: route_target[i,mapping[e]] += .6
        best={'loss':999.}
        for _ in range(max(1,steps)):
            self.model.train(); out=self.model(ids)
            vt=1-.55*d; ut=.2+.7*d
            loss=F.cross_entropy(out.family_logits,f)+.60*F.cross_entropy(out.policy_logits,p)+.12*F.mse_loss(out.value.squeeze(-1),vt)+.12*F.mse_loss(out.uncertainty.squeeze(-1),ut)
            if route_target.sum()>0:
                target=route_target.argmax(-1); loss += .10*F.cross_entropy(out.policy_logits,target)
            # Consistency: paraphrase/context perturbations should preserve latent family.
            perm=torch.randperm(ids.size(0)); z1=self.model.encode(ids); z2=self.model.encode(ids[perm]); loss += .02*(1-F.cosine_similarity(z1,z2,dim=-1).mean())
            self.opt.zero_grad(set_to_none=True); loss.backward(); nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step(); self.steps+=1
            best={'loss':float(loss.detach())}
        return best

    def save(self,path:Path,meta:Dict[str,Any]):
        path.parent.mkdir(parents=True,exist_ok=True); torch.save({'model':self.model.state_dict(),'optimizer':self.opt.state_dict(),'steps':self.steps,'families':self.model.frontier_families,'architecture':{'latent_dim':self.model.latent_dim,'hidden':self.model.hidden,'vocab':self.model.vocab,'actions':self.model.actions},'meta':meta,'version':'1.2.0'},path); return str(path)

class TraceAlignment:
    @staticmethod
    def consistency(trace_rows):
        if not trace_rows: return 0.0
        vals=[float(r.verified)*.7+float(r.confidence)*.2+max(0.,1.-r.latency_ms/2000.)*.1 for r in trace_rows]
        return sum(vals)/len(vals)
