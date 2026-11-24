from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v18.neuroweave_v13 import NeuroWeaveV13, V13State


@dataclass
class V14State:
    base: V13State
    fast_synapse: Tensor
    stable_synapse: Tensor
    eligibility: Tensor
    prev_error: Tensor
    confidence_mean: Tensor
    confidence_var: Tensor
    replay_keys: Tensor
    replay_targets: Tensor
    replay_priority: Tensor
    replay_ptr: Tensor
    drift_ema: Tensor


class SynapticConsolidationV14(nn.Module):
    """Two-timescale synapse: fast delta memory + slowly consolidated stable matrix."""

    def __init__(self, d: int):
        super().__init__()
        self.q = nn.Linear(d, d)
        self.v = nn.Linear(d, d)
        self.rate = nn.Sequential(nn.Linear(d + 4, d), nn.SiLU(), nn.Linear(d, 1))
        self.stable_rate = nn.Sequential(nn.Linear(d + 3, d), nn.SiLU(), nn.Linear(d, 1))

    def read(self, h: Tensor, fast: Tensor, stable: Tensor) -> Tensor:
        q = F.normalize(self.q(h), dim=-1)
        out_fast = torch.einsum("bij,bj->bi", fast, q)
        out_stable = torch.einsum("bij,bj->bi", stable, q)
        return 0.65 * out_fast + 0.35 * out_stable

    @torch.no_grad()
    def update(
        self,
        h: Tensor,
        target: Tensor,
        fast: Tensor,
        stable: Tensor,
        evidence: Tensor,
        stability: Tensor,
        novelty: Tensor,
        uncertainty: Tensor,
    ):
        q = F.normalize(self.q(h), dim=-1)
        v = torch.tanh(self.v(target))
        pred = torch.einsum("bij,bj->bi", fast, q)
        err = v - pred
        rate = torch.sigmoid(self.rate(torch.cat([h, evidence, stability, novelty, uncertainty], -1))).clamp(0.002, 0.06)
        delta = rate.unsqueeze(-1) * torch.einsum("bi,bj->bij", err, q) / (1.0 + q.square().sum(-1, keepdim=True)).unsqueeze(-1)
        fast_n = fast + delta
        fnorm = torch.linalg.matrix_norm(fast_n, ord="fro", dim=(-2, -1), keepdim=True).clamp_min(1e-6)
        fast_n = fast_n * (1.35 / fnorm).clamp(max=1.0)
        sr = torch.sigmoid(self.stable_rate(torch.cat([h, evidence, stability, uncertainty], -1))).clamp(0.0005, 0.025)
        # Consolidate only when evidence is sufficient and the recurrent trajectory is stable.
        consolidate_gate = (0.15 + 0.85 * evidence * stability).unsqueeze(-1)
        stable_n = stable + sr.unsqueeze(-1) * consolidate_gate * (fast_n - stable)
        stable_n = 0.999 * stable_n + 0.001 * fast_n.detach()
        snorm = torch.linalg.matrix_norm(stable_n, ord="fro", dim=(-2, -1), keepdim=True).clamp_min(1e-6)
        stable_n = stable_n * (1.35 / snorm).clamp(max=1.0)
        return fast_n.detach(), stable_n.detach(), pred.detach(), err.detach()


class TemporalCreditV14(nn.Module):
    """Eligibility trace + delayed outcome credit for routing/plasticity."""

    def __init__(self, d: int):
        super().__init__()
        self.decay = nn.Parameter(torch.tensor(0.86))
        self.trace_proj = nn.Linear(d, d)
        self.scale = nn.Sequential(nn.Linear(d + 3, d), nn.SiLU(), nn.Linear(d, 1))

    def update(self, h: Tensor, error: Tensor, improvement: Tensor, uncertainty: Tensor, stability: Tensor, trace: Tensor):
        decay = self.decay.sigmoid().clamp(0.65, 0.98)
        tag = torch.tanh(self.trace_proj(h)) * error.detach().clamp(0, 4)
        trace_n = decay * trace + (1.0 - decay) * tag
        gain = self.scale(torch.cat([h, improvement, uncertainty, stability], -1)).tanh()
        delayed = gain * trace_n.abs().mean(-1, keepdim=True) * improvement.tanh()
        return trace_n.detach(), delayed.detach()


