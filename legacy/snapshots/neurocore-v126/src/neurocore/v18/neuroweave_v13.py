from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict, Any

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .neuroweave_v12 import (
    RetrievalConditionedRecurrenceV12,
    LearnedReplaySchedulerV12,
    MetaPlasticityV3,
    PlasticityConsolidatorV12,
    SparseExpertBankV12,
)


@dataclass
class V13State:
    fast: Tensor
    medium: Tensor
    slow: Tensor
    trace: Tensor
    context: Tensor
    memory_keys: Tensor
    memory_values: Tensor
    memory_strength: Tensor
    memory_age: Tensor
    fast_weights: Tensor
    fast_usage: Tensor
    expert_credit: Tensor
    expert_active: Tensor
    energy: Tensor
    thermal: Tensor
    step: Tensor


class OnlineFastMemoryV13(nn.Module):
    """Bounded test-time learning state using a normalized delta-rule update."""

    def __init__(self, d: int):
        super().__init__()
        self.query = nn.Linear(d, d)
        self.target = nn.Linear(d, d)
        self.eta = nn.Sequential(nn.Linear(d + 4, d), nn.SiLU(), nn.Linear(d, 1))
        self.decay = nn.Sequential(nn.Linear(d + 3, d), nn.SiLU(), nn.Linear(d, 1))

    def read(self, h: Tensor, W: Tensor) -> Tensor:
        q = F.normalize(self.query(h), dim=-1, eps=1e-4)
        return torch.einsum("bij,bj->bi", W, q)

    @torch.no_grad()
    def update(self, h: Tensor, target: Tensor, W: Tensor, usage: Tensor,
               novelty: Tensor, uncertainty: Tensor, evidence: Tensor,
               thermal: Tensor, energy: Tensor):
        q = F.normalize(self.query(h), dim=-1, eps=1e-4)
        tgt = torch.tanh(self.target(target))
        pred = torch.einsum("bij,bj->bi", W, q)
        err = tgt - pred
        signals = torch.cat([h, novelty, uncertainty, evidence, thermal + (1 - energy)], -1)
        eta = torch.sigmoid(self.eta(signals)).clamp(0.002, 0.08)
        decay = torch.sigmoid(self.decay(torch.cat([h, novelty, uncertainty, evidence], -1))).clamp(0.001, 0.08)
        denom = (1.0 + q.pow(2).sum(-1, keepdim=True)).clamp_min(1.0)
        delta = eta.unsqueeze(-1) * torch.einsum("bi,bj->bij", err, q) / denom.unsqueeze(-1)
        Wn = (1.0 - decay.unsqueeze(-1)) * W + delta
        # Frobenius cap prevents runaway plasticity while preserving direction.
        norm = torch.linalg.matrix_norm(Wn, ord="fro", dim=(-2, -1), keepdim=True).clamp_min(1e-6)
        scale = (1.5 / norm).clamp(max=1.0)
        Wn = Wn * scale
        usage_n = 0.97 * usage + 0.03 * err.pow(2).mean(-1, keepdim=True)
        return Wn.detach(), usage_n.detach(), pred.detach(), err.detach()


