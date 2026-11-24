from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple, List
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v31 import (
    V31Config,
    V31State,
    NeuroWeaveV31,
)


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _discounted_returns(reward: Tensor, gamma: float) -> Tensor:
    out = torch.zeros_like(reward)
    running = torch.zeros_like(reward[:, 0])
    for t in range(reward.size(1) - 1, -1, -1):
        running = reward[:, t] + gamma * running
        out[:, t] = running
    return out


@dataclass
class V32Config(V31Config):
    """V32 configuration: learned foresight selection + hierarchical refinement + replay.

    Defaults are deliberately compact so the architecture can run on a phone-sized
    model. Larger settings are explicit experiments, not silently enabled complexity.
    """

    ensemble_heads: int = 2
    refine_steps: int = 1
    coarse_stride: int = 2
    foresight_scale: float = 0.20
    refinement_scale: float = 0.12
    risk_aversion: float = 0.45
    uncertainty_weight: float = 0.08
    plan_improvement_weight: float = 0.10
    foresight_gate_weight: float = 0.08
    multistep_weight: float = 0.08
    replay_weight: float = 0.08
    replay_capacity: int = 256
    replay_batch: int = 8
    replay_priority_alpha: float = 0.60
    replay_epsilon: float = 1e-3
    adaptive_balance: bool = True
    balance_ema: float = 0.98
    balance_floor: float = 0.20
    consistency_temperature: float = 0.20
    legacy_rule_scale: float = 1.0


class ForesightEnsembleV32(nn.Module):
    """Tiny shared-trunk ensemble for uncertainty-aware external forecasting."""

    def __init__(self, d: int, hidden: int, action_dim: int, body_dim: int, heads: int = 2):
        super().__init__()
        self.d = d
        self.heads = heads
        self.trunk = nn.Sequential(
            nn.Linear(2 * d + action_dim + body_dim, hidden),
            nn.SiLU(),
            nn.Linear(hidden, hidden),
            nn.SiLU(),
        )
        self.next_heads = nn.ModuleList([nn.Linear(hidden, d) for _ in range(heads)])
        self.reward_heads = nn.ModuleList([nn.Linear(hidden, 1) for _ in range(heads)])
        self.risk_heads = nn.ModuleList([nn.Linear(hidden, 1) for _ in range(heads)])
        self.logvar_heads = nn.ModuleList([nn.Linear(hidden, d) for _ in range(heads)])

    def forward(self, z: Tensor, action: Tensor, body: Tensor, external_state: Tensor) -> Dict[str, Tensor]:
        h = self.trunk(torch.cat([z, external_state, action, body], -1))
        nxt = torch.stack([torch.tanh(head(h)) for head in self.next_heads], 0)
        reward = torch.stack([torch.tanh(head(h)) for head in self.reward_heads], 0)
        risk = torch.stack([torch.sigmoid(head(h)) for head in self.risk_heads], 0)
        logvar = torch.stack([head(h).clamp(-6.0, 3.0) for head in self.logvar_heads], 0)
        mean = nxt.mean(0)
        disagreement = nxt.var(0, unbiased=False).mean(-1, keepdim=True)
        epistemic = disagreement.sqrt().clamp_min(1e-6)
        aleatoric = logvar.exp().mean(0).mean(-1, keepdim=True).sqrt()
        return {
            "next_mean": mean,
            "next_heads": nxt,
            "next_logvar": logvar.mean(0),
            "reward_mean": reward.mean(0),
            "risk_mean": risk.mean(0),
            "epistemic": epistemic,
            "aleatoric": aleatoric,
            "total_uncertainty": (epistemic + 0.25 * aleatoric),
        }


