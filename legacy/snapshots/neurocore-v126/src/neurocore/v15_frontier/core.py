from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v19.neuroweave_v14 import NeuroWeaveV14, V14Config, V14State


class SemanticMemoryV15(nn.Module):
    """Bounded prototype memory with novelty-aware EMA updates and protection by utility."""
    def __init__(self, d: int, capacity: int = 16):
        super().__init__()
        self.d = d
        self.capacity = capacity
        self.key = nn.Linear(d, d)
        self.value = nn.Linear(d, d)
        self.write = nn.Sequential(nn.Linear(d + 4, d), nn.SiLU(), nn.Linear(d, 1))
        self.temperature = nn.Parameter(torch.tensor(0.65))

    def read(self, q: Tensor, keys: Tensor, values: Tensor, strength: Tensor):
        qq = F.normalize(self.key(q), dim=-1, eps=1e-4)
        kk = F.normalize(keys, dim=-1, eps=1e-4)
        sim = torch.einsum("bd,bnd->bn", qq, kk) / self.temperature.clamp_min(0.05)
        valid = (strength > 0).squeeze(-1)
        sim = sim.masked_fill(~valid, -1e4)
        w = F.softmax(sim, -1) * strength.squeeze(-1)
        r = torch.einsum("bn,bnd->bd", w, values)
        conf = w.sum(-1, keepdim=True).clamp(0, 1)
        return r, conf

    @torch.no_grad()
    def update(self, x: Tensor, evidence: Tensor, novelty: Tensor, confidence: Tensor,
               keys: Tensor, values: Tensor, strength: Tensor):
        b, cap, d = keys.shape
        k = F.normalize(self.key(x), dim=-1, eps=1e-4)
        v = self.value(x)
        gate = torch.sigmoid(self.write(torch.cat([x, evidence, novelty, confidence, strength.mean(-2)], -1))).squeeze(-1)
        keys_n, values_n, strength_n = keys.clone(), values.clone(), strength.clone()
        for i in range(b):
            valid = strength[i, :, 0] > 0
            if valid.any():
                sim = torch.mv(keys[i], k[i])
                sim = sim.masked_fill(~valid, -1e4)
                j = int(sim.argmax().item())
                match = float(torch.sigmoid(sim[j]).item())
            else:
                j, match = 0, 0.0
            if match > 0.82:
                a = float((0.04 + 0.16 * gate[i]).clamp(0.02, 0.20).item())
                keys_n[i, j] = F.normalize((1 - a) * keys[i, j] + a * k[i], dim=-1, eps=1e-4)
                values_n[i, j] = (1 - a) * values[i, j] + a * v[i]
                strength_n[i, j, 0] = (0.96 * strength[i, j, 0] + 0.04 * evidence[i, 0]).clamp(0, 1)
            else:
                score = (0.55 * (1 - strength[i, :, 0]) + 0.30 * (1 - confidence[i, 0]) + 0.15 * novelty[i, 0])
                j = int(score.argmax().item())
                keys_n[i, j] = k[i]
                values_n[i, j] = v[i]
                strength_n[i, j, 0] = (0.35 * evidence[i, 0] + 0.65 * novelty[i, 0]).clamp(0, 1)
        return keys_n.detach(), values_n.detach(), strength_n.detach()


class SuccessorRepresentationV15(nn.Module):
    """Bounded TD-style successor matrix over the latent basis.

    This is a predictive state mechanism: it learns which latent features tend to follow
    the current state. The matrix is maintained as runtime state, not as a decorative metric.
    """
    def __init__(self, d: int, gamma: float = 0.88, alpha: float = 0.045, cap: float = 5.0):
        super().__init__()
        self.gamma = gamma
        self.alpha = alpha
        self.cap = cap
        self.value = nn.Linear(d, d)

    @torch.no_grad()
    def update(self, phi: Tensor, next_phi: Tensor, sr: Tensor, surprise: Tensor):
        p = torch.tanh(self.value(phi))
        np = torch.tanh(self.value(next_phi))
        pred = torch.einsum("bi,bij->bj", p, sr)
        target = np + self.gamma * torch.einsum("bi,bij->bj", np, sr)
        td = target - pred
        lr = (self.alpha * (1 + surprise.detach()).clamp(0.5, 2.5)).unsqueeze(-1)
        sr_n = sr + lr * torch.einsum("bi,bj->bij", p, td)
        norm = torch.linalg.matrix_norm(sr_n, ord="fro", dim=(-2, -1), keepdim=True).clamp_min(1e-6)
        sr_n = sr_n * (self.cap / norm).clamp(max=1.0)
        return sr_n.detach(), td.detach()


