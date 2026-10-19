from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Any
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v19 import NeuroWeaveV14, V14Config


@dataclass
class V20State:
    base: Any
    skill_proto: Tensor
    skill_strength: Tensor
    skill_age: Tensor
    self_model: Tensor
    self_model_error: Tensor
    stable_anchor: Tensor
    stability_ema: Tensor
    information_ema: Tensor
    step: Tensor


@dataclass
class V20Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    memory_capacity: int = 64
    replay_capacity: int = 32
    max_experts: int = 8
    top_k: int = 1
    world_candidates: int = 4
    max_horizon: int = 3
    deep_threshold: float = 0.58
    skill_slots: int = 4
    skill_rank: int = 2
    skill_threshold: float = 0.60
    skill_write_rate: float = 0.08
    anchor_rate: float = 0.03
    compute_budget: float = 0.55


class SparseSkillBankV20(nn.Module):
    """Sparse low-rank skill adapters with bounded online prototypes.

    The adapter weights are learned offline/continually, while skill prototypes live in
    persistent state and can bind a stream to a reusable skill without creating a new dense layer.
    Only selected skills execute, keeping active compute bounded.
    """
    def __init__(self, d: int, slots: int = 4, rank: int = 2):
        super().__init__()
        self.d, self.slots, self.rank = d, slots, rank
        self.router = nn.Linear(d + 3, slots)
        self.A = nn.Parameter(torch.randn(slots, rank, d) * (d ** -0.5))
        self.B = nn.Parameter(torch.randn(slots, d, rank) * (rank ** -0.5))
        self.gain = nn.Parameter(torch.zeros(slots))
        self.norm = nn.LayerNorm(d)

    def route(self, z: Tensor, novelty: Tensor, uncertainty: Tensor, confidence: Tensor, energy: Tensor,
              proto: Tensor, strength: Tensor):
        # Prototypes are state, not trainable truth; they provide contextual binding.
        sim = torch.einsum(
            "bd,bsd->bs",
            F.normalize(z, dim=-1, eps=1e-4),
            F.normalize(proto, dim=-1, eps=1e-4),
        )
        router_in = torch.cat([z, novelty, uncertainty, confidence], -1)
        logits = self.router(router_in) + 0.35 * sim + 0.25 * strength.clamp_min(0)
        idx = logits.argmax(-1)
        return logits, idx, sim

    def apply(self, z: Tensor, idx: Tensor):
        out = torch.zeros_like(z)
        for sid in range(self.slots):
            rows = (idx == sid).nonzero(as_tuple=False).flatten()
            if rows.numel() == 0:
                continue
            h = z.index_select(0, rows)
            a = F.linear(h, self.A[sid])
            delta = F.linear(torch.tanh(a), self.B[sid]) * torch.tanh(self.gain[sid])
            out.index_add_(0, rows, delta)
        return self.norm(z + 0.12 * out)

    @torch.no_grad()
    def update_state(self, z: Tensor, idx: Tensor, novelty: Tensor, energy: Tensor,
                     proto: Tensor, strength: Tensor, age: Tensor, rate: float):
        p = proto.clone(); s = strength.clone(); a = age.clone()
        a += 1.0
        for sid in range(self.slots):
            rows = (idx == sid).nonzero(as_tuple=False).flatten()
            if rows.numel() == 0:
                continue
            mean_z = z.index_select(0, rows).mean(0)
            weighted = (novelty.index_select(0, rows) * energy.index_select(0, rows)).mean().clamp(0, 1)
            alpha = (rate * (0.25 + 0.75 * weighted)).clamp(0.005, 0.20)
            prev = p[rows, sid]
            p[rows, sid] = F.normalize((1 - alpha) * prev + alpha * mean_z, dim=-1, eps=1e-4)
            s[rows, sid, :] = (0.97 * s[rows, sid, :] + 0.03 * weighted).clamp(0, 1)
            a[rows, sid, :] = 0
        p = F.normalize(p, dim=-1, eps=1e-4)
        return p.detach(), s.detach(), a.detach()