class PredictiveWorldModelV13(nn.Module):
    """Small latent world model with action-conditioned rollout and value selection."""

    def __init__(self, d: int, action_dim: int, horizon: int = 3, candidates: int = 3):
        super().__init__()
        self.d = d
        self.action_dim = action_dim
        self.horizon = horizon
        self.candidates = candidates
        self.transition = nn.Sequential(nn.Linear(d + action_dim, d), nn.SiLU(), nn.Linear(d, d))
        self.residual = nn.Sequential(nn.Linear(2 * d, d), nn.Tanh(), nn.Linear(d, d))
        self.reward = nn.Sequential(nn.Linear(d + action_dim, d), nn.SiLU(), nn.Linear(d, 1))
        self.uncertainty = nn.Sequential(nn.Linear(d + action_dim, d), nn.SiLU(), nn.Linear(d, 1))
        self.action_proposal = nn.Linear(d, candidates * action_dim)
        self.value = nn.Sequential(nn.Linear(d, d), nn.SiLU(), nn.Linear(d, 1))

    def one_step(self, z: Tensor, action: Tensor):
        delta = torch.tanh(self.transition(torch.cat([z, action], -1)))
        nxt = z + 0.5 * delta + 0.25 * self.residual(torch.cat([z, delta], -1))
        rew = self.reward(torch.cat([nxt, action], -1))
        unc = F.softplus(self.uncertainty(torch.cat([nxt, action], -1)))
        return nxt, rew, unc

    def rollout(self, z: Tensor):
        b = z.size(0)
        actions = torch.tanh(self.action_proposal(z)).view(b, self.candidates, self.action_dim)
        cur = z[:, None, :].expand(-1, self.candidates, -1).reshape(b * self.candidates, self.d)
        act = actions.reshape(b * self.candidates, self.action_dim)
        total_reward = z.new_zeros(b * self.candidates, 1)
        total_unc = z.new_zeros(b * self.candidates, 1)
        discount = 1.0
        for _ in range(self.horizon):
            cur, rew, unc = self.one_step(cur, act)
            total_reward = total_reward + discount * rew
            total_unc = total_unc + discount * unc
            discount *= 0.9
        values = self.value(cur)
        score = values + total_reward - 0.15 * total_unc
        score = score.view(b, self.candidates)
        best = score.argmax(-1)
        chosen = actions[torch.arange(b, device=z.device), best]
        chosen_score = score.gather(1, best[:, None])
        return chosen, chosen_score, score, actions


class ComputePolicyV13(nn.Module):
    """Compute allocation from expected utility, not a fixed error threshold."""

    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + 8, d), nn.SiLU(), nn.Linear(d, 3))
        self.bias = nn.Parameter(torch.tensor([-1.1, -2.0, -2.4]))

    def forward(self, h, pe, novelty, uncertainty, evidence, energy, thermal, memory_conf, fast_err):
        x = torch.cat([h, pe, novelty, uncertainty, evidence, energy, thermal, memory_conf, fast_err], -1)
        logits = self.net(x) + self.bias
        p = torch.sigmoid(logits)
        # Utility ordering: deep, world-model planning, replay/consolidation.
        return p, logits




class SparseExpertBankV13(nn.Module):
    """Sparse expert bank with safe inactive-slot handling and local expert contributions."""

    def __init__(self, d: int, max_experts: int = 8, top_k: int = 2):
        super().__init__()
        self.d = d
        self.max_experts = max_experts
        self.top_k = min(top_k, max_experts)
        self.experts = nn.ModuleList([
            nn.Sequential(nn.Linear(d, d), nn.GELU(), nn.Linear(d, d))
            for _ in range(max_experts)
        ])
        self.router = nn.Linear(d + 5, max_experts)

    def forward(self, z: Tensor, signal: Tensor, active: Tensor, credit: Tensor):
        logits = self.router(torch.cat([z, signal], -1))
        logits = logits + torch.log1p(credit.clamp_min(0))
        logits = torch.where(active > 0.5, logits, torch.full_like(logits, -1e4))
        values, indices = torch.topk(logits, self.top_k, -1)
        valid = values > -1000
        best = indices[:, :1]
        indices = torch.where(valid, indices, best.expand(-1, self.top_k))
        values = torch.where(valid, values, values[:, :1].expand(-1, self.top_k))
        probs = torch.softmax(values, -1)

        b = z.size(0)
        contributions = torch.zeros(b, self.top_k, self.d, device=z.device, dtype=z.dtype)
        load = torch.zeros(self.max_experts, device=z.device, dtype=z.dtype)
        out = torch.zeros_like(z)
        for expert_id, expert in enumerate(self.experts):
            slots = (indices == expert_id).nonzero(as_tuple=False)
            if slots.numel() == 0:
                continue
            rows = slots[:, 0]
            slot = slots[:, 1]
            vals = expert(z.index_select(0, rows))
            w = probs[rows, slot].unsqueeze(-1)
            contrib = w * vals
            contributions[rows, slot] = contrib
            out.index_add_(0, rows, contrib)
            load[expert_id] = float(rows.numel()) / max(float(b), 1.0)
        # CV-like load penalty stays bounded and is differentiable through routing probabilities only.
        soft_load = torch.softmax(logits, -1).mean(0)
        balance_loss = ((soft_load - 1.0 / self.max_experts) ** 2).mean()
        return out, probs, indices, logits, contributions, balance_loss