class UncertaintyDecompositionV15(nn.Module):
    """Separates predictive residual, model disagreement and memory uncertainty."""
    def __init__(self, d: int):
        super().__init__()
        self.head = nn.Sequential(nn.Linear(d + 4, d), nn.SiLU(), nn.Linear(d, 3))

    def forward(self, h: Tensor, temporal_error: Tensor, world_unc: Tensor, mem_conf: Tensor, novelty: Tensor):
        raw = self.head(torch.cat([h, temporal_error, world_unc, mem_conf, novelty], -1))
        aleatoric = F.softplus(raw[:, 0:1])
        epistemic = F.softplus(raw[:, 1:2]) + world_unc
        memory = F.softplus(raw[:, 2:3]) + (1 - mem_conf)
        total = aleatoric + epistemic + memory
        confidence = torch.exp(-total).clamp(0, 1)
        return aleatoric, epistemic, memory, total, confidence


class CounterfactualEvaluatorV15(nn.Module):
    """Action intervention probe: chosen plan vs a controlled baseline action."""
    def __init__(self, d: int, action_dim: int):
        super().__init__()
        self.utility = nn.Sequential(nn.Linear(2 * d + action_dim + 3, d), nn.SiLU(), nn.Linear(d, 1))
        self.baseline = nn.Parameter(torch.zeros(action_dim))

    def score(self, z: Tensor, chosen: Tensor, chosen_next: Tensor, chosen_reward: Tensor, chosen_risk: Tensor,
              baseline_next: Tensor, baseline_reward: Tensor, baseline_risk: Tensor, uncertainty: Tensor):
        base_action = self.baseline.expand_as(chosen)
        chosen_u = chosen_reward - 0.12 * chosen_risk + self.utility(torch.cat([z, chosen_next, chosen, chosen_reward, chosen_risk, uncertainty], -1))
        base_u = baseline_reward - 0.12 * baseline_risk + self.utility(torch.cat([z, baseline_next, base_action, baseline_reward, baseline_risk, uncertainty], -1))
        advantage = chosen_u - base_u
        return advantage


class ComputeValueV15(nn.Module):
    """Learned expected-value-of-computation policy over cheap/deep/plan/learn."""
    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + 7, d), nn.SiLU(), nn.Linear(d, 4))
        self.prior = nn.Parameter(torch.tensor([1.0, 0.0, 0.0, 0.0]))

    def forward(self, h, pe, novelty, total_unc, mem_conf, energy, thermal, sr_td):
        x = torch.cat([h, pe, novelty, total_unc, mem_conf, energy, thermal, sr_td], -1)
        return torch.softmax(self.net(x) + self.prior, -1)


class HealthControllerV15(nn.Module):
    """Maintains bounded state health indicators and a non-neural hard safety envelope."""
    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + 4, d), nn.SiLU(), nn.Linear(d, 2))

    def forward(self, latent, drift, uncertainty, energy, thermal):
        raw = self.net(torch.cat([latent, drift, uncertainty, energy, thermal], -1))
        drift_limit = F.softplus(raw[:, :1]) + 0.05
        plasticity_scale = torch.sigmoid(raw[:, 1:2])
        return drift_limit, plasticity_scale


@dataclass
class V15State:
    base: V14State
    semantic_keys: Tensor
    semantic_values: Tensor
    semantic_strength: Tensor
    successor: Tensor
    prev_latent: Tensor
    life_step: Tensor
    retention_score: Tensor


@dataclass
class V15Config:
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


