from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
import json
import importlib.util

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from .core import NeuroCoreCurrent
from .delta_integrator import step_scale
from .erase_control import apply_erase
from .temporal_dynamics import effective_decay


@dataclass(frozen=True)
class MobileExportSpec:
    """Fixed-shape ABI for the mobile inference step.

    The exported function is deliberately stateless from the framework's perspective: all
    recurrent quantities needed to reproduce the current mobile trunk are packed into one tensor.
    This makes Android restart/checkpoint semantics explicit and avoids relying on private mutable
    Python attributes inside the exported program.
    """

    raw_observation_dim: int = 9
    goal_dim: int = 8
    latent_dim: int = 20
    hidden_dim: int = 64
    recurrent_state_dim: int = 64
    multiscale_state_dim: int = 64
    key_energy_dim: int = 8
    state_vector_dim: int = 285  # 64 recurrent + 20 prev + 3*64 multiscale + 8 energy + 1 surprise
    batch_size: int = 1
    decode_shape: tuple[int, int, int] = (1, 1, 9)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class MobileExportStateCodec:
    """Pack/unpack the explicit state ABI used by the Android export adapter."""

    RANK = 8
    LATENT = 20
    HIDDEN = 64

    @classmethod
    def pack(
        cls,
        recurrent_state: Tensor,
        prev_latent: Tensor,
        fast_state: Tensor,
        medium_state: Tensor,
        slow_state: Tensor,
        key_energy: Tensor,
        surprise: Tensor,
    ) -> Tensor:
        if recurrent_state.shape != (1, cls.HIDDEN) or prev_latent.shape != (1, cls.LATENT):
            raise ValueError("mobile export state requires B=1 with current dimensions")
        for name, value in (("fast_state", fast_state), ("medium_state", medium_state), ("slow_state", slow_state)):
            if value.shape != (1, cls.HIDDEN):
                raise ValueError(f"{name} must be [1,64]")
        if key_energy.shape != (cls.RANK,):
            raise ValueError("key_energy must be [8]")
        if surprise.numel() != 1:
            raise ValueError("surprise must contain one scalar")
        return torch.cat(
            [
                recurrent_state,
                prev_latent,
                fast_state,
                medium_state,
                slow_state,
                key_energy.view(1, cls.RANK),
                surprise.view(1, 1),
            ],
            dim=-1,
        )

    @classmethod
    def unpack(cls, packed: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor, Tensor, Tensor, Tensor]:
        if packed.ndim != 2 or packed.shape[0] != 1 or packed.shape[1] != 285:
            raise ValueError("packed mobile export state must be [1,285]")
        i = 0
        recurrent = packed[:, i : i + cls.HIDDEN]; i += cls.HIDDEN
        prev = packed[:, i : i + cls.LATENT]; i += cls.LATENT
        fast = packed[:, i : i + cls.HIDDEN]; i += cls.HIDDEN
        medium = packed[:, i : i + cls.HIDDEN]; i += cls.HIDDEN
        slow = packed[:, i : i + cls.HIDDEN]; i += cls.HIDDEN
        key_energy = packed[:, i : i + cls.RANK].view(cls.RANK); i += cls.RANK
        surprise = packed[:, i : i + 1].view(())
        return recurrent, prev, fast, medium, slow, key_energy, surprise

    @classmethod
    def initial(cls, *, device: torch.device, dtype: torch.dtype) -> Tensor:
        state = torch.zeros(1, 285, device=device, dtype=dtype)
        state[:, 276:284] = 0.125
        return state


