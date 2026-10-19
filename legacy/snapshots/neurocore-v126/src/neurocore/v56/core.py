from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional
import copy
import math
import time

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v55 import (
    V55Config,
    mobile_v55_config,
    NeuroWeaveV55,
    OrganismRuntimeV55,
    OrganismTrainerV55,
    RuntimeStateStoreV55,
    NeuralAssociativeMemoryV55,
)


def _batch(x: Tensor) -> Tensor:
    return x.unsqueeze(0) if x.ndim == 1 else x


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return x / x.norm(dim=-1, keepdim=True).clamp_min(eps)


def _finite(x: float, default: float = 0.0) -> float:
    y = float(x)
    return y if math.isfinite(y) else float(default)


@dataclass
class V56Config(V55Config):
    """V56: multi-timescale predictive cognition + learned latent planning + consolidation."""

    mts_hidden_v56: int = 22
    mts_fast_rate_v56: float = 0.55
    mts_medium_rate_v56: float = 0.22
    mts_slow_rate_v56: float = 0.07
    mts_fusion_temperature_v56: float = 0.35
    mts_prediction_weight_v56: float = 0.70
    mts_consistency_weight_v56: float = 0.30
    mts_learning_rate_v56: float = 6e-4
    mts_train_updates_v56: int = 1

    consolidation_slow_slots_v56: int = 8
    consolidation_rate_v56: float = 0.035
    consolidation_threshold_v56: float = 0.28
    consolidation_similarity_v56: float = 0.86
    consolidation_replay_limit_v56: int = 64

    plan_horizon_v56: int = 4
    plan_hidden_v56: int = 30
    plan_learning_rate_v56: float = 7e-4
    plan_train_updates_v56: int = 2
    plan_min_pairs_v56: int = 18
    plan_min_margin_v56: float = 0.012
    plan_max_uncertainty_v56: float = 0.48
    plan_blend_v56: float = 0.10
    plan_delta_limit_v56: float = 0.10

    budget_uncertainty_v56: float = 0.38
    budget_surprise_v56: float = 0.30
    budget_low_confidence_v56: float = 0.42
    budget_max_depth_v56: int = 3
    budget_planner_min_depth_v56: int = 2

    fast_memory_weight_v56: float = 0.70
    slow_memory_weight_v56: float = 0.30
    memory_top_k_v56: int = 3

    unified_state_version_v56: int = 1


def mobile_v56_config(raw_observation_dim: int = 9) -> V56Config:
    base = dict(mobile_v55_config(raw_observation_dim).__dict__)
    return V56Config(
        **base,
        mts_hidden_v56=18,
        mts_fast_rate_v56=0.60,
        mts_medium_rate_v56=0.24,
        mts_slow_rate_v56=0.075,
        mts_fusion_temperature_v56=0.38,
        mts_prediction_weight_v56=0.70,
        mts_consistency_weight_v56=0.30,
        mts_learning_rate_v56=6e-4,
        mts_train_updates_v56=1,
        consolidation_slow_slots_v56=6,
        consolidation_rate_v56=0.04,
        consolidation_threshold_v56=0.28,
        consolidation_similarity_v56=0.87,
        consolidation_replay_limit_v56=48,
        plan_horizon_v56=4,
        plan_hidden_v56=24,
        plan_learning_rate_v56=7e-4,
        plan_train_updates_v56=2,
        plan_min_pairs_v56=12,
        plan_min_margin_v56=0.012,
        plan_max_uncertainty_v56=0.48,
        plan_blend_v56=0.08,
        plan_delta_limit_v56=0.085,
        budget_uncertainty_v56=0.35,
        budget_surprise_v56=0.26,
        budget_low_confidence_v56=0.42,
        budget_max_depth_v56=3,
        budget_planner_min_depth_v56=2,
        fast_memory_weight_v56=0.72,
        slow_memory_weight_v56=0.28,
        memory_top_k_v56=3,
        unified_state_version_v56=1,
    )


@dataclass
class MultiTimescaleStateV56:
    fast: Tensor
    medium: Tensor
    slow: Tensor
    fused: Tensor
    predicted_latent: Tensor
    uncertainty: Tensor
    consistency_error: Tensor
    step_index: int = 0


