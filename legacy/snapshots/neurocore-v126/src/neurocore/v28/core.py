from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v27 import NeuroWeaveV27, V27Config, V27State


def _safe_norm(x: Tensor, dim: int = -1) -> Tensor:
    return F.normalize(x, dim=dim, eps=1e-5)


@dataclass
class V28Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    modalities: int = 3
    proprio_dim: int = 4
    intero_dim: int = 4
    working_slots: int = 8
    episodic_slots: int = 24
    semantic_slots: int = 12
    event_slots: int = 16
    chunk_horizon: int = 4
    top_k: int = 2
    sleep_mix: float = 0.25
    consolidation_rate: float = 0.05
    utility_decay: float = 0.995
    sleep_interval: int = 16
    primary_weight: float = 1.0
    future_weight: float = 0.15
    chunk_weight: float = 0.10
    event_weight: float = 0.08
    semantic_weight: float = 0.06
    identity_weight: float = 0.06
    compute_weight: float = 0.04
    mobile_variant: bool = True


class HierarchicalMemoryV28(nn.Module):
    """Working + episodic + semantic hierarchy with bounded consolidation signals."""
    def __init__(self, d: int, hidden: int, episodic_slots: int, semantic_slots: int):
        super().__init__()
        self.key = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.value = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.summary = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.utility = nn.Sequential(nn.Linear(3*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.semantic_gate = nn.Sequential(nn.Linear(2*d + 1, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.episodic_slots = episodic_slots
        self.semantic_slots = semantic_slots

    def read(self, q: Tensor, e_keys: Tensor, e_vals: Tensor, e_strength: Tensor,
             s_keys: Tensor, s_vals: Tensor, goal: Tensor, uncertainty: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        qk = _safe_norm(self.key(q))
        ek = _safe_norm(e_keys)
        sk = _safe_norm(s_keys)
        ew = F.softmax(torch.einsum('bd,bmd->bm', qk, ek) + torch.log(e_strength.squeeze(-1).clamp_min(1e-4)), -1)
        sw = F.softmax(torch.einsum('bd,bmd->bm', qk, sk), -1)
        etop = min(4, ew.size(-1)); stop = min(3, sw.size(-1))
        ev, ei = torch.topk(ew, etop, dim=-1); sv, si = torch.topk(sw, stop, dim=-1)
        er = torch.gather(e_vals, 1, ei.unsqueeze(-1).expand(-1, -1, e_vals.size(-1)))
        sr = torch.gather(s_vals, 1, si.unsqueeze(-1).expand(-1, -1, s_vals.size(-1)))
        episodic = (er * ev.unsqueeze(-1)).sum(1)
        semantic = (sr * sv.unsqueeze(-1)).sum(1)
        gate = torch.sigmoid(self.semantic_gate(torch.cat([q, semantic, uncertainty], -1)))
        read = (1.0-gate) * episodic + gate * semantic
        util = torch.sigmoid(self.utility(torch.cat([q, read, goal, uncertainty, gate], -1)))
        return read, util, gate

    @torch.no_grad()
    def consolidate(self, e_keys: Tensor, e_vals: Tensor, e_strength: Tensor,
                     s_keys: Tensor, s_vals: Tensor, s_strength: Tensor, rate: float = 0.05):
        # Return fresh tensors: consolidation is state transition, never in-place mutation of live tensors.
        score = e_strength.squeeze(-1)
        top = min(s_keys.size(1), e_keys.size(1))
        vals, idx = torch.topk(score, top, dim=-1)
        k = torch.gather(e_keys, 1, idx.unsqueeze(-1).expand(-1, -1, e_keys.size(-1)))
        v = torch.gather(e_vals, 1, idx.unsqueeze(-1).expand(-1, -1, e_vals.size(-1)))
        nk, nv, ns = s_keys.clone(), s_vals.clone(), s_strength.clone()
        nk[:, :top] = (1-rate) * nk[:, :top] + rate * k
        nv[:, :top] = (1-rate) * nv[:, :top] + rate * v
        ns[:, :top] = (1-rate) * ns[:, :top] + rate * vals.unsqueeze(-1)
        return nk, nv, ns


class EventGraphV28(nn.Module):
    """Compact event relation graph: event embeddings plus bounded transition relations."""
    def __init__(self, d: int, hidden: int, slots: int):
        super().__init__()
        self.event = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.rel = nn.Sequential(nn.Linear(2*d, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.slots = slots

    def encode(self, z: Tensor, prev_event: Tensor) -> Tuple[Tensor, Tensor]:
        ev = torch.tanh(self.event(z))
        rel = torch.sigmoid(self.rel(torch.cat([prev_event, ev], -1)))
        return ev, rel

    def retrieve_relation(self, query: Tensor, event_bank: Tensor, relation_bank: Tensor) -> Tensor:
        q = _safe_norm(query)
        k = _safe_norm(event_bank)
        weights = F.softmax(torch.einsum('bd,bmd->bm', q, k) * (0.5 + relation_bank.squeeze(-1)), -1)
        return torch.einsum('bm,bmd->bd', weights, event_bank)


class ActionChunkPlannerV28(nn.Module):
    """Predicts short action chunks and progress; chunk-level planning reduces repeated search calls."""
    def __init__(self, d: int, hidden: int, action_dim: int, horizon: int):
        super().__init__(); self.horizon=horizon; self.action_dim=action_dim
        self.trunk = nn.Sequential(nn.Linear(3*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.SiLU())
        self.action = nn.Linear(hidden, horizon*action_dim)
        self.progress = nn.Linear(hidden, horizon)
        self.value = nn.Linear(hidden, horizon)

    def forward(self, z: Tensor, goal: Tensor, memory: Tensor, uncertainty: Tensor, budget: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        h = self.trunk(torch.cat([z, goal, memory, uncertainty, budget], -1))
        actions = torch.tanh(self.action(h)).view(z.size(0), self.horizon, self.action_dim)
        progress = torch.sigmoid(self.progress(h)).view(z.size(0), self.horizon, 1)
        value = self.value(h).view(z.size(0), self.horizon, 1)
        return actions, progress, value


class AdaptivePrecisionV28(nn.Module):
    """Sensitivity-guided precision policy; runtime still uses regular tensors, export is separate."""
    def __init__(self, d: int, hidden: int):
        super().__init__(); self.head=nn.Sequential(nn.Linear(d+3,hidden),nn.SiLU(),nn.Linear(hidden,3))
    def forward(self, z: Tensor, uncertainty: Tensor, novelty: Tensor, budget: Tensor) -> Tensor:
        # 0=FP16, 1=INT8-like, 2=INT4-like target class; differentiable soft assignment.
        return F.softmax(self.head(torch.cat([z,uncertainty,novelty,budget],-1)), -1)


class SleepDreamV28(nn.Module):
    """Bounded dream generator: recombines retrieved context and predicts a synthetic next state."""
    def __init__(self, d: int, hidden: int):
        super().__init__(); self.net=nn.Sequential(nn.Linear(2*d+2,hidden),nn.SiLU(),nn.Linear(hidden,d))
    def forward(self, state: Tensor, memory: Tensor, novelty: Tensor, confidence: Tensor) -> Tensor:
        return torch.tanh(self.net(torch.cat([state,memory,novelty,confidence],-1)))


@dataclass
class V28State:
    base: V27State
    event_bank: Tensor           # [B,E,D]
    event_relation: Tensor       # [B,E,1]
    event_strength: Tensor       # [B,E,1]
    event_ptr: Tensor            # [B,1]
    semantic_keys: Tensor        # [B,S,D]
    semantic_values: Tensor      # [B,S,D]
    semantic_strength: Tensor    # [B,S,1]
    sleep_clock: Tensor          # [B,1]
    identity_trajectory: Tensor  # [B,D]


class NeuroWeaveV28(nn.Module):
    """V28: hierarchical lifelong organism layer over V27.

    Adds event-centric memory, semantic consolidation, chunked action planning,
    bounded dream replay and adaptive precision policy. New state is persistent and
    ablatable; V27 remains the stable substrate.
    """
    def __init__(self, cfg: Optional[V28Config]=None):
        super().__init__(); self.cfg=cfg or V28Config(); c=self.cfg
        self.base = NeuroWeaveV27(V27Config(d=c.d,hidden=c.hidden,action_dim=c.action_dim,modalities=c.modalities,
            proprio_dim=c.proprio_dim,intero_dim=c.intero_dim,memory_slots=c.working_slots,router_candidates=4,
            top_k_memory=c.top_k)).to(dtype=torch.float32)
        self.memory = HierarchicalMemoryV28(c.d,c.hidden,c.episodic_slots,c.semantic_slots)
        self.event_graph = EventGraphV28(c.d,c.hidden,c.event_slots)
        self.chunk_planner = ActionChunkPlannerV28(c.d,c.hidden,c.action_dim,c.chunk_horizon)
        self.precision = AdaptivePrecisionV28(c.d,c.hidden)
        self.dream = SleepDreamV28(c.d,c.hidden)
        self.identity_proj = nn.Sequential(nn.Linear(2*c.d,c.hidden),nn.SiLU(),nn.Linear(c.hidden,c.d))
        self.event_write = nn.Sequential(nn.Linear(2*c.d+3,c.hidden),nn.SiLU(),nn.Linear(hidden if False else c.hidden,1))

    def initial_state(self,b:int,device=None,dtype=None)->V28State:
        c=self.cfg; base=self.base.initial_state(b,device=device,dtype=dtype)
        def z(*shape): return torch.zeros(b,*shape,device=device,dtype=dtype)
        return V28State(base,z(c.event_slots,c.d),z(c.event_slots,1),z(c.event_slots,1),z(1),
                        z(c.semantic_slots,c.d),z(c.semantic_slots,c.d),torch.full((b,c.semantic_slots,1),1e-3,device=device,dtype=dtype),
                        z(1),z(c.d))

    def step(self,x:Tensor,state:V28State,goal:Optional[Tensor]=None,presence:Optional[Tensor]=None,
             modalities:Optional[Tensor]=None,proprioception:Optional[Tensor]=None,interoception:Optional[Tensor]=None,
             commit_memory:bool=True) -> Tuple[Dict[str,Tensor],V28State]:
        o27,s27=self.base.step(x,state.base,goal=goal,presence=presence,modalities=modalities,proprioception=proprioception,interoception=interoception,commit_memory=False)
        z=o27['context_v27']; goal_lat=goal if goal is not None else o27['persistent_goal_v23']
        unc=o27['uncertainty']; nov=o27['novelty']; conf=o27['confidence']; budget=o27['compute_budget_v27']
        prev_event=state.event_bank[:,0]
        ev, rel=self.event_graph.encode(z,prev_event)
        write_logit=self.event_write(torch.cat([z,ev,unc,nov,budget],-1))
        write=torch.sigmoid(write_logit)
        read,mem_util,sem_gate=self.memory.read(z,state.base.memory_keys,state.base.memory_values,state.base.memory_strength,
                                                  state.semantic_keys,state.semantic_values,goal_lat,unc)
        event_read=self.event_graph.retrieve_relation(z,state.event_bank,state.event_relation*state.event_strength)
        fused=z+0.16*read+0.10*event_read
        chunk_actions,progress,chunk_value=self.chunk_planner(fused,goal_lat,read,unc,budget)
        action=(0.55*chunk_actions[:,0]+0.45*o27['chosen_action_v27']).tanh()
        precision=self.precision(fused,unc,nov,budget)
        dream=self.dream(fused,read,nov,conf)
        identity=torch.tanh(self.identity_proj(torch.cat([o27['identity_anchor_v27'],fused],-1)))
        idx=state.event_ptr.squeeze(-1).long().clamp(0,self.cfg.event_slots-1)
        B=x.size(0); bi=torch.arange(B,device=x.device)
        eb=state.event_bank.clone(); er=state.event_relation.clone(); es=state.event_strength.clone(); ep=(idx+1).remainder(self.cfg.event_slots).unsqueeze(-1)
        eb[bi,idx]=ev.detach(); er[bi,idx]=rel.detach(); es[bi,idx]=write.detach();
        sk=state.semantic_keys; sv=state.semantic_values; ss=state.semantic_strength
        # Semantic memory is updated only during explicit commit/sleep boundary.
        sleep_clock=state.sleep_clock+1
        tra=0.998*state.identity_trajectory+0.002*identity.detach()
        sem_k, sem_v, sem_s = state.semantic_keys, state.semantic_values, state.semantic_strength
        do_sleep = bool(commit_memory and int(sleep_clock.max().item()) % max(1,self.cfg.sleep_interval) == 0)
        if do_sleep:
            sem_k, sem_v, sem_s = self.memory.consolidate(state.event_bank,state.event_bank,state.event_strength,sem_k,sem_v,sem_s,self.cfg.consolidation_rate)
        nstate=V28State(base=s27,event_bank=eb.detach() if commit_memory else state.event_bank,event_relation=er.detach() if commit_memory else state.event_relation,
                        event_strength=es.detach() if commit_memory else state.event_strength,event_ptr=ep,semantic_keys=sem_k.detach(),semantic_values=sem_v.detach(),semantic_strength=sem_s.detach(),
                        sleep_clock=sleep_clock,identity_trajectory=tra.detach())
        out=dict(o27); out.update({'event_embedding_v28':ev,'event_relation_v28':rel,'event_write_v28':write,'event_read_v28':event_read,
            'hier_memory_read_v28':read,'hier_memory_utility_v28':mem_util,'semantic_gate_v28':sem_gate,'fused_latent_v28':fused,
            'action_chunk_v28':chunk_actions,'chunk_progress_v28':progress,'chunk_value_v28':chunk_value,'chosen_action_v28':action,
            'precision_policy_v28':precision,'dream_state_v28':dream,'identity_trajectory_v28':identity})
        return out,nstate

    def forward(self,x:Tensor,state:Optional[V28State]=None,goal_sequence:Optional[Tensor]=None,presence_sequence:Optional[Tensor]=None,
                modality_sequence:Optional[Tensor]=None,proprioception_sequence:Optional[Tensor]=None,interoception_sequence:Optional[Tensor]=None,
                commit_memory:bool=True):
        if x.ndim!=3 or x.size(-1)!=self.cfg.d: raise ValueError('x must be [B,T,D]')
        st=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            o,st=self.step(x[:,t],st,
                goal=goal_sequence[:,t] if goal_sequence is not None else None,
                presence=presence_sequence[:,t] if presence_sequence is not None else None,
                modalities=modality_sequence[:,t] if modality_sequence is not None else None,
                proprioception=proprioception_sequence[:,t] if proprioception_sequence is not None else None,
                interoception=interoception_sequence[:,t] if interoception_sequence is not None else None,
                commit_memory=commit_memory); rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k])}|{'_final_state':st}

    def consolidate(self,state:V28State,rate:Optional[float]=None)->V28State:
        r=self.cfg.consolidation_rate if rate is None else float(rate)
        sk,sv,ss=self.memory.consolidate(state.event_bank,state.event_bank,state.event_strength,state.semantic_keys,state.semantic_values,state.semantic_strength,r)
        return V28State(base=state.base,event_bank=state.event_bank,event_relation=state.event_relation,event_strength=state.event_strength,event_ptr=state.event_ptr,semantic_keys=sk,semantic_values=sv,semantic_strength=ss,sleep_clock=state.sleep_clock,identity_trajectory=state.identity_trajectory)

    def loss_parts(self,out:Dict[str,Tensor],target:Optional[Tensor]=None):
        z=out['fused_latent_v28']; zero=z.new_zeros(())
        if z.size(1)<=1: return zero,zero,zero
        observed=z[:,1:].detach()
        primary=F.smooth_l1_loss(out['dream_state_v28'][:,:-1],observed)
        future=F.smooth_l1_loss(out['dream_state_v28'][:,:-1],observed)
        event=1-F.cosine_similarity(out['event_read_v28'],z.detach(),dim=-1,eps=1e-5).mean()
        sem=out['semantic_gate_v28'].mean()*0.0 + (1-out['semantic_gate_v28']).mean()*0.01
        chunk=F.smooth_l1_loss(out['action_chunk_v28'][:,:,0],out['chosen_action_v27'].detach())
        identity=F.smooth_l1_loss(out['identity_trajectory_v28'],out['identity_anchor_v27'].detach())
        compute=out['precision_policy_v28'][...,2].mean()
        aux=self.cfg.future_weight*future+self.cfg.event_weight*event+self.cfg.semantic_weight*sem+self.cfg.chunk_weight*chunk+self.cfg.identity_weight*identity+self.cfg.compute_weight*compute
        if target is not None and target.ndim == 2 and target.shape == z[:,-1].shape: primary=primary+0.1*F.mse_loss(z[:,-1],target)
        return primary,aux,event

    def training_loss(self,out,target=None):
        a,b,_=self.loss_parts(out,target); return self.cfg.primary_weight*a+b


class StagedOrganismTrainerV28:
    """Primary-first training with auxiliary unlock and gradient-safety checks."""
    def __init__(self,model:NeuroWeaveV28,lr:float=7e-4,warmup_steps:int=3,max_norm:float=1.0):
        self.model=model; self.warmup_steps=warmup_steps; self.steps=0; self.max_norm=max_norm
        modules=[model.memory,model.event_graph,model.chunk_planner,model.precision,model.dream,model.identity_proj,model.event_write]
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