class NeuroWeaveV15(nn.Module):
    """Frontier V15: predictive continual-learning organism core.

    Adds to V14 in one coherent loop:
      * semantic prototype memory;
      * TD-style successor representation;
      * decomposed uncertainty;
      * counterfactual action intervention;
      * value-of-computation routing including a learn/consolidate branch;
      * health-aware plasticity scaling;
      * persistent life/retention state.
    """
    def __init__(self, cfg: V15Config | None = None):
        super().__init__()
        c = cfg or V15Config()
        self.cfg = c
        self.core = NeuroWeaveV14(V14Config(
            d=c.d, hidden=c.hidden, action_dim=c.action_dim, memory_capacity=c.memory_capacity,
            replay_capacity=c.replay_capacity, max_experts=c.max_experts, top_k=c.top_k,
            world_candidates=c.world_candidates, max_horizon=c.max_horizon, deep_threshold=c.deep_threshold,
        ))
        self.semantic = SemanticMemoryV15(c.d, c.semantic_capacity)
        self.successor = SuccessorRepresentationV15(c.d, gamma=c.sr_gamma)
        self.uncertainty_decomp = UncertaintyDecompositionV15(c.d)
        self.counterfactual = CounterfactualEvaluatorV15(c.d, c.action_dim)
        self.compute_value = ComputeValueV15(c.d)
        self.health = HealthControllerV15(c.d)
        self.integration = nn.Sequential(nn.Linear(3 * c.d + 2, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.d))
        self.next_head_v15 = nn.Linear(c.d, c.d)

    def initial_state(self, b: int, device=None, dtype=None) -> V15State:
        z = torch.zeros(b, self.cfg.d, device=device, dtype=dtype)
        R = self.cfg.replay_capacity
        S = self.cfg.semantic_capacity
        return V15State(
            base=self.core.initial_state(b, device=device, dtype=dtype),
            semantic_keys=torch.zeros(b, S, self.cfg.d, device=device, dtype=dtype),
            semantic_values=torch.zeros(b, S, self.cfg.d, device=device, dtype=dtype),
            semantic_strength=torch.zeros(b, S, 1, device=device, dtype=dtype),
            successor=torch.zeros(b, self.cfg.d, self.cfg.d, device=device, dtype=dtype),
            prev_latent=z.clone(),
            life_step=torch.zeros(b, 1, device=device, dtype=dtype),
            retention_score=torch.ones(b, 1, device=device, dtype=dtype) * 0.5,
        )

    def _counterfactual(self, z, action, chosen_next, reward, risk, uncertainty):
        base_action = self.counterfactual.baseline.expand(z.size(0), -1).to(dtype=z.dtype)
        base_next, base_r, base_risk, _ = self.core.planner.transition(z, base_action)
        chosen_adv = self.counterfactual.score(z, action, chosen_next, reward, risk, base_next, base_r, base_risk, uncertainty)
        return chosen_adv, base_next, base_r, base_risk

    def step(self, x: Tensor, state: V15State, action: Optional[Tensor] = None, commit_memory: bool = True):
        base_out, base_state = self.core.step(x, state.base, action=action, commit_memory=commit_memory)
        # Normalize scalar runtime signals back to the active execution dtype for mobile mixed precision.
        for _k in ("energy_v14", "thermal_v14", "energy_v14", "thermal_v14"):
            if _k in base_out:
                base_out[_k] = base_out[_k].to(dtype=x.dtype)
        z = base_out["latent"]
        sem_read, sem_conf = self.semantic.read(z, state.semantic_keys, state.semantic_values, state.semantic_strength)
        integrated = self.integration(torch.cat([z, sem_read, base_out["memory_read"], base_out["uncertainty"], sem_conf], -1)) + z

        drift = (integrated - state.prev_latent).norm(dim=-1, keepdim=True) / (self.cfg.d ** 0.5)
        aleatoric, epistemic, mem_unc, total_unc, model_conf = self.uncertainty_decomp(
            integrated, base_out["temporal_error"], base_out["world_uncertainty_v14"], sem_conf, base_out["novelty"]
        )
        sr_n, sr_td = self.successor.update(integrated.detach(), base_out["world_next_v14"].detach(), state.successor, base_out["novelty"].detach())
        cf_adv, base_next, base_reward, base_risk = self._counterfactual(
            integrated.detach(), base_out["action"].detach(), base_out["world_next_v14"].detach(),
            base_out["world_reward_v14"].detach(), base_out["world_risk_v14"].detach(), total_unc.detach()
        )
        allocation = self.compute_value(
            integrated, base_out["prediction_error"], base_out["novelty"], total_unc,
            sem_conf, base_out["energy_v14"], base_out["thermal_v14"], sr_td.norm(dim=-1, keepdim=True),
        )
        # [cheap, deep, plan, learn]
        budget = (0.20 + 0.80 * base_out["energy_v14"] - 0.25 * base_out["thermal_v14"].clamp(0, 1)).clamp(0, 1)
        do_learn = (allocation[:, 3:4] > 0.28) & (budget > 0.22) & (base_out["evidence"] > 0.25)
        health_limit, plasticity_scale = self.health(integrated, drift, total_unc, base_out["energy_v14"], base_out["thermal_v14"])
        safe_scale = (health_limit / (drift + 1e-5)).clamp(0, 1) * plasticity_scale

        integrated = z + 0.22 * safe_scale * torch.tanh(integrated - z)
        semantic_keys, semantic_values, semantic_strength = self.semantic.update(
            integrated.detach(), base_out["evidence"].detach(), base_out["novelty"].detach(), model_conf.detach(),
            state.semantic_keys, state.semantic_values, state.semantic_strength,
        )
        next_pred = self.next_head_v15(integrated)
        observed_next = base_out["world_next_v14"].detach()
        retention = (1.0 - (next_pred.detach() - observed_next).pow(2).mean(-1, keepdim=True).sqrt()).clamp(0, 1)
        retention = 0.94 * state.retention_score + 0.06 * retention

        learn_cost = 0.018 * do_learn.to(x.dtype)
        energy = (0.995 * base_state.base.energy - learn_cost - 0.006 * allocation[:, 1:2] - 0.01 * allocation[:, 2:3]).clamp(0, 1)
        thermal = (0.965 * base_state.base.thermal + 0.025 * allocation[:, 1:2] + 0.04 * allocation[:, 2:3] + 0.012 * allocation[:, 3:4]).clamp(0, 1.5).to(dtype=x.dtype)
        energy = energy.to(dtype=x.dtype)
        base_state.base.context = integrated.detach()
        base_state.base.energy = energy.detach().to(dtype=x.dtype)
        base_state.base.thermal = thermal.detach().to(dtype=x.dtype)

        out = dict(base_out)
        out.update({
            "latent_v15": integrated,
            "semantic_read_v15": sem_read,
            "semantic_confidence_v15": sem_conf,
            "aleatoric_uncertainty_v15": aleatoric,
            "epistemic_uncertainty_v15": epistemic,
            "memory_uncertainty_v15": mem_unc,
            "total_uncertainty_v15": total_unc,
            "model_confidence_v15": model_conf,
            "successor_td_v15": sr_td,
            "successor_norm_v15": torch.linalg.matrix_norm(sr_n, dim=(-2, -1), keepdim=True).squeeze(-1),
            "counterfactual_advantage_v15": cf_adv,
            "counterfactual_baseline_reward_v15": base_reward,
            "counterfactual_baseline_risk_v15": base_risk,
            "compute_allocation_v15": allocation,
            "learn_taken_v15": do_learn.to(x.dtype),
            "health_drift_limit_v15": health_limit,
            "plasticity_scale_v15": plasticity_scale,
            "safe_plasticity_scale_v15": safe_scale,
            "retention_score_v15": retention,
            "next_prediction_v15": next_pred,
            "energy_v15": energy,
            "thermal_v15": thermal,
        })
        ns = V15State(
            base=base_state,
            semantic_keys=semantic_keys,
            semantic_values=semantic_values,
            semantic_strength=semantic_strength,
            successor=sr_n,
            prev_latent=integrated.detach(),
            life_step=state.life_step + 1,
            retention_score=retention.detach(),
        )
        return out, ns

    def forward(self, x: Tensor, state: Optional[V15State] = None, commit_memory: bool = True) -> Dict[str, Tensor]:
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