class MobileExportStep(nn.Module):
    """Backend adapter that mirrors the canonical mobile trunk without private mutation.

    This module is not a second model owner. It references the canonical trunk's parameters and
    re-expresses only the mobile-safe subset of its recurrence as a pure function. Numerical parity
    against ``CausalTrunk.forward_step`` is a release gate.
    """

    def __init__(self, model: NeuroCoreCurrent) -> None:
        super().__init__()
        # Register the canonical trunk exactly once. Keeping a second module alias (e.g. `model`
        # plus `trunk`) is harmless in eager PyTorch but can create ambiguous shared-module entries
        # in serialized torch.export archives.
        self.trunk = model.trunk
        self.spec = MobileExportSpec(
            raw_observation_dim=self.trunk.cfg.raw_observation_dim,
            goal_dim=self.trunk.cfg.goal_dim,
            latent_dim=self.trunk.cfg.latent_dim,
            hidden_dim=self.trunk.cfg.hidden_dim,
            recurrent_state_dim=self.trunk.spine.rank * self.trunk.spine.rank,
            multiscale_state_dim=self.trunk.cfg.hidden_dim,
            key_energy_dim=self.trunk.spine.rank,
        )
        self._validate_safe_profile()

    def _validate_safe_profile(self) -> None:
        cfg = self.trunk.cfg
        spine = self.trunk.spine
        forbidden = {
            "frontier_stack": bool(self.trunk.frontier_stack is not None),
            "sparse_memory": bool(spine.sparse_memory_enabled),
            "online_plasticity": bool(spine.online_plasticity.enabled),
            "adaptive_compute": bool(spine.adaptive_compute_config.enabled),
            "adaptive_linearity": bool(spine.adaptive_linearity is not None),
            "uncertainty_write": bool(spine.uncertainty_write.enabled),
            "multi_timescale_route": bool(spine.multiscale_dynamics.enabled),
            "token_decay": bool(spine.token_decay_projection is not None),
            "synergy_feedback": float(cfg.synergy_feedback_strength) != 0.0 or bool(cfg.synergy_disagreement_gate),
            "homeostatic": bool(spine.homeostatic_enabled),
        }
        active = [name for name, enabled in forbidden.items() if enabled]
        if active:
            raise ValueError("mobile export baseline requires disabled unsupported features: " + ", ".join(active))
        if spine.erase_control.mode != "key":
            raise ValueError("mobile export baseline requires key erase mode")
        if spine.delta_integrator.mode != "euler":
            raise ValueError("mobile export baseline requires euler delta integrator")

    def _multiscale_functional(self, h: Tensor, fast: Tensor, medium: Tensor, slow: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor]:
        df = float(self.trunk.cfg.multiscale_fast_decay)
        dm = float(self.trunk.cfg.multiscale_medium_decay)
        ds = float(self.trunk.cfg.multiscale_slow_decay)
        next_fast = df * fast + (1.0 - df) * h
        next_medium = dm * medium + (1.0 - dm) * h
        next_slow = ds * slow + (1.0 - ds) * h
        zf = F.normalize(self.trunk.fast_projection(next_fast), dim=-1, eps=1e-6)
        zm = F.normalize(self.trunk.medium_projection(next_medium), dim=-1, eps=1e-6)
        zs = F.normalize(self.trunk.slow_projection(next_slow), dim=-1, eps=1e-6)
        fused = self.trunk.multiscale_fuse(torch.cat([zf, zm, zs], dim=-1))
        return fused, next_fast, next_medium, next_slow

    def forward(self, observation: Tensor, goal: Tensor, packed_state: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor, Tensor, Tensor, Tensor, Tensor]:
        if observation.shape != (1, self.spec.raw_observation_dim):
            raise ValueError("observation must be [1,9]")
        if goal.shape != (1, self.spec.goal_dim):
            raise ValueError("goal must be [1,8]")
        recurrent, prev_latent, fast, medium, slow, key_energy, surprise_ema = MobileExportStateCodec.unpack(packed_state)

        features = self.trunk.encoder(torch.cat([observation, goal, prev_latent], dim=-1))
        spine = self.trunk.spine
        h = spine.input_proj(spine.input_norm(features))
        S = recurrent.view(1, spine.rank, spine.rank)

        q = F.normalize(spine.q_proj(h), dim=-1, eps=1e-6)
        k = F.normalize(spine.k_proj(h), dim=-1, eps=1e-6)
        v = torch.tanh(spine.v_proj(h))
        read_before = torch.bmm(q.unsqueeze(1), S).squeeze(1) * spine.read_scale
        delta = (v - read_before).clamp(-spine.update_clip, spine.update_clip)
        erase = torch.sigmoid(spine.erase_proj(h)).clamp(0.01, 0.99)
        write = torch.sigmoid(spine.write_proj(h)).clamp(0.01, 0.99)
        base_decay = effective_decay(
            spine.decay_logit,
            cfg=spine.multiscale_dynamics,
            prior_logit=spine.multiscale_decay_prior_logit,
        )
        decay = base_decay.expand(1, -1)
        volatility = (delta.detach().abs().mean(dim=-1) / max(float(spine.update_clip), 1e-6)).clamp(0.0, 1.0)
        logits = spine.router_proj(h) / spine.router_temperature
        probs = torch.softmax(logits, dim=-1)
        top_idx = torch.topk(logits, k=spine.topk, dim=-1).indices
        hard = torch.zeros_like(probs).scatter_(1, top_idx, 1.0)
        route = hard + probs - probs.detach()
        with torch.no_grad():
            next_key_energy = key_energy * spine.preconditioner_decay + k.detach().pow(2).mean(dim=0) * (1.0 - spine.preconditioner_decay)
        learned_gain = torch.exp(spine.preconditioner_log_gain).clamp(0.25, 4.0)
        reference_energy = h.new_tensor(1.0 / float(spine.rank))
        energy_ratio = reference_energy / next_key_energy.clamp_min(1e-5)
        precond = (learned_gain * torch.sqrt(energy_ratio.clamp_min(1e-6))).clamp(spine.preconditioner_floor, spine.preconditioner_ceiling)
        delta_pc = delta * precond
        key_norm_sq = k.pow(2).sum(dim=-1, keepdim=True)
        beta = write.mean(dim=-1, keepdim=True)
        surprise = (volatility - surprise_ema).abs().clamp(0.0, 1.0)
        next_surprise = float(getattr(spine, "_surprise_write_ema_decay", 0.97)) * surprise_ema + (1.0 - float(getattr(spine, "_surprise_write_ema_decay", 0.97))) * volatility.detach().mean()
        integrator_scale = step_scale(beta, key_norm_sq, spine.delta_integrator)
        delta_pc = delta_pc * (integrator_scale / beta.clamp_min(float(spine.delta_integrator.beta_floor)))
        decayed = S * decay.unsqueeze(-1)
        erased_candidate, _, _ = apply_erase(decayed, q, k, erase, spine.erase_control)
        write_term = k.unsqueeze(-1) * (write * delta_pc).unsqueeze(-2)
        new_S = S + route.unsqueeze(-1) * (erased_candidate + write_term - S)

        read_after = torch.bmm(q.unsqueeze(1), new_S).squeeze(1) * spine.read_scale
        state_hidden_input = torch.cat([read_after, h], dim=-1)
        state_hidden_pre = spine.state_to_hidden[0](state_hidden_input)
        state_hidden_activation = spine.state_to_hidden[1](state_hidden_pre)
        state_hidden_mid = spine.state_to_hidden[2](state_hidden_activation)
        hidden = spine.state_to_hidden[3](state_hidden_mid)
        mixed = spine.input_gate * h + (1.0 - spine.input_gate) * hidden
        output = torch.tanh(mixed)
        next_recurrent = new_S.reshape(1, spine.rank * spine.rank)
        fused_hidden, next_fast, next_medium, next_slow = self._multiscale_functional(output, fast, medium, slow)
        spine_latent = F.normalize(spine.next_latent_head(output), dim=-1, eps=1e-6)
        predictive = F.normalize(self.trunk.predictor(torch.cat([output, prev_latent], dim=-1)), dim=-1, eps=1e-6)
        world = F.normalize(self.trunk.world_model(torch.cat([output, goal, prev_latent], dim=-1)), dim=-1, eps=1e-6)
        self_prediction = F.normalize(self.trunk.self_model(torch.cat([output, prev_latent], dim=-1)), dim=-1, eps=1e-6)
        memory = F.normalize(self.trunk.memory_decoder(spine.memory_context_head(output)), dim=-1, eps=1e-6)
        # Canonical mobile config has synergy/frontier/plasticity disabled, so trunk latent is spine latent.
        latent = spine_latent
        # Keep multiscale update as an auxiliary recurrent state, matching current trunk semantics.
        del fused_hidden
        next_packed = MobileExportStateCodec.pack(
            next_recurrent,
            latent,
            next_fast,
            next_medium,
            next_slow,
            next_key_energy,
            next_surprise,
        )
        return latent, next_packed, predictive, world, self_prediction, memory, output, spine.confidence_head(output)


