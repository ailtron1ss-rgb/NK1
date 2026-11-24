from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v20 import NeuroWeaveV20, V20Config, V20State


@dataclass
class V21State:
    base: V20State
    slow_latent: Tensor
    medium_latent: Tensor
    fast_latent: Tensor
    regime: Tensor
    regime_strength: Tensor
    structural_gate: Tensor
    structural_basis: Tensor
    structural_strength: Tensor
    structural_age: Tensor
    relation_graph: Tensor
    capability: Tensor
    capability_uncertainty: Tensor
    life_step: Tensor


@dataclass
class V21Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    memory_capacity: int = 64
    replay_capacity: int = 32
    max_experts: int = 8
    top_k: int = 1
    world_candidates: int = 4
    max_horizon: int = 4
    deep_threshold: float = 0.58
    skill_slots: int = 4
    skill_rank: int = 2
    # V21 temporal hierarchy.
    fast_decay: float = 0.55
    medium_decay: float = 0.85
    slow_decay: float = 0.97
    # V21 structural adaptation.
    candidate_slots: int = 4
    structural_lr: float = 0.04
    structural_min_gain: float = 0.02
    relation_rate: float = 0.08
    regime_threshold: float = 0.35
    # V21 predictive/planning.
    horizon_weights: Tuple[float, ...] = (1.0, 0.6, 0.35, 0.2)
    counterfactual_weight: float = 0.2
    world_weight: float = 0.45
    self_weight: float = 0.12
    retention_weight: float = 0.08
    compute_weight: float = 0.015


class RegimeDetectorV21(nn.Module):
    """Task-free regime detector driven by observable transition statistics."""
    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(2 * d + 5, d), nn.SiLU(), nn.Linear(d, 1))

    def forward(self, z: Tensor, delta: Tensor, error: Tensor, uncertainty: Tensor,
                novelty: Tensor, confidence: Tensor, energy: Tensor) -> Tensor:
        raw = self.net(torch.cat([z, delta, error, uncertainty, novelty, confidence, energy], -1))
        return torch.sigmoid(raw)


