from __future__ import annotations

"""Modernized brain-inspired neural substrate.

This module is deliberately a functional research component rather than a visual
analogy to biology. It combines compartmental neurons, E/I microcircuits, fast/slow
synapses, local eligibility traces, vectorized apical teaching signals, homeostasis,
neuromodulation, astrocyte-like local resource control, and bounded structural
plasticity. Manual plasticity is optional and kept separate from differentiable
forward execution so the same substrate can be used for gradient-trained experiments.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Optional, Tuple
import math

import torch
import torch.nn as nn
import torch.nn.functional as F


class _SurrogateSpike(torch.autograd.Function):
    """Hard spike in the forward pass with a smooth surrogate derivative.

    This keeps discrete spike semantics for execution while making the actual
    recurrent path trainable with gradient methods.
    """

    @staticmethod
    def forward(ctx, membrane_minus_threshold: torch.Tensor, slope: float):
        ctx.save_for_backward(membrane_minus_threshold)
        ctx.slope = float(slope)
        return (membrane_minus_threshold > 0).to(membrane_minus_threshold.dtype)

    @staticmethod
    def backward(ctx, grad_output: torch.Tensor):
        (x,) = ctx.saved_tensors
        s = ctx.slope
        z = torch.sigmoid(s * x)
        grad = grad_output * (s * z * (1.0 - z))
        return grad, None


def surrogate_spike(x: torch.Tensor, slope: float = 5.0) -> torch.Tensor:
    return _SurrogateSpike.apply(x, float(slope))


@dataclass
class NeuralSubstrateMetricsV1:
    mean_rate: float
    exc_rate: float
    inh_rate: float
    active_synapse_fraction: float
    mean_abs_fast_weight: float
    mean_abs_slow_weight: float
    mean_utility: float
    mean_apical_error: float
    energy_load: float
    structural_events: int

    def to_dict(self) -> Dict[str, float]:
        return asdict(self)


class DendriticBranchBankV1(nn.Module):
    """Parallel nonlinear dendritic branches with learned competition."""

    def __init__(self, input_dim: int, neurons: int, branches: int = 4, hidden_mult: float = 1.5):
        super().__init__()
        self.branches = nn.ModuleList()
        width = max(neurons, int(neurons * hidden_mult))
        for _ in range(max(1, int(branches))):
            self.branches.append(
                nn.Sequential(
                    nn.Linear(input_dim, width, bias=False),
                    nn.SiLU(),
                    nn.Linear(width, neurons, bias=False),
                )
            )
        self.gate = nn.Linear(input_dim, len(self.branches))
        self.norm = nn.LayerNorm(neurons)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.dim() == 2:
            x = x.unsqueeze(1)
            squeeze = True
        else:
            squeeze = False
        weights = torch.softmax(self.gate(x), dim=-1)
        vals = torch.stack([branch(x) for branch in self.branches], dim=-2)
        mixed = (vals * weights.unsqueeze(-1)).sum(-2)
        mixed = self.norm(torch.tanh(mixed))
        return mixed.squeeze(1) if squeeze else mixed


class ModernNeuralSubstrateV1(nn.Module):
    """Differentiable E/I compartmental network with optional local plasticity.

    Design principles:
      * E/I separation is explicit.
      * Basal and apical dendritic streams are distinct.
      * Fast synaptic state is transient; slow weights hold structure.
      * Eligibility is local in space/time.
      * Teaching signals are vectorized per neuron.
      * Homeostasis keeps activity sparse.
      * Structural plasticity is bounded and can be disabled for evaluation.
    """

    version = "modern-brain-substrate-v1"

    def __init__(
        self,
        input_dim: int,
        exc_neurons: int = 48,
        inh_neurons: int = 16,
        branches: int = 4,
        dt: float = 0.08,
        membrane_decay: float = 0.90,
        apical_decay: float = 0.82,
        trace_decay: float = 0.92,
        fast_decay: float = 0.78,
        target_rate: float = 0.05,
        structural_interval: int = 32,
        seed: int = 0,
    ):
        super().__init__()
        if input_dim <= 0 or exc_neurons <= 0 or inh_neurons <= 0:
            raise ValueError("dimensions must be positive")
        self.input_dim = int(input_dim)
        self.exc_neurons = int(exc_neurons)
        self.inh_neurons = int(inh_neurons)
        self.neurons = self.exc_neurons + self.inh_neurons
        self.dt = float(dt)
        self.membrane_decay = float(membrane_decay)
        self.apical_decay = float(apical_decay)
        self.trace_decay = float(trace_decay)
        self.fast_decay = float(fast_decay)
        self.target_rate = float(target_rate)
        self.structural_interval = max(1, int(structural_interval))
        self._step_index = 0
        self._structural_events = 0

        # Keep initialization deterministic without affecting caller RNG state.
        g = torch.Generator(device="cpu")
        g.manual_seed(int(seed))
        scale = 1.0 / math.sqrt(self.neurons)

        self.dendrites = DendriticBranchBankV1(self.input_dim, self.neurons, branches=branches)
        self.input_to_apical = nn.Linear(self.input_dim, self.neurons, bias=False)
        self.apical_to_soma = nn.Linear(self.neurons, self.neurons, bias=False)

        # One canonical slow recurrent magnitude matrix.  E/I sign is supplied by
        # the source-population masks in _effective_recurrent(); keeping magnitudes
        # non-negative prevents inhibitory columns from being accidentally erased.
        recurrent = torch.rand(self.neurons, self.neurons, generator=g) * scale
        self.recurrent = nn.Parameter(recurrent)

        src_exc = torch.zeros(self.neurons, self.neurons)
        src_exc[:, : self.exc_neurons] = 1.0
        src_inh = torch.zeros(self.neurons, self.neurons)
        src_inh[:, self.exc_neurons :] = 1.0
        self.register_buffer("exc_source_mask", src_exc)
        self.register_buffer("inh_source_mask", src_inh)

        # Sparse anatomical mask. Structural plasticity mutates this buffer only.
        self.register_buffer("synapse_mask", torch.ones(self.neurons, self.neurons))
        self.register_buffer("fast_weight", torch.zeros(self.neurons, self.neurons))
        self.register_buffer("eligibility", torch.zeros(self.neurons, self.neurons))
        self.register_buffer("pre_trace", torch.zeros(self.neurons))
        self.register_buffer("post_trace", torch.zeros(self.neurons))
        self.register_buffer("synapse_utility", torch.zeros(self.neurons, self.neurons))
        self.register_buffer("rate_ema", torch.full((self.neurons,), self.target_rate))
        self.register_buffer("membrane", torch.zeros(self.neurons))
        self.register_buffer("adaptation", torch.zeros(self.neurons))
        self.register_buffer("apical_state", torch.zeros(self.neurons))
        self.register_buffer("glia_state", torch.zeros(self.neurons))
        self.register_buffer("last_spikes", torch.zeros(self.neurons))

        self.base_threshold = nn.Parameter(torch.full((self.neurons,), 0.85))
        self.homeostasis_gain = nn.Parameter(torch.full((self.neurons,), 0.12))
        self.plasticity_lr = nn.Parameter(torch.tensor(0.015))
        self.apical_lr = nn.Parameter(torch.tensor(0.004))
        self.fast_lr = nn.Parameter(torch.tensor(0.08))
        self.structural_prune = nn.Parameter(torch.tensor(0.08), requires_grad=False)
        self.energy_budget = nn.Parameter(torch.tensor(0.25), requires_grad=False)

        self.register_buffer("cell_type", torch.cat([
            torch.ones(self.exc_neurons),
            -torch.ones(self.inh_neurons),
        ]))
        self.register_buffer("cell_class_index", torch.arange(self.neurons))

    def reset_state(self) -> None:
        for name in ("fast_weight", "eligibility", "pre_trace", "post_trace", "rate_ema",
                     "membrane", "adaptation", "apical_state", "glia_state", "last_spikes"):
            buf = getattr(self, name)
            if name == "rate_ema":
                buf.fill_(self.target_rate)
            else:
                buf.zero_()
        self._step_index = 0
        self._structural_events = 0

    def _effective_recurrent(self) -> torch.Tensor:
        magnitude = self.recurrent.clamp_min(0.0)
        signed = magnitude * self.exc_source_mask - magnitude * self.inh_source_mask
        # Fast plasticity is stored as a non-negative magnitude as well, so it
        # cannot silently flip an E/I source into the opposite sign.
        signed_fast = self.fast_weight * self.exc_source_mask - self.fast_weight * self.inh_source_mask
        return (signed * self.synapse_mask) + (signed_fast * self.synapse_mask)

    def _threshold(self) -> torch.Tensor:
        homeo = self.homeostasis_gain * (self.rate_ema - self.target_rate)
        energy = 0.15 * F.softplus(self.glia_state - 0.5)
        return self.base_threshold + homeo + energy

    def _glial_control(self, spikes: torch.Tensor) -> torch.Tensor:
        activity = spikes.detach()
        self.glia_state.mul_(0.97).add_(0.03 * activity)
        demand = (self.glia_state - self.energy_budget).clamp_min(0.0)
        return (1.0 - 0.35 * demand).clamp(0.4, 1.0)

    def step(
        self,
        x: torch.Tensor,
        *,
        teaching: Optional[torch.Tensor] = None,
        reward: float | torch.Tensor = 0.0,
        local_plasticity: bool = False,
        structural_plasticity: bool = False,
    ) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
        if x.dim() != 1 or x.shape[0] != self.input_dim:
            raise ValueError(f"expected input shape ({self.input_dim},)")
        basal = self.dendrites(x.unsqueeze(0)).squeeze(0)
        apical_drive = self.input_to_apical(x)
        self.apical_state.mul_(self.apical_decay).add_((1.0 - self.apical_decay) * apical_drive.detach())
        if teaching is None:
            teaching_vec = torch.zeros_like(self.apical_state)
        else:
            teaching_vec = teaching.to(self.apical_state).reshape(-1)
            if teaching_vec.numel() != self.neurons:
                raise ValueError("teaching vector must match neuron count")
        apical_error = teaching_vec - self.apical_state

        rec = torch.mv(self._effective_recurrent(), self.last_spikes)
        dendritic_feedback = self.apical_to_soma(self.apical_state)
        drive = basal + 0.45 * dendritic_feedback + rec
        drive = drive * self._glial_control(self.last_spikes)

        self.adaptation.mul_(0.92).add_(0.08 * self.last_spikes)
        self.membrane = self.membrane * self.membrane_decay + self.dt * (drive - 0.32 * self.adaptation)
        threshold = self._threshold()
        spikes = surrogate_spike(self.membrane - threshold, slope=5.0)
        self.membrane = torch.where(spikes > 0, self.membrane - 0.7 * threshold, self.membrane)

        self.rate_ema.mul_(0.985).add_(0.015 * spikes.detach())
        self.pre_trace.mul_(self.trace_decay).add_((1.0 - self.trace_decay) * self.last_spikes.detach())
        self.post_trace.mul_(self.trace_decay).add_((1.0 - self.trace_decay) * spikes.detach())
        outer = torch.outer(spikes.detach(), self.pre_trace)
        soft = torch.outer(torch.sigmoid(self.membrane.detach()), self.pre_trace)
        self.eligibility.mul_(self.trace_decay).add_(0.65 * outer + 0.35 * soft)
        self.synapse_utility.mul_(0.995).add_(0.005 * torch.abs(self.eligibility.detach()))
        self.last_spikes.copy_(spikes.detach())
        self._step_index += 1

        if local_plasticity:
            self.apply_local_plasticity(reward, apical_error, spikes)
        if structural_plasticity and self._step_index % self.structural_interval == 0:
            self.apply_structural_plasticity()

        stats = {
            "spikes": spikes,
            "apical_error": apical_error.detach(),
            "membrane": self.membrane.detach().clone(),
            "threshold": threshold.detach().clone(),
            "rate_ema": self.rate_ema.detach().clone(),
            "glia_state": self.glia_state.detach().clone(),
            "eligibility_norm": self.eligibility.detach().norm(),
        }
        return spikes, stats

    @torch.no_grad()
    def apply_local_plasticity(
        self,
        reward: float | torch.Tensor,
        apical_error: torch.Tensor,
        spikes: torch.Tensor,
    ) -> None:
        r = torch.as_tensor(reward, device=self.recurrent.device, dtype=self.recurrent.dtype)
        vector_mod = torch.tanh(apical_error) * (0.5 + 0.5 * torch.sigmoid(self.post_trace))
        credit = vector_mod[:, None] + 0.25 * r
        delta = self.plasticity_lr.clamp(0.0, 0.2) * credit * self.eligibility
        delta = delta.tanh() * self.synapse_mask
        # Inhibitory source synapses are sign-constrained after update.
        self.recurrent.add_(delta.clamp(-0.05, 0.05))
        # E/I sign is represented by the source masks, so the trainable recurrent
        # parameter remains a non-negative magnitude matrix for both populations.
        self.recurrent.clamp_(min=0.0)

        fast_delta = self.fast_lr.clamp(0.0, 0.5) * credit * self.eligibility
        self.fast_weight.mul_(self.fast_decay).add_(fast_delta.clamp(-0.25, 0.25) * self.synapse_mask)
        self.fast_weight.clamp_(min=0.0, max=1.0)

        # Local dendritic LMS-like adaptation. This is deliberately bounded.
        apical_update = self.apical_lr.clamp(0.0, 0.05) * torch.outer(apical_error, self.last_spikes)
        self.apical_to_soma.weight.add_(apical_update.clamp(-0.02, 0.02))

    @torch.no_grad()
    def apply_structural_plasticity(self, *, prune_quantile: Optional[float] = None) -> int:
        prune_q = float(self.structural_prune.item() if prune_quantile is None else prune_quantile)
        utility = self.synapse_utility.detach()
        active = self.synapse_mask > 0
        vals = utility[active]
        if vals.numel() == 0:
            return 0
        threshold = torch.quantile(vals, max(0.0, min(1.0, prune_q)))
        weak = active & (utility <= threshold)
        # Never prune a whole source row/target pathway.
        self.synapse_mask[weak] = 0.0
        self.fast_weight[weak] = 0.0
        self.recurrent[weak] *= 0.25

        # Recompute inactive connections after pruning; newly pruned edges are
        # legitimate growth candidates in this same structural transaction.
        active = self.synapse_mask > 0
        # Preserve at least one excitatory and one inhibitory source per target.
        for row in range(self.neurons):
            e_slice = self.synapse_mask[row, :self.exc_neurons] > 0
            i_slice = self.synapse_mask[row, self.exc_neurons:] > 0
            if not bool(e_slice.any()):
                idx = torch.argmax(self.synapse_utility[row, :self.exc_neurons])
                self.synapse_mask[row, idx] = 1.0
            if not bool(i_slice.any()):
                idx = torch.argmax(self.synapse_utility[row, self.exc_neurons:]) + self.exc_neurons
                self.synapse_mask[row, idx] = 1.0
        active = self.synapse_mask > 0
        inactive = ~active
        # Grow a bounded number of dormant connections from the strongest current
        # pre/post co-activity estimates encoded by eligibility magnitude.
        if inactive.any():
            grow_scores = torch.abs(self.eligibility) * inactive
            k = min(max(1, self.neurons // 4), int(inactive.sum().item()))
            flat = torch.topk(grow_scores.reshape(-1), k=k).indices
            rows = flat // self.neurons
            cols = flat % self.neurons
            self.synapse_mask[rows, cols] = 1.0
            self.recurrent[rows, cols] = 0.01 * torch.rand_like(self.recurrent[rows, cols])
            self._structural_events += int(k)
        return int(weak.sum().item())

    def forward(
        self,
        sequence: torch.Tensor,
        *,
        teaching: Optional[torch.Tensor] = None,
        reward: Optional[torch.Tensor] = None,
        local_plasticity: bool = False,
        structural_plasticity: bool = False,
        reset_state: bool = True,
    ) -> Dict[str, torch.Tensor]:
        if sequence.dim() != 2 or sequence.shape[-1] != self.input_dim:
            raise ValueError(f"expected [time,{self.input_dim}] sequence")

        # Manual local plasticity/structural changes intentionally use the streaming
        # stateful path. Pure forward execution is functional so autograd can safely
        # span time without in-place mutations of recurrent state.
        if local_plasticity or structural_plasticity:
            if reset_state:
                self.reset_state()
            spikes = []
            errors = []
            for t in range(sequence.shape[0]):
                teach_t = None if teaching is None else teaching[t]
                rew_t = 0.0 if reward is None else reward[t]
                s, info = self.step(
                    sequence[t], teaching=teach_t, reward=rew_t,
                    local_plasticity=local_plasticity,
                    structural_plasticity=structural_plasticity,
                )
                spikes.append(s)
                errors.append(info["apical_error"])
            ss = torch.stack(spikes, 0)
            ee = torch.stack(errors, 0)
            return {"spikes": ss, "pooled": ss.mean(0) + 0.5 * self.membrane,
                    "last_state": self.membrane.clone(), "apical_error": ee,
                    "mean_rate": ss.mean()}

        device = sequence.device
        dtype = sequence.dtype
        v = torch.zeros(self.neurons, device=device, dtype=dtype)
        adaptation = torch.zeros_like(v)
        apical = torch.zeros_like(v)
        pre_trace = torch.zeros_like(v)
        last = torch.zeros_like(v)
        rate = torch.full_like(v, self.target_rate)
        glia = torch.zeros_like(v)
        spikes = []
        apical_errors = []
        rec_matrix = self._effective_recurrent().to(device=device, dtype=dtype)
        threshold_base = self.base_threshold.to(device=device, dtype=dtype)
        homeo_gain = self.homeostasis_gain.to(device=device, dtype=dtype)

        for t in range(sequence.shape[0]):
            x = sequence[t]
            basal = self.dendrites(x.unsqueeze(0)).squeeze(0)
            apical_drive = self.input_to_apical(x)
            apical = self.apical_decay * apical + (1.0 - self.apical_decay) * apical_drive
            if teaching is None:
                teach_t = torch.zeros_like(apical)
            else:
                teach_t = teaching[t].to(apical)
            apical_error = teach_t - apical
            rec = torch.mv(rec_matrix, last)
            feedback = self.apical_to_soma(apical)
            demand = F.softplus(glia - self.energy_budget.to(device=device, dtype=dtype))
            glial_gain = (1.0 - 0.35 * demand).clamp(0.4, 1.0)
            drive = (basal + 0.45 * feedback + rec) * glial_gain
            adaptation = 0.92 * adaptation + 0.08 * last
            v = self.membrane_decay * v + self.dt * (drive - 0.32 * adaptation)
            threshold = threshold_base + homeo_gain * (rate - self.target_rate) + 0.15 * demand
            s = surrogate_spike(v - threshold, slope=5.0)
            v = torch.where(s > 0, v - 0.7 * threshold, v)
            rate = 0.985 * rate + 0.015 * s
            pre_trace = self.trace_decay * pre_trace + (1.0 - self.trace_decay) * last
            last = s
            glia = 0.97 * glia + 0.03 * s
            spikes.append(s)
            apical_errors.append(apical_error)

        spike_stack = torch.stack(spikes, 0)
        apical_stack = torch.stack(apical_errors, 0)
        pooled = spike_stack.mean(0) + 0.5 * v
        if reset_state:
            with torch.no_grad():
                self.membrane.copy_(v.detach())
                self.apical_state.copy_(apical.detach())
                self.last_spikes.copy_(last.detach())
                self.rate_ema.copy_(rate.detach())
                self.glia_state.copy_(glia.detach())
        return {
            "spikes": spike_stack,
            "pooled": pooled,
            "last_state": v,
            "apical_error": apical_stack,
            "mean_rate": spike_stack.mean(),
        }

    def forward_batch(self, sequences: torch.Tensor, *, mask: Optional[torch.Tensor] = None) -> Dict[str, torch.Tensor]:
        """Functional batched forward for ordered sequences.

        ``sequences`` is ``[batch, time, input_dim]``.  Unlike ``forward`` this
        method never mutates persistent runtime state, so it is safe for gradient
        training and matched-budget ablations. ``mask`` marks valid timesteps; masked
        positions neither update recurrent state nor contribute to pooled features.
        """
        if sequences.dim() != 3 or sequences.shape[-1] != self.input_dim:
            raise ValueError(f"expected [batch,time,{self.input_dim}] sequence batch")
        B, T, _ = sequences.shape
        device = sequences.device
        dtype = sequences.dtype
        if mask is None:
            mask_b = torch.ones(B, T, dtype=torch.bool, device=device)
        else:
            if mask.shape != (B, T):
                raise ValueError("mask must match [batch,time]")
            mask_b = mask.to(device=device, dtype=torch.bool)

        basal = self.dendrites(sequences)
        v = torch.zeros(B, self.neurons, device=device, dtype=dtype)
        adaptation = torch.zeros_like(v)
        apical = torch.zeros_like(v)
        last = torch.zeros_like(v)
        rate = torch.full_like(v, self.target_rate)
        glia = torch.zeros_like(v)
        spikes = []
        apical_errors = []
        rec_matrix = self._effective_recurrent().to(device=device, dtype=dtype)
        threshold_base = self.base_threshold.to(device=device, dtype=dtype)
        homeo_gain = self.homeostasis_gain.to(device=device, dtype=dtype)

        for t in range(T):
            valid = mask_b[:, t].unsqueeze(-1)
            x = sequences[:, t]
            basal_t = basal[:, t]
            apical_drive = self.input_to_apical(x)
            apical_next = self.apical_decay * apical + (1.0 - self.apical_decay) * apical_drive
            apical = torch.where(valid, apical_next, apical)
            apical_error = -apical
            rec = torch.matmul(last, rec_matrix.transpose(0, 1))
            feedback = self.apical_to_soma(apical)
            demand = F.softplus(glia - self.energy_budget.to(device=device, dtype=dtype))
            glial_gain = (1.0 - 0.35 * demand).clamp(0.4, 1.0)
            drive = (basal_t + 0.45 * feedback + rec) * glial_gain
            adaptation_next = 0.92 * adaptation + 0.08 * last
            v_next = self.membrane_decay * v + self.dt * (drive - 0.32 * adaptation_next)
            threshold = threshold_base + homeo_gain * (rate - self.target_rate) + 0.15 * demand
            s = surrogate_spike(v_next - threshold, slope=5.0)
            v_next = torch.where(s > 0, v_next - 0.7 * threshold, v_next)
            rate_next = 0.985 * rate + 0.015 * s
            glia_next = 0.97 * glia + 0.03 * s
            s = torch.where(valid, s, torch.zeros_like(s))
            v = torch.where(valid, v_next, v)
            adaptation = torch.where(valid, adaptation_next, adaptation)
            rate = torch.where(valid, rate_next, rate)
            glia = torch.where(valid, glia_next, glia)
            last = torch.where(valid, s, last)
            spikes.append(s)
            apical_errors.append(torch.where(valid, apical_error, torch.zeros_like(apical_error)))

        spike_stack = torch.stack(spikes, dim=1)
        apical_stack = torch.stack(apical_errors, dim=1)
        denom = mask_b.to(dtype).sum(dim=1, keepdim=True).clamp_min(1.0)
        pooled = (spike_stack * mask_b.unsqueeze(-1).to(dtype)).sum(dim=1) / denom
        pooled = pooled + 0.5 * v
        return {
            "spikes": spike_stack,
            "pooled": pooled,
            "last_state": v,
            "apical_error": apical_stack,
            "mean_rate": spike_stack.mean(dim=(1, 2)),
        }

    @torch.no_grad()
    def consolidate(self, strength: float = 0.20) -> None:
        """Transfer a bounded portion of fast synaptic state into slow weights."""
        alpha = float(max(0.0, min(1.0, strength)))
        transfer = alpha * self.fast_weight * self.synapse_mask
        self.recurrent.add_(transfer.clamp(0.0, 0.08)).clamp_(min=0.0)
        self.fast_weight.mul_(1.0 - alpha)


    @torch.no_grad()
    def state_digest(self) -> str:
        """Deterministic digest of learned parameters *and* mutable runtime state."""
        import hashlib
        h = hashlib.sha256()
        for name, tensor in sorted(self.state_dict().items()):
            h.update(name.encode("utf-8"))
            h.update(tensor.detach().cpu().contiguous().numpy().tobytes())
        return h.hexdigest()

    def metrics(self) -> NeuralSubstrateMetricsV1:
        active = self.synapse_mask.mean().item()
        exc_rate = self.rate_ema[: self.exc_neurons].mean().item()
        inh_rate = self.rate_ema[self.exc_neurons :].mean().item()
        return NeuralSubstrateMetricsV1(
            mean_rate=float(self.rate_ema.mean().item()),
            exc_rate=float(exc_rate),
            inh_rate=float(inh_rate),
            active_synapse_fraction=float(active),
            mean_abs_fast_weight=float(self.fast_weight.abs().mean().item()),
            mean_abs_slow_weight=float(self.recurrent.abs().mean().item()),
            mean_utility=float(self.synapse_utility.mean().item()),
            mean_apical_error=float(self.apical_state.abs().mean().item()),
            energy_load=float(self.glia_state.mean().item()),
            structural_events=int(self._structural_events),
        )

    def substrate_signature(self) -> str:
        return (
            f"{self.version}|in={self.input_dim}|E={self.exc_neurons}|I={self.inh_neurons}|"
            f"active={self.synapse_mask.mean().item():.4f}"
        )
