from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from .neuro_weave import MultiTimescaleWeave
from .associative_bank import AssociativeBank
from .trace_memory import DifferentiableTraceMemory
from .model import SparseExpertBank
from .attention import GatedLinearAttention
from .consolidation import EvidenceConsolidator
from .homeostatic_budget import NeuralHomeostat
from .predictive_coding import PredictiveCodingCell
from .plasticity_gate import PlasticityGate
from .novelty import PrototypeNovelty

@dataclass
class NeuroWeaveV2Output:
    latent: Tensor
    prediction: Tensor
    prediction_error: Tensor
    novelty: Tensor
    memory: Tensor
    expert: Tensor
    deep_probability: Tensor
    plasticity: Tensor
    consolidation: Tensor

class NeuroWeaveV2(nn.Module):
    """Research candidate: predictive-coding + multi-timescale + associative memory + sparse routing.

    It is a hypothesis-driven architecture. Novelty is not asserted; it must be
    tested against prior art and matched baselines.
    """
    def __init__(self, d_model=64, fast_state=96, slow_state=96, memory_capacity=128, n_experts=4):
        super().__init__()
        self.d_model = d_model
        self.encoder = nn.Sequential(nn.Linear(d_model, d_model), nn.SiLU(), nn.LayerNorm(d_model))
        self.weave = MultiTimescaleWeave(d_model, fast_state, slow_state)
        self.predictive = PredictiveCodingCell(d_model)
        self.memory = AssociativeBank(d_model, memory_capacity)
        self.trace = DifferentiableTraceMemory(d_model, slots=max(16, min(64, memory_capacity // 2)))
        self.experts = SparseExpertBank(d_model, n_experts=n_experts, top_k=1)
        self.attn = GatedLinearAttention(d_model, heads=2)
        self.consolidator = EvidenceConsolidator(d_model)
        self.homeostat = NeuralHomeostat(d_model)
        self.plasticity = PlasticityGate(d_model)
        self.novelty = PrototypeNovelty(d_model)
        self.fuse = nn.Sequential(nn.Linear(d_model * 3, d_model * 2), nn.SiLU(), nn.Linear(d_model * 2, d_model), nn.LayerNorm(d_model))
        self.out_head = nn.Linear(d_model, d_model)

    def initial_state(self, batch, device=None, dtype=None):
        return self.weave.initial_state(batch, device=device, dtype=dtype), self.trace.initial_state(batch, device=device, dtype=dtype), self.predictive.initial_state(batch, device=device, dtype=dtype)

    def forward_sequence(self, x: Tensor, state=None, budget=None, energy=None, thermal=None, recovery=None, update_memory=False):
        if x.ndim != 3 or x.size(-1) != self.d_model:
            raise ValueError('x must be [batch,time,d_model]')
        b,t,_=x.shape
        state = self.initial_state(b,x.device,x.dtype) if state is None else state
        weave_state, trace_state, pc_state = state
        budget = torch.ones(b,1,device=x.device,dtype=x.dtype) if budget is None else budget
        energy = torch.ones(b,1,device=x.device,dtype=x.dtype) if energy is None else energy
        thermal = torch.zeros(b,1,device=x.device,dtype=x.dtype) if thermal is None else thermal
        recovery = torch.zeros(b,1,device=x.device,dtype=x.dtype) if recovery is None else recovery
        prev = torch.zeros(b,self.d_model,device=x.device,dtype=x.dtype)
        ys=[]; preds=[]; errs=[]; novs=[]; mems=[]; exps=[]; dps=[]; pls=[]; cs=[]
        for i in range(t):
            e=self.encoder(x[:,i])
            merged, provisional, candidate, fast_latent, _=self.weave(e,weave_state)
            pc_state, pc_pred, pc_err, pc_energy = self.predictive(merged, pc_state)
            uncertainty = F.softplus(pc_energy).clamp_max(10.0)
            novelty = self.novelty(merged).detach()
            pred_error=(pc_err.pow(2).mean(-1,keepdim=True).sqrt()).detach()
            stability=(1/(1+pred_error))
            repetition=(1/(1+novelty))
            cons=self.consolidator(merged, novelty, uncertainty, pred_error, stability, repetition)
            slow=self.weave.commit_slow(provisional[1], candidate, cons.write)
            weave_state=(provisional[0],slow)
            slow_latent=self.weave.slow_to_latent(slow)
            z=self.weave.merge(torch.cat([fast_latent,slow_latent],-1))
            trace,trace_state=self.trace.step(z,trace_state)
            external,_=self.memory.retrieve(z)
            mem=0.6*trace+0.4*external
            expert,_=self.experts(z+0.2*mem, uncertainty, novelty, pred_error)
            home=self.homeostat(z, uncertainty, novelty, pred_error, budget, energy, thermal, recovery)
            plastic=self.plasticity(z, novelty, uncertainty, pred_error, cons.write)
            deep=torch.where(home.deep_probability.squeeze(-1)>0.65)[0]
            attn=torch.zeros_like(z)
            if deep.numel():
                a,_=self.attn(z[deep].unsqueeze(1)); attn[deep]=a.squeeze(1)
            fused=self.fuse(torch.cat([z, mem+expert, home.gain*attn],-1))
            ys.append(fused); preds.append(self.out_head(fused)); errs.append(pc_energy); novs.append(novelty); mems.append(mem); exps.append(expert); dps.append(home.deep_probability); pls.append(plastic); cs.append(cons.write)
            prev=z.detach()
            if update_memory and not self.training and float(cons.write.detach().mean()) >= 0.15:
                with torch.no_grad(): self.memory.write(z.detach())
        out=NeuroWeaveV2Output(*(torch.stack(v,1) for v in [ys,preds,errs,novs,mems,exps,dps,pls,cs]))
        return out,(weave_state,trace_state,pc_state)

    def forward(self,x:Tensor,state=None):
        return self.forward_sequence(x,state=state,update_memory=not self.training)[0]