class MobileExportSequence(nn.Module):
    """Fixed-length prefill adapter that repeatedly invokes the same explicit step ABI."""

    def __init__(self, step: MobileExportStep, sequence_length: int) -> None:
        super().__init__()
        if sequence_length <= 0:
            raise ValueError("sequence_length must be positive")
        self.step = step
        self.sequence_length = int(sequence_length)

    def forward(self, observations: Tensor, goals: Tensor, packed_state: Tensor) -> tuple[Tensor, Tensor]:
        if observations.shape[0] != 1 or observations.shape[1] != self.sequence_length:
            raise ValueError("observations shape must be [1,sequence_length,9]")
        state = packed_state
        prevs: list[Tensor] = []
        for i in range(self.sequence_length):
            latent, state, *_ = self.step(observations[:, i], goals[:, i], state)
            prevs.append(latent)
        return torch.stack(prevs, dim=1), state


def build_mobile_export_adapter(model: NeuroCoreCurrent) -> MobileExportStep:
    model.eval()
    return MobileExportStep(model)


def export_mobile_programs(model: NeuroCoreCurrent, output_dir: str | Path, *, prefill_length: int = 32) -> dict[str, Any]:
    """Export a current mobile-safe model via ``torch.export``.

    If ExecuTorch is installed, a companion helper can lower these ExportedPrograms to a `.pte`
    using the selected backend. This function itself never invents a `.pte` when the backend tools
    are unavailable.
    """
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    model = model.eval()
    step = build_mobile_export_adapter(model)
    device = next(model.parameters()).device
    dtype = next(model.parameters()).dtype
    state = MobileExportStateCodec.initial(device=device, dtype=dtype)
    obs = torch.zeros(1, 9, device=device, dtype=dtype)
    goal = torch.zeros(1, 8, device=device, dtype=dtype)
    step_ep = torch.export.export(step, (obs, goal, state))
    step_path = out / "neurocore_mobile_step.pt2"
    torch.export.save(step_ep, str(step_path))
    seq = MobileExportSequence(step, prefill_length)
    seq_obs = torch.zeros(1, prefill_length, 9, device=device, dtype=dtype)
    seq_goal = torch.zeros(1, prefill_length, 8, device=device, dtype=dtype)
    seq_ep = torch.export.export(seq, (seq_obs, seq_goal, state))
    seq_path = out / f"neurocore_mobile_prefill{prefill_length}.pt2"
    torch.export.save(seq_ep, str(seq_path))
    manifest = {
        "format": "torch_exported_program",
        "torch_version": torch.__version__,
        "step_program": str(step_path.name),
        "prefill_program": str(seq_path.name),
        "prefill_length": int(prefill_length),
        "state_vector_dim": 285,
        "batch_size": 1,
        "executorch_installed": bool(importlib.util.find_spec("executorch")),
        "next_lowering_backend": "executorch_xnnpack",
        "backend_fallback": None,
    }
    (out / "MOBILE_EXPORT_MANIFEST_CURRENT.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return manifest
