from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from neurocore.v15_frontier.core import NeuroWeaveV15, V15Config, V15State


class SelfModelV16(nn.Module):
    """Predict the core's own next latent/resource state.

    This is a self-prediction mechanism, not a claim of subjective self-awareness.
    """
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + 4, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.health = nn.Sequential(nn.Linear(d + 4, hidden), nn.SiLU(), nn.Linear(hidden, 3))

    def forward(self, latent: Tensor, energy: Tensor, thermal: Tensor, confidence: Tensor, drift: Tensor):
        x = torch.cat([latent, energy, thermal, confidence, drift], -1)
        delta = 0.5 * torch.tanh(self.net(x))
        health = torch.sigmoid(self.health(x))
        return latent + delta, health


class GoalConditionerV16(nn.Module):
    """Maps an optional external goal into the latent workspace."""
    def __init__(self, d: int):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(d, d), nn.SiLU(), nn.Linear(d, d))
        self.urgency = nn.Sequential(nn.Linear(2 * d, d), nn.SiLU(), nn.Linear(d, 1))

    def encode(self, goal: Optional[Tensor], reference: Tensor):
        if goal is None:
            return torch.zeros_like(reference), reference.new_zeros(reference.size(0), 1)
        g = torch.tanh(self.encoder(goal))
        u = torch.sigmoid(self.urgency(torch.cat([reference, g], -1)))
        return g, u


class GoalUtilityV16(nn.Module):
    """Goal-conditioned action intervention against a controlled baseline."""
    def __init__(self, d: int, action_dim: int):
        super().__init__()
        self.action_value = nn.Sequential(nn.Linear(2 * d + action_dim + 2, d), nn.SiLU(), nn.Linear(d, 1))
        self.sim_weight = nn.Parameter(torch.tensor(1.0))
        self.base_action = nn.Parameter(torch.zeros(action_dim))

    def score(self, current: Tensor, goal: Tensor, action: Tensor, nxt: Tensor, reward: Tensor, risk: Tensor):
        den = (nxt.float().norm(dim=-1) * goal.float().norm(dim=-1)).clamp_min(1e-4)
        sim = (nxt.float().mul(goal.float()).sum(-1) / den).to(dtype=nxt.dtype).unsqueeze(-1)
        val = self.action_value(torch.cat([current, nxt, action, reward, risk], -1))
        return self.sim_weight.clamp(0, 2) * sim + val

    def select(self, current, goal, planned_action, planned_next, planned_reward, planned_risk,
               base_next, base_reward, base_risk):
        pa = self.score(current, goal, planned_action, planned_next, planned_reward, planned_risk)
        ba = self.base_action.expand_as(planned_action)
        pb = self.score(current, goal, ba, base_next, base_reward, base_risk)
        use_plan = pa >= pb
        chosen = torch.where(use_plan, planned_action, ba)
        advantage = pa - pb
        return chosen, advantage, pa, pb, use_plan


class IntrinsicDriveV16(nn.Module):
    """Exploration/learning drive from novelty × epistemic uncertainty × available energy."""
    def __init__(self):
        super().__init__()
        self.scale = nn.Parameter(torch.tensor(0.7))

    def forward(self, novelty, epistemic, energy, confidence):
        drive = self.scale.clamp(0, 2) * novelty * (0.25 + epistemic) * energy * (0.25 + 1 - confidence)
        return drive.clamp(0, 1)


@dataclass
class V16State:
    base: V15State
    self_prediction: Tensor
    goal: Tensor
    goal_urgency: Tensor
    intrinsic_ema: Tensor
    self_model_error: Tensor
    life_step: Tensor


@dataclass
class V16Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    memory_capacity: int = 64
    replay_capacity: int = 32
    semantic_capacity: int = 16
    max_experts: int = 8
    top_k: int = 1
    world_candidates: int = 4
    max_horizon: int = 3
    deep_threshold: float = 0.58
    sr_gamma: float = 0.88


