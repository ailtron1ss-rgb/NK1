from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Tuple, Dict

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v21 import NeuroWeaveV21, V21Config, V21State


@dataclass
class V22State:
    base: V21State
    identity_fast: Tensor
    identity_slow: Tensor
    homeostasis: Tensor
    need_state: Tensor
    memory_trace: Tensor
    memory_value: Tensor
    subgoal: Tensor
    episode_return: Tensor
    sleep_score: Tensor
    life_step: Tensor


@dataclass
class V22Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    modalities: int = 3
    modality_gain: float = 0.40
    identity_fast_decay: float = 0.90
    identity_slow_decay: float = 0.985
    trace_decay: float = 0.82
    homeo_decay: float = 0.96
    sleep_threshold: float = 0.72
    consolidation_rate: float = 0.05
    memory_write_threshold: float = 0.18
    utility_weight: float = 0.22
    identity_weight: float = 0.12
    homeostasis_weight: float = 0.08
    agency_weight: float = 0.12
    free_energy_weight: float = 0.06
    counterfactual_weight: float = 0.05
    mobile_cap: float = 0.25


class MultimodalBinderV22(nn.Module):
    """Compact shared-latent binder for optional modalities.

    modalities: [B,M,D]. Each modality receives a small projection, then a learned
    reliability gate. Missing modalities are represented by an explicit presence mask.
    """
    def __init__(self, d: int, hidden: int, modalities: int):
        super().__init__()
        self.modalities = modalities
        self.base = nn.Linear(d, d)
        self.proj = nn.ModuleList([nn.Linear(d, d) for _ in range(modalities)])
        self.gate = nn.Sequential(nn.Linear(modalities * d + modalities, hidden), nn.SiLU(), nn.Linear(hidden, modalities))
        self.fuse = nn.Sequential(nn.Linear(2 * d, hidden), nn.SiLU(), nn.Linear(hidden, d))

    def forward(self, x: Tensor, modalities: Optional[Tensor] = None, presence: Optional[Tensor] = None) -> Tuple[Tensor, Tensor]:
        b, d = x.shape
        x0 = x + 0.10 * torch.tanh(self.base(x))
        if modalities is None:
            return x0, x.new_zeros(b, self.modalities)
        if modalities.ndim != 3 or modalities.shape[0] != b or modalities.shape[-1] != d:
            raise ValueError("modalities must be [B,M,D]")
        m = modalities.size(1)
        if m > self.modalities:
            raise ValueError("too many modalities for configured binder")
        if presence is None:
            presence = torch.ones(b, m, device=x.device, dtype=x.dtype)
        if presence.shape != (b, m):
            raise ValueError("presence must be [B,M]")
        feats = []
        for i in range(self.modalities):
            if i < m:
                feats.append(self.proj[i](modalities[:, i]))
            else:
                feats.append(torch.zeros_like(x))
        packed = torch.cat(feats + [F.pad(presence, (0, self.modalities-m))], -1)
        gates = torch.sigmoid(self.gate(packed)) * F.pad(presence, (0, self.modalities-m))
        denom = gates.sum(-1, keepdim=True).clamp_min(1.0)
        fused = sum(gates[:, i:i+1] * feats[i] for i in range(self.modalities)) / denom
        out = x0 + 0.5 * torch.tanh(self.fuse(torch.cat([x0, fused], -1)))
        return out, gates


class FutureMemoryUtilityV22(nn.Module):
    """Predicts future utility of retaining a representation instead of only novelty."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(2 * d + 6, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, trace: Tensor, next_pred_error: Tensor, novelty: Tensor,
                uncertainty: Tensor, confidence: Tensor, energy: Tensor, age: Tensor) -> Tensor:
        raw = self.net(torch.cat([z, trace, next_pred_error, novelty, uncertainty, confidence, energy, age], -1))
        return torch.sigmoid(raw)


class IdentityDynamicsV22(nn.Module):
    """Slow/fast self-consistency substrate; targets are observable state statistics."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.update = nn.Sequential(nn.Linear(3 * d + 9, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.capability = nn.Sequential(nn.Linear(2 * d + 9, hidden), nn.SiLU(), nn.Linear(hidden, 4))

    def forward(self, z: Tensor, fast: Tensor, slow: Tensor, homeo: Tensor, needs: Tensor, regime: Tensor) -> Tuple[Tensor, Tensor]:
        cand = torch.tanh(self.update(torch.cat([z, fast, slow, homeo, needs, regime], -1)))
        cap = torch.sigmoid(self.capability(torch.cat([z, slow, homeo, needs, regime], -1)))
        return cand, cap


