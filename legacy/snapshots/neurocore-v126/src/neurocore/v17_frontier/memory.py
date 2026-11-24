from __future__ import annotations
from dataclasses import dataclass
from typing import Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

class UncertaintyMemoryV17(nn.Module):
    """Compact Kalman-inspired associative memory.

    Runtime state is mean matrix + scalar uncertainty. A scalar covariance proxy keeps
    the uncertainty-aware write mobile-friendly while preserving the important property:
    writes are down-weighted when evidence is weak and uncertainty is already low.
    """
    def __init__(self, d: int, max_norm: float = 1.4):
        super().__init__()
        self.q = nn.Linear(d, d)
        self.v = nn.Linear(d, d)
        self.gain = nn.Sequential(nn.Linear(d + 4, d), nn.SiLU(), nn.Linear(d, 1))
        self.process_noise = nn.Parameter(torch.tensor(-2.0))
        self.max_norm = max_norm

    def read(self, h: Tensor, W: Tensor, uncertainty: Tensor) -> Tensor:
        q = F.normalize(self.q(h), dim=-1, eps=1e-4)
        return torch.einsum("bij,bj->bi", W, q)

    @torch.no_grad()
    def update(self, h: Tensor, target: Tensor, W: Tensor, cov: Tensor,
               evidence: Tensor, novelty: Tensor, confidence: Tensor, energy: Tensor):
        q = F.normalize(self.q(h), dim=-1, eps=1e-4)
        y = torch.tanh(self.v(target))
        pred = torch.einsum("bij,bj->bi", W, q)
        err = y - pred
        feat = torch.cat([h, evidence, novelty, confidence, energy], -1)
        base_gain = torch.sigmoid(self.gain(feat)).clamp(0.002, 0.10)
        prior_var = cov.clamp(1e-4, 4.0)
        obs_var = 0.05 + 0.45 * (1.0 - confidence).clamp(0, 1) + 0.15 * novelty.clamp(0, 1)
        kg = (prior_var / (prior_var + obs_var + 1e-5)).clamp(0.02, 0.95)
        rate = (base_gain * kg).unsqueeze(-1)
        delta = rate * torch.einsum("bi,bj->bij", err, q) / (1.0 + q.square().sum(-1, keepdim=True)).unsqueeze(-1)
        Wn = (1.0 - 0.01 * kg.unsqueeze(-1)) * W + delta
        norm = torch.linalg.matrix_norm(Wn, ord="fro", dim=(-2,-1), keepdim=True).clamp_min(1e-6)
        Wn = Wn * (self.max_norm / norm).clamp(max=1.0)
        # Scalar covariance recursion: posterior shrinks with evidence, then process noise reopens it.
        process = F.softplus(self.process_noise).to(dtype=cov.dtype)
        cov_n = ((1.0 - kg) * prior_var + 0.02 * process + 0.02 * novelty).clamp(1e-4, 4.0)
        return Wn.detach(), cov_n.detach(), pred.detach(), err.detach(), kg.detach()

class ExactCacheV17:
    """Bounded exact KV complement to compressive recurrent memory.

    Keeps high-residual associations. This is deliberately small and fixed-shape.
    """
    def __init__(self, batch: int, capacity: int, d: int, device, dtype):
        self.keys = torch.zeros(batch, capacity, d, device=device, dtype=dtype)
        self.values = torch.zeros(batch, capacity, d, device=device, dtype=dtype)
        self.score = torch.zeros(batch, capacity, 1, device=device, dtype=dtype)
        self.age = torch.zeros(batch, capacity, 1, device=device, dtype=dtype)

    def read(self, q: Tensor) -> Tuple[Tensor, Tensor]:
        qq = F.normalize(q, dim=-1, eps=1e-4)
        kk = F.normalize(self.keys, dim=-1, eps=1e-4)
        sim = torch.einsum("bd,bnd->bn", qq, kk)
        valid = self.score.squeeze(-1) > 0
        sim = sim.masked_fill(~valid, -1e4)
        w = F.softmax(sim, -1) * self.score.squeeze(-1)
        out = torch.einsum("bn,bnd->bd", w, self.values)
        return out, w.sum(-1, keepdim=True).clamp(0,1)

    @torch.no_grad()
    def update(self, key: Tensor, value: Tensor, residual: Tensor, novelty: Tensor, write_gate: Tensor):
        keys = self.keys.clone(); values = self.values.clone(); score = self.score.clone(); age = self.age + 1
        strength = (residual.abs().mean(-1, keepdim=True) * (0.3 + novelty) * write_gate).clamp(0,1)
        for i in range(key.size(0)):
            if float(strength[i,0]) < 0.12:
                continue
            valid = score[i,:,0] > 0
            if valid.any():
                kk = F.normalize(keys[i], dim=-1, eps=1e-4)
                sim = torch.mv(kk, F.normalize(key[i], dim=-1, eps=1e-4)).masked_fill(~valid, -1e4)
                j = int(sim.argmax())
                if float(sim[j]) > 0.88:
                    a = float(strength[i,0].clamp(0.05,0.30))
                    keys[i,j] = F.normalize((1-a)*keys[i,j] + a*key[i], dim=-1, eps=1e-4)
                    values[i,j] = (1-a)*values[i,j] + a*value[i]
                    score[i,j,0] = max(float(score[i,j,0])*0.90, float(strength[i,0]))
                    age[i,j,0] = 0
                    continue
            utility = 0.7*(1-score[i,:,0]) + 0.3*(age[i,:,0]/(age[i,:,0].max()+1.0))
            j = int(utility.argmax())
            keys[i,j] = F.normalize(key[i], dim=-1, eps=1e-4)
            values[i,j] = value[i]
            score[i,j,0] = strength[i,0]
            age[i,j,0] = 0
        self.keys, self.values, self.score, self.age = keys.detach(), values.detach(), score.detach(), age.detach()
        return self.keys, self.values, self.score, self.age