class ConfidenceCalibratorV14(nn.Module):
    """Online uncertainty calibration using a bounded EMA of prediction residuals."""

    def __init__(self, d: int):
        super().__init__()
        self.head = nn.Sequential(nn.Linear(d + 3, d), nn.SiLU(), nn.Linear(d, 2))

    @torch.no_grad()
    def update(self, h: Tensor, error: Tensor, novelty: Tensor, uncertainty: Tensor, mean: Tensor, var: Tensor):
        raw = self.head(torch.cat([h, error, novelty, uncertainty], -1))
        local_mu = F.softplus(raw[:, :1]) + 1e-4
        local_var = F.softplus(raw[:, 1:]) + 1e-4
        a = 0.04
        mean_n = (1 - a) * mean + a * local_mu
        var_n = (1 - a) * var + a * local_var + a * (local_mu - mean_n).square()
        z = ((error - mean_n) / var_n.sqrt().clamp_min(1e-3)).clamp(-5, 5)
        confidence = torch.sigmoid(-0.7 * z.abs() - 0.35 * novelty)
        return mean_n.detach(), var_n.detach(), confidence.detach()


class ReplayBufferV14:
    """Fixed-shape per-stream replay storage for micro-dream consolidation."""

    def __init__(self, batch: int, capacity: int, d: int, device, dtype):
        self.keys = torch.zeros(batch, capacity, d, device=device, dtype=dtype)
        self.targets = torch.zeros(batch, capacity, d, device=device, dtype=dtype)
        self.priority = torch.zeros(batch, capacity, 1, device=device, dtype=dtype)
        self.ptr = torch.zeros(batch, 1, device=device, dtype=torch.long)

    @torch.no_grad()
    def write(self, key: Tensor, target: Tensor, priority: Tensor):
        b = key.size(0)
        cap = self.keys.size(1)
        for i in range(b):
            p = int(self.ptr[i].item()) % cap
            self.keys[i, p] = key[i]
            self.targets[i, p] = target[i]
            self.priority[i, p] = priority[i].clamp(0, 1)
            self.ptr[i, 0] = (p + 1) % cap

    @torch.no_grad()
    def sample(self, count: int = 4):
        b, cap, _ = self.keys.shape
        n = min(count, cap)
        w = self.priority.squeeze(-1) + 1e-4
        probs = w / w.sum(-1, keepdim=True).clamp_min(1e-6)
        idx = torch.multinomial(probs, n, replacement=cap < n)
        rows = torch.arange(b, device=self.keys.device)[:, None].expand(b, n)
        return self.keys[rows, idx], self.targets[rows, idx], self.priority[rows, idx]

    def snapshot(self):
        return self.keys.detach().clone(), self.targets.detach().clone(), self.priority.detach().clone(), self.ptr.detach().clone()