class CapabilitySelfModelV20(nn.Module):
    """Predicts bounded internal capabilities from current state; target uses observables only."""
    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + 7, d), nn.SiLU(), nn.Linear(d, 6))

    def forward(self, z: Tensor, error: Tensor, uncertainty: Tensor, confidence: Tensor,
                energy: Tensor, thermal: Tensor, novelty: Tensor, drive: Tensor):
        raw = self.net(torch.cat([z, error, uncertainty, confidence, energy, thermal, novelty, drive], -1))
        return torch.sigmoid(raw)

    @staticmethod
    def target(error: Tensor, uncertainty: Tensor, confidence: Tensor, energy: Tensor,
               thermal: Tensor, novelty: Tensor):
        return torch.cat([
            (1 - error.clamp(0, 1)),
            (1 - uncertainty.sigmoid()),
            confidence.clamp(0, 1),
            energy.clamp(0, 1),
            (1 - thermal.clamp(0, 1)),
            novelty.sigmoid(),
        ], -1)


class ActiveInformationV20(nn.Module):
    """Turns predictive uncertainty and learning progress into an action-selection bonus."""
    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + 5, d), nn.SiLU(), nn.Linear(d, 1))

    def forward(self, z: Tensor, temporal_error: Tensor, world_unc: Tensor, novelty: Tensor,
                confidence: Tensor, compute_cost: Tensor):
        # Expected information utility. It is a learnable correction around a transparent core signal.
        base = (world_unc + 0.7 * temporal_error + 0.5 * novelty) * (1 - confidence)
        correction = self.net(torch.cat([z, temporal_error, world_unc, novelty, confidence, compute_cost], -1))
        utility = base + 0.1 * torch.tanh(correction) - compute_cost
        return utility


class ConsolidationV20(nn.Module):
    """Importance-weighted stability pressure plus a bounded anchor trajectory."""
    def __init__(self, d: int):
        super().__init__()
        self.importance = nn.Sequential(nn.Linear(d + 3, d), nn.SiLU(), nn.Linear(d, 1))

    def forward(self, z: Tensor, anchor: Tensor, error: Tensor, confidence: Tensor, stability: Tensor):
        imp = torch.sigmoid(self.importance(torch.cat([z, error, confidence, stability], -1)))
        penalty = (imp * (z - anchor).pow(2)).mean(-1, keepdim=True)
        return imp, penalty

    @torch.no_grad()
    def update_anchor(self, z: Tensor, confidence: Tensor, anchor: Tensor, rate: float):
        w = (rate * confidence.clamp(0, 1)).clamp(0.001, rate)
        return ((1 - w) * anchor + w * z).detach()


