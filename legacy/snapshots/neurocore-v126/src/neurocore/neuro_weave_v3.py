from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .gated_delta import GatedDeltaCell
from .trace_memory import DifferentiableTraceMemory
from .associative_bank import AssociativeBank
from .model import SparseExpertBank

@dataclass
class NeuroWeaveV3State:
    fast: Tensor
    slow: Tensor
    context: Tensor
    trace: Tensor
    prev: Tensor
    step: Tensor

@dataclass
class NeuroWeaveV3Output:
    latent: Tensor
    fast: Tensor
    slow: Tensor
    context: Tensor
    memory: Tensor
    prediction: Tensor
    prediction_error: Tensor
    uncertainty: Tensor
    novelty: Tensor
    consolidation: Tensor
    plasticity: Tensor
    route: Tensor
    deep_probability: Tensor
    action_latent: Tensor
    self_prediction: Tensor

class NeuroModulator(nn.Module):
    """Learned state of urgency/uncertainty/novelty/stability.

    It is not a hand-coded emotion layer: all signals are differentiable,
    bounded and fed back into memory, routing and plasticity.
    """
    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d * 3, d), nn.SiLU(), nn.Linear(d, 4))
    def forward(self, fast: Tensor, slow: Tensor, error: Tensor):
        q = torch.sigmoid(self.net(torch.cat([fast, slow, error], -1)))
        return q[:, 0:1], q[:, 1:2], q[:, 2:3], q[:, 3:4]

class SlowPlasticCell(nn.Module):
    """Low-bandwidth plastic state driven by context and evidence.

    The key research constraint is explicit separation of candidate update and
    committed update. A separate gate decides whether accumulated evidence is
    sufficient to alter slow state.
    """
    def __init__(self, d: int):
        super().__init__()
        self.cand = nn.Sequential(nn.Linear(d * 2, d), nn.SiLU(), nn.Linear(d, d), nn.Tanh())
        self.write = nn.Sequential(nn.Linear(d * 3, d), nn.SiLU(), nn.Linear(d, d), nn.Sigmoid())
        self.norm = nn.LayerNorm(d)
    def forward(self, fast: Tensor, slow: Tensor, context: Tensor):
        candidate = self.cand(torch.cat([fast, context], -1))
        gate = self.write(torch.cat([fast, slow, context], -1))
        committed = self.norm(slow + gate * (candidate - slow))
        return committed, candidate, gate

class MemoryConditionedRouter(nn.Module):
    """Routes based on present state *and retrieved memory*, not just input."""
    def __init__(self, d: int, n_experts: int):
        super().__init__()
        self.mod_proj = nn.Linear(4, d)
        self.gate = nn.Sequential(nn.Linear(d * 4, d), nn.SiLU(), nn.Linear(d, n_experts + 2))
        self.n_experts = n_experts
    def forward(self, z: Tensor, mem: Tensor, mod: Tensor):
        mod = self.mod_proj(mod)
        logits = self.gate(torch.cat([z, mem, mod, z * mem], -1))
        expert_logits = logits[:, :self.n_experts]
        control = torch.sigmoid(logits[:, self.n_experts:])
        return expert_logits, control[:, 0:1], control[:, 1:2]

class HierarchicalLatentWorldModel(nn.Module):
    """Two-timescale action-conditioned latent transition model.

    Fast transition predicts immediate state; slow transition predicts a
    temporally abstract context. The module can be trained without pixels.
    """
    def __init__(self, d: int, action_dim: int | None = None):
        super().__init__()
        a = action_dim or d
        self.fast = nn.Sequential(nn.Linear(d * 2 + a, d), nn.SiLU(), nn.Linear(d, d))
        self.slow = nn.GRUCell(d + a, d)
        self.reward = nn.Sequential(nn.Linear(d * 2 + a, d), nn.SiLU(), nn.Linear(d, 1))
        self.risk = nn.Sequential(nn.Linear(d * 2 + a, d), nn.SiLU(), nn.Linear(d, 1))
    def step(self, z: Tensor, context: Tensor, action: Tensor):
        h = self.fast(torch.cat([z, context, action], -1))
        slow = self.slow(torch.cat([z, action], -1), context)
        reward = self.reward(torch.cat([z, h, action], -1))
        risk = F.softplus(self.risk(torch.cat([z, h, action], -1)))
        return h, slow, reward, risk

