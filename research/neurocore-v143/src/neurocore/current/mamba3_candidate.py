from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F


def heavy_tail_activation(x: Tensor) -> Tensor:
    """Parameter-free heavy-tail transform retained as an optional research primitive."""
    neg = x.clamp_max(0)
    pos = x.clamp_min(0)
    return pos + torch.reciprocal(1.0 - neg)


class _RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-5) -> None:
        super().__init__()
        self.weight = nn.Parameter(torch.ones(dim))
        self.eps = float(eps)

    def forward(self, x: Tensor) -> Tensor:
        return x * torch.rsqrt(x.float().pow(2).mean(dim=-1, keepdim=True) + self.eps).to(x.dtype) * self.weight


def _apply_pairwise_rope(x: Tensor, angles: Tensor, rotary_dim: int) -> Tensor:
    """Rotate paired coordinates of the leading ``rotary_dim`` features."""
    if rotary_dim <= 0:
        return x
    rot = x[..., :rotary_dim]
    rest = x[..., rotary_dim:]
    even = rot[..., 0::2]
    odd = rot[..., 1::2]
    cos = torch.cos(angles).to(rot.dtype)
    sin = torch.sin(angles).to(rot.dtype)
    even_r = even * cos - odd * sin
    odd_r = even * sin + odd * cos
    rotated = torch.stack((even_r, odd_r), dim=-1).flatten(-2)
    return torch.cat((rotated, rest), dim=-1)


@dataclass(frozen=True)
class Mamba3CandidateConfig:
    """Portable Mamba-3 fidelity candidate.

    This deliberately remains independent from the upstream CUDA/Triton implementation. It
    matches the documented structural ideas used by current Mamba-3 code: no causal convolution,
    input-dependent A/dt/trapezoid controls, learned B/C, B/C normalization, cumulative rotary
    state angles, MIMO rank mixing, and a direct D skip/readout path.
    """

    d_state: int = 16
    headdim: int = 16
    mimo_rank: int = 2
    n_groups: int = 1
    rope_fraction: float = 0.5
    dt_min: float = 1e-3
    dt_max: float = 0.1
    dt_init_floor: float = 1e-4
    a_floor: float = 1e-4
    norm_eps: float = 1e-5
    use_trapezoid: bool = True
    use_rotary: bool = True

    def __post_init__(self) -> None:
        if self.d_state <= 0 or self.headdim <= 0 or self.mimo_rank <= 0:
            raise ValueError("Mamba3Candidate dimensions must be positive")
        if self.n_groups <= 0:
            raise ValueError("n_groups must be positive")
        if self.rope_fraction not in (0.5, 1.0):
            raise ValueError("rope_fraction must be 0.5 or 1.0")
        if not 0.0 < self.dt_min <= self.dt_max:
            raise ValueError("dt bounds must satisfy 0 < dt_min <= dt_max")
        if self.a_floor <= 0.0 or self.norm_eps <= 0.0:
            raise ValueError("a_floor and norm_eps must be positive")
        split = int(self.d_state * self.rope_fraction)
        if split % 2:
            split -= 1
        if split < 2:
            raise ValueError("d_state and rope_fraction must leave at least one rotary pair")


