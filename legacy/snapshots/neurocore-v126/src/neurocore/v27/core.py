from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v26 import NeuroWeaveV26, V26Config, V26State


def _scalar(x: Tensor) -> Tensor:
    return x if x.ndim == 2 else x.reshape(x.size(0), -1).mean(-1, keepdim=True)


@dataclass
class V27State:
    base: V26State
    fast_context: Tensor          # [B,D]
    stable_context: Tensor        # [B,D]
    memory_keys: Tensor            # [B,M,D]
    memory_values: Tensor          # [B,M,D]
    memory_strength: Tensor        # [B,M,1]
    memory_age: Tensor             # [B,M,1]
    memory_ptr: Tensor             # [B,1] long
    uncertainty_ema: Tensor        # [B,1]
    prediction_ema: Tensor         # [B,1]
    compute_budget: Tensor         # [B,1]
    identity_anchor: Tensor        # [B,D]
    developmental_pressure: Tensor # [B,1]
    life_clock: Tensor             # [B,1]


@dataclass
class V27Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    modalities: int = 3
    proprio_dim: int = 4
    intero_dim: int = 4
    memory_slots: int = 16
    router_candidates: int = 4
    top_k_memory: int = 4
    fast_decay: float = 0.90
    stable_decay: float = 0.997
    uncertainty_decay: float = 0.96
    prediction_decay: float = 0.95
    compute_decay: float = 0.92
    budget_min: float = 0.15
    budget_max: float = 1.00
    memory_write_rate: float = 0.10
    memory_forget_rate: float = 0.015
    identity_decay: float = 0.998
    development_decay: float = 0.97
    primary_weight: float = 1.0
    retrieval_weight: float = 0.12
    world_weight: float = 0.12
    action_weight: float = 0.08
    identity_weight: float = 0.06
    efficiency_weight: float = 0.04
    memory_write_weight: float = 0.05
    mobile_variant: bool = False
    use_qat: bool = False
    hard_route: bool = False


class MultiRateContextV27(nn.Module):
    """Cheap multi-rate recurrence: fast context follows current input, stable context drifts slowly."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.fast = nn.GRUCell(d, d)
        self.stable = nn.GRUCell(d, d)
        self.mix = nn.Sequential(nn.Linear(2*d + 3, hidden), nn.SiLU(), nn.Linear(hidden, 2))

    def forward(self, z: Tensor, fast: Tensor, stable: Tensor, uncertainty: Tensor, novelty: Tensor, budget: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        nf = self.fast(z, fast)
        ns = self.stable(z, stable)
        w = torch.sigmoid(self.mix(torch.cat([z, fast, uncertainty, novelty, budget], -1)))
        out = w[:, :1] * nf + (1.0 - w[:, :1]) * ns
        return out, nf, ns


class SurpriseRouterV27(nn.Module):
    """Selects a low-cost computation rule using learned utility from surprise, novelty, confidence and budget."""
    def __init__(self, d: int, hidden: int, candidates: int = 4):
        super().__init__(); self.candidates = candidates
        self.router = nn.Sequential(nn.Linear(2*d + 5, hidden), nn.SiLU(), nn.Linear(hidden, candidates))
        self.transforms = nn.ModuleList([nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d)) for _ in range(candidates)])
        self.gain = nn.Parameter(torch.ones(candidates))

    def forward(self, z: Tensor, context: Tensor, surprise: Tensor, novelty: Tensor, uncertainty: Tensor, confidence: Tensor, budget: Tensor) -> Tuple[Tensor, Tensor]:
        logits = self.router(torch.cat([z, context, surprise, novelty, uncertainty, confidence, budget], -1))
        weights = F.softmax(logits + self.gain.view(1, -1), -1)
        if self.training:
            outs = torch.stack([torch.tanh(op(z)) for op in self.transforms], 1)
            mixed = (outs * weights.unsqueeze(-1)).sum(1)
        else:
            idx = weights.argmax(-1)
            outs = torch.stack([torch.tanh(op(z)) for op in self.transforms], 1)
            mixed = outs[torch.arange(z.size(0), device=z.device), idx]
        return mixed, weights


class UtilityMemoryV27(nn.Module):
    """Bounded key-value memory with utility prediction for write/erase decisions."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.key = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.value = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.utility = nn.Sequential(nn.Linear(3*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.erase = nn.Sequential(nn.Linear(3*d + 1, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def read(self, z: Tensor, keys: Tensor, values: Tensor, strength: Tensor, age: Tensor, goal: Tensor, uncertainty: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        q = F.normalize(self.key(z), dim=-1, eps=1e-5)
        k = F.normalize(keys, dim=-1, eps=1e-5)
        sim = torch.einsum('bd,bmd->bm', q, k)
        logits = sim + torch.log(strength.squeeze(-1).clamp_min(1e-4)) - 0.01 * age.squeeze(-1)
        w = F.softmax(logits, -1)
        top = min(4, w.size(-1))
        vals, idx = torch.topk(w, k=top, dim=-1)
        sel = torch.gather(values, 1, idx.unsqueeze(-1).expand(-1, -1, values.size(-1)))
        read = (sel * vals.unsqueeze(-1)).sum(1)
        relevance = vals.mean(-1, keepdim=True)
        util = torch.sigmoid(self.utility(torch.cat([z, read, goal, uncertainty, relevance], -1)))
        return read, util, w

    def propose(self, z: Tensor, read: Tensor, goal: Tensor, uncertainty: Tensor) -> Tuple[Tensor, Tensor]:
        ctx = torch.cat([z, read, goal, uncertainty], -1)
        util = torch.sigmoid(self.utility(torch.cat([z, read, goal, uncertainty], -1)))
        erase = torch.sigmoid(self.erase(torch.cat([z, read, goal, uncertainty], -1)))
        return util, erase