class HierarchicalPredictorV21(nn.Module):
    """Predicts future latent states at multiple temporal scales.

    The same compact trunk feeds four horizons; horizon-4 is only trained when enough
    observations are available, which keeps the mobile path bounded.
    """
    def __init__(self, d: int, hidden: int, action_dim: int, horizon: int = 4):
        super().__init__()
        self.d = d; self.horizon = horizon
        self.trunk = nn.Sequential(nn.Linear(2 * d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.SiLU())
        self.heads = nn.ModuleList([nn.Linear(hidden, d) for _ in range(horizon)])

    def forward(self, z: Tensor, context: Tensor, action: Tensor) -> Tensor:
        h = self.trunk(torch.cat([z, context, action], -1))
        return torch.stack([head(h) for head in self.heads], -2)  # [B,H,D]


class LearnedSearchOperatorV21(nn.Module):
    """Learned plan-improvement operator inspired by learned-search approaches.

    It proposes an action delta from current state, goal and imagined outcome. It is intentionally
    tiny and bounded so it can run as an optional second planning pass on-device.
    """
    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.action_dim = action_dim
        self.net = nn.Sequential(nn.Linear(3 * d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, action_dim))
        self.gate = nn.Sequential(nn.Linear(2 * d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, state: Tensor, goal: Tensor, action: Tensor, imagined: Tensor, uncertainty: Tensor) -> Tensor:
        base = torch.tanh(self.net(torch.cat([state, goal, imagined, action], -1)))
        trust = torch.sigmoid(self.gate(torch.cat([state, imagined, uncertainty, torch.ones_like(uncertainty)], -1)))
        return (action + 0.18 * trust * base).tanh()


class CounterfactualJudgeV21(nn.Module):
    """Scores actual-vs-baseline outcomes and estimates a bounded utility gap."""
    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(2 * d + 2 * action_dim + 3, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, state: Tensor, actual_action: Tensor, baseline_action: Tensor,
                actual_outcome: Tensor, baseline_outcome: Tensor,
                uncertainty: Tensor, reward_delta: Tensor, risk_delta: Tensor) -> Tensor:
        x = torch.cat([state, actual_action, baseline_action, actual_outcome - baseline_outcome,
                       uncertainty, reward_delta, risk_delta], -1)
        return torch.tanh(self.net(x))


class StructuralAdaptationV21(nn.Module):
    """Bounded structural adaptation without unbounded graph growth.

    A fixed bank of candidate gates can be activated/deactivated. New structure is represented as
    a sparse gain vector over existing pathways, so the online learner can experiment without
    allocating arbitrary new layers on a phone.
    """
    def __init__(self, d: int, slots: int):
        super().__init__()
        self.candidate = nn.Parameter(torch.zeros(slots, d))
        self.value = nn.Sequential(nn.Linear(2 * d + 3, d), nn.SiLU(), nn.Linear(d, slots))
        self.norm = nn.LayerNorm(d)

    def score(self, z: Tensor, residual: Tensor, novelty: Tensor, uncertainty: Tensor, energy: Tensor) -> Tensor:
        return self.value(torch.cat([z, residual, novelty, uncertainty, energy], -1))

    def apply(self, z: Tensor, gate: Tensor, basis: Optional[Tensor] = None) -> Tensor:
        # Low-rank-ish additive structural basis. Gate is [B,S].
        base = self.candidate.unsqueeze(0).expand(z.size(0), -1, -1)
        if basis is not None:
            base = base + basis
        delta = torch.einsum("bs,bsd->bd", gate, base)
        return self.norm(z + 0.08 * torch.tanh(delta))


class NeuroWeaveV21(nn.Module):
    """Frontier MAX V21: bounded adaptive organism substrate.

    V21 integrates the strongest mechanisms from V20 and adds:
      - multi-timescale latent hierarchy;
      - task-free regime detection;
      - fixed-capacity structural adaptation;
      - learned plan-improvement operator;
      - explicit counterfactual utility judge;
      - multi-horizon future prediction;
      - relation graph over persistent skill prototypes;
      - capability/uncertainty state for metacognitive control.

    This is an experimental neural architecture. No consciousness claim is implied.
    """
    def __init__(self, cfg: Optional[V21Config] = None):
        super().__init__()
        c = cfg or V21Config(); self.cfg = c
        self.core = NeuroWeaveV20(V20Config(
            d=c.d, hidden=c.hidden, action_dim=c.action_dim,
            memory_capacity=c.memory_capacity, replay_capacity=c.replay_capacity,
            max_experts=c.max_experts, top_k=c.top_k,
            world_candidates=c.world_candidates, max_horizon=max(3, min(4, c.max_horizon)),
            deep_threshold=c.deep_threshold, skill_slots=c.skill_slots, skill_rank=c.skill_rank,
        ))
        self.regime_detector = RegimeDetectorV21(c.d)
        self.hier_predictor = HierarchicalPredictorV21(c.d, c.hidden, c.action_dim, c.max_horizon)
        self.search_operator = LearnedSearchOperatorV21(c.d, c.hidden, c.action_dim)
        self.cf_judge = CounterfactualJudgeV21(c.d, c.hidden, c.action_dim)
        self.structure = StructuralAdaptationV21(c.d, c.candidate_slots)
        self.capability_head = nn.Sequential(nn.Linear(3 * c.d + 6, c.hidden), nn.SiLU(), nn.Linear(c.hidden, 6))
        self.goal_policy = nn.Sequential(nn.Linear(3 * c.d + 2, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.action_dim))

    def initial_state(self, b: int, device=None, dtype=None) -> V21State:
        base = self.core.initial_state(b, device=device, dtype=dtype)
        z = lambda: torch.zeros(b, self.cfg.d, device=device, dtype=dtype)
        return V21State(
            base=base,
            slow_latent=z(), medium_latent=z(), fast_latent=z(),
            regime=torch.zeros(b,1,device=device,dtype=dtype),
            regime_strength=torch.zeros(b,1,device=device,dtype=dtype),
            structural_gate=torch.zeros(b,self.cfg.candidate_slots,device=device,dtype=dtype),
            structural_basis=torch.zeros(b,self.cfg.candidate_slots,self.cfg.d,device=device,dtype=dtype),
            structural_strength=torch.zeros(b,self.cfg.candidate_slots,device=device,dtype=dtype),
            structural_age=torch.zeros(b,self.cfg.candidate_slots,device=device,dtype=dtype),
            relation_graph=torch.eye(self.cfg.skill_slots,device=device,dtype=dtype).unsqueeze(0).expand(b,-1,-1).clone(),
            capability=torch.full((b,6),0.5,device=device,dtype=dtype),
            capability_uncertainty=torch.ones(b,1,device=device,dtype=dtype)*0.5,
            life_step=torch.zeros(b,1,device=device,dtype=dtype),
        )

    def _hierarchy(self, z: Tensor, state: V21State) -> Tuple[Tensor, Tensor, Tensor]:
        fast = self.cfg.fast_decay * state.fast_latent + (1-self.cfg.fast_decay) * z
        medium = self.cfg.medium_decay * state.medium_latent + (1-self.cfg.medium_decay) * fast
        slow = self.cfg.slow_decay * state.slow_latent + (1-self.cfg.slow_decay) * medium
        return fast, medium, slow
    @torch.no_grad()
    def _update_structure_state(self, state: V21State, residual: Tensor, gate: Tensor,
                                regime_strength: Tensor, novelty: Tensor, uncertainty: Tensor,
                                energy: Tensor, cf_advantage: Tensor):
        strength = state.structural_strength.clone()
        age = state.structural_age + 1.0
        basis = state.structural_basis.clone()
        base = self.structure.candidate.detach()
        selected = gate.argmax(-1)
        # Evidence threshold: structural adaptation happens only when novelty/uncertainty
        # are high enough OR the actual action has a positive counterfactual advantage.
        evidence = (0.45*novelty + 0.35*uncertainty + 0.20*regime_strength + 0.35*cf_advantage.tanh()) * energy
        accept = evidence > self.cfg.structural_min_gain
        for i in range(residual.size(0)):
            if not bool(accept[i].item()):
                continue
            sid = int(selected[i].item())
            alpha = float(torch.clamp(self.cfg.structural_lr * evidence[i], 0.005, 0.12).item())
            r = F.normalize(residual[i], dim=-1, eps=1e-4)
            current = F.normalize(base[sid] + basis[i, sid], dim=-1, eps=1e-4)
            updated = F.normalize((1-alpha)*current + alpha*r, dim=-1, eps=1e-4)
            basis[i, sid] = (updated - base[sid]).clamp(-2, 2)
            strength[i, sid] = torch.clamp(0.98*strength[i, sid] + 0.02*evidence[i,0], 0, 1)
            age[i, sid] = 0
        # Gentle decay for unused candidate slots prevents permanent lock-in.
        strength = (strength * 0.998).clamp(0,1)
        basis = basis.clamp(-2,2)
        return basis.detach(), strength.detach(), age.detach(), accept.detach(), selected.detach()

    def step(self, x: Tensor, state: V21State, goal: Optional[Tensor] = None,
             action: Optional[Tensor] = None, commit_memory: bool = True):
        base_out, base_state = self.core.step(x, state.base, goal=goal, action=action, commit_memory=commit_memory)
        z = base_out["latent_v20"]
        prev = state.fast_latent
        delta = z - prev
        err = base_out["temporal_error"].to(z.dtype)
        unc = base_out["uncertainty"].to(z.dtype)
        nov = base_out["novelty"].to(z.dtype)
        conf = base_out["confidence"].to(z.dtype)
        energy = base_out["energy_v14"].to(z.dtype)
        fast, medium, slow = self._hierarchy(z, state)
        regime_score = self.regime_detector(z, delta, err, unc, nov, conf, energy)
        regime = (regime_score > self.cfg.regime_threshold).to(z.dtype)
        regime_strength = (regime_score - self.cfg.regime_threshold).clamp_min(0) / max(1e-6, 1-self.cfg.regime_threshold)

        residual = z - medium
        struct_logits = self.structure.score(z, residual, nov, unc, energy)
        struct_gate = torch.sigmoid(struct_logits)
        if self.training:
            struct_gate = struct_gate
        structural_z = self.structure.apply(z, struct_gate, state.structural_basis)

        action_used = base_out["action"] if action is None else action
        goal_used = goal if goal is not None else torch.zeros_like(z)
        hier_context = 0.45 * fast + 0.35 * medium + 0.20 * slow
        goal_action = torch.tanh(self.goal_policy(torch.cat([structural_z, goal_used, hier_context, unc, energy], -1)))
        goal_gate = (goal_used.norm(dim=-1, keepdim=True) / (goal_used.norm(dim=-1, keepdim=True) + 1.0)).clamp(0,1) * conf
        action_used = (action_used + 0.45 * goal_gate * (goal_action - action_used)).tanh() if action is None else action_used
        future_multi = self.hier_predictor(structural_z, hier_context, action_used.to(z.dtype))

        world_next = base_out["world_next_v14"].to(z.dtype)
        # Baseline action is zero-centered, while actual action comes from current policy/planner.
        baseline_action = torch.zeros_like(action_used)
        baseline_next, baseline_reward, baseline_risk, baseline_unc = self.core.core.planner.transition(structural_z, baseline_action)
        actual_next, actual_reward, actual_risk, actual_unc = self.core.core.planner.transition(structural_z, action_used)
        cf_score = self.cf_judge(
            structural_z, action_used, baseline_action,
            actual_next.detach(), baseline_next.detach(),
            unc.detach(), (actual_reward-baseline_reward).detach(), (actual_risk-baseline_risk).detach(),
        )
        cf_advantage = (actual_reward - baseline_reward) - 0.5*(actual_risk-baseline_risk)

        # Optional learned search refinement; gate by uncertainty and available energy.
        refine_gate = ((unc > 0.35) & (energy > 0.25)).to(z.dtype)
        proposed = self.search_operator(structural_z, goal_used, action_used.to(z.dtype), actual_next.detach(), actual_unc.detach())
        chosen_action = torch.where(refine_gate.bool(), proposed, action_used)
        refined_next, refined_reward, refined_risk, refined_unc = self.core.core.planner.transition(structural_z, chosen_action)

        # Prototype relation graph: persistent skill relationships, not a second truth store.
        proto = state.base.skill_proto
        pnorm = F.normalize(proto, dim=-1, eps=1e-4)
        relation = torch.einsum("bsd,btd->bst", pnorm, pnorm)
        relation = 0.85 * state.relation_graph + 0.15 * relation
        relation = relation.clamp(-1, 1)
        eye = torch.eye(self.cfg.skill_slots, device=relation.device, dtype=relation.dtype).unsqueeze(0)
        relation = relation * (1.0 - eye) + eye

        # Capability model predicts bounded internal variables; target is observable from V20 outputs + regime.
        cap_in = torch.cat([structural_z, fast, medium, err, unc, conf, energy, nov, regime_score], -1)
        cap_raw = self.capability_head(cap_in)
        capability = torch.sigmoid(cap_raw)
        capability_target = torch.cat([
            (1-err).clamp(0,1), (1-unc).clamp(0,1), conf.clamp(0,1),
            energy.clamp(0,1), (1-base_out["thermal_v14"].to(z.dtype)).clamp(0,1),
            (1-regime_strength).clamp(0,1)
        ], -1)
        capability_unc = (capability - capability_target).pow(2).mean(-1,keepdim=True).sqrt()

        structural_basis, structural_strength, structural_age, structural_accept, structural_selected = self._update_structure_state(
            state, residual.detach(), struct_gate.detach(), regime_strength.detach(), nov.detach(), unc.detach(), energy.detach(), cf_advantage.detach()
        )
        # State continuity: improved context is fed into the underlying V20 next tick.
        base_state.context = structural_z.detach()
        ns = V21State(
            base=base_state,
            slow_latent=slow.detach(), medium_latent=medium.detach(), fast_latent=fast.detach(),
            regime=regime.detach(), regime_strength=regime_strength.detach(),
            structural_gate=struct_gate.detach(), structural_basis=structural_basis, structural_strength=structural_strength, structural_age=structural_age, relation_graph=relation.detach(),
            capability=capability.detach(), capability_uncertainty=capability_unc.detach(),
            life_step=state.life_step + 1,
        )
        out = dict(base_out)
        out.update({
            "latent_v21": structural_z,
            "fast_latent_v21": fast,
            "medium_latent_v21": medium,
            "slow_latent_v21": slow,
            "regime_score_v21": regime_score,
            "regime_v21": regime,
            "regime_strength_v21": regime_strength,
            "structural_logits_v21": struct_logits,
            "structural_gate_v21": struct_gate,
            "structural_basis_v21": structural_basis,
            "structural_strength_v21": structural_strength,
            "structural_age_v21": structural_age,
            "structural_accept_v21": structural_accept,
            "structural_selected_v21": structural_selected,
            "goal_action_v21": goal_action,
            "goal_gate_v21": goal_gate,
            "future_multi_v21": future_multi,
            "counterfactual_score_v21": cf_score,
            "counterfactual_advantage_v21": cf_advantage,
            "baseline_next_v21": baseline_next,
            "actual_next_v21": actual_next,
            "refined_next_v21": refined_next,
            "baseline_reward_v21": baseline_reward,
            "actual_reward_v21": actual_reward,
            "refined_reward_v21": refined_reward,
            "actual_risk_v21": actual_risk,
            "refined_risk_v21": refined_risk,
            "refined_uncertainty_v21": refined_unc,
            "search_refined_v21": refine_gate,
            "chosen_action_v21": chosen_action,
            "relation_graph_v21": relation,
            "capability_v21": capability,
            "capability_target_v21": capability_target,
            "capability_error_v21": capability_unc,
            "life_step_v21": ns.life_step,
        })
        return out, ns

    def forward(self, x: Tensor, state: Optional[V21State] = None, goal: Optional[Tensor] = None,
                goal_sequence: Optional[Tensor] = None, commit_memory: bool = True) -> Dict[str, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.cfg.d:
            raise ValueError("x must be [B,T,D]")
        if goal_sequence is not None and goal_sequence.shape[:2] != x.shape[:2]:
            raise ValueError("goal_sequence must match [B,T,*]")
        state = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows=[]
        for t in range(x.size(1)):
            g = goal_sequence[:,t] if goal_sequence is not None else goal
            o,state=self.step(x[:,t],state,goal=g,commit_memory=commit_memory)
            rows.append(o)
        keys=rows[0].keys(); out={}
        for k in keys:
            vals=[r[k] for r in rows]
            if all(torch.is_tensor(v) for v in vals):
                out[k]=torch.stack(vals,1)
        out["_final_state"]=state
        return out

    def training_loss(self, out: Dict[str, Tensor], target: Optional[Tensor]=None) -> Tensor:
        z=out["latent_v21"]; loss=z.new_zeros(())
        if z.size(1)>1:
            pred=out["future_multi_v21"]
            # Each horizon has a corresponding observed target where available.
            weights=self.cfg.horizon_weights
            horizons=min(self.cfg.max_horizon,z.size(1)-1)
            for h in range(horizons):
                n = z.size(1) - (h + 1)
                p = pred[:, :n, h]
                tgt = z[:, h+1:h+1+n].detach()
                loss = loss + weights[h] * F.smooth_l1_loss(p, tgt)
            loss = loss/max(1.0, sum(weights[:horizons]))
        # Use actual observed planning consequences as self-supervised world target.
        world=F.smooth_l1_loss(out["actual_next_v21"],out["world_next_v14"].detach())
        cf=-out["counterfactual_advantage_v21"].mean()
        self_l=F.mse_loss(out["capability_v21"],out["capability_target_v21"].detach())
        relation=(1-out["relation_graph_v21"].diagonal(dim1=-2,dim2=-1)).abs().mean()
        compute=out["allocation_probs"].mean()
        consistency=F.mse_loss(out["refined_next_v21"][:, :-1], out["future_multi_v21"][:, :-1, 0].detach()) if z.size(1)>1 else z.new_zeros(())
        # Differentiable utility gives goal-policy and search-operator real learning signal.
        search_utility = -(out["refined_reward_v21"] - 0.5*out["refined_risk_v21"]).mean()
        goal_alignment = -(out["actual_reward_v21"] - 0.5*out["actual_risk_v21"]).mean()
        loss=loss+self.cfg.world_weight*world+self.cfg.counterfactual_weight*cf+self.cfg.self_weight*self_l
        loss=loss+self.cfg.retention_weight*relation+self.cfg.compute_weight*compute+0.04*consistency
        loss=loss+0.10*search_utility+0.08*goal_alignment
        if target is not None and target.shape==z[:,-1].shape:
            loss=loss+0.25*F.mse_loss(z[:,-1],target)
        return loss


class LifeTrainerV21:
    """Continual trainer with explicit parameter scope and two-time-scale update caps."""
    def __init__(self, model: NeuroWeaveV21, lr: float=1e-3, max_norm: float=1.0):
        self.model=model; self.max_norm=max_norm
        params=(list(model.hier_predictor.parameters())+list(model.search_operator.parameters())+
                list(model.cf_judge.parameters())+list(model.structure.parameters())+
                list(model.regime_detector.parameters())+list(model.capability_head.parameters())+
                list(model.goal_policy.parameters()))
        self.params=params
        self.optimizer=torch.optim.AdamW(params,lr=lr,weight_decay=1e-4)

    def step(self,x:Tensor,target:Optional[Tensor]=None):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,commit_memory=False)
        loss=self.model.training_loss(out,target=target)
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm)
        self.optimizer.step()
        return loss.detach(),out
