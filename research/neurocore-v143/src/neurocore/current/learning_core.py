from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class LearningCoreConfig:
    """Canonical training-policy layer around the single current optimizer.

    This object does not own model parameters, a second optimizer, or a second runtime state.
    It only decides how the existing trunk is trained and records optimizer/update health.

    ``tnt_inspired`` deliberately names the policy, not a paper-faithful TNT implementation:
    NeuroCore has no separate global/local TTT memory modules yet, so the current implementation
    borrows TNT's coarse-to-fine chunking principle without claiming architectural equivalence.
    """

    enabled: bool = True
    default_regime: str = "tbptt"
    tbptt_chunk: int = 32
    tnt_global_chunk: int = 128
    tnt_local_chunk: int = 16
    tnt_global_steps: int = 4
    tnt_local_steps: int = 2
    detach_between_chunks: bool = True
    diagnostics_enabled: bool = True
    diagnostics_every: int = 1
    probe_parameter_patterns: Tuple[str, ...] = (
        "trunk.spine.state_to_hidden.0.weight",
        "trunk.spine.state_to_hidden.2.weight",
        "trunk.spine.q_proj.weight",
        "trunk.spine.k_proj.weight",
        "trunk.predictor.0.weight",
    )
    loss_ema_decay: float = 0.95
    update_ema_decay: float = 0.95
    drift_ema_decay: float = 0.95
    max_update_to_weight_ratio: float = 0.10

    def __post_init__(self) -> None:
        if self.default_regime not in {"standard", "tbptt", "tnt_inspired"}:
            raise ValueError("default_regime must be standard, tbptt, or tnt_inspired")
        for name, value in (
            ("tbptt_chunk", self.tbptt_chunk),
            ("tnt_global_chunk", self.tnt_global_chunk),
            ("tnt_local_chunk", self.tnt_local_chunk),
            ("tnt_global_steps", self.tnt_global_steps),
            ("tnt_local_steps", self.tnt_local_steps),
            ("diagnostics_every", self.diagnostics_every),
        ):
            if int(value) <= 0:
                raise ValueError(f"{name} must be > 0")
        if not 0.0 < self.loss_ema_decay < 1.0:
            raise ValueError("loss_ema_decay must be in (0,1)")
        if not 0.0 < self.update_ema_decay < 1.0:
            raise ValueError("update_ema_decay must be in (0,1)")
        if not 0.0 < self.drift_ema_decay < 1.0:
            raise ValueError("drift_ema_decay must be in (0,1)")
        if self.max_update_to_weight_ratio <= 0.0:
            raise ValueError("max_update_to_weight_ratio must be > 0")
        if not self.probe_parameter_patterns:
            raise ValueError("at least one probe parameter pattern is required")


@dataclass(frozen=True)
class LearningPlan:
    regime: str
    chunk_length: Optional[int]
    detach_between_chunks: bool
    phase: str