class SelfDynamicsPredictor(nn.Module):
    """Predicts own next latent and calibrated confidence."""
    def __init__(self, d: int):
        super().__init__()
        self.delta = nn.Sequential(nn.Linear(d * 2, d), nn.SiLU(), nn.Linear(d, d))
        self.conf = nn.Sequential(nn.Linear(d * 2, d // 2 if d > 2 else 1), nn.SiLU(), nn.Linear(d // 2 if d > 2 else 1, 1))
    def forward(self, z: Tensor, self_state: Tensor):
        x = torch.cat([z, self_state], -1)
        return self.delta(x), torch.sigmoid(self.conf(x))

class ActionLatent(nn.Module):
    """Continuous action proposal head; environment-specific decoders stay outside."""
    def __init__(self, d: int, action_dim: int | None = None):
        super().__init__()
        a = action_dim or d
        self.mu = nn.Linear(d, a)
        self.scale = nn.Sequential(nn.Linear(d, a), nn.Softplus())
    def forward(self, z: Tensor):
        return self.mu(z), self.scale(z) + 1e-4

class NeuroWeaveV3(nn.Module):
    """NeuroWeave V3 / NeuroCore Frontier 0.9 research candidate.

    Research hypothesis: useful neural continuity emerges when prediction
    error is treated as a shared budget for state correction, memory write,
    routing and plasticity rather than as an isolated auxiliary loss.
    """
    def __init__(self, d_model=64, fast_state=96, slow_state=96, memory_capacity=256, n_experts=4, action_dim=None):
        super().__init__()
        self.d_model=d_model; self.action_dim=action_dim or d_model
        self.encoder = nn.Sequential(nn.Linear(d_model,d_model), nn.SiLU(), nn.LayerNorm(d_model))
        self.fast_cell = GatedDeltaCell(d_model, fast_state)
        self.fast_to_latent = nn.Linear(fast_state, d_model)
        self.slow_cell = SlowPlasticCell(d_model)
        self.context = nn.GRUCell(d_model, d_model)
        self.memory = AssociativeBank(d_model, memory_capacity)
        self.trace = DifferentiableTraceMemory(d_model, slots=max(32, min(96, memory_capacity//2)))
        self.modulator = NeuroModulator(d_model)
        self.router = MemoryConditionedRouter(d_model, n_experts)
        self.experts = SparseExpertBank(d_model, n_experts=n_experts, top_k=1)
        self.world = HierarchicalLatentWorldModel(d_model, self.action_dim)
        self.self_model = SelfDynamicsPredictor(d_model)
        self.action = ActionLatent(d_model, self.action_dim)
        self.fuse = nn.Sequential(nn.Linear(d_model*4, d_model*2), nn.SiLU(), nn.Linear(d_model*2,d_model), nn.LayerNorm(d_model))
        self.prediction = nn.Linear(d_model, d_model)
        self.context_decay = nn.Parameter(torch.tensor(0.90))

    def initial_state(self,batch,device=None,dtype=None):
        fast=self.fast_cell.initial_state(batch,device=device,dtype=dtype)
        slow=torch.zeros(batch,self.d_model,device=device,dtype=dtype)
        context=torch.zeros(batch,self.d_model,device=device,dtype=dtype)
        trace=self.trace.initial_state(batch,device=device,dtype=dtype)
        prev=torch.zeros(batch,self.d_model,device=device,dtype=dtype)
        step=torch.zeros(batch,1,device=device,dtype=dtype)
        return NeuroWeaveV3State(fast,slow,context,trace,prev,step)

    def step(self,x:Tensor,state:NeuroWeaveV3State,action:Tensor|None=None):
        e=self.encoder(x)
        fast_latent, fast = self.fast_cell(e,state.fast)
        fast_latent=self.fast_to_latent(fast)
        provisional_context=self.context(fast_latent,state.context)
        # Predict before committing slow state: this ordering is a core invariant.
        prior_pred=self.prediction(state.prev)
        err=e-prior_pred
        error_mag=err.pow(2).mean(-1,keepdim=True).sqrt()
        novelty=(1-F.cosine_similarity(e,state.prev,dim=-1).unsqueeze(-1)).clamp(0,2)
        uncertainty=torch.sigmoid(error_mag.detach())
        arousal,learn_rate,novelty_gate,stability=self.modulator(fast_latent,state.slow,err)
        evidence=(0.35*error_mag.sigmoid()+0.25*novelty.clamp(0,1)+0.25*uncertainty+0.15*stability)
        commit_strength=torch.sigmoid(4*(evidence-0.55))*learn_rate
        slow_candidate, slow_raw, slow_gate=self.slow_cell(fast_latent,state.slow,provisional_context)
        slow=state.slow + commit_strength*(slow_candidate-state.slow)
        slow=torch.tanh(slow)
        z0=self.fuse(torch.cat([fast_latent,slow,provisional_context,err.tanh()],-1))
        trace_read,trace_state=self.trace.step(z0,state.trace)
        ext,_=self.memory.retrieve(z0)
        mem=0.5*trace_read+0.5*ext
        mod=torch.cat([arousal,learn_rate,novelty_gate,stability],-1)
        expert_logits,deep_probability,plasticity_route=self.router(z0,mem,mod)
        expert,expert_idx=self.experts(z0,uncertainty,novelty,error_mag.detach())
        action_mu,action_scale=self.action(z0)
        if action is None:
            action=action_mu
        world_fast,world_slow,reward,risk=self.world.step(z0,provisional_context,action)
        self_pred, self_conf=self.self_model(z0,state.prev)
        route=F.softmax(expert_logits,dim=-1)
        # Error allocation: high novelty can increase plasticity, but stability resists drift.
        plasticity=(plasticity_route*(0.4+0.6*learn_rate)*(0.5+0.5*novelty_gate)*(0.5+0.5*stability)).clamp(0,1)
        deep_probability=deep_probability.clamp(0,1)
        z=self.fuse(torch.cat([z0,mem,expert,world_fast],-1))
        pred=self.prediction(z)
        new_state=NeuroWeaveV3State(fast,slow,provisional_context,trace_state,z.detach(),state.step+1)
        out=NeuroWeaveV3Output(z,fast_latent,slow,provisional_context,mem,pred,error_mag,uncertainty,novelty,commit_strength,plasticity,route,deep_probability,action_mu,self_pred)
        aux={"reward":reward,"risk":risk,"self_confidence":self_conf,"action_scale":action_scale,"expert_index":expert_idx,"slow_gate":slow_gate,"arousal":arousal,"learning_rate":learn_rate}
        return out,new_state,aux

    def forward(self,x:Tensor,state=None,actions=None,update_memory=False):
        if x.ndim!=3 or x.size(-1)!=self.d_model: raise ValueError('x must be [B,T,D]')
        b,t,_=x.shape; state=self.initial_state(b,x.device,x.dtype) if state is None else state
        outs=[]; auxs=[]
        for i in range(t):
            a=None if actions is None else actions[:,i]
            o,state,aux=self.step(x[:,i],state,a)
            if update_memory and not self.training:
                gate=o.consolidation.mean().detach()
                if float(gate)>=0.20:
                    with torch.no_grad(): self.memory.write(o.latent.detach(),min_novelty=0.02)
            outs.append(o); auxs.append(aux)
        stacked={name:torch.stack([getattr(o,name) for o in outs],1) for name in NeuroWeaveV3Output.__dataclass_fields__}
        return NeuroWeaveV3Output(**stacked),state,auxs