class MultiTimescalePredictorV56(nn.Module):
    """Compact fast/medium/slow latent dynamics.

    The three states are nested recurrent summaries. The slow state only changes modestly,
    while the fast state follows immediate observations. A learned fusion gate exposes one
    coherent state to downstream cognition, avoiding three competing memory owners.
    """

    def __init__(self, latent_dim: int, goal_dim: int, self_dim: int, memory_dim: int,
                 action_dim: int, body_dim: int, hidden: int = 22):
        super().__init__()
        self.latent_dim = int(latent_dim)
        self.hidden = int(hidden)
        self.input = nn.Sequential(
            nn.Linear(latent_dim + goal_dim + self_dim + memory_dim + action_dim + body_dim + 3, hidden * 2),
            nn.SiLU(),
            nn.Linear(hidden * 2, hidden),
            nn.SiLU(),
        )
        self.fast_cell = nn.GRUCell(hidden, hidden)
        self.medium_cell = nn.GRUCell(hidden * 2, hidden)
        self.slow_cell = nn.GRUCell(hidden * 2, hidden)
        self.fuse = nn.Sequential(
            nn.Linear(hidden * 4, hidden), nn.SiLU(), nn.Linear(hidden, 3)
        )
        self.pred_head = nn.Sequential(
            nn.Linear(hidden * 3, hidden * 2), nn.SiLU(), nn.Linear(hidden * 2, latent_dim)
        )
        self.uncertainty_head = nn.Sequential(
            nn.Linear(hidden * 3, hidden), nn.SiLU(), nn.Linear(hidden, 1), nn.Sigmoid()
        )
        self.fast_to_medium = nn.Linear(hidden, hidden, bias=False)
        self.medium_to_slow = nn.Linear(hidden, hidden, bias=False)

    def initial_state(self, batch: int, device=None, dtype=None) -> MultiTimescaleStateV56:
        z = lambda: torch.zeros(batch, self.hidden, device=device, dtype=dtype)
        l = torch.zeros(batch, self.latent_dim, device=device, dtype=dtype)
        return MultiTimescaleStateV56(z(), z(), z(), z(), l, torch.ones(batch, 1, device=device, dtype=dtype), torch.zeros(batch, 1, device=device, dtype=dtype), 0)

    @torch.no_grad()
    def step(self, state: MultiTimescaleStateV56, *, latent: Tensor, goal: Tensor, self_state: Tensor,
             memory: Tensor, action: Tensor, body: Tensor, uncertainty: Tensor, prediction_error: Tensor,
             confidence: Tensor, fast_rate: float = 0.55, medium_rate: float = 0.22,
             slow_rate: float = 0.07, temperature: float = 0.35) -> Dict[str, Tensor | MultiTimescaleStateV56]:
        z, g, s, m, a, b = map(_batch, (latent, goal, self_state, memory, action, body))
        extras = torch.cat([_batch(uncertainty).reshape(-1, 1), _batch(prediction_error).reshape(-1, 1), _batch(confidence).reshape(-1, 1)], -1)
        x = self.input(torch.cat([z, g, s, m, a, b, extras], -1))
        fast_new = self.fast_cell(x, state.fast)
        medium_new = self.medium_cell(torch.cat([x, fast_new], -1), state.medium)
        slow_new = self.slow_cell(torch.cat([x, medium_new], -1), state.slow)
        fast_new = torch.tanh((1.0-fast_rate) * state.fast + fast_rate * fast_new)
        medium_new = torch.tanh((1.0-medium_rate) * state.medium + medium_rate * medium_new)
        slow_new = torch.tanh((1.0-slow_rate) * state.slow + slow_rate * slow_new)
        mix_logits = self.fuse(torch.cat([x, fast_new, medium_new, slow_new], -1)) / max(float(temperature), 0.05)
        mix = F.softmax(mix_logits, -1)
        fused = mix[:, 0:1] * fast_new + mix[:, 1:2] * medium_new + mix[:, 2:3] * slow_new
        triplet = torch.cat([fast_new, medium_new, slow_new], -1)
        predicted = z + 0.20 * torch.tanh(self.pred_head(triplet))
        uncertainty_new = self.uncertainty_head(triplet)
        consistency = 0.5 * (1.0 - F.cosine_similarity(_norm(self.fast_to_medium(fast_new)), _norm(medium_new), dim=-1, eps=1e-6)).unsqueeze(-1)
        consistency = consistency + 0.5 * (1.0 - F.cosine_similarity(_norm(self.medium_to_slow(medium_new)), _norm(slow_new), dim=-1, eps=1e-6)).unsqueeze(-1)
        next_state = MultiTimescaleStateV56(
            fast=fast_new.detach(), medium=medium_new.detach(), slow=slow_new.detach(), fused=fused.detach(),
            predicted_latent=predicted.detach(), uncertainty=uncertainty_new.detach(), consistency_error=consistency.detach(),
            step_index=state.step_index + 1,
        )
        return {'state': next_state, 'fused': fused.detach(), 'predicted_latent': predicted.detach(),
                'uncertainty': uncertainty_new.detach(), 'consistency_error': consistency.detach(), 'scale_weights': mix.detach()}

    def forward_training(self, state: MultiTimescaleStateV56, *, latent: Tensor, goal: Tensor, self_state: Tensor,
                         memory: Tensor, action: Tensor, body: Tensor, uncertainty: Tensor, prediction_error: Tensor,
                         confidence: Tensor, fast_rate: float = 0.55, medium_rate: float = 0.22,
                         slow_rate: float = 0.07, temperature: float = 0.35) -> Dict[str, Tensor]:
        """Differentiable replay of one inference transition for online learning."""
        z, g, s, m, a, b = map(_batch, (latent, goal, self_state, memory, action, body))
        extras = torch.cat([_batch(uncertainty).reshape(-1, 1), _batch(prediction_error).reshape(-1, 1), _batch(confidence).reshape(-1, 1)], -1)
        x = self.input(torch.cat([z, g, s, m, a, b, extras], -1))
        fast_new = self.fast_cell(x, state.fast.detach())
        medium_new = self.medium_cell(torch.cat([x, fast_new], -1), state.medium.detach())
        slow_new = self.slow_cell(torch.cat([x, medium_new], -1), state.slow.detach())
        fast_new = torch.tanh((1.0-fast_rate) * state.fast.detach() + fast_rate * fast_new)
        medium_new = torch.tanh((1.0-medium_rate) * state.medium.detach() + medium_rate * medium_new)
        slow_new = torch.tanh((1.0-slow_rate) * state.slow.detach() + slow_rate * slow_new)
        mix = F.softmax(self.fuse(torch.cat([x, fast_new, medium_new, slow_new], -1)) / max(float(temperature), 0.05), -1)
        fused = mix[:, 0:1] * fast_new + mix[:, 1:2] * medium_new + mix[:, 2:3] * slow_new
        triplet = torch.cat([fast_new, medium_new, slow_new], -1)
        predicted = z + 0.20 * torch.tanh(self.pred_head(triplet))
        consistency = 0.5 * (1.0 - F.cosine_similarity(_norm(self.fast_to_medium(fast_new)), _norm(medium_new), dim=-1, eps=1e-6)).unsqueeze(-1)
        consistency = consistency + 0.5 * (1.0 - F.cosine_similarity(_norm(self.medium_to_slow(medium_new)), _norm(slow_new), dim=-1, eps=1e-6)).unsqueeze(-1)
        return {'predicted_latent': predicted, 'fused': fused, 'consistency_error': consistency, 'scale_weights': mix}

    def training_loss(self, fused_pred: Tensor, target_latent: Tensor, consistency_error: Tensor, target_error: Optional[Tensor] = None) -> Tensor:
        pred = _batch(fused_pred)
        target = _batch(target_latent).detach()
        mse = F.smooth_l1_loss(pred, target)
        if target_error is None:
            consistency = _batch(consistency_error).mean()
        else:
            consistency = F.smooth_l1_loss(_batch(consistency_error), _batch(target_error).detach().clamp_min(0.0))
        return mse + 0.15 * consistency


