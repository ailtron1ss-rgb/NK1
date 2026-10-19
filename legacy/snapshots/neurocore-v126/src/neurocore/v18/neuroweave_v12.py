from __future__ import annotations
from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass
class V12State:
    fast: Tensor
    medium: Tensor
    slow: Tensor
    trace: Tensor
    context: Tensor
    memory_keys: Tensor
    memory_values: Tensor
    memory_strength: Tensor
    memory_age: Tensor
    expert_credit: Tensor
    expert_active: Tensor
    energy: Tensor
    thermal: Tensor
    step: Tensor


class RetrievalConditionedRecurrenceV12(nn.Module):
    """Recurrent state is modulated by retrieved memory and an explicit write/read relation."""
    def __init__(self, d: int):
        super().__init__()
        self.x = nn.Linear(d, 3 * d)
        self.h = nn.Linear(d, 3 * d, bias=False)
        self.r = nn.Linear(d, d)
        self.mix = nn.Linear(2 * d, 3 * d)

    def forward(self, x: Tensor, h: Tensor, memory: Tensor) -> Tensor:
        g = self.x(x) + self.h(h) + self.mix(torch.cat([x, memory], -1))
        z, c, q = g.chunk(3, -1)
        gate = torch.sigmoid(z)
        cand = torch.tanh(c + self.r(memory))
        update = torch.sigmoid(q)
        proposal = update * cand + (1 - update) * x
        return (1 - gate) * h + gate * proposal


class LearnedReplaySchedulerV12(nn.Module):
    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + 6, d), nn.SiLU(), nn.Linear(d, 1))

    def forward(self, state, pe, evidence, age, unc, novelty, stability):
        q = torch.cat([state, pe, evidence, age, unc, novelty, stability], -1)
        return torch.sigmoid(self.net(q))


class MetaPlasticityV3(nn.Module):
    def __init__(self, d: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d + 6, d), nn.GELU(), nn.Linear(d, 1))

    def forward(self, h, pe, nov, unc, evidence, stability, drift):
        q = torch.cat([h, pe, nov, unc, evidence, stability, drift], -1)
        return torch.sigmoid(self.net(q))


class PlasticityConsolidatorV12(nn.Module):
    def __init__(self, d: int):
        super().__init__()
        self.imp = nn.Sequential(nn.Linear(d, d), nn.SiLU(), nn.Linear(d, 1))

    def importance(self, h):
        return torch.sigmoid(self.imp(h))

    def penalty(self, current, reference, importance):
        return (importance * (current - reference).pow(2)).mean()


class SparseExpertBankV12(nn.Module):
    """Actual sparse dispatch: only selected experts execute their MLPs."""
    def __init__(self, d: int, max_experts: int = 8, top_k: int = 2):
        super().__init__()
        self.max_experts = max_experts
        self.top_k = min(top_k, max_experts)
        self.experts = nn.ModuleList(
            [nn.Sequential(nn.Linear(d, d), nn.GELU(), nn.Linear(d, d)) for _ in range(max_experts)]
        )
        self.router = nn.Linear(d + 5, max_experts)

    def forward(self, z: Tensor, signal: Tensor, active: Tensor, credit: Tensor):
        logits = self.router(torch.cat([z, signal], -1)) + torch.log1p(credit.clamp_min(0))
        mask = torch.where(active > 0.5, torch.zeros_like(logits), torch.full_like(logits, -1e4))
        tv, ti = torch.topk(logits + mask, self.top_k, -1)
        probs = torch.softmax(tv, -1)

        # Sparse execution: no all-expert stack. Each expert only processes the rows routed to it.
        out = torch.zeros_like(z)
        for expert_id, expert in enumerate(self.experts):
            slots = (ti == expert_id).nonzero(as_tuple=False)
            if slots.numel() == 0:
                continue
            rows = slots[:, 0]
            slot = slots[:, 1]
            values = expert(z.index_select(0, rows))
            weighted = values * probs.index_select(0, rows).gather(1, slot[:, None]).expand_as(values)
            out.index_add_(0, rows, weighted)
        return out, probs, ti, logits


