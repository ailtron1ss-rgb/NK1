from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from .neuro_weave import MultiTimescaleWeave
from .associative_bank import AssociativeBank
from .consolidation import EvidenceConsolidator
from .compute_controller import ComputeHomeostat
from .trace_memory import DifferentiableTraceMemory
from .model import SparseExpertBank
from .attention import GatedLinearAttention

@dataclass
class NeuroWeaveOutput:
    latent: Tensor
    fast_latent: Tensor
    slow_latent: Tensor
    memory: Tensor
    prediction: Tensor
    uncertainty: Tensor
    novelty: Tensor
    consolidation: Tensor
    route: Tensor
    route_probs: Tensor

class NeuroWeaveCore(nn.Module):
    """NeuroCore v0.7: multi-timescale predictive associative sparse core.

    Proposed unique synthesis, not established novelty. Every claimed property
    is benchmarked separately; no consciousness inference is performed.
    """
    def __init__(self, d_model=96, fast_state=128, slow_state=128, memory_capacity=256, n_experts=4, top_k=1, attention_heads=4):
        super().__init__()
        self.d_model = d_model
        self.encoder = nn.Sequential(nn.Linear(d_model, d_model), nn.SiLU(), nn.LayerNorm(d_model))
        self.weave = MultiTimescaleWeave(d_model, fast_state, slow_state)
        self.memory = AssociativeBank(d_model, memory_capacity)
        self.trace_memory = DifferentiableTraceMemory(d_model, slots=min(64, max(16, memory_capacity//4)))
        self.experts = SparseExpertBank(d_model, n_experts=n_experts, top_k=top_k)
        self.attn = GatedLinearAttention(d_model, heads=attention_heads)
        self.predictor = nn.Sequential(nn.Linear(d_model, d_model), nn.SiLU(), nn.Linear(d_model, d_model))
        self.uncertainty = nn.Sequential(nn.Linear(d_model, max(16, d_model//2)), nn.SiLU(), nn.Linear(max(16, d_model//2), 1))
        self.consolidator = EvidenceConsolidator(d_model)
        self.compute = ComputeHomeostat(d_model)
        self.fuse = nn.Sequential(nn.Linear(d_model*4, d_model*2), nn.SiLU(), nn.Linear(d_model*2, d_model), nn.LayerNorm(d_model))

    def initial_state(self, batch, device=None, dtype=None):
        return self.weave.initial_state(batch, device=device, dtype=dtype), self.trace_memory.initial_state(batch, device=device, dtype=dtype)

    def forward_sequence(self, x: Tensor, state=None, budget=None, energy=None, thermal=None, pressure=None, update_memory: bool = False):
        if x.ndim != 3 or x.size(-1) != self.d_model: raise ValueError("x must be [batch,time,d_model]")
        b,t,_ = x.shape
        state = self.initial_state(b,x.device,x.dtype) if state is None else state
        weave_state, trace_state = state
        budget = torch.ones(b,1,device=x.device,dtype=x.dtype) if budget is None else budget
        energy = torch.ones(b,1,device=x.device,dtype=x.dtype) if energy is None else energy
        thermal = torch.zeros(b,1,device=x.device,dtype=x.dtype) if thermal is None else thermal
        pressure = torch.zeros(b,1,device=x.device,dtype=x.dtype) if pressure is None else pressure
        zs=[]; fs=[]; ss=[]; ms=[]; ps=[]; us=[]; ns=[]; cs=[]; rs=[]; rps=[]
        prev = torch.zeros(b,self.d_model,device=x.device,dtype=x.dtype)
        for i in range(t):
            e = self.encoder(x[:,i])
            premerge, provisional_state, slow_candidate, fast_latent, old_slow_latent = self.weave(e, weave_state)
            pred_pre = self.predictor(premerge)
            pred_error = (pred_pre-prev).pow(2).mean(-1,keepdim=True).sqrt()
            novelty = (premerge-prev).pow(2).mean(-1,keepdim=True).sqrt().detach()
            unc = F.softplus(self.uncertainty(premerge))
            stability = (1.0 / (1.0 + pred_error)).detach()
            repetition = (1.0 / (1.0 + novelty)).detach()
            consolidation = self.consolidator(premerge, novelty, unc, pred_error, stability, repetition)
            old_slow = provisional_state[1]
            committed_slow = self.weave.commit_slow(old_slow, slow_candidate, consolidation.write)
            weave_state = (provisional_state[0], committed_slow)
            slow_latent = self.weave.slow_to_latent(committed_slow)
            z = self.weave.merge(torch.cat([fast_latent, slow_latent], -1))
            pred = self.predictor(z)
            trace, trace_state = self.trace_memory.step(z, trace_state)
            external_mem, _ = self.memory.retrieve(z)
            mem = 0.7 * trace + 0.3 * external_mem
            expert, _ = self.experts(z + 0.25*mem, unc, novelty, pred_error)
            decision = self.compute(z, unc, novelty, pred_error, budget, energy, thermal, pressure)

            # True hard conditional execution: attention is not evaluated for
            # FAST/ADAPTIVE samples. Only DEEP-selected batch rows enter it.
            deep_idx = torch.where(decision.level.squeeze(-1) == 2)[0]
            attn_out = torch.zeros_like(z)
            if deep_idx.numel() > 0:
                deep_seq = z[deep_idx].unsqueeze(1)
                deep_result, _ = self.attn(deep_seq)
                attn_out[deep_idx] = deep_result.squeeze(1)
            deep_gate = (decision.level == 2).to(z.dtype)
            fused = self.fuse(torch.cat([z, mem, expert, deep_gate*attn_out], -1))
            zs.append(fused); fs.append(fast_latent); ss.append(slow_latent); ms.append(mem); ps.append(pred); us.append(unc); ns.append(novelty); cs.append(consolidation.write); rs.append(decision.level.float()); rps.append(decision.probability)
            prev = z.detach()
            if update_memory and not self.training and float(consolidation.write.detach().mean()) >= 0.15:
                with torch.no_grad():
                    self.memory.write(z.detach())
        return NeuroWeaveOutput(torch.stack(zs,1), torch.stack(fs,1), torch.stack(ss,1), torch.stack(ms,1), torch.stack(ps,1), torch.stack(us,1), torch.stack(ns,1), torch.stack(cs,1), torch.stack(rs,1), torch.stack(rps,1)), (weave_state, trace_state)

    def export_forward(self, x: Tensor):
        """Static tensor-only deployment graph.

        Runtime hard gating is intentionally kept out of this graph because
        data-dependent Python branching is not safely representable by plain
        tracing. The export graph evaluates the attention path and multiplies
        it by the learned DEEP probability; a deployment runtime may then use
        backend-specific operator fusion/pruning.
        """
        b,t,_=x.shape
        weave_state, trace_state=self.initial_state(b,x.device,x.dtype)
        budget=torch.ones(b,1,device=x.device,dtype=x.dtype)
        energy=torch.ones(b,1,device=x.device,dtype=x.dtype)
        thermal=torch.zeros(b,1,device=x.device,dtype=x.dtype)
        pressure=torch.zeros(b,1,device=x.device,dtype=x.dtype)
        ys=[]; ps=[]; us=[]; rs=[]
        prev=torch.zeros(b,self.d_model,device=x.device,dtype=x.dtype)
        for i in range(t):
            e=self.encoder(x[:,i])
            premerge, provisional, candidate, fast_latent, _=self.weave(e,weave_state)
            pred_pre=self.predictor(premerge)
            err=(pred_pre-prev).pow(2).mean(-1,keepdim=True).sqrt()
            nov=(premerge-prev).pow(2).mean(-1,keepdim=True).sqrt().detach()
            unc=F.softplus(self.uncertainty(premerge))
            stability=(1.0/(1.0+err)).detach(); repetition=(1.0/(1.0+nov)).detach()
            cons=self.consolidator(premerge,nov,unc,err,stability,repetition)
            slow=self.weave.commit_slow(provisional[1],candidate,cons.write)
            weave_state=(provisional[0],slow)
            slow_latent=self.weave.slow_to_latent(slow)
            z=self.weave.merge(torch.cat([fast_latent,slow_latent],-1))
            trace,trace_state=self.trace_memory.step(z,trace_state)
            expert,_=self.experts(z+0.25*trace,unc,nov,err)
            decision=self.compute(z,unc,nov,err,budget,energy,thermal,pressure)
            attn,_=self.attn(z.unsqueeze(1)); attn=attn.squeeze(1)
            fused=self.fuse(torch.cat([z,trace,expert,decision.probability[:,2:3]*attn],-1))
            ys.append(fused); ps.append(self.predictor(fused)); us.append(unc); rs.append(decision.probability)
            prev=z.detach()
        return torch.stack(ys,1),torch.stack(ps,1),torch.stack(us,1),torch.stack(rs,1)

    def forward(self, x: Tensor, state=None):
        return self.forward_sequence(x,state=state,update_memory=not self.training)[0]