class NeuroWeaveV16(nn.Module):
    """V16: predictive organism substrate on top of V15.

    New real mechanisms:
      * self-model predicts own next latent and health state;
      * optional explicit goal latent and goal-conditioned action selection;
      * intrinsic exploration/learning drive;
      * persistent self-model error and goal urgency state.
    """
    def __init__(self, cfg: V16Config | None = None):
        super().__init__()
        c = cfg or V16Config()
        self.cfg = c
        self.core = NeuroWeaveV15(V15Config(
            d=c.d, hidden=c.hidden, action_dim=c.action_dim, memory_capacity=c.memory_capacity,
            replay_capacity=c.replay_capacity, semantic_capacity=c.semantic_capacity,
            max_experts=c.max_experts, top_k=c.top_k, world_candidates=c.world_candidates,
            max_horizon=c.max_horizon, deep_threshold=c.deep_threshold, sr_gamma=c.sr_gamma,
        ))
        self.self_model = SelfModelV16(c.d, c.hidden)
        self.goal = GoalConditionerV16(c.d)
        self.goal_utility = GoalUtilityV16(c.d, c.action_dim)
        self.intrinsic = IntrinsicDriveV16()
        self.goal_fusion = nn.Sequential(nn.Linear(2 * c.d + 2, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.d))

    def initial_state(self, b: int, device=None, dtype=None):
        z = torch.zeros(b, self.cfg.d, device=device, dtype=dtype)
        return V16State(
            base=self.core.initial_state(b, device=device, dtype=dtype),
            self_prediction=z.clone(), goal=z.clone(), goal_urgency=torch.zeros(b,1,device=device,dtype=dtype),
            intrinsic_ema=torch.zeros(b,1,device=device,dtype=dtype), self_model_error=torch.zeros(b,1,device=device,dtype=dtype),
            life_step=torch.zeros(b,1,device=device,dtype=dtype),
        )

    def step(self, x: Tensor, state: V16State, goal: Optional[Tensor] = None, action: Optional[Tensor] = None,
             commit_memory: bool = True):
        base_out, base_state = self.core.step(x, state.base, action=action, commit_memory=commit_memory)
        z = base_out["latent_v15"]
        goal_latent, goal_urgency = self.goal.encode(goal, z)
        fused = z + 0.18 * self.goal_fusion(torch.cat([z, goal_latent, goal_urgency, base_out["retention_score_v15"]], -1))

        energy = base_out["energy_v15"]
        thermal = base_out["thermal_v15"]
        conf = base_out["model_confidence_v15"]
        drift = (fused - state.base.prev_latent).norm(dim=-1, keepdim=True) / (self.cfg.d ** 0.5)
        self_pred, self_health = self.self_model(fused, energy, thermal, conf, drift)
        self_err = (self_pred - base_out["world_next_v14"].detach()).pow(2).mean(-1,keepdim=True).sqrt()

        planned_action = base_out["action"] if action is None else action
        chosen_next, chosen_reward, chosen_risk, _ = self.core.core.planner.transition(fused.detach(), planned_action.detach())
        base_action = self.goal_utility.base_action.expand_as(planned_action).to(planned_action.dtype)
        base_next, base_reward, base_risk, _ = self.core.core.planner.transition(fused.detach(), base_action)
        chosen_action, goal_adv, plan_u, base_u, use_plan = self.goal_utility.select(
            fused.detach(), goal_latent.detach(), planned_action.detach(), chosen_next.detach(), chosen_reward.detach(), chosen_risk.detach(),
            base_next.detach(), base_reward.detach(), base_risk.detach(),
        )
        curiosity = self.intrinsic(base_out["novelty"], base_out["epistemic_uncertainty_v15"], energy, conf)
        intrinsic_ema = 0.94 * state.intrinsic_ema + 0.06 * curiosity.detach()

        # When an explicit goal exists, action selection can override the planner only when
        # the counterfactual goal-conditioned utility actually prefers it.
        action_out = chosen_action if goal is not None else planned_action
        retention = (1 - self_err).clamp(0, 1)
        base_state.context = fused.detach()

        out = dict(base_out)
        out.update({
            "latent_v16": fused,
            "goal_latent_v16": goal_latent,
            "goal_urgency_v16": goal_urgency,
            "self_prediction_v16": self_pred,
            "self_model_error_v16": self_err,
            "self_health_v16": self_health,
            "goal_advantage_v16": goal_adv,
            "goal_plan_utility_v16": plan_u,
            "goal_baseline_utility_v16": base_u,
            "goal_plan_selected_v16": use_plan.to(x.dtype),
            "intrinsic_drive_v16": curiosity,
            "intrinsic_ema_v16": intrinsic_ema,
            "retention_v16": retention,
            "action_v16": action_out,
        })
        ns = V16State(
            base=base_state, self_prediction=self_pred.detach(), goal=goal_latent.detach(), goal_urgency=goal_urgency.detach(),
            intrinsic_ema=intrinsic_ema, self_model_error=0.94 * state.self_model_error + 0.06 * self_err.detach(),
            life_step=state.life_step + 1,
        )
        return out, ns

    def forward(self, x: Tensor, state: Optional[V16State] = None, goal: Optional[Tensor] = None,
                goal_sequence: Optional[Tensor] = None, commit_memory: bool = True):
        if x.ndim != 3 or x.size(-1) != self.cfg.d:
            raise ValueError("x must be [B,T,D]")
        if goal_sequence is not None and (goal_sequence.ndim != 3 or goal_sequence.shape[:2] != x.shape[:2]):
            raise ValueError("goal_sequence must be [B,T,D]")
        state = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows=[]
        for t in range(x.size(1)):
            gt = goal_sequence[:,t] if goal_sequence is not None else goal
            o,state=self.step(x[:,t],state,goal=gt,commit_memory=commit_memory)
            rows.append(o)
        stacked={k:torch.stack([r[k] for r in rows],1) for k in rows[0]}
        stacked["_final_state"]=state
        return stacked


class OrganismTrainerV16:
    """Bounded multi-objective life-cycle trainer for self prediction and sequence prediction."""
    def __init__(self, model: NeuroWeaveV16, lr: float=2e-3):
        self.model=model
        params=list(model.self_model.parameters())+list(model.goal_utility.parameters())+list(model.goal_conditioner.parameters()) if hasattr(model,'goal_conditioner') else []
        params=(list(model.self_model.parameters())+list(model.goal.parameters())+list(model.goal_utility.parameters())+
                list(model.intrinsic.parameters())+list(model.goal_fusion.parameters())+list(model.core.next_head_v15.parameters()))
        self.optimizer=torch.optim.AdamW(params,lr=lr,weight_decay=1e-4)

    def step(self, out: Dict[str,Tensor], target_next: Tensor | None=None):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        self_loss=out["self_model_error_v16"].mean()
        drive=out["intrinsic_drive_v16"].mean()
        goal_term=-0.02*out["goal_advantage_v16"].mean()
        loss=self_loss+0.01*drive+0.05*goal_term
        if target_next is not None:
            pred=out["self_prediction_v16"][:,-1]
            loss=loss+0.2*F.mse_loss(pred,target_next)
        loss.backward(); nn.utils.clip_grad_norm_(self.optimizer.param_groups[0]["params"],1.0); self.optimizer.step()
        return loss.detach()