class HomeostaticControllerV22(nn.Module):
    """Maps internal resources to an adaptive compute/learning budget."""
    def __init__(self, hidden: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(6, hidden), nn.SiLU(), nn.Linear(hidden, 5))

    def forward(self, energy: Tensor, thermal: Tensor, uncertainty: Tensor, novelty: Tensor,
                confidence: Tensor, regime: Tensor) -> Tuple[Tensor, Tensor]:
        h = torch.cat([energy, thermal, uncertainty, novelty, confidence, regime], -1)
        raw = self.net(h)
        need = torch.sigmoid(raw[:, :4])
        budget = torch.sigmoid(raw[:, 4:5])
        return need, budget


class HierarchicalSubgoalV22(nn.Module):
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(3 * d + 2, hidden), nn.SiLU(), nn.Linear(hidden, d))

    def forward(self, z: Tensor, slow: Tensor, goal: Tensor, uncertainty: Tensor, regime: Tensor) -> Tensor:
        return torch.tanh(self.net(torch.cat([z, slow, goal, uncertainty, regime], -1)))


class ActiveInferenceV22(nn.Module):
    """Experimental expected-free-energy proxy.

    This is a hypothesis-testing mechanism, not a claim that the system performs full Bayesian active inference.
    Lower score is preferred: risk + uncertainty - information gain - goal alignment.
    """
    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(2 * d + action_dim + 6, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, subgoal: Tensor, action: Tensor, uncertainty: Tensor,
                info_gain: Tensor, reward: Tensor, risk: Tensor, budget: Tensor) -> Tensor:
        goal_gap = (z - subgoal).norm(dim=-1, keepdim=True)
        return self.net(torch.cat([z, subgoal, action, uncertainty, info_gain, reward, risk, budget, goal_gap], -1))


class CausalInterventionV22(nn.Module):
    """Counterfactual probe: estimates utility delta under action and memory perturbation."""
    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + action_dim + 5, hidden), nn.SiLU(), nn.Linear(hidden, 2))

    def forward(self, z: Tensor, action: Tensor, actual_reward: Tensor, baseline_reward: Tensor,
                actual_risk: Tensor, baseline_risk: Tensor, utility: Tensor) -> Tensor:
        x = torch.cat([z, action, actual_reward, baseline_reward, actual_risk, baseline_risk, utility], -1)
        raw = self.net(x)
        return raw


