from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor, nn
import torch.nn.functional as F


@dataclass(frozen=True)
class AdaptiveLinearityConfig:
    """Opt-in per-neuron adaptive linearity inspired by AdaLin (2026).

    The unit keeps one trainable linearity logit and a non-trainable EMA of observed
    activation-gradient magnitude. The latter changes the forward gate on later steps;
    it is therefore a stateful learning signal rather than a decorative metric.
    """

    enabled: bool = False
    init_linearity: float = 0.05
    gradient_ema_decay: float = 0.95
    gradient_sensitivity: float = 2.0
    min_gate: float = 0.01
    max_gate: float = 0.99
    activity_ema_decay: float = 0.99

    def __post_init__(self) -> None:
        if not 0.0 < self.gradient_ema_decay < 1.0:
            raise ValueError("gradient_ema_decay must be in (0,1)")
        if not 0.0 < self.activity_ema_decay < 1.0:
            raise ValueError("activity_ema_decay must be in (0,1)")
        if not 0.0 <= self.min_gate < self.max_gate <= 1.0:
            raise ValueError("invalid gate bounds")
        if not 0.0 <= self.init_linearity <= 1.0:
            raise ValueError("init_linearity must be in [0,1]")


class AdaptiveLinearity(nn.Module):
    """Per-neuron nonlinear/linear interpolation driven by observed gradient flow.

    y = (1-g) * SiLU(x) + g * x

    ``g`` is parameterized per neuron and is modulated by the previous EMA of activation
    gradient magnitude. A backward hook updates that EMA after each backward pass. This
    avoids an optimizer-side second model pass and keeps the learning signal local.
    """

    STATE_VERSION = 1

    def __init__(self, features: int, cfg: AdaptiveLinearityConfig | None = None) -> None:
        super().__init__()
        self.features = int(features)
        self.cfg = cfg or AdaptiveLinearityConfig(enabled=True)
        init = min(max(float(self.cfg.init_linearity), 1e-4), 1.0 - 1e-4)
        logit = torch.full((self.features,), torch.logit(torch.tensor(init)).item())
        self.linearity_logit = nn.Parameter(logit)
        self.register_buffer("gradient_ema", torch.full((self.features,), 1e-3))
        self.register_buffer("activity_ema", torch.zeros(self.features))
        self.register_buffer("hook_updates", torch.zeros((), dtype=torch.long))
        self.register_buffer("last_gate_mean", torch.zeros(()))
        self.register_buffer("last_gradient_mean", torch.zeros(()))

    def _gate(self) -> Tensor:
        grad = self.gradient_ema
        # Log-space stabilizes wide gradient ranges without inventing a second learned model.
        g = torch.log1p(grad)
        centered = (g - g.mean()) / g.std(unbiased=False).clamp_min(1e-5)
        # Units receiving weaker gradient flow get a stronger linear component.
        logits = self.linearity_logit - float(self.cfg.gradient_sensitivity) * centered
        return torch.sigmoid(logits).clamp(float(self.cfg.min_gate), float(self.cfg.max_gate))

    def _capture_gradient(self, grad: Tensor) -> Tensor:
        with torch.no_grad():
            mean_abs = grad.detach().abs().reshape(-1, self.features).mean(dim=0)
            activity = self._last_output.detach().abs().reshape(-1, self.features).mean(dim=0)
            d = float(self.cfg.gradient_ema_decay)
            a = float(self.cfg.activity_ema_decay)
            self.gradient_ema.mul_(d).add_(mean_abs * (1.0 - d))
            self.activity_ema.mul_(a).add_(activity * (1.0 - a))
            self.hook_updates.add_(1)
            self.last_gradient_mean.copy_(mean_abs.mean())
        return grad

    def forward(self, x: Tensor, nonlinear=None) -> Tensor:
        if x.ndim < 2 or x.size(-1) != self.features:
            raise ValueError(f"expected [...,{self.features}]")
        if not self.cfg.enabled:
            return F.silu(x) if nonlinear is None else nonlinear(x)
        gate = self._gate().to(dtype=x.dtype, device=x.device)
        base = F.silu(x) if nonlinear is None else nonlinear(x)
        if base.shape != x.shape:
            raise ValueError("nonlinear must preserve the input shape")
        out = (1.0 - gate) * base + gate * x
        with torch.no_grad():
            self.last_gate_mean.copy_(gate.float().mean())
        if out.requires_grad:
            self._last_output = out.detach()
            out.register_hook(self._capture_gradient)
        return out

    @torch.no_grad()
    def reset_state(self) -> None:
        self.gradient_ema.fill_(1e-3)
        self.activity_ema.zero_()
        self.hook_updates.zero_()
        self.last_gate_mean.zero_()
        self.last_gradient_mean.zero_()