class AdaptivePlannerV14(nn.Module):
    """Budget-aware latent planner with adaptive horizon and ensemble disagreement."""

    def __init__(self, d: int, action_dim: int, candidates: int = 4, max_horizon: int = 3, ensemble: int = 3):
        super().__init__()
        self.d = d
        self.action_dim = action_dim
        self.candidates = candidates
        self.max_horizon = max_horizon
        self.members = nn.ModuleList([
            nn.Sequential(nn.Linear(d + action_dim, d), nn.SiLU(), nn.Linear(d, d)) for _ in range(ensemble)
        ])
        self.reward = nn.Sequential(nn.Linear(d + action_dim, d), nn.SiLU(), nn.Linear(d, 1))
        self.risk = nn.Sequential(nn.Linear(d + action_dim, d), nn.SiLU(), nn.Linear(d, 1))
        self.proposal = nn.Linear(d, candidates * max_horizon * action_dim)
        self.value = nn.Sequential(nn.Linear(d, d), nn.SiLU(), nn.Linear(d, 1))
        self.discount_logit = nn.Parameter(torch.tensor(1.2))

    def transition(self, z: Tensor, a: Tensor):
        inp = torch.cat([z, a], -1)
        preds = torch.stack([z + 0.35 * torch.tanh(m(inp)) for m in self.members], 0)
        nxt = preds.mean(0)
        epistemic = preds.var(0, unbiased=False).mean(-1, keepdim=True).sqrt()
        r = self.reward(torch.cat([nxt, a], -1))
        risk = F.softplus(self.risk(torch.cat([nxt, a], -1)))
        return nxt, r, risk, epistemic

    def plan(self, z: Tensor, horizon: int = 2):
        b = z.size(0)
        horizon = max(1, min(self.max_horizon, int(horizon)))
        prop = torch.tanh(self.proposal(z)).view(b, self.candidates, self.max_horizon, self.action_dim)[:, :, :horizon]
        cur = z[:, None, :].expand(-1, self.candidates, -1).reshape(b * self.candidates, self.d)
        total = z.new_zeros(b * self.candidates, 1)
        total_unc = z.new_zeros(b * self.candidates, 1)
        disc = torch.sigmoid(self.discount_logit).clamp(0.6, 0.98)
        for t in range(horizon):
            a = prop[:, :, t].reshape(b * self.candidates, self.action_dim)
            cur, r, risk, unc = self.transition(cur, a)
            total = total + (disc ** t) * (r - 0.10 * risk)
            total_unc = total_unc + (disc ** t) * unc
        values = self.value(cur)
        score = values + total - 0.20 * total_unc
        score = score.view(b, self.candidates)
        best = score.argmax(-1)
        chosen = prop[torch.arange(b, device=z.device), best, 0]
        return chosen, score.gather(1, best[:, None]), score, prop, total_unc.view(b, self.candidates, 1)


class RecoveryControllerV14(nn.Module):
    """State repair based on drift relative to a consolidated trajectory."""

    def __init__(self, d: int):
        super().__init__()
        self.gate = nn.Sequential(nn.Linear(d + 3, d), nn.SiLU(), nn.Linear(d, 1))

    def repair(self, latent, stable, fast, medium, slow, drift, uncertainty, confidence):
        g = torch.sigmoid(self.gate(torch.cat([latent, drift, uncertainty, confidence], -1))).clamp(0, 1)
        # High drift + low confidence pulls the state towards a stable multi-timescale manifold.
        trust = (g * drift.sigmoid() * (1 - confidence)).clamp(0, 0.85)
        anchor = 0.45 * stable + 0.30 * medium + 0.25 * slow
        repaired = (1 - trust) * latent + trust * anchor
        return repaired, trust


@dataclass
class V14Config:
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