class Mamba3Candidate(nn.Module):
    """Causal Mamba-3 structural candidate with explicit serializable recurrent state.

    The recurrent state is ``ssm`` [B,H,P,S], ``bx_prev`` [B,H,P,S], and cumulative rotary
    ``angle`` [B,H,R].  ``P`` is ``headdim`` and ``S`` is ``d_state``.  MIMO rank is transient and
    therefore does not inflate the persistent state tensor.
    """

    STATE_VERSION = 2
    BACKEND_MODE = "reference_mamba3_fidelity"

    def __init__(self, d_model: int, cfg: Optional[Mamba3CandidateConfig] = None) -> None:
        super().__init__()
        self.d_model = int(d_model)
        self.cfg = cfg or Mamba3CandidateConfig()
        if self.d_model % self.cfg.headdim != 0:
            raise ValueError("d_model must be divisible by headdim")
        if self.d_model % self.cfg.n_groups != 0:
            raise ValueError("d_model must be divisible by n_groups")
        self.nheads = self.d_model // self.cfg.headdim
        if self.nheads % self.cfg.n_groups != 0:
            raise ValueError("number of heads must be divisible by n_groups")
        self.d_inner = self.d_model
        self.rotary_dim = int(self.cfg.d_state * self.cfg.rope_fraction)
        if self.rotary_dim % 2:
            self.rotary_dim -= 1
        self.num_rope_angles = self.rotary_dim // 2

        # One projection reduces memory traffic and keeps the candidate close to the published layout.
        self.d_in_proj = (
            2 * self.d_inner
            + 2 * self.cfg.d_state * self.cfg.n_groups * self.cfg.mimo_rank
            + 3 * self.nheads
            + self.num_rope_angles
        )
        self.in_proj = nn.Linear(self.d_model, self.d_in_proj, bias=False)

        # Log-uniform initialization followed by inverse-softplus, matching current Mamba-3 source.
        dt = torch.exp(
            torch.rand(self.nheads, dtype=torch.float32)
            * (math.log(self.cfg.dt_max) - math.log(self.cfg.dt_min))
            + math.log(self.cfg.dt_min)
        ).clamp(min=self.cfg.dt_init_floor)
        inv_dt = dt + torch.log(-torch.expm1(-dt))
        self.dt_bias = nn.Parameter(inv_dt)
        self.dt_bias._no_weight_decay = True

        self.B_bias = nn.Parameter(torch.ones(self.cfg.mimo_rank, self.nheads, self.cfg.d_state))
        self.C_bias = nn.Parameter(torch.ones(self.cfg.mimo_rank, self.nheads, self.cfg.d_state))
        self.B_norm = _RMSNorm(self.cfg.d_state, self.cfg.norm_eps)
        self.C_norm = _RMSNorm(self.cfg.d_state, self.cfg.norm_eps)

        mimo_x = torch.ones(self.nheads, self.cfg.mimo_rank, self.cfg.headdim) / self.cfg.mimo_rank
        mimo_z = torch.ones(self.nheads, self.cfg.mimo_rank, self.cfg.headdim)
        mimo_o = torch.ones(self.nheads, self.cfg.mimo_rank, self.cfg.headdim) / self.cfg.mimo_rank
        self.mimo_x = nn.Parameter(mimo_x)
        self.mimo_z = nn.Parameter(mimo_z)
        self.mimo_o = nn.Parameter(mimo_o)

        self.D = nn.Parameter(torch.ones(self.nheads))
        self.D._no_weight_decay = True
        self.out_proj = nn.Linear(self.d_inner, self.d_model, bias=False)

    def initial_state(self, batch_size: int, device: torch.device, dtype: torch.dtype) -> dict[str, Tensor]:
        state_dtype = torch.float32 if dtype in (torch.float16, torch.bfloat16) else dtype
        return {
            "ssm": torch.zeros(batch_size, self.nheads, self.cfg.headdim, self.cfg.d_state, device=device, dtype=state_dtype),
            "bx_prev": torch.zeros(batch_size, self.nheads, self.cfg.headdim, self.cfg.d_state, device=device, dtype=state_dtype),
            "angle": torch.zeros(batch_size, self.nheads, self.num_rope_angles, device=device, dtype=state_dtype),
        }

    def _split_projected(self, x: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor, Tensor, Tensor, Tensor, Tensor]:
        return torch.split(
            self.in_proj(x),
            [
                self.d_inner,
                self.d_inner,
                self.cfg.d_state * self.cfg.n_groups * self.cfg.mimo_rank,
                self.cfg.d_state * self.cfg.n_groups * self.cfg.mimo_rank,
                self.nheads,
                self.nheads,
                self.nheads,
                self.num_rope_angles,
            ],
            dim=-1,
        )

    def _prepare_bc(self, raw: Tensor, bias: Tensor, norm: nn.Module) -> Tensor:
        # [B, R*G*S] -> [B,R,G,S] -> [B,R,H,S].
        bsz = raw.size(0)
        shaped = raw.view(bsz, self.cfg.mimo_rank, self.cfg.n_groups, self.cfg.d_state)
        shaped = norm(shaped)
        shaped = shaped.repeat_interleave(self.nheads // self.cfg.n_groups, dim=2)
        return shaped + bias.unsqueeze(0)

    def _prepare_angle(self, angle_rate: Tensor, dt: Tensor, prior_angle: Tensor) -> Tensor:
        # Upstream accumulates angle rates multiplied by dt in fp32.
        delta = angle_rate.unsqueeze(1) * dt.unsqueeze(-1)
        return torch.remainder(prior_angle + delta, 2.0 * math.pi)

    def step(self, x: Tensor, state: Optional[dict[str, Tensor]] = None) -> tuple[Tensor, dict[str, Tensor]]:
        if x.ndim != 2 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,{self.d_model}] input")
        if state is None:
            state = self.initial_state(x.size(0), x.device, x.dtype)
        ssm = state["ssm"].to(device=x.device, dtype=torch.float32)
        bx_prev = state["bx_prev"].to(device=x.device, dtype=torch.float32)
        angle = state["angle"].to(device=x.device, dtype=torch.float32)

        z, value_raw, B_raw, C_raw, dd_dt, dd_A, trap_raw, angle_rate = self._split_projected(x)
        z = z.view(x.size(0), self.nheads, self.cfg.headdim).float()
        value = value_raw.view(x.size(0), self.nheads, self.cfg.headdim).float()
        B = self._prepare_bc(B_raw, self.B_bias, self.B_norm).float()
        C = self._prepare_bc(C_raw, self.C_bias, self.C_norm).float()

        A = -F.softplus(dd_A.float()).clamp_min(self.cfg.a_floor)
        dt = F.softplus(dd_dt.float() + self.dt_bias.to(x.device))
        adt = A * dt
        decay = torch.exp(adt).unsqueeze(-1).unsqueeze(-1)
        trap = torch.sigmoid(trap_raw.float()).unsqueeze(-1).unsqueeze(-1) if self.cfg.use_trapezoid else torch.zeros_like(dt).unsqueeze(-1).unsqueeze(-1)
        next_angle = self._prepare_angle(angle_rate.float(), dt, angle) if self.cfg.use_rotary else angle

        # Rotate state-input key/query directions using the cumulative Mamba-3 rotary state.
        if self.cfg.use_rotary:
            rot_angles = next_angle.unsqueeze(1).expand(-1, self.cfg.mimo_rank, -1, -1)
            B = _apply_pairwise_rope(B, rot_angles, self.rotary_dim)
            C = _apply_pairwise_rope(C, rot_angles, self.rotary_dim)

        # MIMO rank is transient: it creates a rank-R write and a rank-R read, while the persistent
        # state remains [H,P,S].
        x_r = torch.einsum("bhp,hrp->brhp", value, self.mimo_x.float())
        bx_curr = torch.einsum("brhp,brhd->bhpd", x_r, B)
        bx_blended = (1.0 - trap) * bx_curr + trap * 0.5 * (bx_curr + bx_prev)
        ssm_next = decay * ssm + dt.unsqueeze(-1).unsqueeze(-1) * bx_blended

        y_r = torch.einsum("brhd,bhpd->brhp", C, ssm_next)
        skip = self.D.float().view(1, 1, self.nheads, 1) * x_r
        z_r = torch.einsum("bhp,hrp->brhp", z, self.mimo_z.float())
        y_r = (y_r + skip) * F.silu(z_r)
        y = torch.einsum("brhp,hrp->bhp", y_r, self.mimo_o.float()).reshape(x.size(0), self.d_model)
        out = self.out_proj(y.to(x.dtype))
        next_state = {"ssm": ssm_next, "bx_prev": bx_curr, "angle": next_angle}
        return out, next_state

    def forward(self, x: Tensor, state: Optional[dict[str, Tensor]] = None) -> tuple[Tensor, dict[str, Tensor]]:
        if x.ndim != 3 or x.size(-1) != self.d_model:
            raise ValueError(f"expected [B,T,{self.d_model}] input")
        current = state
        outputs: list[Tensor] = []
        for t in range(x.size(1)):
            out, current = self.step(x[:, t], current)
            outputs.append(out)
        return torch.stack(outputs, dim=1), current
