from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Optional

import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class GradientSubspaceConfig:
    """Configuration for a compact GPM-inspired gradient subspace guard.

    The guard stores a low-rank basis of recent task representations and projects future
    parameter gradients away from that protected input subspace. It is an opt-in research
    mechanism; no trainable parameters are added.
    """

    enabled: bool = False
    basis_rank: int = 8
    energy_threshold: float = 0.90
    projection_strength: float = 1.0
    update_interval: int = 8
    max_samples: int = 256
    min_samples: int = 16

    def __post_init__(self) -> None:
        if self.basis_rank < 1:
            raise ValueError("basis_rank must be >= 1")
        if not 0.0 < self.energy_threshold <= 1.0:
            raise ValueError("energy_threshold must be in (0,1]")
        if not 0.0 <= self.projection_strength <= 1.0:
            raise ValueError("projection_strength must be in [0,1]")
        if self.update_interval < 1:
            raise ValueError("update_interval must be >= 1")
        if self.max_samples < self.min_samples or self.min_samples < 1:
            raise ValueError("max_samples must be >= min_samples >= 1")


class GradientSubspaceGuard:
    """Low-rank gradient protection for selected Linear layers.

    Each protected layer gets a basis U over its input dimension. A future weight gradient G is
    transformed as G' = G - alpha * G U U^T. This is a real gradient projection mechanism, not a
    score or diagnostic. A bounded activation reservoir is periodically summarized by SVD to
    refresh U, following the core idea of Gradient Projection Memory (GPM).
    """

    def __init__(self, config: GradientSubspaceConfig) -> None:
        self.config = config
        self._basis: Dict[str, Tensor] = {}
        self._samples: Dict[str, Tensor] = {}
        self._hooks: list[torch.utils.hooks.RemovableHandle] = []
        self.capture_events = 0
        self.projection_events = 0
        self.basis_updates = 0
        self.last_rank = 0
        self.last_explained_energy = 0.0
        self.last_projection_fraction = 0.0

    def attach_linear(self, name: str, layer: nn.Linear) -> None:
        if not self.config.enabled:
            return
        if name in self._basis or any(getattr(h, "_neurocore_layer_name", None) == name for h in self._hooks):
            raise KeyError(f"guard already attached to {name}")
        handle = layer.register_forward_pre_hook(self._make_capture_hook(name))
        setattr(handle, "_neurocore_layer_name", name)
        self._hooks.append(handle)
        grad_handle = layer.weight.register_hook(self._make_projection_hook(name))
        setattr(grad_handle, "_neurocore_layer_name", name)
        self._hooks.append(grad_handle)

    def _make_capture_hook(self, name: str):
        def _capture(module: nn.Module, inputs: tuple[Tensor, ...]) -> None:
            if not self.config.enabled or not inputs:
                return
            x = inputs[0].detach().reshape(-1, inputs[0].shape[-1])
            if x.numel() == 0:
                return
            take = min(int(self.config.max_samples), int(x.size(0)))
            x = x[-take:]
            old = self._samples.get(name)
            if old is None or old.shape[1] != x.shape[1]:
                merged = x
            else:
                merged = torch.cat([old.to(x), x], dim=0)
                if merged.size(0) > int(self.config.max_samples):
                    merged = merged[-int(self.config.max_samples):]
            self._samples[name] = merged.detach()
            self.capture_events += int(x.size(0))
        return _capture

    def _make_projection_hook(self, name: str):
        def _project(grad: Tensor) -> Tensor:
            basis = self._basis.get(name)
            if not self.config.enabled or basis is None or basis.numel() == 0:
                return grad
            U = basis.to(device=grad.device, dtype=grad.dtype)
            projected = grad @ U @ U.transpose(0, 1)
            corrected = grad - float(self.config.projection_strength) * projected
            before = grad.norm().clamp_min(1e-12)
            delta = (grad - corrected).norm()
            self.last_projection_fraction = float((delta / before).detach().item())
            self.projection_events += 1
            return corrected
        return _project

    @torch.no_grad()
    def update_basis(self, name: Optional[str] = None) -> Dict[str, float]:
        names = [name] if name is not None else list(self._samples)
        report: Dict[str, float] = {}
        for key in names:
            samples = self._samples.get(key)
            if samples is None or samples.size(0) < int(self.config.min_samples):
                continue
            x = samples.float()
            x = x - x.mean(dim=0, keepdim=True)
            _, singular, vh = torch.linalg.svd(x, full_matrices=False)
            energy = singular.square()
            total = float(energy.sum().item())
            if total <= 1e-12:
                continue
            cumulative = torch.cumsum(energy, dim=0) / total
            needed = int(torch.searchsorted(cumulative, torch.tensor(float(self.config.energy_threshold), device=cumulative.device)).item()) + 1
            rank = min(int(self.config.basis_rank), needed, vh.size(0))
            basis = vh[:rank].transpose(0, 1).contiguous()
            self._basis[key] = basis.to(device=samples.device, dtype=samples.dtype)
            self.basis_updates += 1
            self.last_rank = rank
            self.last_explained_energy = float(cumulative[rank - 1].item())
            report[f"{key}.rank"] = float(rank)
            report[f"{key}.energy"] = self.last_explained_energy
        self._samples.clear()
        return report

    def maybe_update(self, step: int) -> Dict[str, float]:
        if not self.config.enabled or int(step) <= 0 or int(step) % int(self.config.update_interval) != 0:
            return {"gpm_basis_updated": 0.0, "gpm_basis_rank": float(self.last_rank), "gpm_projection_fraction": float(self.last_projection_fraction)}
        report = self.update_basis()
        return {
            "gpm_basis_updated": float(bool(report)),
            "gpm_basis_rank": float(self.last_rank),
            "gpm_basis_energy": float(self.last_explained_energy),
            "gpm_projection_fraction": float(self.last_projection_fraction),
        }

    def state_dict(self) -> dict:
        return {
            "capture_events": int(self.capture_events),
            "projection_events": int(self.projection_events),
            "basis_updates": int(self.basis_updates),
            "last_rank": int(self.last_rank),
            "last_explained_energy": float(self.last_explained_energy),
            "last_projection_fraction": float(self.last_projection_fraction),
            "basis": {k: v.detach().cpu() for k, v in self._basis.items()},
        }

    def load_state_dict(self, state: dict) -> None:
        self.capture_events = int(state.get("capture_events", 0))
        self.projection_events = int(state.get("projection_events", 0))
        self.basis_updates = int(state.get("basis_updates", 0))
        self.last_rank = int(state.get("last_rank", 0))
        self.last_explained_energy = float(state.get("last_explained_energy", 0.0))
        self.last_projection_fraction = float(state.get("last_projection_fraction", 0.0))
        self._basis = {k: v.clone() for k, v in state.get("basis", {}).items()}

    def close(self) -> None:
        for handle in self._hooks:
            handle.remove()
        self._hooks.clear()