class HierarchicalPlanRefinerV32(nn.Module):
    """Learns to improve an already generated multi-step plan.

    Coarse actions are predicted at a lower temporal resolution and lifted to the
    candidate sequence; a small fine residual then corrects each step. This keeps
    inference cheap while creating an explicit learned plan-improvement path.
    """

    def __init__(self, d: int, hidden: int, action_dim: int, body_dim: int, max_horizon: int, candidates: int, stride: int = 2):
        super().__init__()
        self.d = d
        self.action_dim = action_dim
        self.max_horizon = max_horizon
        self.candidates = candidates
        self.stride = max(1, stride)
        context_dim = 2 * d + body_dim + 2
        self.context = nn.Sequential(nn.Linear(context_dim, hidden), nn.SiLU(), nn.Linear(hidden, hidden))
        coarse_steps = math.ceil(max_horizon / self.stride)
        self.coarse = nn.Linear(hidden + action_dim, coarse_steps * action_dim)
        self.fine = nn.Sequential(nn.Linear(hidden + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, max_horizon * action_dim))
        self.delta_score = nn.Sequential(nn.Linear(hidden + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, goal: Tensor, body: Tensor, uncertainty: Tensor, base_actions: Tensor, steps: int = 1):
        B, K, H, A = base_actions.shape
        c = torch.cat([z, goal, body, uncertainty, base_actions.mean((1, 2))], -1)
        # base_actions.mean((1,2)) has A dims; the actual context has 2*d+body+1+A.
        # Rebuild with an explicit action summary so the declared dimension stays stable.
        c = torch.cat([z, goal, body, uncertainty, base_actions.mean((1, 2)).mean(-1, keepdim=True)], -1)
        h = self.context(c)
        coarse_steps = math.ceil(H / self.stride)
        coarse_seed = base_actions.mean(1)
        refined = base_actions
        score_delta = torch.zeros(B, K, device=z.device, dtype=z.dtype)
        for _ in range(max(1, steps)):
            # candidate-specific low-frequency context
            cand = refined.mean(2)
            cc = h.unsqueeze(1).expand(-1, K, -1)
            c0 = torch.cat([cc, cand], -1)
            coarse = self.coarse(c0).view(B, K, coarse_steps, A)
            coarse_up = coarse.repeat_interleave(self.stride, dim=2)[:, :, :H]
            fine = self.fine(c0).view(B, K, H, A)
            delta = torch.tanh(coarse_up + 0.5 * fine)
            refined = torch.tanh(refined + delta * 0.5)
            score_delta = score_delta + self.delta_score(c0).squeeze(-1)
        return refined, score_delta


class SelectiveForesightV32(nn.Module):
    """Chooses how strongly to trust imagined plans based on calibrated uncertainty."""

    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.gate = nn.Sequential(nn.Linear(d + d + 3, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.preference = nn.Sequential(nn.Linear(d + d + action_dim + 2, hidden), nn.SiLU(), nn.Linear(hidden, action_dim))

    def forward(self, z: Tensor, goal: Tensor, action_base: Tensor, uncertainty: Tensor, risk: Tensor, plan_adv: Tensor):
        g = torch.sigmoid(self.gate(torch.cat([z, goal, uncertainty, risk, plan_adv], -1)))
        pref = torch.tanh(self.preference(torch.cat([z, goal, action_base, uncertainty, risk], -1)))
        return g, pref


class OutcomeReplayV32:
    """Small prioritized replay buffer for real outcome tuples.

    Stores detached tensors only. It intentionally does not claim to replay the full
    organism state; V32 replays the external/world-model learning signal first.
    """

    def __init__(self, capacity: int = 256, alpha: float = 0.6, epsilon: float = 1e-3):
        self.capacity = capacity
        self.alpha = alpha
        self.epsilon = epsilon
        self.data: List[Dict[str, Tensor]] = []
        self.priority: List[float] = []

    def __len__(self):
        return len(self.data)

    def add(self, z: Tensor, action: Tensor, body: Tensor, external_state: Tensor, next_obs: Tensor, reward: Tensor, risk: Tensor):
        for i in range(z.size(0)):
            item = {k: v[i].detach().cpu() for k, v in {
                "z": z, "action": action, "body": body, "external_state": external_state,
                "next_obs": next_obs, "reward": reward, "risk": risk
            }.items()}
            p = max(self.priority, default=1.0)
            if len(self.data) >= self.capacity:
                self.data.pop(0); self.priority.pop(0)
            self.data.append(item); self.priority.append(float(p))

    def sample(self, n: int, device: torch.device, dtype: torch.dtype):
        if not self.data:
            return None
        n = min(n, len(self.data))
        weights = torch.tensor([max(p, self.epsilon) ** self.alpha for p in self.priority], dtype=torch.float32)
        probs = weights / weights.sum().clamp_min(self.epsilon)
        idx = torch.multinomial(probs, n, replacement=len(self.data) < n)
        batch = {k: torch.stack([self.data[int(i)][k] for i in idx]).to(device=device, dtype=dtype) for k in self.data[0]}
        return batch, idx

    def update_priority(self, idx: Tensor, losses: Tensor):
        for i, l in zip(idx.tolist(), losses.detach().flatten().tolist()):
            if 0 <= i < len(self.priority):
                self.priority[i] = float(abs(l) + self.epsilon)


class ObjectiveBalancerV32:
    """Simple EMA-based loss balancing; avoids one auxiliary objective taking over."""

    def __init__(self, ema: float = 0.98, floor: float = 0.20):
        self.ema = ema
        self.floor = floor
        self.state: Dict[str, float] = {}

    def weights(self, losses: Dict[str, Tensor]) -> Dict[str, float]:
        for k, v in losses.items():
            x = float(v.detach().abs().mean()) if torch.isfinite(v).all() else 1.0
            self.state[k] = self.ema * self.state.get(k, x) + (1.0 - self.ema) * max(x, self.floor)
        inv = {k: 1.0 / math.sqrt(max(v, self.floor)) for k, v in self.state.items()}
        s = sum(inv.values()) or 1.0
        scale = len(inv) / s
        return {k: float(inv[k] * scale) for k in inv}


@dataclass
class V32State:
    base: V31State
    semantic_rule_state: Tensor
    life_clock: Tensor


class NeuroWeaveV32(nn.Module):
    """V32: causal organism spine + learned plan improvement + selective foresight.

    V32 is explicitly experimental. It does not claim consciousness. Every new
    capability is connected to measurable outcome losses or runtime behavior.
    """

    def __init__(self, cfg: Optional[V32Config] = None):
        super().__init__()
        self.cfg = cfg or V32Config()
        c = self.cfg
        self.base = NeuroWeaveV31(V31Config(**{k: getattr(c, k) for k in V31Config.__dataclass_fields__.keys()}))
        self.ensemble = ForesightEnsembleV32(c.d, c.hidden, c.action_dim, c.body_dim, c.ensemble_heads)
        self.refiner = HierarchicalPlanRefinerV32(c.d, c.hidden, c.action_dim, c.body_dim, c.max_horizon, c.planner_candidates, c.coarse_stride)
        self.selective = SelectiveForesightV32(c.d, c.hidden, c.action_dim)
        self.rule_encoder = nn.Sequential(nn.Linear(3 * c.d + 2, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.d))
        self.rule_to_goal = nn.Sequential(nn.Linear(c.d, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.d))
        self.rule_readout = nn.Sequential(nn.Linear(c.d, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.d))
        self.rule_decay = nn.Parameter(torch.tensor(3.8918203))  # sigmoid ~= 0.98
        self.balancer = ObjectiveBalancerV32(c.balance_ema, c.balance_floor)

    def initial_state(self, b: int, device=None, dtype=None) -> V32State:
        base = self.base.initial_state(b, device=device, dtype=dtype)
        rules = torch.zeros(b, self.cfg.d, device=device, dtype=dtype)
        clock = torch.zeros(b, 1, device=device, dtype=dtype)
        return V32State(base=base, semantic_rule_state=rules, life_clock=clock)

    def _rule_state(self, previous: Tensor, predicted: Tensor, target: Tensor, reward: Tensor, risk: Tensor) -> Tensor:
        mismatch = (target - predicted).detach()
        h = self.rule_encoder(torch.cat([previous, predicted.detach(), mismatch, reward, risk], -1))
        decay = torch.sigmoid(self.rule_decay)
        return decay * previous + (1.0 - decay) * torch.tanh(h)

    def step(self, x: Tensor, state: V32State, goal: Optional[Tensor] = None, target_next: Optional[Tensor] = None,
             presence=None, modalities=None, proprioception=None, interoception=None, commit_memory: bool = True):
        o31, st31 = self.base.step(x, state.base, goal=goal, presence=presence, modalities=modalities,
                                   proprioception=proprioception, interoception=interoception, commit_memory=commit_memory)
        z = o31['fused_latent_v30']
        eff_goal = o31['effective_goal_v31']
        rule_goal = _norm(self.rule_to_goal(state.semantic_rule_state)) * float(self.cfg.legacy_rule_scale)
        effective_goal_v32 = _norm(0.90 * _norm(eff_goal[..., :z.size(-1)]) + 0.10 * rule_goal)
        body = o31['body_state_v30']
        base_action = o31['chosen_action_v31']
        base_actions = o31['action_candidates_v30']
        uncertainty = o31['uncertainty']
        ext_state = o31['external_state_v31']

        ens = self.ensemble(z, base_action, body, ext_state)
        refined_actions, refine_score = self.refiner(z, effective_goal_v32, body, ens['total_uncertainty'], base_actions, self.cfg.refine_steps)
        # Evaluate first actions under the learned external ensemble.
        B, K, H, A = refined_actions.shape
        cand_z = z.unsqueeze(1).expand(-1, K, -1)
        cand_body = body.unsqueeze(1).expand(-1, K, -1)
        cand_ext = ext_state.unsqueeze(1).expand(-1, K, -1)
        a0 = refined_actions[:, :, 0]
        flat = lambda q: q.reshape(-1, q.size(-1))
        # Aggregate ensemble one-step predictions across candidates.
        zf, af, bf, ef = flat(cand_z), flat(a0), flat(cand_body), flat(cand_ext)
        pred_ens = self.ensemble(zf, af, bf, ef)
        pred_mean = pred_ens['next_mean'].view(B, K, -1)
        pred_reward = pred_ens['reward_mean'].view(B, K, 1)
        pred_risk = pred_ens['risk_mean'].view(B, K, 1)
        unc_cf = pred_ens['total_uncertainty'].view(B, K, 1)
        goal_d = effective_goal_v32.unsqueeze(1)
        progress = (cand_z - goal_d).norm(dim=-1, keepdim=True) - (pred_mean - goal_d).norm(dim=-1, keepdim=True)
        cf_score = pred_reward + 0.15 * progress - self.cfg.risk_aversion * pred_risk - 0.10 * unc_cf
        score = o31['plan_scores_v30'] + refine_score + cf_score.squeeze(-1)
        best = score.argmax(-1)
        idx = torch.arange(B, device=z.device)
        refined_action = refined_actions[idx, best, 0]
        chosen_pred_next = pred_mean[idx, best]
        chosen_pred_reward = pred_reward[idx, best]
        chosen_pred_risk = pred_risk[idx, best]
        plan_adv = (score.max(-1, keepdim=True).values - o31['plan_scores_v30'].max(-1, keepdim=True).values).detach()
        gate, preference = self.selective(z, effective_goal_v32, base_action, ens['total_uncertainty'], o31['risk_v31'], plan_adv)
        final_action = torch.tanh((1.0 - self.cfg.foresight_scale * gate) * base_action +
                                  self.cfg.foresight_scale * gate * refined_action +
                                  0.04 * preference)
        # Predict the actual emitted action through the existing transition model.
        ggap = (o31['intrinsic_goal_v30'] - z).norm(dim=-1, keepdim=True)
        pred_z, pred_logvar, pred_reward2, pred_risk2 = self.base.base.transition(z, final_action, body, ggap)
        actual_next_internal = o31['next_observation_pred_v31']
        if target_next is None:
            target_next = actual_next_internal.detach()
        rule_state = self._rule_state(state.semantic_rule_state, ens['next_mean'], target_next, pred_reward2.detach(), pred_risk2.detach())

        # Replace only the final action-facing outputs, preserving the proven V31 state path.
        out = dict(o31)
        out.update({
            'foresight_next_v32': ens['next_mean'],
            'effective_goal_v32': effective_goal_v32,
            'rule_goal_v32': rule_goal,
            'foresight_next_heads_v32': ens['next_heads'],
            'foresight_reward_v32': ens['reward_mean'],
            'foresight_risk_v32': ens['risk_mean'],
            'foresight_uncertainty_v32': ens['total_uncertainty'],
            'foresight_epistemic_v32': ens['epistemic'],
            'foresight_aleatoric_v32': ens['aleatoric'],
            'refined_actions_v32': refined_actions,
            'refinement_score_v32': refine_score,
            'counterfactual_score_v32': cf_score.squeeze(-1),
            'chosen_predicted_next_v32': chosen_pred_next,
            'chosen_predicted_reward_v32': chosen_pred_reward,
            'chosen_predicted_risk_v32': chosen_pred_risk,
            'plan_scores_v32': score,
            'chosen_plan_index_v32': best,
            'planned_action_v32': refined_action,
            'foresight_gate_v32': gate,
            'foresight_preference_v32': preference,
            'chosen_action_v32': final_action,
            'transition_pred_v32': pred_z,
            'reward_v32': pred_reward2,
            'risk_v32': pred_risk2,
            'semantic_rule_state_v32': rule_state,
            'life_clock_v32': state.life_clock + 1,
        })
        new_base = V31State(base=st31.base,
            identity=st31.identity, life_clock=st31.life_clock)
        new_state = V32State(base=new_base, semantic_rule_state=rule_state.detach(), life_clock=state.life_clock + 1)
        out['_final_state'] = new_state
        return out, new_state

    def forward(self, x: Tensor, state: Optional[V32State] = None, goal_sequence=None, target_sequence=None,
                presence_sequence=None, modality_sequence=None, proprioception_sequence=None,
                interoception_sequence=None, commit_memory: bool = True) -> Dict[str, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.cfg.d:
            raise ValueError('x must be [B,T,D]')
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            target_next = target_sequence[:, t] if target_sequence is not None and target_sequence.shape[:2] == x.shape[:2] else None
            o, st = self.step(
                x[:, t], st,
                goal=goal_sequence[:, t] if goal_sequence is not None else None,
                target_next=target_next,
                presence=presence_sequence[:, t] if presence_sequence is not None else None,
                modalities=modality_sequence[:, t] if modality_sequence is not None else None,
                proprioception=proprioception_sequence[:, t] if proprioception_sequence is not None else None,
                interoception=interoception_sequence[:, t] if interoception_sequence is not None else None,
                commit_memory=commit_memory,
            )
            rows.append(o)
        tensors = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0] if torch.is_tensor(rows[0][k]) and k != '_final_state'}
        if 'foresight_next_heads_v32' in tensors:
            tensors['foresight_next_heads_v32'] = tensors['foresight_next_heads_v32'].permute(2, 0, 1, 3).contiguous()
        tensors['_final_state'] = st
        return tensors

    def _multistep_loss(self, out: Dict[str, Tensor], target_sequence: Optional[Tensor]) -> Tensor:
        z = out['fused_latent_v30']
        if target_sequence is None or target_sequence.shape != z.shape or z.size(1) < 3:
            return z.new_zeros(())
        nxt1 = out['foresight_next_v32'][:, :-2]
        # Predict t+2 using the same learned external model from the model's first prediction.
        a2 = out['chosen_action_v32'][:, 1:-1].detach()
        body2 = out['body_state_v30'][:, 1:-1].detach()
        second = self.ensemble(nxt1, a2, body2, nxt1)['next_mean']
        tgt2 = target_sequence[:, 2:].detach()
        return F.smooth_l1_loss(second, tgt2)

    def loss_parts(self, out: Dict[str, Tensor], target_sequence: Optional[Tensor] = None,
                   reward_sequence: Optional[Tensor] = None, risk_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        p31 = self.base.loss_parts(out, target_sequence=target_sequence, reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        z = out['fused_latent_v30']; zero = z.new_zeros(())
        if z.size(1) <= 1:
            return {k: zero for k in list(p31) + ['uncertainty', 'plan_improvement', 'foresight_gate', 'multistep', 'replay', 'rule_alignment']}
        tgt = target_sequence[:, 1:].detach() if target_sequence is not None and target_sequence.shape == z.shape else z[:, 1:].detach()
        pred = out['foresight_next_v32'][:, :-1]
        uncertainty = F.smooth_l1_loss(pred, tgt)
        # Ensemble head agreement is penalized only when real target exists; this is a grounded calibration signal.
        heads = out['foresight_next_heads_v32'][:, :, :-1]  # B,Hh,T,D
        head_loss = (heads - tgt.unsqueeze(1)).pow(2).mean()
        uncertainty = uncertainty + 0.25 * head_loss

        # Counterfactual selection: prefer candidates whose predicted next state is closer to the real next state.
        real_next = tgt
        cand = out['refined_actions_v32'][:, :-1, :, 0, :].permute(0, 2, 1, 3).contiguous()
        B, K, T, A = cand.shape
        flat_a = cand.reshape(B * K * T, A)
        z0 = z[:, :-1].unsqueeze(1).expand(-1, K, -1, -1).reshape(B * K * T, -1)
        body0 = out['body_state_v30'][:, :-1].unsqueeze(1).expand(-1, K, -1, -1).reshape(B * K * T, -1)
        ext0 = out['external_state_v31'][:, :-1].unsqueeze(1).expand(-1, K, -1, -1).reshape(B * K * T, -1)
        ens_cf = self.ensemble(z0, flat_a, body0, ext0)['next_mean'].reshape(B, K, T, -1)
        err = (ens_cf - real_next.unsqueeze(1)).pow(2).mean(-1)
        best_err = err.argmin(1)
        logits = -err.permute(0, 2, 1) / self.cfg.consistency_temperature
        plan_improvement = F.cross_entropy(logits.reshape(-1, K), best_err.detach().reshape(-1))

        # The gate target compares the base prediction with the consequence of the selected refined plan.
        base_pred = out['next_observation_pred_v31'][:, :-1]
        refined_pred = out['chosen_predicted_next_v32'][:, :-1]
        gate_target = torch.sigmoid(((base_pred - tgt).pow(2).mean(-1, keepdim=True) -
                                     (refined_pred - tgt).pow(2).mean(-1, keepdim=True)).detach() / self.cfg.consistency_temperature)
        gate = out['foresight_gate_v32'][:, :-1]
        foresight_gate = F.binary_cross_entropy(gate.clamp(1e-5, 1-1e-5), gate_target.clamp(1e-5, 1-1e-5))

        multistep = self._multistep_loss(out, target_sequence)
        # Actual outcome reward/risk are used to calibrate selected plan preference when available.
        if reward_sequence is not None and reward_sequence.shape[:2] == z.shape[:2]:
            rtg = _discounted_returns(reward_sequence.detach(), self.cfg.outcome_discount)[:, :-1]
            selected_value = torch.gather(out['plan_scores_v32'][:, :-1], -1, out['chosen_plan_index_v32'][:, :-1].unsqueeze(-1)).squeeze(-1)
            plan_improvement = plan_improvement + 0.5 * F.smooth_l1_loss(selected_value, rtg.squeeze(-1))

        rule_target = (tgt - out['foresight_next_v32'][:, :-1]).detach()
        rule_read = self.rule_readout(out['semantic_rule_state_v32'][:, :-1])
        rule_alignment = F.smooth_l1_loss(rule_read, rule_target)
        replay = zero
        return {**p31, 'uncertainty': uncertainty, 'plan_improvement': plan_improvement,
                'foresight_gate': foresight_gate, 'multistep': multistep, 'replay': replay, 'rule_alignment': rule_alignment}

    def training_loss(self, out: Dict[str, Tensor], **kwargs) -> Tensor:
        parts = self.loss_parts(out, **kwargs)
        c = self.cfg
        extra = {
            'uncertainty': parts['uncertainty'], 'plan_improvement': parts['plan_improvement'],
            'foresight_gate': parts['foresight_gate'], 'multistep': parts['multistep'], 'rule_alignment': parts['rule_alignment']
        }
        if c.adaptive_balance:
            w = self.balancer.weights(extra)
            configured = {'uncertainty': c.uncertainty_weight, 'plan_improvement': c.plan_improvement_weight,
                          'foresight_gate': c.foresight_gate_weight, 'multistep': c.multistep_weight,
                          'rule_alignment': 0.06}
            extra_loss = sum(configured[k] * w[k] * extra[k] for k in extra)
        else:
            extra_loss = (c.uncertainty_weight * extra['uncertainty'] + c.plan_improvement_weight * extra['plan_improvement'] +
                          c.foresight_gate_weight * extra['foresight_gate'] + c.multistep_weight * extra['multistep'] + 0.06 * extra['rule_alignment'])
        return self.base.training_loss(out, target_sequence=kwargs.get('target_sequence'),
                                      reward_sequence=kwargs.get('reward_sequence'), risk_sequence=kwargs.get('risk_sequence')) + extra_loss


class OrganismTrainerV32:
    """Trainer with real-outcome learning plus optional external-model replay.

    ``ingest_outcome`` is the minimal online bridge from a real environment to the
    replay/learning path. It stores only observed transition data; it never invents
    a synthetic next observation when the environment can provide a real one.
    """

    def __init__(self, model: NeuroWeaveV32, lr: float = 6e-4, warmup_steps: int = 2, max_norm: Optional[float] = None):
        self.model = model
        self.steps = 0
        self.warmup_steps = warmup_steps
        self.max_norm = max_norm or model.cfg.max_grad_norm
        self.optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=lr, weight_decay=1e-4)
        self.replay = OutcomeReplayV32(model.cfg.replay_capacity, model.cfg.replay_priority_alpha, model.cfg.replay_epsilon)

    def ingest_outcome(
        self,
        z: Tensor,
        action: Tensor,
        body: Tensor,
        external_state: Tensor,
        next_obs: Tensor,
        reward: Tensor,
        risk: Tensor,
    ) -> None:
        """Insert one or more real environment outcomes into replay.

        Shapes are ``[B,D]``/``[B,A]``/``[B,1]``. All values are detached before
        storage. This method is deliberately side-effect-only so inference code
        can submit outcomes without accidentally running an optimizer step.
        """
        tensors = [z, action, body, external_state, next_obs, reward, risk]
        if not tensors or any(t.ndim != 2 for t in tensors):
            raise ValueError('online outcome tensors must be rank-2 [B,F]')
        b = z.size(0)
        if any(t.size(0) != b for t in tensors):
            raise ValueError('all online outcome tensors must share batch size')
        self.replay.add(z, action, body, external_state, next_obs, reward, risk)

    def _replay_loss(self, dtype: torch.dtype, device: torch.device):
        sample = self.replay.sample(self.model.cfg.replay_batch, device, dtype)
        if sample is None:
            return torch.zeros((), device=device, dtype=dtype)
        batch, _ = sample
        pred = self.model.ensemble(batch['z'], batch['action'], batch['body'], batch['external_state'])
        per_next = F.smooth_l1_loss(pred['next_mean'], batch['next_obs'], reduction='none').mean(-1)
        per_r = F.smooth_l1_loss(pred['reward_mean'], batch['reward'], reduction='none').mean(-1)
        per_k = F.binary_cross_entropy(pred['risk_mean'].clamp(1e-5, 1-1e-5), batch['risk'].clamp(0, 1), reduction='none').mean(-1)
        return (per_next + 0.5 * per_r + 0.5 * per_k).mean(), sample[1], (per_next + 0.5 * per_r + 0.5 * per_k).detach()

    def step(self, x: Tensor, goal_sequence=None, target_sequence: Optional[Tensor] = None,
             reward_sequence: Optional[Tensor] = None, risk_sequence: Optional[Tensor] = None, **kwargs):
        self.optimizer.zero_grad(set_to_none=True)
        out = self.model(x, goal_sequence=goal_sequence, target_sequence=target_sequence, commit_memory=False, **kwargs)
        parts = self.model.loss_parts(out, target_sequence=target_sequence, reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        loss = self.model.training_loss(out, target_sequence=target_sequence, reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        # Store true observed transitions for subsequent replay. The target is explicitly external and detached.
        if target_sequence is not None and target_sequence.shape == x.shape:
            self.replay.add(out['fused_latent_v30'][:, :-1].reshape(-1, x.size(-1)),
                            out['chosen_action_v32'][:, :-1].reshape(-1, self.model.cfg.action_dim),
                            out['body_state_v30'][:, :-1].reshape(-1, self.model.cfg.body_dim),
                            out['external_state_v31'][:, :-1].reshape(-1, x.size(-1)),
                            target_sequence[:, 1:].reshape(-1, x.size(-1)),
                            (reward_sequence[:, 1:] if reward_sequence is not None else out['reward_v32'][:, :-1].detach()).reshape(-1, 1),
                            (risk_sequence[:, 1:] if risk_sequence is not None else out['risk_v32'][:, :-1].detach()).reshape(-1, 1))
        if self.steps >= self.warmup_steps and len(self.replay) > 0:
            replay_loss, replay_idx, replay_priority = self._replay_loss(x.dtype, x.device)
            loss = loss + self.model.cfg.replay_weight * replay_loss
        else:
            replay_idx = replay_priority = None
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.optimizer.param_groups[0]['params'], self.max_norm)
        self.optimizer.step()
        if replay_idx is not None:
            self.replay.update_priority(replay_idx, replay_priority)
        self.steps += 1
        return loss.detach(), out, parts