class SleepConsolidatorV22(nn.Module):
    """Bounded offline-like consolidation executed only when a sleep score is high.

    No parameters are mutated here. Only persistent state is changed in step().
    """
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.score = nn.Sequential(nn.Linear(d + 8, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, slow_identity: Tensor, homeo: Tensor, needs: Tensor) -> Tensor:
        return torch.sigmoid(self.score(torch.cat([slow_identity, homeo, needs], -1)))


class NeuroWeaveV22(nn.Module):
    """Frontier MAX V22: canonical life-loop research substrate.

    V22 adds a bounded organism loop around V21:
      perception/binding -> homeostasis -> subgoal -> action -> world consequence ->
      counterfactual probe -> future-memory utility -> identity dynamics -> sleep/consolidation.

    Several components are experimental hypotheses and are explicitly measured, not treated as proof of consciousness.
    """
    def __init__(self, cfg: Optional[V22Config] = None):
        super().__init__()
        c = cfg or V22Config(); self.cfg = c
        self.core = NeuroWeaveV21(V21Config(
            d=c.d, hidden=c.hidden, action_dim=c.action_dim,
            memory_capacity=32, replay_capacity=16, max_experts=6, top_k=1,
            world_candidates=3, max_horizon=4, skill_slots=4, skill_rank=2,
        ))
        self.binder = MultimodalBinderV22(c.d, c.hidden, c.modalities)
        self.memory_utility = FutureMemoryUtilityV22(c.d, c.hidden)
        self.identity = IdentityDynamicsV22(c.d, c.hidden)
        self.homeostasis_head = HomeostaticControllerV22(c.hidden)
        self.subgoal_head = HierarchicalSubgoalV22(c.d, c.hidden)
        self.active_inference = ActiveInferenceV22(c.d, c.hidden, c.action_dim)
        self.causal_probe = CausalInterventionV22(c.d, c.hidden, c.action_dim)
        self.sleep = SleepConsolidatorV22(c.d, c.hidden)
        self.action_head = nn.Sequential(nn.Linear(3*c.d + 8, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.action_dim))

    def initial_state(self, b: int, device=None, dtype=None) -> V22State:
        base = self.core.initial_state(b, device=device, dtype=dtype)
        z = lambda: torch.zeros(b, self.cfg.d, device=device, dtype=dtype)
        return V22State(
            base=base,
            identity_fast=z(), identity_slow=z(),
            homeostasis=torch.full((b,4),0.5,device=device,dtype=dtype),
            need_state=torch.full((b,4),0.5,device=device,dtype=dtype),
            memory_trace=z(),
            memory_value=torch.zeros(b,1,device=device,dtype=dtype),
            subgoal=z(),
            episode_return=torch.zeros(b,1,device=device,dtype=dtype),
            sleep_score=torch.zeros(b,1,device=device,dtype=dtype),
            life_step=torch.zeros(b,1,device=device,dtype=dtype),
        )

    @torch.no_grad()
    def _state_consolidate(self, state: V22State, z: Tensor, identity_fast: Tensor,
                           sleep_score: Tensor, memory_value: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        rate = self.cfg.consolidation_rate * sleep_score.clamp(0,1)
        slow = (1-rate) * state.identity_slow + rate * identity_fast
        trace = (1-0.5*rate) * state.memory_trace + 0.5*rate * z
        value = (1-0.25*rate) * state.memory_value + 0.25*rate * memory_value
        return slow.detach(), trace.detach(), value.detach()

    def step(self, x: Tensor, state: V22State, goal: Optional[Tensor] = None,
             action: Optional[Tensor] = None, modalities: Optional[Tensor] = None,
             presence: Optional[Tensor] = None, commit_memory: bool = True):
        fused, modality_gates = self.binder(x, modalities, presence)
        if modalities is not None:
            pm = presence if presence is not None else torch.ones(x.size(0), modalities.size(1), device=x.device, dtype=x.dtype)
            denom = pm.sum(-1, keepdim=True).clamp_min(1.0)
            modality_mean = (modalities * pm.unsqueeze(-1)).sum(1) / denom
            binding_target = 0.5 * (x.detach() + modality_mean.detach())
        else:
            binding_target = x.detach()
        base_out, base_state = self.core.step(fused, state.base, goal=goal, action=action, commit_memory=commit_memory)
        z = base_out["latent_v21"]
        err = base_out["temporal_error"].to(z.dtype)
        unc = base_out["uncertainty"].to(z.dtype)
        nov = base_out["novelty"].to(z.dtype)
        conf = base_out["confidence"].to(z.dtype)
        energy = base_out["energy_v14"].to(z.dtype)
        thermal = base_out["thermal_v14"].to(z.dtype)
        regime = base_out["regime_v21"].to(z.dtype)
        need, budget = self.homeostasis_head(energy, thermal, unc, nov, conf, regime)
        homeo = self.cfg.homeo_decay * state.homeostasis + (1-self.cfg.homeo_decay) * torch.cat([
            energy, thermal, conf, (1-unc).clamp(0,1)
        ], -1)
        goal_used = goal if goal is not None else torch.zeros_like(z)
        subgoal = self.subgoal_head(z, state.identity_slow, goal_used, unc, regime)
        prior_action = base_out["chosen_action_v21"] if action is None else action
        policy_action = torch.tanh(self.action_head(torch.cat([z, subgoal, state.identity_slow, homeo, need], -1)))
        blend = (budget * conf).clamp(0,1)
        chosen = torch.tanh(prior_action + blend * 0.35 * (policy_action - prior_action)) if action is None else action

        actual_next, actual_reward, actual_risk, actual_unc = self.core.core.core.planner.transition(z, chosen)
        baseline = torch.zeros_like(chosen)
        base_next, base_reward, base_risk, base_unc = self.core.core.core.planner.transition(z, baseline)
        utility_actual = actual_reward - 0.5 * actual_risk
        utility_base = base_reward - 0.5 * base_risk
        cf_delta = utility_actual - utility_base
        info_gain = (unc - actual_unc).clamp(-1,1)
        free_energy = self.active_inference(z, subgoal, chosen, unc, info_gain, actual_reward, actual_risk, budget)
        causal = self.causal_probe(z, chosen, actual_reward, base_reward, actual_risk, base_risk, cf_delta)

        next_pred_error = (actual_next - z).norm(dim=-1, keepdim=True)
        age = state.life_step / (state.life_step + 8.0)
        memory_value_raw = self.memory_utility(z, state.memory_trace, next_pred_error, nov, unc, conf, energy, age)
        memory_value = memory_value_raw
        write = (memory_value > self.cfg.memory_write_threshold) & (conf < 0.95)
        trace = torch.where(write, 0.75 * state.memory_trace + 0.25 * z.detach(),
                           self.cfg.trace_decay * state.memory_trace + (1-self.cfg.trace_decay) * z.detach())

        identity_candidate, capability = self.identity(z, state.identity_fast, state.identity_slow, homeo, need, regime)
        identity_fast = self.cfg.identity_fast_decay * state.identity_fast + (1-self.cfg.identity_fast_decay) * identity_candidate
        sleep_score_raw = self.sleep(state.identity_slow, homeo, need)
        sleep_score = sleep_score_raw
        identity_slow, trace, memory_value = self._state_consolidate(state, z.detach(), identity_fast.detach(), sleep_score.detach(), memory_value.detach())

        # episode return is state, not a second reward truth store.
        episode_return = 0.98 * state.episode_return + actual_reward.detach()
        ns = V22State(
            base=base_state,
            identity_fast=identity_fast.detach(), identity_slow=identity_slow,
            homeostasis=homeo.detach(), need_state=need.detach(),
            memory_trace=trace, memory_value=memory_value.detach(),
            subgoal=subgoal.detach(), episode_return=episode_return,
            sleep_score=sleep_score.detach(), life_step=state.life_step + 1,
        )
        base_state.context = z.detach()
        out = dict(base_out)
        out.update({
            "latent_v22": z,
            "bound_input_v22": fused,
            "binding_target_v22": binding_target,
            "binding_consistency_v22": F.mse_loss(fused, binding_target, reduction="none").mean(-1, keepdim=True),
            "modality_gates_v22": modality_gates,
            "homeostasis_v22": homeo,
            "need_state_v22": need,
            "compute_budget_v22": budget,
            "subgoal_v22": subgoal,
            "policy_action_v22": policy_action,
            "chosen_action_v22": chosen,
            "actual_next_v22": actual_next,
            "baseline_next_v22": base_next,
            "actual_reward_v22": actual_reward,
            "baseline_reward_v22": base_reward,
            "actual_risk_v22": actual_risk,
            "baseline_risk_v22": base_risk,
            "actual_uncertainty_v22": actual_unc,
            "baseline_uncertainty_v22": base_unc,
            "counterfactual_delta_v22": cf_delta,
            "causal_probe_v22": causal,
            "information_gain_v22": info_gain,
            "active_free_energy_v22": free_energy,
            "memory_utility_v22": memory_value.detach(),
            "memory_utility_raw_v22": memory_value_raw,
            "memory_write_v22": write.to(z.dtype),
            "identity_fast_v22": identity_fast,
            "identity_slow_v22": identity_slow,
            "capability_v22": capability,
            "sleep_score_v22": sleep_score.detach(),
            "sleep_score_raw_v22": sleep_score_raw,
            "episode_return_v22": episode_return,
            "life_step_v22": ns.life_step,
        })
        return out, ns

    def forward(self, x: Tensor, state: Optional[V22State] = None, goal: Optional[Tensor] = None,
                goal_sequence: Optional[Tensor] = None, modality_sequence: Optional[Tensor] = None,
                presence_sequence: Optional[Tensor] = None, commit_memory: bool = True) -> Dict[str, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.cfg.d:
            raise ValueError("x must be [B,T,D]")
        if goal_sequence is not None and goal_sequence.shape[:2] != x.shape[:2]:
            raise ValueError("goal_sequence must match [B,T,*]")
        if modality_sequence is not None and (modality_sequence.ndim != 4 or modality_sequence.shape[:2] != x.shape[:2]):
            raise ValueError("modality_sequence must be [B,T,M,D]")
        if presence_sequence is not None and presence_sequence.shape[:2] != x.shape[:2]:
            raise ValueError("presence_sequence must match [B,T,*]")
        state = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows=[]
        for t in range(x.size(1)):
            g = goal_sequence[:,t] if goal_sequence is not None else goal
            m = modality_sequence[:,t] if modality_sequence is not None else None
            p = presence_sequence[:,t] if presence_sequence is not None else None
            o, state = self.step(x[:,t], state, goal=g, modalities=m, presence=p, commit_memory=commit_memory)
            rows.append(o)
        out={k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k])}
        out["_final_state"] = state
        return out

    def training_loss(self, out: Dict[str, Tensor], target: Optional[Tensor] = None) -> Tensor:
        z=out["latent_v22"]
        loss=z.new_zeros(())
        if z.size(1)>1:
            nxt=z[:,1:].detach()
            actual=out["actual_next_v22"][:,:-1]
            pred_loss=F.smooth_l1_loss(actual,nxt)
            cf=-out["counterfactual_delta_v22"].mean()
            id_cons=F.mse_loss(out["identity_fast_v22"][:,1:], out["identity_slow_v22"][:,1:].detach())
            homeo_target=torch.cat([
                out["energy_v14"][:,:-1].to(z.dtype),
                out["thermal_v14"][:,:-1].to(z.dtype),
                out["confidence"][:,:-1].to(z.dtype),
                (1-out["uncertainty"][:,:-1].to(z.dtype)).clamp(0,1)
            ],-1)
            homeo_loss=F.mse_loss(out["homeostasis_v22"][:,:-1],homeo_target)
            fe=out["active_free_energy_v22"].mean()
            utility=-out["memory_utility_raw_v22"].mean()
            agency=-out["actual_reward_v22"].mean()+0.5*out["actual_risk_v22"].mean()
            causal_target=out["counterfactual_delta_v22"].detach().clamp(-1,1)
            causal_loss=F.smooth_l1_loss(torch.tanh(out["causal_probe_v22"][...,0:1]), causal_target)
            sleep_target=(out["energy_v14"].to(z.dtype)*out["confidence"].to(z.dtype)).detach().clamp(0,1)
            sleep_loss=F.smooth_l1_loss(out["sleep_score_raw_v22"], sleep_target)
            cap_target=torch.cat([
                out["confidence"].to(z.dtype).clamp(0,1),
                (1-out["uncertainty"].to(z.dtype)).clamp(0,1),
                out["energy_v14"].to(z.dtype).clamp(0,1),
                (1-out["thermal_v14"].to(z.dtype)).clamp(0,1)
            ],-1).detach()
            cap_loss=F.mse_loss(out["capability_v22"],cap_target)
            binding_loss=F.smooth_l1_loss(out["bound_input_v22"], out["binding_target_v22"].detach())
            loss=loss+0.35*pred_loss+self.cfg.counterfactual_weight*cf+self.cfg.identity_weight*id_cons+0.08*binding_loss
            loss=loss+self.cfg.homeostasis_weight*homeo_loss+self.cfg.free_energy_weight*fe+self.cfg.utility_weight*utility
            loss=loss+self.cfg.agency_weight*agency+0.05*causal_loss+0.05*sleep_loss+0.06*cap_loss
        if target is not None and target.shape==z[:,-1].shape:
            loss=loss+0.20*F.mse_loss(z[:,-1],target)
        return loss


class LifeTrainerV22:
    """Explicitly scoped optimizer for the new V22 mechanisms only."""
    def __init__(self, model: NeuroWeaveV22, lr: float=1e-3, max_norm: float=1.0):
        self.model=model; self.max_norm=max_norm
        mods=[model.binder,model.memory_utility,model.identity,model.homeostasis_head,model.subgoal_head,
              model.active_inference,model.causal_probe,model.sleep,model.action_head]
        self.params=[p for m in mods for p in m.parameters()]
        self.optimizer=torch.optim.AdamW(self.params,lr=lr,weight_decay=1e-4)
    def step(self,x:Tensor,target:Optional[Tensor]=None,modality_sequence:Optional[Tensor]=None,presence_sequence:Optional[Tensor]=None):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,modality_sequence=modality_sequence,presence_sequence=presence_sequence,commit_memory=False)
        loss=self.model.training_loss(out,target=target)
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step()
        return loss.detach(),out