class LearningCoreController:
    """Training controller for the current model.

    The optimizer remains owned by ``OrganismTrainerCurrent``. This controller contributes only
    policy, diagnostics, and evidence. It therefore cannot create a second source of learned
    weights or runtime state.
    """

    STATE_VERSION = 1

    def __init__(self, model: nn.Module, config: LearningCoreConfig) -> None:
        self.config = config
        self.steps = 0
        self.loss_ema: Optional[float] = None
        self.update_ema = 0.0
        self.drift_ema = 0.0
        self.last_update_cosine = 0.0
        self.last_update_norm = 0.0
        self.last_probe_grad_norm = 0.0
        self.last_update_to_weight_ratio = 0.0
        self.last_gradient_coverage = 0.0
        self.last_phase = "standard"
        self.last_regime = "standard"
        self._probe_before: Dict[str, Tensor] = {}
        self._probe_gradient: Optional[Tensor] = None
        self._probe_names: list[str] = []
        self._previous_probe: Optional[Tensor] = None
        self.events = 0
        self.unsafe_update_events = 0
        self.model = model

    def _select_parameters(self) -> list[tuple[str, nn.Parameter]]:
        selected: list[tuple[str, nn.Parameter]] = []
        for name, p in self.model.named_parameters():
            if not p.requires_grad:
                continue
            if any(name == pattern or name.endswith(pattern) for pattern in self.config.probe_parameter_patterns):
                selected.append((name, p))
        return selected

    def plan(self, *, step: int, sequence_length: int, explicit_chunk: Optional[int] = None, regime: Optional[str] = None) -> LearningPlan:
        if explicit_chunk is not None and int(explicit_chunk) > 0:
            return LearningPlan(
                regime="explicit",
                chunk_length=int(explicit_chunk),
                detach_between_chunks=bool(self.config.detach_between_chunks),
                phase="explicit",
            )
        selected = regime or self.config.default_regime
        if selected not in {"standard", "tbptt", "tnt_inspired"}:
            raise ValueError("regime must be standard, tbptt, or tnt_inspired")
        if not self.config.enabled or selected == "standard" or sequence_length <= self.config.tbptt_chunk:
            return LearningPlan(selected, None, False, "full_sequence")
        if selected == "tbptt":
            return LearningPlan(selected, int(self.config.tbptt_chunk), bool(self.config.detach_between_chunks), "tbptt")
        cycle = int(self.config.tnt_global_steps + self.config.tnt_local_steps)
        pos = int(step % max(1, cycle))
        if pos < self.config.tnt_global_steps:
            return LearningPlan(selected, int(self.config.tnt_global_chunk), bool(self.config.detach_between_chunks), "global_coarse")
        return LearningPlan(selected, int(self.config.tnt_local_chunk), bool(self.config.detach_between_chunks), "local_fine")

    @staticmethod
    def _flatten(grads: Sequence[Optional[Tensor]], params: Sequence[nn.Parameter]) -> Tensor:
        pieces = []
        for g, p in zip(grads, params):
            if g is None:
                pieces.append(torch.zeros(p.numel(), dtype=torch.float32, device=p.device))
            else:
                pieces.append(g.detach().float().reshape(-1))
        return torch.cat(pieces) if pieces else torch.zeros(0)

    def capture_before_optimizer(self) -> None:
        if not self.config.diagnostics_enabled or self.steps % self.config.diagnostics_every != 0:
            self._probe_before = {}
            self._probe_gradient = None
            self._probe_names = []
            return
        selected = self._select_parameters()
        if not selected:
            self._probe_before = {}
            self._probe_gradient = None
            self._probe_names = []
            return
        params = [p for _, p in selected]
        names = [n for n, _ in selected]
        grad_parts = [p.grad for p in params]
        self._probe_before = {n: p.detach().clone() for n, p in selected}
        self._probe_gradient = self._flatten(grad_parts, params)
        self._probe_names = names
        self.last_probe_grad_norm = float(self._probe_gradient.norm().item())

    @torch.no_grad()
    def after_optimizer(self, loss: float, gradient_coverage: float) -> Dict[str, float]:
        self.events += 1
        self.steps += 1
        d = float(self.config.loss_ema_decay)
        self.loss_ema = float(loss) if self.loss_ema is None else d * self.loss_ema + (1.0 - d) * float(loss)
        self.last_gradient_coverage = float(gradient_coverage)
        if not self._probe_before or self._probe_gradient is None:
            self.last_update_cosine = 0.0
            self.last_update_norm = 0.0
            self.last_update_to_weight_ratio = 0.0
            self.last_phase = "unknown"
            self.last_regime = "unknown"
            return self.report()
        selected = dict(self._select_parameters())
        update_pieces = []
        weight_pieces = []
        for name in self._probe_names:
            if name in selected and name in self._probe_before:
                update_pieces.append((selected[name].detach() - self._probe_before[name]).float().reshape(-1))
                weight_pieces.append(self._probe_before[name].float().reshape(-1))
        update = torch.cat(update_pieces) if update_pieces else torch.zeros(0)
        weights = torch.cat(weight_pieces) if weight_pieces else torch.zeros(0)
        if update.numel():
            self.last_update_norm = float(update.norm().item())
            weight_norm = float(weights.norm().item()) if weights.numel() else 0.0
            ratio = self.last_update_norm / max(weight_norm, 1e-12)
            self.last_update_to_weight_ratio = float(ratio)
            if ratio > float(self.config.max_update_to_weight_ratio):
                self.unsafe_update_events += 1
            if self._probe_gradient.numel() == update.numel() and float(update.norm().item()) > 0 and float(self._probe_gradient.norm().item()) > 0:
                # Optimizer updates should generally point against the raw gradient.
                self.last_update_cosine = float(torch.nn.functional.cosine_similarity(update, -self._probe_gradient, dim=0, eps=1e-8).item())
            self.update_ema = float(self.config.update_ema_decay) * self.update_ema + (1.0 - float(self.config.update_ema_decay)) * self.last_update_norm
        if self._previous_probe is not None and update.numel() == self._previous_probe.numel() and update.numel():
            self.drift_ema = float(self.config.drift_ema_decay) * self.drift_ema + (1.0 - float(self.config.drift_ema_decay)) * float(torch.nn.functional.cosine_similarity(update, self._previous_probe, dim=0, eps=1e-8).item())
        self._previous_probe = update.detach().clone() if update.numel() else None
        return self.report()

    def report(self) -> Dict[str, float]:
        return {
            "learning_core_steps": float(self.steps),
            "learning_core_loss_ema": float(self.loss_ema or 0.0),
            "learning_core_update_norm": float(self.last_update_norm),
            "learning_core_update_ema": float(self.update_ema),
            "learning_core_update_cosine_to_negative_grad": float(self.last_update_cosine),
            "learning_core_update_to_weight_ratio": float(self.last_update_to_weight_ratio),
            "learning_core_phase": self.last_phase,
            "learning_core_regime": self.last_regime,
            "learning_core_update_alignment_ema": float(self.drift_ema),
            "learning_core_gradient_coverage": float(self.last_gradient_coverage),
            "learning_core_unsafe_update_events": float(self.unsafe_update_events),
            "learning_core_probe_grad_norm": float(self.last_probe_grad_norm),
        }

    def set_plan(self, plan: LearningPlan) -> None:
        self.last_phase = plan.phase
        self.last_regime = plan.regime

    def state_dict(self) -> dict[str, Any]:
        return {
            "state_version": self.STATE_VERSION,
            "steps": self.steps,
            "loss_ema": self.loss_ema,
            "update_ema": self.update_ema,
            "drift_ema": self.drift_ema,
            "events": self.events,
            "unsafe_update_events": self.unsafe_update_events,
            "last_phase": self.last_phase,
            "last_regime": self.last_regime,
        }

    def load_state_dict(self, payload: Optional[Mapping[str, Any]]) -> None:
        payload = payload or {}
        self.steps = int(payload.get("steps", 0))
        self.loss_ema = None if payload.get("loss_ema") is None else float(payload.get("loss_ema"))
        self.update_ema = float(payload.get("update_ema", 0.0))
        self.drift_ema = float(payload.get("drift_ema", 0.0))
        self.events = int(payload.get("events", 0))
        self.unsafe_update_events = int(payload.get("unsafe_update_events", 0))
        self.last_phase = str(payload.get("last_phase", "standard"))
        self.last_regime = str(payload.get("last_regime", "standard"))