class NeuroWeaveV14(nn.Module):
    """Frontier V14 integrated organism core.

    This generation adds real closed-loop mechanisms on top of V13:
      - two-timescale synaptic consolidation;
      - delayed temporal credit via eligibility traces;
      - calibrated online confidence;
      - fixed-shape replay buffer + micro-dream objective;
      - adaptive ensemble planner with horizon allocation;
      - state recovery from drift;
      - explicit evidence of which expensive computations were actually executed.
    """

    def __init__(self, cfg: V14Config | None = None):
        super().__init__()
        self.cfg = cfg or V14Config()
        c = self.cfg
        self.core = NeuroWeaveV13(
            d=c.d, hidden=c.hidden, action_dim=c.action_dim, capacity=c.memory_capacity,
            max_experts=c.max_experts, top_k=c.top_k,
            world_horizon=c.max_horizon, world_candidates=c.world_candidates,
            deep_threshold=c.deep_threshold,
        )
        self.synapse = SynapticConsolidationV14(c.d)
        self.credit = TemporalCreditV14(c.d)
        self.calibrator = ConfidenceCalibratorV14(c.d)
        self.planner = AdaptivePlannerV14(c.d, c.action_dim, c.world_candidates, c.max_horizon)
        self.recovery = RecoveryControllerV14(c.d)
        self.next_predictor = nn.Sequential(nn.Linear(2 * c.d + c.action_dim, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.d))
        self.next_head = nn.Linear(c.d, c.d)
        self.compute_value = nn.Sequential(nn.Linear(c.d + 5, c.hidden), nn.SiLU(), nn.Linear(c.hidden, 4))
        self.output_norm = nn.LayerNorm(c.d)

    def initial_state(self, b: int, device=None, dtype=None) -> V14State:
        base = self.core.initial_state(b, device=device, dtype=dtype)
        d = self.cfg.d
        z = lambda: torch.zeros(b, d, device=device, dtype=dtype)
        R = self.cfg.replay_capacity
        return V14State(
            base=base,
            fast_synapse=torch.zeros(b, d, d, device=device, dtype=dtype),
            stable_synapse=torch.zeros(b, d, d, device=device, dtype=dtype),
            eligibility=z(),
            prev_error=torch.zeros(b, 1, device=device, dtype=dtype),
            confidence_mean=torch.ones(b, 1, device=device, dtype=dtype) * 0.5,
            confidence_var=torch.ones(b, 1, device=device, dtype=dtype) * 0.5,
            replay_keys=torch.zeros(b, R, d, device=device, dtype=dtype),
            replay_targets=torch.zeros(b, R, d, device=device, dtype=dtype),
            replay_priority=torch.zeros(b, R, 1, device=device, dtype=dtype),
            replay_ptr=torch.zeros(b, 1, device=device, dtype=torch.long),
            drift_ema=torch.zeros(b, 1, device=device, dtype=dtype),
        )

    @torch.no_grad()
    def _replay_write(self, state: V14State, key: Tensor, target: Tensor, priority: Tensor):
        keys = state.replay_keys.clone()
        targets = state.replay_targets.clone()
        pri = state.replay_priority.clone()
        ptr = state.replay_ptr.clone()
        cap = keys.size(1)
        for i in range(key.size(0)):
            p = int(ptr[i].item()) % cap
            keys[i, p] = key[i]
            targets[i, p] = target[i]
            pri[i, p] = priority[i].clamp(0, 1)
            ptr[i, 0] = (p + 1) % cap
        return keys, targets, pri, ptr

    def replay_batch(self, state: V14State, count: int = 6):
        b, cap, _ = state.replay_keys.shape
        n = min(count, cap)
        w = state.replay_priority.squeeze(-1) + 1e-4
        probs = w / w.sum(-1, keepdim=True).clamp_min(1e-6)
        idx = torch.multinomial(probs, n, replacement=True)
        rows = torch.arange(b, device=state.replay_keys.device)[:, None].expand(b, n)
        return state.replay_keys[rows, idx], state.replay_targets[rows, idx], state.replay_priority[rows, idx]

    def micro_dream_loss(self, state: V14State, count: int = 6) -> Tensor:
        keys, targets, pri = self.replay_batch(state, count)
        b, n, d = keys.shape
        pred = self.next_head(torch.tanh(self.next_predictor(torch.cat([keys, targets, torch.zeros(b, n, self.cfg.action_dim, device=keys.device, dtype=keys.dtype)], -1))))
        err = F.smooth_l1_loss(pred, targets, reduction="none").mean(-1, keepdim=True)
        return (err * (0.25 + pri)).mean()

    def _compute_allocation(self, out: Dict[str, Tensor]):
        h = out["latent"]
        feats = torch.cat([
            h, out["prediction_error"], out["novelty"], out["uncertainty"],
            out["memory_confidence"], out["energy"],
        ], -1)
        logits = self.compute_value(feats)
        probs = torch.softmax(logits, -1)
        # Levels: 0 cheap, 1 deep, 2 planning, 3 replay/consolidation.
        return probs, logits

    def step(self, x: Tensor, state: V14State, action: Optional[Tensor] = None, commit_memory: bool = True):
        # Normalize persistent scalar state dtypes before crossing the base V13 boundary;
        # this keeps FP16/BF16 execution from accumulating float32 scalars.
        state.base.energy = state.base.energy.to(dtype=x.dtype)
        state.base.thermal = state.base.thermal.to(dtype=x.dtype)
        state.base.fast_usage = state.base.fast_usage.to(dtype=x.dtype)
        base_out, base_state = self.core.step(x, state.base, action=action, commit_memory=commit_memory)
        latent = base_out["latent"]

        syn = self.synapse.read(latent, state.fast_synapse, state.stable_synapse)
        adapted = latent + 0.18 * torch.tanh(syn)
        pred_next = self.next_head(torch.tanh(self.next_predictor(torch.cat([adapted, state.base.context, base_out["action"]], -1))))
        temporal_error = (base_out["world_next"] - pred_next).pow(2).mean(-1, keepdim=True).sqrt()
        drift = (adapted - (0.45 * state.base.medium + 0.35 * state.base.slow + 0.20 * state.base.context)).norm(dim=-1, keepdim=True) / (self.cfg.d ** 0.5)
        mean_n, var_n, confidence = self.calibrator.update(
            adapted.detach(), temporal_error.detach(), base_out["novelty"].detach(), base_out["uncertainty"].detach(),
            state.confidence_mean, state.confidence_var,
        )
        stability = base_out["stability"].detach()
        fast_syn, stable_syn, _, syn_err = self.synapse.update(
            adapted.detach(), base_out["world_next"].detach(), state.fast_synapse, state.stable_synapse,
            base_out["evidence"].detach(), stability, base_out["novelty"].detach(), base_out["uncertainty"].detach(),
        )

        improvement = (state.prev_error - temporal_error).detach()
        elig, delayed_credit = self.credit.update(
            adapted.detach(), temporal_error.detach(), improvement,
            base_out["uncertainty"].detach(), stability, state.eligibility,
        )
        expert_credit = base_out["expert_credit"] + 0.08 * delayed_credit
        expert_active = self.core.propose_structure(expert_credit, base_out["expert_active"])

        allocation, allocation_logits = self._compute_allocation({**base_out, "latent": adapted})
        # Adaptive budget: expensive operations require confidence/novelty evidence.
        plan_prob = allocation[:, 2:3]
        deep_prob = allocation[:, 1:2]
        replay_prob = allocation[:, 3:4]
        budget_limit = (0.25 + 0.75 * state.base.energy).clamp(0, 1)
        do_deep = (deep_prob > 0.34) & (budget_limit > 0.18)
        do_plan = (plan_prob > 0.30) & (budget_limit > 0.32)
        do_replay = (replay_prob > 0.26) & (base_out["evidence"] > 0.35)

        refined = adapted.clone()
        idx = do_deep[:, 0].nonzero(as_tuple=False).flatten()
        if idx.numel():
            refined[idx] = refined[idx] + self.core.deep(adapted.index_select(0, idx))
        refined = self.output_norm(refined)

        base_action = base_out["action"] if action is None else action
        chosen_action = base_action.detach().clone()
        plan_score = self.core.value(refined).detach()
        plan_scores = refined.new_zeros(refined.size(0), self.cfg.world_candidates)
        plan_unc = refined.new_zeros(refined.size(0), self.cfg.world_candidates, 1)
        horizon = 1 + (allocation[:, 2] > 0.55).long() + (allocation[:, 2] > 0.76).long()
        idxp = do_plan[:, 0].nonzero(as_tuple=False).flatten()
        if idxp.numel():
            # Group by horizon to avoid running longer rollouts when not paid for.
            for h in range(1, self.cfg.max_horizon + 1):
                sub = idxp[horizon[idxp] == h]
                if sub.numel():
                    a, sc, scores, _, unc = self.planner.plan(refined.index_select(0, sub), int(h))
                    chosen_action[sub] = a.detach()
                    plan_score[sub] = sc.detach()
                    plan_scores[sub] = scores.detach()
                    plan_unc[sub] = unc.detach()
        world_next, world_reward, world_risk, world_unc = self.planner.transition(refined, chosen_action)

        recovered, repair_strength = self.recovery.repair(
            refined, state.base.context.detach(), state.base.fast.detach(), state.base.medium.detach(),
            state.base.slow.detach(), drift.detach(), world_unc.detach(), confidence.detach(),
        )
        # Replay stores surprising, high-evidence transitions; replacement is bounded by capacity.
        priority = (base_out["evidence"].detach() * (0.55 * base_out["novelty"].detach() + 0.45 * temporal_error.detach()).sigmoid()).clamp(0, 1)
        rk, rt, rp, rptr = self._replay_write(state, adapted.detach(), world_next.detach(), priority)

        # Energy/thermal from previous core is corrected by the actual V14 execution decisions.
        energy = (0.985 * base_state.energy - 0.02 * do_deep.to(x.dtype) - 0.045 * do_plan.to(x.dtype) - 0.01 * do_replay.to(x.dtype)).clamp(0, 1)
        thermal = (0.96 * base_state.thermal + 0.035 * do_deep.to(x.dtype) + 0.075 * do_plan.to(x.dtype)).clamp(0, 1.5)
        drift_ema = 0.96 * state.drift_ema + 0.04 * drift.detach()

        # Keep the base state but inject the improved context and structurally useful expert credit.
        base_state.context = recovered.detach()
        base_state.expert_credit = expert_credit.detach()
        base_state.expert_active = expert_active.detach()
        base_state.energy = energy.detach()
        base_state.thermal = thermal.detach()

        out = dict(base_out)
        out.update({
            "latent": recovered,
            "v14_adapted_latent": adapted,
            "synaptic_read": syn,
            "synaptic_error": syn_err.norm(dim=-1, keepdim=True),
            "fast_synapse_norm": torch.linalg.matrix_norm(fast_syn, dim=(-2, -1), keepdim=True).squeeze(-1),
            "stable_synapse_norm": torch.linalg.matrix_norm(stable_syn, dim=(-2, -1), keepdim=True).squeeze(-1),
            "temporal_error": temporal_error,
            "temporal_improvement": improvement,
            "eligibility_norm": elig.norm(dim=-1, keepdim=True),
            "delayed_expert_credit": delayed_credit,
            "expert_credit": expert_credit,
            "expert_active": expert_active,
            "confidence": confidence,
            "confidence_mean": mean_n,
            "confidence_var": var_n,
            "allocation_probs": allocation,
            "allocation_logits": allocation_logits,
            "deep_taken_v14": do_deep.float(),
            "planning_taken_v14": do_plan.float(),
            "replay_taken_v14": do_replay.float(),
            "planning_horizon": horizon.float().unsqueeze(-1),
            "action": chosen_action,
            "world_next_v14": world_next,
            "world_reward_v14": world_reward,
            "world_risk_v14": world_risk,
            "world_uncertainty_v14": world_unc,
            "plan_score_v14": plan_score,
            "plan_scores_v14": plan_scores,
            "plan_uncertainty_v14": plan_unc,
            "repair_strength": repair_strength,
            "drift": drift,
            "drift_ema": drift_ema,
            "replay_priority": priority,
            "replay_fill": (rp > 0).sum(-1, keepdim=True).to(x.dtype),
            "energy_v14": energy,
            "thermal_v14": thermal,
            "predicted_next": pred_next,
        })
        ns = V14State(
            base=base_state,
            fast_synapse=fast_syn,
            stable_synapse=stable_syn,
            eligibility=elig,
            prev_error=temporal_error.detach(),
            confidence_mean=mean_n,
            confidence_var=var_n,
            replay_keys=rk,
            replay_targets=rt,
            replay_priority=rp,
            replay_ptr=rptr,
            drift_ema=drift_ema,
        )
        return out, ns

    def forward(self, x: Tensor, state: Optional[V14State] = None, commit_memory: bool = True) -> Dict[str, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.cfg.d:
            raise ValueError("x must be [B,T,D]")
        state = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            out, state = self.step(x[:, t], state, commit_memory=commit_memory)
            rows.append(out)
        stacked = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0]}
        stacked["_final_state"] = state
        return stacked

class MicroDreamTrainerV14:
    """Small persistent optimizer for replay-driven test-time adaptation.

    The trainer deliberately updates only the predictive/adaptive subnetworks. This keeps
    online learning bounded and makes the changed parameter set explicit and auditable.
    """

    def __init__(self, model: NeuroWeaveV14, lr: float = 1e-3):
        self.model = model
        self.optimizer = torch.optim.AdamW(
            list(model.next_predictor.parameters())
            + list(model.next_head.parameters())
            + list(model.planner.members.parameters()),
            lr=lr,
            weight_decay=1e-4,
        )

    def step(self, state: V14State, count: int = 6):
        self.model.train()
        self.optimizer.zero_grad(set_to_none=True)
        loss = self.model.micro_dream_loss(state, count=count)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(
            list(self.model.next_predictor.parameters())
            + list(self.model.next_head.parameters())
            + list(self.model.planner.members.parameters()), 1.0
        )
        self.optimizer.step()
        return loss.detach()