class LifeCycleTrainerV15:
    """Bounded life-long trainer: replay + multi-step predictive consistency + successor TD."""
    def __init__(self, model: NeuroWeaveV15, lr: float = 2e-3):
        self.model = model
        params = (
            list(model.next_head_v15.parameters())
            + list(model.semantic.key.parameters()) + list(model.semantic.value.parameters())
            + list(model.successor.value.parameters())
            + list(model.uncertainty_decomp.parameters()) + list(model.counterfactual.parameters())
            + list(model.compute_value.parameters()) + list(model.health.parameters())
            + list(model.integration.parameters())
        )
        self.optimizer = torch.optim.AdamW(params, lr=lr, weight_decay=1e-4)

    def step(self, state: V15State, count: int = 6):
        self.model.train()
        self.optimizer.zero_grad(set_to_none=True)
        keys = state.base.replay_keys
        targets = state.base.replay_targets
        pri = state.base.replay_priority
        valid = (pri > 0).float()
        pred = self.model.next_head_v15(keys)
        replay_loss = ((pred - targets).pow(2).mean(-1, keepdim=True) * (0.2 + pri)).sum() / valid.sum().clamp_min(1.0)
        if keys.size(1) >= 2:
            seq_pred = self.model.next_head_v15(keys[:, :-1])
            seq_target = targets[:, 1:]
            seq_loss = F.smooth_l1_loss(seq_pred, seq_target)
        else:
            seq_loss = replay_loss * 0
        reg = 0.01 * (self.model.successor.value.weight.pow(2).mean() + self.model.compute_value.prior.square().mean())
        loss = replay_loss + 0.15 * seq_loss + reg
        loss.backward()
        nn.utils.clip_grad_norm_(self.optimizer.param_groups[0]["params"], 1.0)
        self.optimizer.step()
        return loss.detach()