class NeuroWeaveV20(nn.Module):
    """Frontier MAX V20: canonical adaptive continual-learning substrate.

    New integrated mechanisms:
      - sparse low-rank skill routing with persistent skill prototypes;
      - explicit self-capability model trained only against observable internal signals;
      - active information utility coupled to world uncertainty and learning progress;
      - importance-weighted consolidation anchor;
      - multi-step predictive loss with anti-collapse consistency checks;
      - auditable training/update scopes for safe bounded online learning.

    No consciousness claim is implied. All mechanisms must be empirically qualified.
    """
    def __init__(self, cfg: Optional[V20Config] = None):
        super().__init__()
        c = cfg or V20Config(); self.cfg = c
        self.core = NeuroWeaveV14(V14Config(
            d=c.d, hidden=c.hidden, action_dim=c.action_dim,
            memory_capacity=c.memory_capacity, replay_capacity=c.replay_capacity,
            max_experts=c.max_experts, top_k=c.top_k,
            world_candidates=c.world_candidates, max_horizon=c.max_horizon,
            deep_threshold=c.deep_threshold,
        ))
        self.skills = SparseSkillBankV20(c.d, c.skill_slots, c.skill_rank)
        self.self_model = CapabilitySelfModelV20(c.d)
        self.active_info = ActiveInformationV20(c.d)
        self.consolidation = ConsolidationV20(c.d)
        self.future_head = nn.Sequential(nn.Linear(2*c.d + c.action_dim, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.d))
        self.goal_head = nn.Sequential(nn.Linear(2*c.d, c.hidden), nn.SiLU(), nn.Linear(c.hidden, 1))

    def initial_state(self, b: int, device=None, dtype=None) -> V20State:
        base = self.core.initial_state(b, device=device, dtype=dtype)
        return V20State(
            base=base,
            skill_proto=torch.zeros(b, self.cfg.skill_slots, self.cfg.d, device=device, dtype=dtype),
            skill_strength=torch.zeros(b, self.cfg.skill_slots, 1, device=device, dtype=dtype),
            skill_age=torch.zeros(b, self.cfg.skill_slots, 1, device=device, dtype=dtype),
            self_model=torch.full((b, 6), 0.5, device=device, dtype=dtype),
            self_model_error=torch.ones(b, 1, device=device, dtype=dtype) * 0.5,
            stable_anchor=torch.zeros(b, self.cfg.d, device=device, dtype=dtype),
            stability_ema=torch.ones(b, 1, device=device, dtype=dtype) * 0.5,
            information_ema=torch.zeros(b, 1, device=device, dtype=dtype),
            step=torch.zeros(b, 1, device=device, dtype=dtype),
        )

    def step(self, x: Tensor, state: V20State, goal: Optional[Tensor] = None, action: Optional[Tensor] = None,
             commit_memory: bool = True):
        base_out, base_state = self.core.step(x, state.base, action=action, commit_memory=commit_memory)
        z = base_out["latent"]
        err = base_out["temporal_error"]
        unc = base_out["uncertainty"]
        conf = base_out["confidence"]
        energy = base_out["energy_v14"]
        thermal = base_out["thermal_v14"]
        novelty = base_out["novelty"]
        drive = base_out.get("intrinsic_drive_v16", novelty)
        compute_cost = base_out["allocation_probs"][:, 1:].mean(-1, keepdim=True).to(z.dtype)
        world_unc = base_out["world_uncertainty_v14"].to(z.dtype)

        logits, skill_idx, skill_sim = self.skills.route(z, novelty, unc, conf, energy, state.skill_proto, state.skill_strength.squeeze(-1))
        skill_z = self.skills.apply(z, skill_idx)
        info_util = self.active_info(skill_z, err, world_unc, novelty, conf, compute_cost.to(skill_z.dtype))
        err = err.to(skill_z.dtype); unc = unc.to(skill_z.dtype); conf = conf.to(skill_z.dtype); energy = energy.to(skill_z.dtype); thermal = thermal.to(skill_z.dtype); novelty = novelty.to(skill_z.dtype); drive = drive.to(skill_z.dtype)
        self_cap = self.self_model(skill_z, err, world_unc, conf, energy, thermal, novelty, drive)
        cap_target = self.self_model.target(err, world_unc, conf, energy, thermal, novelty)
        self_err = (self_cap - cap_target).pow(2).mean(-1, keepdim=True)

        stable_signal = base_out.get("stability", torch.ones_like(err) * 0.5)
        importance, consolidation_penalty = self.consolidation(
            skill_z, state.stable_anchor, err, conf, stable_signal,
        )
        stable_anchor = self.consolidation.update_anchor(skill_z.detach(), conf.detach(), state.stable_anchor, self.cfg.anchor_rate)

        proto, strength, age = self.skills.update_state(
            skill_z.detach(), skill_idx, novelty.detach(), energy.detach(),
            state.skill_proto, state.skill_strength, state.skill_age, self.cfg.skill_write_rate,
        )

        # Multi-step predictor uses the actual chosen action. Future target comes from the next observed step in sequence.
        action_used = base_out["action"] if action is None else action
        future_pred = self.future_head(torch.cat([skill_z, base_state.base.context.detach(), action_used.to(skill_z.dtype)], -1))
        goal_value = self.goal_head(torch.cat([skill_z, goal if goal is not None else torch.zeros_like(skill_z)], -1))
        stability_ema = 0.96 * state.stability_ema + 0.04 * stable_signal.detach()
        information_ema = 0.96 * state.information_ema + 0.04 * info_util.detach().clamp(-5, 5)

        # Closed-loop state injection: skill-conditioned latent becomes the context for the next base tick.
        base_state.context = skill_z.detach()
        out = dict(base_out)
        out.update({
            "latent_v20": skill_z,
            "skill_logits_v20": logits,
            "skill_index_v20": skill_idx,
            "skill_similarity_v20": skill_sim,
            "skill_active_count_v20": torch.ones_like(err),
            "active_information_utility_v20": info_util,
            "self_model_v20": self_cap,
            "self_model_target_v20": cap_target,
            "self_model_error_v20": self_err,
            "consolidation_importance_v20": importance,
            "consolidation_penalty_v20": consolidation_penalty,
            "stable_anchor_distance_v20": (skill_z - stable_anchor).norm(dim=-1, keepdim=True),
            "future_pred_v20": future_pred,
            "goal_value_v20": goal_value,
            "skill_strength_v20": strength,
            "skill_age_v20": age,
        })
        ns = V20State(
            base=base_state,
            skill_proto=proto,
            skill_strength=strength,
            skill_age=age,
            self_model=self_cap.detach(),
            self_model_error=self_err.detach(),
            stable_anchor=stable_anchor,
            stability_ema=stability_ema,
            information_ema=information_ema,
            step=state.step + 1,
        )
        return out, ns

    def forward(self, x: Tensor, state: Optional[V20State] = None, goal: Optional[Tensor] = None,
                goal_sequence: Optional[Tensor] = None, commit_memory: bool = True) -> Dict[str, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.cfg.d:
            raise ValueError("x must be [B,T,D]")
        if goal_sequence is not None and goal_sequence.shape[:2] != x.shape[:2]:
            raise ValueError("goal_sequence must match [B,T,*]")
        state = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            g = goal_sequence[:, t] if goal_sequence is not None else goal
            o, state = self.step(x[:, t], state, goal=g, commit_memory=commit_memory)
            rows.append(o)
        keys = rows[0].keys(); stacked = {}
        for k in keys:
            vals = [r[k] for r in rows]
            if all(torch.is_tensor(v) and v.ndim >= 1 for v in vals):
                stacked[k] = torch.stack(vals, 1)
            else:
                stacked[k] = vals
        stacked["_final_state"] = state
        return stacked

    def training_loss(self, out: Dict[str, Tensor], target: Optional[Tensor] = None, next_target: Optional[Tensor] = None):
        z = out["latent_v20"]
        loss = z.new_zeros(())
        if z.size(1) > 1:
            pred = out["future_pred_v20"][:, :-1]
            # Teacher target is next observed latent and is detached to prevent self-distillation collapse.
            tgt = z[:, 1:].detach()
            temporal = F.smooth_l1_loss(pred, tgt)
            # Multi-step consistency measured through the underlying world model, not recursive self-targets only.
            cur = z[:, 0]
            pred_steps = []
            horizon = min(3, z.size(1)-1)
            for t in range(horizon):
                cur, _, _, _ = self.core.planner.transition(cur, out["action"][:, t])
                pred_steps.append(cur)
            rollout = torch.stack(pred_steps, 1)
            rollout_loss = F.smooth_l1_loss(rollout, z[:, 1:1+horizon].detach())
            future_consistency = F.mse_loss(pred[:, :horizon], rollout.detach())
            loss = loss + 0.50*temporal + 0.22*rollout_loss + 0.08*future_consistency
        self_loss = F.mse_loss(out["self_model_v20"], out["self_model_target_v20"].detach())
        skill_balance = ((out["skill_logits_v20"].softmax(-1).mean((0,1)) - 1.0/self.cfg.skill_slots)**2).mean()
        anchor = out["consolidation_penalty_v20"].mean()
        info = (-out["active_information_utility_v20"].mean())
        loss = loss + 0.10*self_loss + 0.015*skill_balance + 0.035*anchor + 0.008*info
        if target is not None:
            readout = z[:, -1]
            if target.shape == readout.shape:
                loss = loss + 0.25*F.mse_loss(readout, target)
        if next_target is not None and next_target.shape == out["future_pred_v20"][:, -1].shape:
            loss = loss + 0.15*F.mse_loss(out["future_pred_v20"][:, -1], next_target)
        return loss


class LifeTrainerV20:
    """Bounded optimizer for continual learning. The modified parameter set is explicit."""
    def __init__(self, model: NeuroWeaveV20, lr: float = 1e-3):
        self.model = model
        params = (
            list(model.future_head.parameters())
            + list(model.self_model.parameters())
            + list(model.active_info.parameters())
            + list(model.consolidation.parameters())
            + list(model.skills.parameters())
        )
        self.optimizer = torch.optim.AdamW(params, lr=lr, weight_decay=1e-4)
        self.params = params

    def step(self, x: Tensor, target: Optional[Tensor] = None, next_target: Optional[Tensor] = None):
        self.model.train()
        self.optimizer.zero_grad(set_to_none=True)
        out = self.model(x, commit_memory=False)
        loss = self.model.training_loss(out, target=target, next_target=next_target)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.params, 1.0)
        self.optimizer.step()
        return loss.detach(), out