class NeuroWeaveV12(nn.Module):
    """
    X1/X2 candidate core:
      - actual sparse expert execution;
      - per-sample compute gating;
      - bounded erase/write associative memory;
      - age-aware replacement;
      - recurrence remains retrieval-conditioned.
    """
    def __init__(self, d=16, hidden=32, action_dim=4, capacity=64, max_experts=8, top_k=2, deep_threshold=0.60):
        super().__init__()
        self.d = d
        self.max_experts = max_experts
        self.capacity = capacity
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

        self.replay = LearnedReplaySchedulerV12(d)
        self.meta = MetaPlasticityV3(d)
        self.consolidator = PlasticityConsolidatorV12(d)
        self.experts = SparseExpertBankV12(d, max_experts, top_k)

        self.compute = nn.Linear(d + 4, 1)
        self.deep = nn.Sequential(nn.Linear(d, 2 * d), nn.GELU(), nn.Linear(2 * d, d))
        self.action = nn.Linear(d, action_dim)
        self.world_fast = nn.Sequential(nn.Linear(d + action_dim, d), nn.Tanh(), nn.Linear(d, d))
        self.world_slow = nn.Sequential(nn.Linear(2 * d, d), nn.SiLU(), nn.Linear(d, d))
        self.world_var = nn.Sequential(nn.Linear(d, d), nn.SiLU(), nn.Linear(d, 1))
        self.world_reward = nn.Linear(d, 1)
        self.value = nn.Linear(d, 1)
        self.homeo = nn.Linear(d + 3, 2)

    def initial_state(self, b, device=None, dtype=None):
        z = lambda: torch.zeros(b, self.d, device=device, dtype=dtype)
        empty_k = torch.zeros(b, 0, self.d, device=device, dtype=dtype)
        empty_s = torch.zeros(b, 0, 1, device=device, dtype=dtype)
        empty_a = torch.zeros(b, 0, 1, device=device, dtype=dtype)
        return V12State(
            z(), z(), z(), z(), z(), empty_k, empty_k.clone(), empty_s, empty_a,
            torch.zeros(b, self.max_experts, device=device, dtype=dtype),
            torch.ones(b, self.max_experts, device=device, dtype=dtype),
            torch.ones(b, 1, device=device, dtype=dtype),
            torch.zeros(b, 1, device=device, dtype=dtype),
            torch.zeros(b, 1, device=device, dtype=dtype),
        )

    def read_memory(self, q, keys, vals, strength, age):
        if keys.size(1) == 0:
            return q.new_zeros(q.size()), q.new_zeros(q.size(0), 1)
        qq = F.normalize(self.q(q), -1)
        kk = F.normalize(keys, -1)
        sim = torch.einsum('bd,bnd->bn', qq, kk) / self.temp.clamp_min(0.05)
        age_decay = torch.exp(-age.squeeze(-1).clamp_min(0.0) / 128.0)
        w = F.softmax(sim, -1) * strength.squeeze(-1) * age_decay
        den = w.sum(-1, keepdim=True).clamp_min(1e-6)
        r = torch.einsum('bn,bnd->bd', w, vals) / den
        return r, w.max(-1, keepdim=True).values

    @torch.no_grad()
    def commit_memory(self, x, evidence, context, keys, vals, strength, age):
        keys, vals = keys.clone(), vals.clone()
        strength, age = strength.clone(), age.clone()
        b = x.size(0)
        k = F.normalize(self.key(x), -1)
        v = self.val(x)
        s = evidence.clamp(0, 1)
        write = torch.sigmoid(self.write_gate(torch.cat([context, x, evidence], -1)))

        if keys.size(1) == 0:
            keys = k[:, None, :]
            vals = v[:, None, :]
            strength = (s * write).view(b, 1, 1)
            age = torch.zeros(b, 1, 1, device=x.device, dtype=x.dtype)
            return keys.detach(), vals.detach(), strength.detach(), age.detach()

        # Similar memories are updated in place with an explicit erase/write gate.
        qn = F.normalize(k, -1)
        sim = torch.einsum('bd,bnd->bn', qn, F.normalize(keys, -1))
        best_sim, best_idx = sim.max(-1)
        matched = best_sim > 0.82
        rows = torch.arange(b, device=x.device)
        for i in range(b):
            age[i] += 1.0
            j = int(best_idx[i])
            if bool(matched[i]):
                old_v = vals[i, j]
                old_k = keys[i, j]
                gate = torch.sigmoid(self.erase(torch.cat([old_k, v[i], s[i], best_sim[i:i+1]], -1)))
                vals[i, j] = (1 - gate) * old_v + gate * v[i]
                keys[i, j] = F.normalize((0.8 * old_k + 0.2 * k[i]), dim=0)
                strength[i, j, 0] = (0.92 * strength[i, j, 0] + 0.08 * (s[i] * write[i, 0])).clamp(0, 1)
                age[i, j, 0] = 0
            elif keys.size(1) < self.capacity:
                # Keep a uniform tensor length across the batch. A matched row gets an inert
                # placeholder so another row can grow the shared bounded memory tensor.
                ks = k[i:i+1] if not bool(matched[i]) else keys[i, j:j+1]
                vs = v[i:i+1] if not bool(matched[i]) else vals[i, j:j+1]
                ss = (s[i] * write[i]).view(1, 1) if not bool(matched[i]) else torch.zeros(1, 1, device=x.device, dtype=x.dtype)
                aa = torch.zeros(1, 1, device=x.device, dtype=x.dtype) if not bool(matched[i]) else torch.full((1, 1), 1e6, device=x.device, dtype=x.dtype)
                keys[i] = torch.cat([keys[i], ks], 0)
                vals[i] = torch.cat([vals[i], vs], 0)
                strength[i] = torch.cat([strength[i], ss], 0)
                age[i] = torch.cat([age[i], aa], 0)
            else:
                # Least valuable slot balances low strength with old age.
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

    def _deep_selective(self, specialized: Tensor, cp: Tensor):
        # True compute savings: the deep MLP is only called for selected samples.
        hard = cp[:, 0] >= self.deep_threshold
        latent = specialized.clone()
        idx = hard.nonzero(as_tuple=False).flatten()
        if idx.numel():
            latent[idx] = latent[idx] + self.deep(specialized.index_select(0, idx))
        return latent, hard.float().unsqueeze(-1)

    def step(self, x, state: V12State, action=None, commit_memory=True):
        e = self.encoder(x)
        mem, memc = self.read_memory(state.context, state.memory_keys, state.memory_values, state.memory_strength, state.memory_age)
        fast = self.fast(e, state.fast, mem)
        medium = self.medium(0.60 * fast + 0.40 * mem, state.medium, mem)
        slow_c = self.slow(0.35 * medium + 0.65 * mem, state.slow, mem)
        trace = self.trace(fast, state.trace)

        p_in = torch.cat([state.fast, state.medium, state.slow, state.trace], -1)
        pred = self.pred(p_in)
        pvar = F.softplus(self.var(p_in))
        pe = (e - pred).pow(2).mean(-1, keepdim=True).sqrt()
        nov = (1 - F.cosine_similarity(e, state.context, dim=-1).unsqueeze(-1)).clamp(0, 2)
        drift = (fast - state.fast).abs().mean(-1, keepdim=True)
        stability = (1 - (medium - slow_c).abs().mean(-1, keepdim=True)).clamp(0, 1)
        unc = torch.sigmoid(pvar + 0.35 * memc + 0.25 * nov)
        energy_pressure = (1 - state.energy).clamp(0, 1)
        ev = torch.sigmoid(self.evidence(torch.cat([fast, pe, nov, unc, drift, energy_pressure, stability], -1))).clamp(0, 1)

        plasticity = self.meta(fast, pe, nov, unc, ev, stability, drift)
        slow = plasticity * slow_c + (1 - plasticity) * state.slow

        if commit_memory:
            keys, vals, strength, age = self.commit_memory(e, ev, fast, state.memory_keys, state.memory_values, state.memory_strength, state.memory_age)
        else:
            keys, vals, strength, age = state.memory_keys, state.memory_values, state.memory_strength, state.memory_age

        context = 0.40 * medium + 0.28 * slow + 0.14 * trace + 0.18 * mem
        signal = torch.cat([pe, nov, unc, memc, ev], -1)
        specialized, probs, indices, logits = self.experts(context, signal, state.expert_active, state.expert_credit)

        # Credit is observationally grounded in one-step prediction improvement, not routing probability.
        with torch.no_grad():
            chosen = torch.zeros_like(state.expert_credit)
            chosen.scatter_add_(1, indices, probs)
            base_err = (context - pred).pow(2).mean(-1, keepdim=True)
            spec_err = (specialized - pred).pow(2).mean(-1, keepdim=True)
            improvement = (base_err - spec_err)
            credit_obs = (ev * torch.sigmoid(improvement)).detach() * chosen
        credit = 0.97 * state.expert_credit + 0.03 * credit_obs
        replay = self.replay(context, pe, ev, age.mean(-1) if age.size(1) else pe, unc, nov, stability)
        active_next = self.propose_structure(credit, state.expert_active)

        cp = torch.sigmoid(self.compute(torch.cat([context, pe, nov, unc, ev], -1)))
        latent, deep_taken = self._deep_selective(specialized, cp)
        act = self.action(latent) if action is None else action
        wf = torch.tanh(self.world_fast(torch.cat([latent, act], -1)))
        ws = torch.tanh(self.world_slow(torch.cat([wf, slow], -1)))
        wn = 0.65 * wf + 0.35 * ws
        wunc = F.softplus(self.world_var(wn))
        rew = self.world_reward(wn)
        ig = (wunc + unc) * (1 + nov)
        val = self.value(latent)
        home = self.homeo(torch.cat([latent, pe, unc, ev], -1))
        te, tt = torch.sigmoid(home[:, 0:1]), torch.sigmoid(home[:, 1:2])
        energy = (0.97 * state.energy + 0.03 * (1 - te)).clamp(0, 1)
        thermal = (0.96 * state.thermal + 0.04 * (tt + 0.25 * deep_taken)).clamp(0, 1.5)

        out = {
            'latent': latent, 'prediction': pred, 'prediction_error': pe,
            'prediction_uncertainty': pvar, 'novelty': nov, 'uncertainty': unc,
            'stability': stability, 'evidence': ev, 'plasticity': plasticity,
            'memory_read': mem, 'memory_confidence': memc, 'route_probs': probs,
            'route_indices': indices, 'route_logits': logits, 'expert_credit': credit,
            'expert_active': active_next, 'replay_priority': replay,
            'compute_probability': cp, 'deep_taken': deep_taken, 'action': act,
            'world_next': wn, 'world_reward': rew, 'world_uncertainty': wunc,
            'information_gain': ig, 'value': val, 'energy': energy, 'thermal': thermal,
            'memory_size': torch.full((x.size(0), 1), float(keys.size(1)), device=x.device, dtype=x.dtype),
        }
        ns = V12State(
            fast, medium, slow, trace, latent.detach(), keys, vals, strength, age,
            credit.detach(), active_next.detach(), energy.detach(), thermal.detach(), state.step + 1
        )
        return out, ns

    def forward(self, x, state=None, deep_mask: Optional[Tensor] = None, commit_memory=True):
        if x.ndim != 3 or x.size(-1) != self.d:
            raise ValueError('x must be [B,T,D]')
        state = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            out, state = self.step(x[:, t], state, commit_memory=commit_memory)
            if deep_mask is not None:
                requested = deep_mask[:, t:t+1].to(dtype=x.dtype)
                # Diagnostic override: selectively run deep only for requested rows.
                forced = requested[:, 0] > 0.5
                if forced.any():
                    idx = forced.nonzero(as_tuple=False).flatten()
                    out['latent'][idx] = out['latent'][idx] + self.deep(out['latent'].index_select(0, idx))
                    out['deep_taken'] = torch.maximum(out['deep_taken'], requested)
                    state.context = out['latent'].detach()
            rows.append(out)
        return {k: torch.stack([r[k] for r in rows], 1) for k in rows[0]}, state