class NeuroWeaveV13(nn.Module):
    """
    X3/X4 research core.

    Real mechanisms in this branch:
      1. episodic bounded erase/write memory;
      2. learned-at-test-time fast associative weights;
      3. actual sparse expert dispatch;
      4. interventional local expert credit;
      5. per-sample compute allocation;
      6. action-conditioned multi-step latent world-model planning;
      7. replay/consolidation signals;
      8. energy/thermal-aware compute pressure.
    """

    def __init__(self, d=16, hidden=32, action_dim=4, capacity=64,
                 max_experts=8, top_k=2, world_horizon=3, world_candidates=3,
                 deep_threshold=0.6):
        super().__init__()
        self.d = d
        self.capacity = capacity
        self.max_experts = max_experts
        self.deep_threshold = deep_threshold

        self.encoder = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.fast = RetrievalConditionedRecurrenceV12(d)
        self.medium = RetrievalConditionedRecurrenceV12(d)
        self.slow = RetrievalConditionedRecurrenceV12(d)
        self.trace = nn.GRUCell(d, d)
        self.pred = nn.Sequential(nn.Linear(4 * d, d), nn.SiLU(), nn.Linear(d, d))
        self.var = nn.Sequential(nn.Linear(4 * d, d), nn.SiLU(), nn.Linear(d, 1))
        self.evidence = nn.Sequential(nn.Linear(d + 6, d), nn.SiLU(), nn.LayerNorm(d), nn.Linear(d, 1))

        self.key = nn.Linear(d, d)
        self.val = nn.Linear(d, d)
        self.q = nn.Linear(d, d)
        self.erase = nn.Linear(2 * d + 2, d)
        self.write_gate = nn.Linear(2 * d + 1, 1)
        self.temp = nn.Parameter(torch.tensor(0.7))

        self.online = OnlineFastMemoryV13(d)
        self.replay = LearnedReplaySchedulerV12(d)
        self.meta = MetaPlasticityV3(d)
        self.consolidator = PlasticityConsolidatorV12(d)
        self.experts = SparseExpertBankV13(d, max_experts, top_k)

        self.compute_policy = ComputePolicyV13(d)
        self.deep = nn.Sequential(nn.Linear(d, 2 * d), nn.GELU(), nn.Linear(2 * d, d))
        self.action = nn.Linear(d, action_dim)
        self.world = PredictiveWorldModelV13(d, action_dim, world_horizon, world_candidates)
        self.homeo = nn.Linear(d + 4, 2)
        self.value = nn.Linear(d, 1)

    def initial_state(self, b, device=None, dtype=None):
        z = lambda: torch.zeros(b, self.d, device=device, dtype=dtype)
        # Fixed-shape memory is deliberate: it prevents per-row tensor growth/shrinkage,
        # makes batching stable, and lets the mobile runtime preallocate the full budget.
        keys = torch.zeros(b, self.capacity, self.d, device=device, dtype=dtype)
        vals = torch.zeros(b, self.capacity, self.d, device=device, dtype=dtype)
        strength = torch.zeros(b, self.capacity, 1, device=device, dtype=dtype)
        age = torch.zeros(b, self.capacity, 1, device=device, dtype=dtype)
        return V13State(
            z(), z(), z(), z(), z(), keys, vals, strength, age,
            torch.zeros(b, self.d, self.d, device=device, dtype=dtype),
            torch.zeros(b, 1, device=device, dtype=dtype),
            torch.zeros(b, self.max_experts, device=device, dtype=dtype),
            torch.ones(b, self.max_experts, device=device, dtype=dtype),
            torch.ones(b, 1, device=device, dtype=dtype),
            torch.zeros(b, 1, device=device, dtype=dtype),
            torch.zeros(b, 1, device=device, dtype=dtype),
        )

    def read_memory(self, q, keys, vals, strength, age):
        if keys.size(1) == 0:
            return q.new_zeros(q.size()), q.new_zeros(q.size(0), 1)
        qq = F.normalize(self.q(q), dim=-1, eps=1e-4)
        kk = F.normalize(keys, dim=-1, eps=1e-4)
        sim = torch.einsum("bd,bnd->bn", qq, kk) / self.temp.clamp_min(0.05)
        age_decay = torch.exp(-age.squeeze(-1).clamp_min(0.0) / 128.0)
        w = F.softmax(sim, -1) * strength.squeeze(-1) * age_decay
        den = w.sum(-1, keepdim=True).clamp_min(1e-6)
        r = torch.einsum("bn,bnd->bd", w, vals) / den
        return r, w.max(-1, keepdim=True).values

    @torch.no_grad()
    def commit_memory(self, x, evidence, context, keys, vals, strength, age, novelty):
        keys, vals = keys.clone(), vals.clone()
        strength, age = strength.clone(), age.clone()
        b = x.size(0)
        k = F.normalize(self.key(x), dim=-1, eps=1e-4)
        v = self.val(x)
        s = evidence.clamp(0, 1)
        write = torch.sigmoid(self.write_gate(torch.cat([context, x, evidence], -1)))
        write = write * (0.35 + 0.65 * novelty.clamp(0, 1))

        # Age only occupied slots. Inactive slots remain zero-strength and immediately reusable.
        occupied = strength.squeeze(-1) > 1e-4
        age = torch.where(occupied.unsqueeze(-1), age + 1.0, age)
        if keys.size(1) == 0:
            raise RuntimeError('V13 episodic memory capacity must be > 0')

        sim = torch.einsum('bd,bnd->bn', F.normalize(k, dim=-1, eps=1e-4), F.normalize(keys, dim=-1, eps=1e-4))
        sim = torch.where(occupied, sim, torch.full_like(sim, -2.0))
        best_sim, best_idx = sim.max(-1)
        matched = occupied.gather(1, best_idx[:, None]).squeeze(1) & (best_sim > 0.82)

        for i in range(b):
            j = int(best_idx[i])
            if bool(matched[i]):
                old_v = vals[i, j]
                old_k = keys[i, j]
                gate = torch.sigmoid(self.erase(torch.cat([old_k, v[i], s[i], best_sim[i:i+1]], -1)))
                vals[i, j] = (1 - gate) * old_v + gate * v[i]
                keys[i, j] = F.normalize(0.8 * old_k + 0.2 * k[i], dim=0, eps=1e-4)
                strength[i, j, 0] = (0.90 * strength[i, j, 0] + 0.10 * (s[i] * write[i, 0])).clamp(0, 1)
                age[i, j, 0] = 0
                continue

            free = (~occupied[i]).nonzero(as_tuple=False).flatten()
            if free.numel():
                j = int(free[0])
            else:
                # Interference-aware replacement: old/weak memories are cheaper to evict,
                # while very strong fresh memories are protected.
                replace_score = strength[i, :, 0] / (1.0 + age[i, :, 0] / 64.0)
                j = int(torch.argmin(replace_score))
            keys[i, j] = k[i]
            vals[i, j] = v[i]
            strength[i, j, 0] = (s[i] * write[i, 0]).clamp(0, 1)
            age[i, j, 0] = 0
        return keys.detach(), vals.detach(), strength.clamp(0, 1).detach(), age.detach()

    @staticmethod
    def propose_structure(credit, active, threshold_low=0.05, threshold_high=0.35):
        score = credit.detach()
        new_active = active.clone()
        new_active = torch.where((active <= 0.5) & (score > threshold_high), torch.ones_like(new_active), new_active)
        weak = (score < threshold_low) & (active > 0.5)
        count = new_active.sum(-1, keepdim=True)
        new_active = torch.where(weak & (count > 1), torch.zeros_like(new_active), new_active)
        best = score.argmax(-1)
        for i in range(score.size(0)):
            if float(new_active[i].sum()) < 1:
                new_active[i, best[i]] = 1
        return new_active

    def _deep_selective(self, z, p):
        hard = p[:, 0] >= self.deep_threshold
        out = z.clone()
        idx = hard.nonzero(as_tuple=False).flatten()
        if idx.numel():
            out[idx] = out[idx] + self.deep(z.index_select(0, idx))
        return out, hard.float().unsqueeze(-1)

    def _expert_interventional_credit(self, context, pred, specialized, probs, indices, contributions, ev):
        # Local lesion intervention: remove each selected contribution while keeping all
        # other executed experts fixed. Positive marginal = that expert actually helped.
        b, k = indices.shape
        spec_err = (specialized - pred).pow(2).mean(-1, keepdim=True)
        selected_marginal = context.new_zeros(b, k)
        for slot in range(k):
            counterfactual = specialized - contributions[:, slot, :]
            cf_err = (counterfactual - pred).pow(2).mean(-1, keepdim=True)
            selected_marginal[:, slot] = (cf_err - spec_err).squeeze(-1)
        chosen = torch.zeros(b, self.max_experts, device=context.device, dtype=context.dtype)
        expert_credit_signal = torch.zeros_like(chosen)
        for slot in range(k):
            idx = indices[:, slot]
            val = (ev.squeeze(-1) * torch.tanh(selected_marginal[:, slot])).detach()
            expert_credit_signal.scatter_add_(1, idx[:, None], val[:, None])
            chosen.scatter_add_(1, idx[:, None], probs[:, slot:slot+1])
        credit_obs = expert_credit_signal - 0.01 * chosen
        # Positive selected_marginal means the lesion worsened error, therefore the expert helped.
        return selected_marginal.mean(-1, keepdim=True), credit_obs.detach()

    def step(self, x, state: V13State, action=None, commit_memory=True):
        e = self.encoder(x)
        mem, memc = self.read_memory(state.context, state.memory_keys, state.memory_values, state.memory_strength, state.memory_age)
        fast_assoc = self.online.read(state.fast + 0.35 * mem, state.fast_weights)
        fast = self.fast(e + 0.20 * fast_assoc, state.fast, mem)
        medium = self.medium(0.56 * fast + 0.24 * mem + 0.20 * fast_assoc, state.medium, mem)
        slow_c = self.slow(0.30 * medium + 0.50 * mem + 0.20 * fast_assoc, state.slow, mem)
        trace = self.trace(fast, state.trace)

        p_in = torch.cat([state.fast, state.medium, state.slow, state.trace], -1)
        pred = self.pred(p_in)
        pvar = F.softplus(self.var(p_in))
        pe = (e - pred).pow(2).mean(-1, keepdim=True).sqrt()
        den = (e.float().norm(dim=-1) * state.context.float().norm(dim=-1)).clamp_min(1e-4)
        cos = (e.float().mul(state.context.float()).sum(-1) / den).to(dtype=e.dtype)
        nov = (1 - cos.unsqueeze(-1)).clamp(0, 2)
        drift = (fast - state.fast).abs().mean(-1, keepdim=True)
        stability = (1 - (medium - slow_c).abs().mean(-1, keepdim=True)).clamp(0, 1)
        unc = torch.sigmoid(pvar + 0.35 * memc + 0.20 * nov + 0.12 * state.fast_usage)
        energy_pressure = (1 - state.energy).clamp(0, 1)
        ev = torch.sigmoid(self.evidence(torch.cat([fast, pe, nov, unc, drift, energy_pressure, stability], -1))).clamp(0, 1)

        plasticity = self.meta(fast, pe, nov, unc, ev, stability, drift)
        slow = plasticity * slow_c + (1 - plasticity) * state.slow

        if commit_memory:
            keys, vals, strength, age = self.commit_memory(e, ev, fast, state.memory_keys, state.memory_values,
                                                           state.memory_strength, state.memory_age, nov)
        else:
            keys, vals, strength, age = state.memory_keys, state.memory_values, state.memory_strength, state.memory_age

        # Real test-time learning state. We learn a tiny associative model, not the whole network.
        Wn, usage_n, fast_pred, fast_err = self.online.update(
            fast.detach(), slow.detach(), state.fast_weights, state.fast_usage,
            nov.detach(), unc.detach(), ev.detach(), state.thermal.detach(), state.energy.detach()
        )

        context = 0.33 * medium + 0.23 * slow + 0.10 * trace + 0.18 * mem + 0.16 * fast_pred
        signal = torch.cat([pe, nov, unc, memc, ev], -1)
        specialized, probs, indices, route_logits, expert_contrib, router_balance_loss = self.experts(context, signal, state.expert_active, state.expert_credit)
        realized_credit, credit_obs = self._expert_interventional_credit(
            context, pred, specialized, probs, indices, expert_contrib, ev
        )
        credit = 0.965 * state.expert_credit + 0.035 * credit_obs
        active_next = self.propose_structure(credit, state.expert_active)
        replay = self.replay(context, pe, ev, age.mean(dim=(1, 2), keepdim=False).unsqueeze(-1), unc, nov, stability)

        cp, cplogits = self.compute_policy(
            context, pe, nov, unc, ev, state.energy, state.thermal, memc, fast_err.pow(2).mean(-1, keepdim=True)
        )
        latent, deep_taken = self._deep_selective(specialized, cp[:, 0:1])

        base_action = self.action(latent) if action is None else action
        world_taken = (cp[:, 1:2] >= self.deep_threshold)
        action_plan = base_action.detach().clone()
        plan_score = self.value(latent).detach().clone()
        plan_scores = latent.new_zeros(latent.size(0), self.world.candidates)
        candidates = latent.new_zeros(latent.size(0), self.world.candidates, self.world.action_dim)
        selected = world_taken[:, 0].nonzero(as_tuple=False).flatten()
        if selected.numel():
            ap, ps, pss, cands = self.world.rollout(latent.index_select(0, selected))
            action_plan[selected] = ap
            plan_score[selected] = ps
            plan_scores[selected] = pss
            candidates[selected] = cands
        # Planning is only executed for selected samples; others keep the cheap action head.
        chosen_action = torch.where(world_taken.expand_as(base_action), action_plan, base_action)
        # One-step diagnostic for the chosen action is cheap and always available.
        world_next, world_reward, world_unc = self.world.one_step(latent, chosen_action)
        plan_advantage = plan_score - self.value(latent)

        home = self.homeo(torch.cat([latent, pe, unc, ev, cp[:, 1:2]], -1))
        te, tt = torch.sigmoid(home[:, 0:1]), torch.sigmoid(home[:, 1:2])
        energy = (0.975 * state.energy + 0.025 * (1 - te - 0.25 * cp[:, :2].sum(-1, keepdim=True))).clamp(0, 1)
        thermal = (0.955 * state.thermal + 0.045 * (tt + 0.20 * deep_taken + 0.25 * world_taken)).clamp(0, 1.5)

        # Consolidation pressure estimates whether fast state should be retained or compressed.
        consolidate = self.consolidator.importance(latent.detach())
        consolidation_penalty = self.consolidator.penalty(fast, slow.detach(), consolidate).expand(x.size(0), 1)

        out = {
            "latent": latent,
            "prediction": pred,
            "prediction_error": pe,
            "prediction_uncertainty": pvar,
            "novelty": nov,
            "uncertainty": unc,
            "stability": stability,
            "evidence": ev,
            "plasticity": plasticity,
            "memory_read": mem,
            "memory_confidence": memc,
            "memory_size": (strength.squeeze(-1) > 1e-4).sum(-1, keepdim=True).to(dtype=x.dtype),
            "fast_memory_read": fast_pred,
            "fast_memory_error": fast_err.norm(dim=-1, keepdim=True),
            "route_probs": probs,
            "route_indices": indices,
            "route_logits": route_logits,
            "router_balance_loss": router_balance_loss.expand(x.size(0), 1),
            "expert_credit": credit,
            "expert_active": active_next,
            "expert_interventional_improvement": realized_credit,
            "replay_priority": replay,
            "compute_probability": cp,
            "compute_logits": cplogits,
            "deep_taken": deep_taken,
            "world_taken": world_taken.float(),
            "action_base": base_action,
            "action": chosen_action,
            "world_next": world_next,
            "world_reward": world_reward,
            "world_uncertainty": world_unc,
            "plan_score": plan_score,
            "plan_scores": plan_scores,
            "plan_advantage": plan_advantage,
            "action_candidates": candidates,
            "value": self.value(latent),
            "energy": energy,
            "thermal": thermal,
            "consolidation_importance": consolidate,
            "consolidation_penalty": consolidation_penalty.detach(),
        }

        ns = V13State(
            fast, medium, slow, trace, latent.detach(), keys, vals, strength, age,
            Wn, usage_n, credit.detach(), active_next.detach(), energy.detach(), thermal.detach(), state.step + 1
        )
        return out, ns

    def forward(self, x, state: Optional[V13State] = None, commit_memory=True) -> Dict[str, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.d:
            raise ValueError("x must be [B,T,D]")
        state = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            out, state = self.step(x[:, t], state, commit_memory=commit_memory)
            rows.append(out)
        stacked = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0]}
        return {**stacked, "_final_state": state}