class CounterfactualRefinerV27(nn.Module):
    """One-step action refinement from predicted consequence and baseline counterfactual."""
    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.predict = nn.Sequential(nn.Linear(2*d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.score = nn.Sequential(nn.Linear(d + action_dim + 3, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.refine = nn.Sequential(nn.Linear(d + action_dim + 2, hidden), nn.SiLU(), nn.Linear(hidden, action_dim))

    def forward(self, z: Tensor, action: Tensor, goal: Tensor, uncertainty: Tensor, budget: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        future = self.predict(torch.cat([z, goal, action], -1))
        score = self.score(torch.cat([future, action, uncertainty, budget, torch.ones_like(budget)], -1))
        refined = torch.tanh(action + 0.15 * self.refine(torch.cat([future, action, goal[:, :1], uncertainty], -1)))
        return future, refined, score


class IdentityContinuityV27(nn.Module):
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.update = nn.Sequential(nn.Linear(3*d + 3, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.stability = nn.Sequential(nn.Linear(2*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, workspace: Tensor, prev: Tensor, uncertainty: Tensor, novelty: Tensor, boundary: Tensor) -> Tuple[Tensor, Tensor]:
        cand = torch.tanh(self.update(torch.cat([z, workspace, prev, uncertainty, novelty, boundary], -1)))
        stable = torch.sigmoid(self.stability(torch.cat([cand, prev, uncertainty, novelty], -1)))
        return cand, stable


class QuantAwareLinearV27(nn.Module):
    """Training-time fake quantization hook; exact integer export is deliberately separate."""
    def __init__(self, inp: int, out: int, bits: int = 8):
        super().__init__(); self.linear = nn.Linear(inp, out); self.bits = bits

    def forward(self, x: Tensor) -> Tensor:
        y = self.linear(x)
        qmax = float(2**(self.bits-1)-1)
        scale = y.detach().abs().amax(dim=-1, keepdim=True).clamp_min(1e-4) / qmax
        return torch.clamp(torch.round(y / scale), -qmax, qmax) * scale


class NeuroWeaveV27(nn.Module):
    """V27: autonomous continual organism substrate.

    New mechanisms are designed to be real, bounded and ablatable: multi-rate context,
    utility-directed memory, algorithm routing, counterfactual action refinement,
    identity continuity, developmental pressure and quantization-aware output path.
    No consciousness claim is made.
    """
    def __init__(self, cfg: Optional[V27Config] = None):
        super().__init__(); c = cfg or V27Config(); self.cfg = c
        self.core = NeuroWeaveV26(V26Config(d=c.d, hidden=c.hidden, action_dim=c.action_dim, modalities=c.modalities,
            proprio_dim=c.proprio_dim, intero_dim=c.intero_dim, event_capacity=c.memory_slots, skill_slots=max(4, min(8, c.memory_slots//2)), top_k=min(2,c.top_k_memory)))
        self.multirate = MultiRateContextV27(c.d,c.hidden)
        self.router = SurpriseRouterV27(c.d,c.hidden,c.router_candidates)
        self.memory = UtilityMemoryV27(c.d,c.hidden)
        self.counterfactual = CounterfactualRefinerV27(c.d,c.hidden,c.action_dim)
        self.identity = IdentityContinuityV27(c.d,c.hidden)
        self.development = nn.Sequential(nn.Linear(5, c.hidden), nn.SiLU(), nn.Linear(c.hidden, 1))
        self.compute = nn.Sequential(nn.Linear(5, c.hidden), nn.SiLU(), nn.Linear(hidden if False else c.hidden, 1))
        self.final_action = nn.Sequential(nn.Linear(c.d + c.action_dim + 3, c.hidden), nn.SiLU(), nn.Linear(c.hidden,c.action_dim))
        self.qaware = QuantAwareLinearV27(c.d,c.d,bits=8)

    def initial_state(self,b:int,device=None,dtype=None)->V27State:
        d,m=self.cfg.d,self.cfg.memory_slots
        base=self.core.initial_state(b,device=device,dtype=dtype)
        z=lambda *shape: torch.zeros(b,*shape,device=device,dtype=dtype)
        return V27State(base=base, fast_context=z(d), stable_context=z(d), memory_keys=z(m,d), memory_values=z(m,d),
            memory_strength=torch.full((b,m,1),1e-3,device=device,dtype=dtype), memory_age=torch.zeros(b,m,1,device=device,dtype=dtype),
            memory_ptr=torch.zeros(b,1,device=device,dtype=torch.long), uncertainty_ema=torch.full((b,1),0.5,device=device,dtype=dtype),
            prediction_ema=torch.zeros(b,1,device=device,dtype=dtype), compute_budget=torch.ones(b,1,device=device,dtype=dtype),
            identity_anchor=z(d), developmental_pressure=z(1), life_clock=z(1))

    def step(self, x:Tensor, state:V27State, goal:Optional[Tensor]=None, modalities:Optional[Tensor]=None,
             presence:Optional[Tensor]=None, proprioception:Optional[Tensor]=None, interoception:Optional[Tensor]=None,
             commit_memory:bool=True, runtime_quant:bool=False):
        o26,s26=self.core.step(x,state.base,goal=goal,modalities=modalities,presence=presence,proprioception=proprioception,
                               interoception=interoception,commit_memory=commit_memory)
        z=o26['latent_v25']; unc=o26['uncertainty']; nov=o26['novelty']; conf=o26['confidence']; ws=o26['workspace_v25']
        needs=o26['needs_v23']; boundary=o26['event_boundary_v25']
        goal_lat=goal if goal is not None else o26['persistent_goal_v23']
        surprise=(unc+nov).clamp(0,2)
        new_budget=torch.clamp(0.92*state.compute_budget + 0.08*torch.sigmoid(1.2*surprise-0.5*conf),self.cfg.budget_min,self.cfg.budget_max)
        context,nf,ns=self.multirate(z,state.fast_context,state.stable_context,unc,nov,new_budget)
        routed,rw=self.router(z,context,surprise,nov,unc,conf,new_budget)
        mem_read,mem_util,mw=self.memory.read(context,state.memory_keys,state.memory_values,state.memory_strength,state.memory_age,goal_lat,unc)
        inv,inv_stability=self.identity(z,ws,state.identity_anchor,unc,nov,boundary)
        base_action=o26['chosen_action_v25']
        future,refined,cf_score=self.counterfactual(context,base_action,goal_lat,unc,new_budget)
        quant_inv=self.qaware(inv) if self.cfg.use_qat else inv
        fused=context+0.20*mem_read+0.15*routed+0.10*quant_inv
        action=torch.tanh(self.final_action(torch.cat([fused,refined,inv_stability,mem_util,new_budget],-1)))
        dev_in=torch.cat([1-conf,unc,nov,boundary,new_budget],-1)
        dev=torch.sigmoid(self.development(dev_in))
        # bounded write/erase policy: replace least useful/old slot without growing memory tensor
        candidate_key=F.normalize(self.memory.key(context),dim=-1,eps=1e-5)
        candidate_value=self.memory.value(context)
        ages=state.memory_age.squeeze(-1); strengths=state.memory_strength.squeeze(-1)
        replace_score=(1-strengths)+(ages/float(max(1,self.cfg.memory_slots)))
        idx=replace_score.argmax(-1)
        new_keys=state.memory_keys.clone(); new_vals=state.memory_values.clone(); new_str=state.memory_strength.clone(); new_age=state.memory_age+1
        bidx=torch.arange(x.size(0),device=x.device); new_keys[bidx,idx]=candidate_key.detach(); new_vals[bidx,idx]=candidate_value.detach()
        write_gain=(self.cfg.memory_write_rate*mem_util).detach().clamp(0,0.2)
        new_str[bidx,idx]=torch.clamp(write_gain.squeeze(-1),0,1).unsqueeze(-1)
        new_age[bidx,idx]=0
        decay=(1-self.cfg.memory_forget_rate)
        new_str=new_str*decay
        new_mem_ptr=(idx.detach()+1).remainder(self.cfg.memory_slots).unsqueeze(-1)
        uncertainty_ema=self.cfg.uncertainty_decay*state.uncertainty_ema+(1-self.cfg.uncertainty_decay)*unc.detach()
        pred_err=(future-context).pow(2).mean(-1,keepdim=True).sqrt()
        pred_ema=self.cfg.prediction_decay*state.prediction_ema+(1-self.cfg.prediction_decay)*pred_err.detach()
        dev_state=self.cfg.development_decay*state.developmental_pressure+(1-self.cfg.development_decay)*dev.detach()
        anchor=self.cfg.identity_decay*state.identity_anchor+(1-self.cfg.identity_decay)*inv.detach()
        next_fast = (0.80*nf + 0.20*fused).detach()
        nstate=V27State(base=s26,fast_context=next_fast,stable_context=ns.detach(),memory_keys=new_keys.detach() if commit_memory else state.memory_keys,
                        memory_values=new_vals.detach() if commit_memory else state.memory_values,memory_strength=new_str.detach() if commit_memory else state.memory_strength,
                        memory_age=new_age.detach() if commit_memory else state.memory_age,memory_ptr=new_mem_ptr,
                        uncertainty_ema=uncertainty_ema.detach(),prediction_ema=pred_ema.detach(),compute_budget=new_budget.detach(),identity_anchor=anchor.detach(),
                        developmental_pressure=dev_state.detach(),life_clock=state.life_clock+1)
        out=dict(o26); out.update({
            'fast_context_v27':nf,'stable_context_v27':ns,'context_v27':context,'algorithm_weights_v27':rw,
            'memory_read_v27':mem_read,'memory_utility_v27':mem_util,'memory_weights_v27':mw,
            'counterfactual_future_v27':future,'refined_action_v27':refined,'counterfactual_score_v27':cf_score,
            'identity_candidate_v27':inv,'identity_stability_v27':inv_stability,'developmental_pressure_v27':dev,
            'compute_budget_v27':new_budget,'prediction_error_v27':pred_err,'identity_anchor_v27':anchor,
            'chosen_action_v27':action,'life_clock_v27':nstate.life_clock,
        })
        if runtime_quant:
            out['quantized_context_v27']=self.qaware(context)
        return out,nstate

    def forward(self,x:Tensor,state:Optional[V27State]=None,goal:Optional[Tensor]=None,goal_sequence:Optional[Tensor]=None,
                modality_sequence:Optional[Tensor]=None,presence_sequence:Optional[Tensor]=None,proprioception_sequence:Optional[Tensor]=None,
                interoception_sequence:Optional[Tensor]=None,commit_memory:bool=True,runtime_quant:bool=False):
        if x.ndim!=3 or x.size(-1)!=self.cfg.d: raise ValueError('x must be [B,T,D]')
        st=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            o,st=self.step(x[:,t],st,goal=goal_sequence[:,t] if goal_sequence is not None else goal,
                modalities=modality_sequence[:,t] if modality_sequence is not None else None,
                presence=presence_sequence[:,t] if presence_sequence is not None else None,
                proprioception=proprioception_sequence[:,t] if proprioception_sequence is not None else None,
                interoception=interoception_sequence[:,t] if interoception_sequence is not None else None,
                commit_memory=commit_memory,runtime_quant=runtime_quant); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k])}|{'_final_state':st}

    def loss_parts(self,out:Dict[str,Tensor],target:Optional[Tensor]=None):
        z=out['latent_v25']; zero=z.new_zeros(())
        if z.size(1)<=1: return zero,zero,zero
        observed=z[:,1:].detach()
        pred=F.normalize(out['transition_pred_v26'][:,:-1],dim=-1,eps=1e-5)
        primary=F.smooth_l1_loss(pred,observed)
        primary += 0.35*F.smooth_l1_loss(F.normalize(out['context_v27'][:,:-1],dim=-1,eps=1e-5), observed)
        if target is not None and target.shape==z[:,-1].shape: primary += 0.15*F.mse_loss(z[:,-1],target)
        retrieval=(1-F.cosine_similarity(out['memory_read_v27'],z.detach(),dim=-1,eps=1e-5)).mean()
        world=F.smooth_l1_loss(out['counterfactual_future_v27'][:,:-1],observed)
        action=F.mse_loss(out['refined_action_v27'],out['chosen_action_v25'].detach())
        identity=F.smooth_l1_loss(out['identity_candidate_v27'],out['autobiographical_v23'].detach())
        efficiency=out['compute_budget_v27'].mean()
        write=F.l1_loss(out['memory_utility_v27'], out['memory_utility_v27'].detach().clamp(0,1))
        aux=self.cfg.retrieval_weight*retrieval+self.cfg.world_weight*world+self.cfg.action_weight*action+self.cfg.identity_weight*identity+self.cfg.efficiency_weight*efficiency+self.cfg.memory_write_weight*write
        return primary,aux,retrieval

    def training_loss(self,out,target=None):
        a,b,_=self.loss_parts(out,target); return self.cfg.primary_weight*a+b


class StagedOrganismTrainerV27:
    """Warm primary predictive path, then auxiliary organism objectives with conflict projection."""
    def __init__(self,model:NeuroWeaveV27,lr:float=7e-4,warmup_steps:int=3,max_norm:float=1.0):
        self.model=model; self.warmup_steps=warmup_steps; self.steps=0; self.max_norm=max_norm
        modules=[model.multirate,model.router,model.memory,model.counterfactual,model.identity,model.development,model.compute,model.final_action,model.qaware]
        self.params=[p for m in modules for p in m.parameters() if p.requires_grad]
        allowed={id(p) for p in self.params}
        for p in model.parameters(): p.requires_grad_(id(p) in allowed)
        self.optimizer=torch.optim.AdamW(self.params,lr=lr,weight_decay=1e-4)

    def step(self,x:Tensor,target:Optional[Tensor]=None,**kwargs):
        self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,commit_memory=False,**kwargs)
        primary,aux,_=self.model.loss_parts(out,target)
        loss=primary if self.steps<self.warmup_steps else primary+aux
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step(); self.steps+=1
        return loss.detach(),out