class ConsolidatingMemoryV56:
    """Single canonical two-timescale memory: V55 fast slots + V56 slow consolidated prototypes."""

    SCHEMA_VERSION = 'v56.1'

    def __init__(self, fast: NeuralAssociativeMemoryV55, slow_slots: int = 8, rate: float = 0.035,
                 threshold: float = 0.28, similarity: float = 0.86):
        self.fast = fast
        self.slow_slots = int(max(2, slow_slots))
        self.rate = float(max(0.001, rate))
        self.threshold = float(max(0.0, threshold))
        self.similarity = float(max(-1.0, min(0.999, similarity)))
        self.slow_keys = torch.zeros(self.slow_slots, fast.key_dim)
        self.slow_values = torch.zeros(self.slow_slots, fast.value_dim)
        self.slow_strength = torch.zeros(self.slow_slots)
        self.slow_age = torch.zeros(self.slow_slots, dtype=torch.long)
        self.consolidations = 0
        self.total_reads = 0

    def _ensure(self, device, dtype):
        self.fast._ensure(device, dtype)
        if self.slow_keys.device != device or self.slow_keys.dtype != dtype:
            self.slow_keys = self.slow_keys.to(device=device, dtype=dtype)
            self.slow_values = self.slow_values.to(device=device, dtype=dtype)
            self.slow_strength = self.slow_strength.to(device=device, dtype=dtype)
            self.slow_age = self.slow_age.to(device=device)

    @torch.no_grad()
    def read(self, query: Tensor) -> Dict[str, Tensor]:
        q = _norm(_batch(query)); self._ensure(q.device, q.dtype)
        fast = self.fast.read(q)
        if float(self.slow_strength.sum().item()) <= 0.0:
            return {**fast, 'slow_read': torch.zeros_like(fast['read']), 'slow_confidence': q.new_zeros((q.size(0), 1)), 'combined_read': fast['read']}
        sim = q @ _norm(self.slow_keys).t()
        logits = sim / 0.20 + torch.log(self.slow_strength.clamp_min(1e-4)).view(1, -1) - 0.0025 * self.slow_age.to(q).view(1, -1)
        attn = F.softmax(logits, -1)
        slow_read = attn @ self.slow_values
        slow_conf = (attn.max(-1, keepdim=True).values * self.slow_strength.sum().clamp(0.0, 1.0)).clamp(0.0, 1.0)
        combined = (0.72 * fast['read'] + 0.28 * slow_read)
        self.total_reads += int(q.size(0))
        return {**fast, 'slow_read': slow_read, 'slow_confidence': slow_conf, 'combined_read': combined}

    @torch.no_grad()
    def write(self, key: Tensor, value: Tensor, importance: Tensor | float, surprise: Tensor | float) -> Dict[str, Tensor]:
        k = _norm(_batch(key)); v = _batch(value); self._ensure(k.device, k.dtype)
        imp = (importance if torch.is_tensor(importance) else k.new_tensor([[float(importance)]]))
        sur = (surprise if torch.is_tensor(surprise) else k.new_tensor([[float(surprise)]]))
        imp = _batch(imp).reshape(-1, 1).to(k).mean().clamp(0.0, 1.0)
        sur = _batch(sur).reshape(-1, 1).to(k).mean().clamp(0.0, 1.0)
        fast_meta = self.fast.write(k, v, surprise=sur)
        score = 0.60 * sur + 0.40 * imp
        if float(score.item()) < self.threshold:
            self.slow_age.add_(1).clamp_(max=4096)
            return {**fast_meta, 'slow_written': k.new_zeros((1,1)), 'slow_slot': k.new_full((1,1), -1.0)}
        q = k.mean(0)
        if float(self.slow_strength.sum().item()) > 0.0:
            sims = _norm(self.slow_keys) @ q
            best = int(torch.argmax(sims).item())
            best_sim = float(sims[best].item())
        else:
            best = 0; best_sim = -1.0
        weakness = (1.0 - self.slow_strength).clamp(0.0, 1.0)
        stale = (self.slow_age.float() / max(1.0, float(self.slow_age.max().item()) + 1.0)).clamp(0.0, 1.0).to(k)
        slot_scores = 0.55 * weakness + 0.30 * stale
        slot = best if best_sim >= self.similarity else int(slot_scores.argmax().item())
        rate = self.rate * (0.6 + 0.4 * float(score.item()))
        if best_sim >= self.similarity:
            self.slow_keys[slot].mul_(1.0-rate).add_(rate*q)
            self.slow_values[slot].mul_(1.0-rate).add_(rate*v.mean(0))
        else:
            self.slow_keys[slot].copy_(q)
            self.slow_values[slot].copy_(v.mean(0))
        self.slow_strength[slot] = min(1.0, float(self.slow_strength[slot].item() + rate * (0.5 + 0.5 * float(score.item()))))
        self.slow_age.add_(1).clamp_(max=4096); self.slow_age[slot] = 0
        self.consolidations += 1
        return {**fast_meta, 'slow_written': k.new_ones((1,1)), 'slow_slot': k.new_tensor([[float(slot)]])}

    def state_dict(self) -> Dict[str, Any]:
        return {
            'schema_version': self.SCHEMA_VERSION,
            'fast': self.fast.state_dict(),
            'slow_slots': self.slow_slots, 'rate': self.rate, 'threshold': self.threshold, 'similarity': self.similarity,
            'slow_keys': self.slow_keys.cpu(), 'slow_values': self.slow_values.cpu(),
            'slow_strength': self.slow_strength.cpu(), 'slow_age': self.slow_age.cpu(),
            'consolidations': self.consolidations, 'total_reads': self.total_reads,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        if state.get('fast') is not None: self.fast.load_state_dict(state['fast'])
        self.slow_slots = int(state.get('slow_slots', self.slow_slots)); self.rate=float(state.get('rate', self.rate))
        self.threshold=float(state.get('threshold', self.threshold)); self.similarity=float(state.get('similarity', self.similarity))
        self.slow_keys=state.get('slow_keys', self.slow_keys).detach().cpu().float().clone()
        self.slow_values=state.get('slow_values', self.slow_values).detach().cpu().float().clone()
        self.slow_strength=state.get('slow_strength', self.slow_strength).detach().cpu().float().clone()
        self.slow_age=state.get('slow_age', self.slow_age).detach().cpu().long().clone()
        self.consolidations=int(state.get('consolidations',0)); self.total_reads=int(state.get('total_reads',0))


class LatentPlanOptimizerV56(nn.Module):
    """Amortized multi-step proposal: predicts a reusable plan delta rather than running CEM each query."""

    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int, horizon: int = 4, hidden: int = 30, delta_limit: float = 0.10):
        super().__init__()
        self.latent_dim=int(latent_dim); self.goal_dim=int(goal_dim); self.action_dim=int(action_dim)
        self.horizon=int(max(1,horizon)); self.delta_limit=float(max(0.01,delta_limit))
        self.context=nn.Sequential(nn.Linear(latent_dim+goal_dim,hidden*2),nn.SiLU(),nn.Linear(hidden*2,hidden),nn.SiLU())
        self.sequence=nn.GRUCell(action_dim,hidden)
        self.delta_head=nn.Linear(hidden,action_dim)
        self.conf_head=nn.Sequential(nn.Linear(hidden,hidden//2),nn.SiLU(),nn.Linear(hidden//2,1),nn.Sigmoid())
        self.value_head=nn.Sequential(nn.Linear(hidden,hidden//2),nn.SiLU(),nn.Linear(hidden//2,1))

    def forward(self, latent: Tensor, goal: Tensor, baseline_actions: Tensor) -> Dict[str, Tensor]:
        z=_batch(latent); g=_batch(goal); base=baseline_actions
        if base.ndim==2: base=base.unsqueeze(1)
        ctx=self.context(torch.cat([z,g],-1)); h=torch.zeros(z.size(0),ctx.size(-1),device=z.device,dtype=z.dtype)
        # Use the first action as the recurrent seed. Subsequent steps share one compact hidden state.
        deltas=[]; conf=[]; vals=[]
        for t in range(self.horizon):
            seed=base[:,min(t,base.size(1)-1)]
            h=self.sequence(seed,h+ctx)
            deltas.append(self.delta_limit*torch.tanh(self.delta_head(h)).unsqueeze(1))
            conf.append(self.conf_head(h).unsqueeze(1)); vals.append(self.value_head(h).unsqueeze(1))
        delta=torch.cat(deltas,1); confidence=torch.cat(conf,1); values=torch.cat(vals,1)
        plan=(base[:,:self.horizon]+delta).clamp(-1.0,1.0)
        return {'plan':plan,'delta':delta,'confidence':confidence,'value_trace':values,'mean_confidence':confidence.mean(1,keepdim=True)}

    def masked_loss(self, pred: Dict[str, Tensor], target_actions: Tensor, mask: Tensor, target_advantage: Tensor, weight: Tensor) -> Tensor:
        h=min(pred['plan'].size(1), target_actions.size(1))
        m=mask[:,:h].to(pred['plan']); err=(pred['plan'][:,:h]-target_actions[:,:h]).pow(2)
        denom=m.sum().clamp_min(1.0)
        imitation=(err*m).sum()/denom
        pred_value=pred['value_trace'][:,:h].mean(1).reshape(-1)
        advantage_target=target_advantage.reshape(-1)
        value_loss=F.smooth_l1_loss(pred_value, advantage_target, reduction='none')
        w=weight.reshape(-1).clamp(0.1,1.0)
        return ((0.75*imitation)+(0.25*(value_loss*w).mean()))


@dataclass
class PlanTrainingStatsV56:
    loss: float
    observations: int
    updates: int


class LatentPlanTrainerV56:
    def __init__(self, planner: LatentPlanOptimizerV56, lr: float=7e-4):
        self.planner=planner
        self.optimizer=torch.optim.AdamW(planner.parameters(),lr=lr,weight_decay=1e-4)
        self.observations=0; self.update_steps=0

    def train_from_v54_replay(self, replay, batch_size:int=12, updates:int=2) -> PlanTrainingStatsV56:
        if replay.count==0: return PlanTrainingStatsV56(0.0,0,0)
        losses=[]; seen=0
        for _ in range(max(1,int(updates))):
            b=replay.sample(min(batch_size,replay.count),device=next(self.planner.parameters()).device)
            pred=self.planner(b['latent'],b['goal'],b['candidate_actions']*0.0+b['baseline_actions'])
            loss=self.planner.masked_loss(pred,b['candidate_actions'],b['mask'],b['target_advantage'],b['weight'])
            if not torch.isfinite(loss):
                continue
            self.optimizer.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.planner.parameters(),1.0); self.optimizer.step()
            losses.append(float(loss.detach().item())); seen += int(b['latent'].size(0)); self.update_steps += 1
        self.observations += seen
        return PlanTrainingStatsV56(float(sum(losses)/len(losses)) if losses else 0.0, seen, len(losses))


@dataclass
class CognitiveBudgetStateV56:
    pressure: float
    depth: int
    planner_allowed: bool
    memory_priority: float
    reason: str


class CognitiveBudgetControllerV56:
    def __init__(self, uncertainty_threshold:float=0.38, surprise_threshold:float=0.30,
                 low_confidence_threshold:float=0.42, max_depth:int=3, planner_min_depth:int=2):
        self.uncertainty_threshold=float(uncertainty_threshold); self.surprise_threshold=float(surprise_threshold)
        self.low_confidence_threshold=float(low_confidence_threshold); self.max_depth=int(max(1,max_depth)); self.planner_min_depth=int(max(1,planner_min_depth))

    def decide(self, uncertainty:float, surprise:float, confidence:float, consistency:float) -> CognitiveBudgetStateV56:
        pressure=max(0.0,min(1.0,
            0.35*max(0.0,float(uncertainty))/max(self.uncertainty_threshold,1e-4)
            +0.25*max(0.0,float(surprise))/max(self.surprise_threshold,1e-4)
            +0.25*max(0.0,1.0-float(confidence))/max(1.0-self.low_confidence_threshold,1e-4)
            +0.15*float(consistency)))
        depth=1+int(round(pressure*(self.max_depth-1)))
        planner_allowed=depth>=self.planner_min_depth
        reasons=[]
        if uncertainty>=self.uncertainty_threshold: reasons.append('world_uncertainty')
        if surprise>=self.surprise_threshold: reasons.append('surprise')
        if confidence<=self.low_confidence_threshold: reasons.append('low_confidence')
        if consistency>0.35: reasons.append('scale_disagreement')
        return CognitiveBudgetStateV56(pressure,depth,planner_allowed,pressure,'+'.join(reasons) if reasons else 'stable')


class NeuroWeaveV56(NeuroWeaveV55):
    """V56 canonical model: V55 cognition + multi-timescale latent dynamics + amortized planning."""

    def __init__(self, cfg: Optional[V56Config]=None):
        super().__init__(cfg or V56Config())
        self.cfg:V56Config
        c=self.cfg
        self.multiscale_v56=MultiTimescalePredictorV56(
            c.latent_dim_v46,c.latent_dim_v46,c.d,c.memory_value_dim_v55,c.action_dim,c.body_dim,c.mts_hidden_v56
        )
        self.latent_planner_v56=LatentPlanOptimizerV56(
            c.latent_dim_v46,c.latent_dim_v46,c.action_dim,c.plan_horizon_v56,c.plan_hidden_v56,c.plan_delta_limit_v56
        )


class OrganismRuntimeV56(OrganismRuntimeV55):
    """V56 runtime: one live path for fast/slow memory, multi-timescale state and learned plan proposals."""

    def __init__(self, model:NeuroWeaveV56, trainer:Optional['OrganismTrainerV56']=None):
        super().__init__(model,trainer)
        self.model:NeuroWeaveV56=model; self.trainer=trainer
        c=model.cfg
        dev=next(model.parameters()).device; dt=next(model.parameters()).dtype
        self.multiscale_state_v56=model.multiscale_v56.initial_state(1,device=dev,dtype=dt)
        self.memory_v56=ConsolidatingMemoryV56(self.memory_v55,c.consolidation_slow_slots_v56,c.consolidation_rate_v56,c.consolidation_threshold_v56,c.consolidation_similarity_v56)
        self.budget_v56=CognitiveBudgetControllerV56(c.budget_uncertainty_v56,c.budget_surprise_v56,c.budget_low_confidence_v56,c.budget_max_depth_v56,c.budget_planner_min_depth_v56)
        self._pending_v56:Dict[str,Any]={}
        self.multiscale_update_steps_v56=0; self.consolidation_writes_v56=0; self.plan_decisions_v56=0; self.plan_accepts_v56=0; self.plan_update_steps_v56=0

    def _ensure_batch_state_v56(self,batch:int,device,dtype)->None:
        if self.multiscale_state_v56.fast.size(0)!=batch or self.multiscale_state_v56.fast.device!=device or self.multiscale_state_v56.fast.dtype!=dtype:
            self.multiscale_state_v56=self.model.multiscale_v56.initial_state(batch,device=device,dtype=dtype)
            self.memory_v55=self.memory_v56.fast
            self.memory_v56.fast=self.memory_v55

    @torch.no_grad()
    def step(self,observation:Tensor,goal:Optional[Tensor]=None)->Dict[str,Tensor]:
        out=super().step(observation,goal=goal)
        obs=_batch(observation); self._ensure_batch_state_v56(obs.size(0),obs.device,obs.dtype)
        latent=out['brain_current_latent_v47']; cognitive_goal=out['v55_effective_goal']
        body=out.get('body_state_v30',obs.new_zeros((obs.size(0),self.model.cfg.body_dim)))
        mem=self.memory_v56.read(latent)['combined_read']
        uncertainty=out.get('world50_uncertainty',obs.new_zeros((1,1))).reshape(-1,1)
        prediction_error=out.get('prediction_error',obs.new_zeros((1,1))).reshape(-1,1)
        confidence=out.get('brain_confidence_v47',out.get('confidence',obs.new_ones((1,1)))).reshape(-1,1)
        pre_mts = MultiTimescaleStateV56(
            fast=self.multiscale_state_v56.fast.detach().clone(), medium=self.multiscale_state_v56.medium.detach().clone(),
            slow=self.multiscale_state_v56.slow.detach().clone(), fused=self.multiscale_state_v56.fused.detach().clone(),
            predicted_latent=self.multiscale_state_v56.predicted_latent.detach().clone(),
            uncertainty=self.multiscale_state_v56.uncertainty.detach().clone(),
            consistency_error=self.multiscale_state_v56.consistency_error.detach().clone(), step_index=self.multiscale_state_v56.step_index
        )
        mts=self.model.multiscale_v56.step(
            self.multiscale_state_v56,latent=latent,goal=cognitive_goal,self_state=self.self_model_state_v55.self_state,
            memory=mem,action=out['chosen_action_v55'],body=body,uncertainty=uncertainty,prediction_error=prediction_error,
            confidence=confidence,fast_rate=self.model.cfg.mts_fast_rate_v56,medium_rate=self.model.cfg.mts_medium_rate_v56,
            slow_rate=self.model.cfg.mts_slow_rate_v56,temperature=self.model.cfg.mts_fusion_temperature_v56,
        )
        self.multiscale_state_v56=mts['state']  # type: ignore[assignment]
        budget=self.budget_v56.decide(float(uncertainty.mean()),float(prediction_error.mean()),float(confidence.mean()),float(mts['consistency_error'].mean()))
        action=out['chosen_action_v55']
        plan_accept=0.0; plan_margin=0.0; plan_conf=0.0
        if budget.planner_allowed and self.trainer is not None and self.trajectory_replay_v54.true_pair_count>=self.model.cfg.plan_min_pairs_v56 and self.trainer.latent_plan_trainer_v56.observations>=self.model.cfg.plan_min_pairs_v56:
            horizon=self.model.cfg.plan_horizon_v56
            base_seq=action.unsqueeze(1).expand(-1,horizon,-1)
            plan=self.model.latent_planner_v56(latent,cognitive_goal,base_seq)
            plan_action=plan['plan'][:,0]
            critic=self.model.counterfactual_advantage_critic_v53
            base_pred=critic(latent,out['brain_subgoal_v47'],action,action,uncertainty,out.get('regime51_severity',obs.new_zeros((1,1))),out.get('sensor51_health',obs.new_ones((1,1))))['mean']
            plan_pred=critic(latent,out['brain_subgoal_v47'],action,plan_action,uncertainty,out.get('regime51_severity',obs.new_zeros((1,1))),out.get('sensor51_health',obs.new_ones((1,1))))['mean']
            plan_margin=float((plan_pred-base_pred).mean().item()); plan_conf=float(plan['mean_confidence'].mean().item())
            rank=float(self.rank_monitor_v54.rank())
            if plan_margin>self.model.cfg.plan_min_margin_v56 and plan_conf>=0.45 and float(uncertainty.mean())<=self.model.cfg.plan_max_uncertainty_v56 and rank>=self.model.cfg.trajectory_min_rank_v54 and self.trajectory_calibrator_v54.ready:
                blend=self.model.cfg.plan_blend_v56
                action=((1.0-blend)*action+blend*plan_action).clamp(-1.0,1.0); plan_accept=1.0; self.plan_accepts_v56+=1
        self.plan_decisions_v56+=1
        self._pending_v56={
            'latent':latent[0].detach().cpu(),'goal':cognitive_goal[0].detach().cpu(),'self_state':self.self_model_state_v55.self_state[0].detach().cpu(),
            'memory':mem[0].detach().cpu(),'body':body[0].detach().cpu(),'action':action[0].detach().cpu(),'pre_multiscale':asdict(pre_mts),
            'uncertainty_tensor':uncertainty[0].detach().cpu(),'confidence_tensor':confidence[0].detach().cpu(),
            'predicted_latent':mts['predicted_latent'][0].detach().cpu(),
            'uncertainty':float(uncertainty.mean()),'prediction_error':float(prediction_error.mean()),
            'confidence':float(confidence.mean()),'consistency':float(mts['consistency_error'].mean()),
            'budget_depth':budget.depth,'plan_accept':bool(plan_accept>0.5),
        }
        out['v56_multiscale_fused']=mts['fused']; out['v56_multiscale_prediction']=mts['predicted_latent'];
        out['v56_multiscale_uncertainty']=mts['uncertainty']; out['v56_scale_consistency_error']=mts['consistency_error']; out['v56_scale_weights']=mts['scale_weights']
        out['v56_budget_pressure']=obs.new_tensor([[budget.pressure]]); out['v56_budget_depth']=obs.new_tensor([[float(budget.depth)]])
        out['v56_planner_allowed']=obs.new_tensor([[1.0 if budget.planner_allowed else 0.0]]); out['v56_plan_margin']=obs.new_tensor([[plan_margin]]); out['v56_plan_confidence']=obs.new_tensor([[plan_conf]]); out['v56_plan_admitted']=obs.new_tensor([[plan_accept]]); out['chosen_action_v56']=action
        return out

    def observe_transition(self,next_observation:Tensor,*,actual_reward:float,actual_risk:float,goal:Optional[Tensor]=None,update_world_model:bool=True)->Dict[str,Any]:
        if not self._pending_v56: raise RuntimeError('observe_transition requires a preceding V56 step')
        result=super().observe_transition(next_observation,actual_reward=actual_reward,actual_risk=actual_risk,goal=goal,update_world_model=update_world_model)
        p=self._pending_v56; nxt=_batch(next_observation); goal_t=p['goal'].to(nxt).reshape(1,-1); next_latent=_norm(self.model.target47(torch.cat([nxt,goal_t[:, :self.model.cfg.goal_dim]],-1))).detach()
        predicted=p['predicted_latent'].to(nxt).reshape(1,-1)
        target_error=(1.0-F.cosine_similarity(_norm(predicted),_norm(next_latent),dim=-1,eps=1e-6)).reshape(1,1)
        # Importance couples external consequence, surprise, and self revision; high-importance events
        # reach the slow store, while ordinary transitions remain in fast test-time memory.
        self_revision=float(result.get('v55_self_revision_gate',nxt.new_zeros((1,1))).mean()) if torch.is_tensor(result.get('v55_self_revision_gate')) else 0.0
        importance=min(1.0,max(0.0,0.50*abs(float(actual_reward))+0.20*float(p['prediction_error'])+0.20*self_revision+0.10*float(target_error.item())))
        self.memory_v56._ensure(nxt.device,nxt.dtype)
        memmeta=self.memory_v56.write(p['latent'].to(nxt),next_latent,importance,target_error)
        self.consolidation_writes_v56+=int(float(memmeta['slow_written'].item())>0.5)
        if self.trainer is not None:
            state_for_training=MultiTimescaleStateV56(**{k:v.to(nxt) if torch.is_tensor(v) else v for k,v in p['pre_multiscale'].items()})
            loss=self.trainer.train_multiscale_v56(
                state_for_training, latent=p['latent'].to(nxt).reshape(1,-1), goal=p['goal'].to(nxt).reshape(1,-1),
                self_state=p['self_state'].to(nxt).reshape(1,-1), memory=p['memory'].to(nxt).reshape(1,-1),
                action=p['action'].to(nxt).reshape(1,-1), body=p['body'].to(nxt).reshape(1,-1),
                uncertainty=p['uncertainty_tensor'].to(nxt).reshape(1,-1), prediction_error=nxt.new_tensor([[float(p['prediction_error'])]]),
                confidence=p['confidence_tensor'].to(nxt).reshape(1,-1), target_latent=next_latent
            )
            result['v56_multiscale_loss']=float(loss); self.multiscale_update_steps_v56+=1
            if self.trajectory_replay_v54.true_pair_count>=self.model.cfg.plan_min_pairs_v56:
                st=self.trainer.latent_plan_trainer_v56.train_from_v54_replay(self.trajectory_replay_v54,batch_size=min(12,self.trajectory_replay_v54.count),updates=self.model.cfg.plan_train_updates_v56)
                self.plan_update_steps_v56+=int(st.updates); result['v56_plan_loss']=float(st.loss)
        result['v56_multiscale_target_error']=target_error; result['v56_slow_memory_written']=memmeta['slow_written']; result['v56_slow_memory_slot']=memmeta['slow_slot']; result['v56_budget_depth']=float(p['budget_depth']); result['v56_consolidation_count']=float(self.memory_v56.consolidations); result['v56_plan_accept_count']=float(self.plan_accepts_v56)
        self._pending_v56={}
        return result

    def state_dict(self)->Dict[str,Any]:
        return {**super().state_dict(),
                'multiscale_state_v56':{k:(v.detach().cpu() if torch.is_tensor(v) else v) for k,v in asdict(self.multiscale_state_v56).items()},
                'memory_v56':self.memory_v56.state_dict(),'pending_v56':copy.deepcopy(self._pending_v56),
                'multiscale_update_steps_v56':self.multiscale_update_steps_v56,'consolidation_writes_v56':self.consolidation_writes_v56,
                'plan_decisions_v56':self.plan_decisions_v56,'plan_accepts_v56':self.plan_accepts_v56,'plan_update_steps_v56':self.plan_update_steps_v56}

    def load_state_dict(self,state:Dict[str,Any])->None:
        super().load_state_dict(state)
        ss=state.get('multiscale_state_v56')
        if ss: self.multiscale_state_v56=MultiTimescaleStateV56(**{k:(v.clone() if torch.is_tensor(v) else v) for k,v in ss.items()})
        if state.get('memory_v56') is not None: self.memory_v56.load_state_dict(state['memory_v56'])
        self._pending_v56=state.get('pending_v56') or {}
        self.multiscale_update_steps_v56=int(state.get('multiscale_update_steps_v56',0)); self.consolidation_writes_v56=int(state.get('consolidation_writes_v56',0)); self.plan_decisions_v56=int(state.get('plan_decisions_v56',0)); self.plan_accepts_v56=int(state.get('plan_accepts_v56',0)); self.plan_update_steps_v56=int(state.get('plan_update_steps_v56',0))


class OrganismTrainerV56(OrganismTrainerV55):
    def __init__(self,model:NeuroWeaveV56,lr:float=3e-4,warmup_steps:int=4,external_verifier=None):
        super().__init__(model,lr=lr,warmup_steps=warmup_steps,external_verifier=external_verifier)
        self.model:NeuroWeaveV56=model
        self.multiscale_optimizer=torch.optim.AdamW(model.multiscale_v56.parameters(),lr=model.cfg.mts_learning_rate_v56,weight_decay=1e-4)
        self.latent_plan_trainer_v56=LatentPlanTrainerV56(model.latent_planner_v56,lr=model.cfg.plan_learning_rate_v56)

    def train_multiscale_v56(self,state:MultiTimescaleStateV56,*,latent:Tensor,goal:Tensor,self_state:Tensor,memory:Tensor,action:Tensor,body:Tensor,uncertainty:Tensor,prediction_error:Tensor,confidence:Tensor,target_latent:Tensor)->float:
        pred=self.model.multiscale_v56.forward_training(state,latent=latent,goal=goal,self_state=self_state,memory=memory,action=action,body=body,uncertainty=uncertainty,prediction_error=prediction_error,confidence=confidence,fast_rate=self.model.cfg.mts_fast_rate_v56,medium_rate=self.model.cfg.mts_medium_rate_v56,slow_rate=self.model.cfg.mts_slow_rate_v56,temperature=self.model.cfg.mts_fusion_temperature_v56)
        target=target_latent.detach()
        loss=F.smooth_l1_loss(pred['predicted_latent'],target)+0.08*pred['consistency_error'].mean()
        if not torch.isfinite(loss): return 0.0
        self.multiscale_optimizer.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.multiscale_v56.parameters(),1.0); self.multiscale_optimizer.step(); return float(loss.detach().item())


class RuntimeStateStoreV56(RuntimeStateStoreV55):
    VERSION=1
    @classmethod
    def save(cls,path,model:NeuroWeaveV56,trainer:Optional[OrganismTrainerV56]=None,runtime:Optional[OrganismRuntimeV56]=None):
        RuntimeStateStoreV55.save(path,model,trainer,runtime)
        payload=torch.load(path,map_location='cpu',weights_only=False)
        payload['v56']={'multiscale':model.multiscale_v56.state_dict(),'latent_planner':model.latent_planner_v56.state_dict(),
                        'multiscale_optimizer':trainer.multiscale_optimizer.state_dict() if trainer else None,
                        'latent_plan_optimizer':trainer.latent_plan_trainer_v56.optimizer.state_dict() if trainer else None,
                        'latent_plan_updates':trainer.latent_plan_trainer_v56.update_steps if trainer else 0,
                        'latent_plan_observations':trainer.latent_plan_trainer_v56.observations if trainer else 0,
                        'runtime':runtime.state_dict() if runtime else None}
        payload['version_v56']=cls.VERSION; torch.save(payload,path)

    @classmethod
    def load(cls,path,model:NeuroWeaveV56,trainer:Optional[OrganismTrainerV56]=None,runtime:Optional[OrganismRuntimeV56]=None,device=None):
        payload=RuntimeStateStoreV55.load(path,model,trainer,runtime,device=device); v=payload.get('v56') or {}
        if v.get('multiscale') is not None: model.multiscale_v56.load_state_dict(v['multiscale'])
        if v.get('latent_planner') is not None: model.latent_planner_v56.load_state_dict(v['latent_planner'])
        if trainer is not None:
            if v.get('multiscale_optimizer') is not None: trainer.multiscale_optimizer.load_state_dict(v['multiscale_optimizer'])
            if v.get('latent_plan_optimizer') is not None: trainer.latent_plan_trainer_v56.optimizer.load_state_dict(v['latent_plan_optimizer'])
            trainer.latent_plan_trainer_v56.update_steps=int(v.get('latent_plan_updates',0)); trainer.latent_plan_trainer_v56.observations=int(v.get('latent_plan_observations',0))
        if runtime is not None and v.get('runtime') is not None: runtime.load_state_dict(v['runtime'])
        return payload


__all__=[
    'V56Config','mobile_v56_config','MultiTimescaleStateV56','MultiTimescalePredictorV56','ConsolidatingMemoryV56',
    'LatentPlanOptimizerV56','PlanTrainingStatsV56','LatentPlanTrainerV56','CognitiveBudgetStateV56','CognitiveBudgetControllerV56',
    'NeuroWeaveV56','OrganismRuntimeV56','OrganismTrainerV56','RuntimeStateStoreV56',
]
