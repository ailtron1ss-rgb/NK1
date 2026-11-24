from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import math
import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class NeuralLifecycleConfig:
    """Configuration for non-gradient neuronal lifecycle management.

    The mechanism is deliberately tiny and local: it monitors one explicit hidden-unit bank,
    estimates contribution utility from activity x outgoing weights, and performs very rare
    partial rejuvenation of mature low-utility units. This follows the evidence-backed direction
    of continual backpropagation / self-normalized resets without making a second long-term memory.
    """

    enabled: bool = False
    replacement_rate: float = 5e-4
    maturity_steps: int = 32
    utility_decay: float = 0.99
    silence_decay: float = 0.99
    silence_threshold: float = 0.02
    reset_strength: float = 0.20
    minimum_live_units: int = 8
    cooldown_steps: int = 8
    homeostatic_enabled: bool = False
    homeostatic_target_activity: float = 0.05
    homeostatic_eta: float = 0.002
    homeostatic_gain_floor: float = 0.60
    homeostatic_gain_ceiling: float = 1.80

    def __post_init__(self) -> None:
        if not 0.0 < self.replacement_rate < 1.0:
            raise ValueError("replacement_rate must be in (0,1)")
        if not 0.0 < self.utility_decay < 1.0:
            raise ValueError("utility_decay must be in (0,1)")
        if not 0.0 < self.silence_decay < 1.0:
            raise ValueError("silence_decay must be in (0,1)")
        if self.maturity_steps < 1:
            raise ValueError("maturity_steps must be >= 1")
        if not 0.0 < self.silence_threshold:
            raise ValueError("silence_threshold must be > 0")
        if not 0.0 < self.reset_strength <= 1.0:
            raise ValueError("reset_strength must be in (0,1]")
        if self.minimum_live_units < 1:
            raise ValueError("minimum_live_units must be >= 1")
        if self.cooldown_steps < 0:
            raise ValueError("cooldown_steps must be >= 0")
        if self.homeostatic_target_activity <= 0.0:
            raise ValueError("homeostatic_target_activity must be > 0")
        if not 0.0 < self.homeostatic_eta <= 1.0:
            raise ValueError("homeostatic_eta must be in (0,1]")
        if not 0.0 < self.homeostatic_gain_floor <= self.homeostatic_gain_ceiling:
            raise ValueError("homeostatic gain bounds are invalid")


class NeuralLifecycleController:
    """Evidence-backed neuronal lifecycle controller for one current hidden-unit bank.

    Design:
      * utility is measured from actual activity and outgoing connection magnitude;
      * silence is tracked separately as an SNR-inspired signal;
      * only mature units are eligible;
      * a tiny replacement credit limits reset frequency;
      * the reset is partial by default, preserving stability;
      * Adam/AdamW moment buffers for the affected rows/columns are cleared.

    This object owns statistics, not neural representations. The target parameters remain owned
    by the recurrent spine and the optimizer remains the trainer's owner.
    """

    STATE_VERSION = 1

    def __init__(self, spine: nn.Module, cfg: Optional[NeuralLifecycleConfig] = None) -> None:
        self.spine = spine
        self.cfg = cfg or NeuralLifecycleConfig()
        self.enabled = bool(self.cfg.enabled)
        self.steps = 0
        self.rejuvenations = 0
        self.last_rejuvenated_unit = -1
        self.cooldown = 0
        self.spine.lifecycle_observation_enabled = self.enabled or bool(self.cfg.homeostatic_enabled)
        self.spine.homeostatic_enabled = bool(self.cfg.homeostatic_enabled)
        self.spine.homeostatic_target_activity = float(self.cfg.homeostatic_target_activity)
        self.spine.homeostatic_eta = float(self.cfg.homeostatic_eta)
        self.spine.homeostatic_gain_floor = float(self.cfg.homeostatic_gain_floor)
        self.spine.homeostatic_gain_ceiling = float(self.cfg.homeostatic_gain_ceiling)
        self.spine.lifecycle_utility_decay = float(self.cfg.utility_decay)
        self.spine.lifecycle_silence_decay = float(self.cfg.silence_decay)
        self.spine.lifecycle_silence_threshold = float(self.cfg.silence_threshold)
        self.replacement_credit = 0.0

    def _hidden_width(self) -> int:
        try:
            return int(self.spine.state_to_hidden[0].out_features)
        except Exception as exc:  # pragma: no cover - defensive contract error
            raise TypeError("NeuralLifecycleController requires spine.state_to_hidden[0] Linear") from exc

    @property
    def hidden_width(self) -> int:
        return self._hidden_width()

    @torch.no_grad()
    def observe(self, activation: Tensor) -> dict[str, float]:
        """Ingest one real hidden-activation observation through the canonical spine owner."""
        return self.spine.observe_lifecycle_activation(activation)

    def _utility_score(self) -> Tensor:
        """Lower is less useful; blend activity contribution and persistent silence."""
        utility = self.spine.unit_contribution_ema
        scale = utility.mean().clamp_min(1e-8)
        relative = utility / scale
        # Silence is a positive penalty, making long-term dormant units more eligible.
        return relative + 0.5 * self.spine.unit_silence_ema

    def _eligible(self) -> Tensor:
        live_needed = min(max(1, self.cfg.minimum_live_units), self.hidden_width)
        mature = self.spine.unit_age >= int(self.cfg.maturity_steps)
        if int(mature.sum().item()) == 0:
            return torch.zeros_like(mature)
        scores = self._utility_score()
        # Keep at least minimum_live_units above a conservative activity floor.
        live_floor = torch.quantile(self.spine.unit_activity_ema, 0.15).detach()
        protected = self.spine.unit_activity_ema > live_floor
        candidates = mature & (~protected | (scores <= torch.quantile(scores[mature], 0.25)))
        if int((~candidates).sum().item()) < live_needed:
            candidates = mature.clone()
        return candidates

    @torch.no_grad()
    def _reset_optimizer_slice(self, optimizer: Any, param: nn.Parameter, indexer: tuple[Any, ...]) -> None:
        if optimizer is None or not hasattr(optimizer, "state"):
            return
        state = optimizer.state.get(param)
        if not state:
            return
        for key, value in state.items():
            if torch.is_tensor(value) and value.ndim > 0:
                try:
                    value[indexer] = 0
                except (IndexError, RuntimeError):
                    # Scalar steps and optimizer-specific layouts are intentionally left intact.
                    continue

    @torch.no_grad()
    def _partial_rejuvenate(self, unit: int, optimizer: Any) -> None:
        in_layer: nn.Linear = self.spine.state_to_hidden[0]
        out_layer: nn.Linear = self.spine.state_to_hidden[2]
        alpha = float(self.cfg.reset_strength)

        fan_in = max(1, int(in_layer.in_features))
        bound = 1.0 / math.sqrt(fan_in)
        fresh_in = torch.empty_like(in_layer.weight[unit]).uniform_(-bound, bound)
        in_layer.weight[unit].lerp_(fresh_in, alpha)
        if in_layer.bias is not None:
            fresh_bias = torch.empty_like(in_layer.bias[unit]).uniform_(-bound, bound)
            in_layer.bias[unit].lerp_(fresh_bias, alpha)

        # Newly introduced feature starts with low downstream influence, matching the continual-
        # backprop direction while using a partial reset to avoid abrupt distribution shifts.
        out_layer.weight[:, unit].mul_(1.0 - alpha)

        self._reset_optimizer_slice(optimizer, in_layer.weight, (unit, slice(None)))
        if in_layer.bias is not None:
            self._reset_optimizer_slice(optimizer, in_layer.bias, (unit,))
        self._reset_optimizer_slice(optimizer, out_layer.weight, (slice(None), unit))
        self.spine.unit_age[unit] = 0
        self.spine.unit_activity_ema[unit] = max(float(self.spine.unit_activity_ema.mean().item()), 1e-4)
        self.spine.unit_contribution_ema[unit] = 0.0
        self.spine.unit_silence_ema[unit] = 1.0
        self.last_rejuvenated_unit = int(unit)
        self.rejuvenations += 1
        self.cooldown = int(self.cfg.cooldown_steps)

    @torch.no_grad()
    def after_optimizer_step(self, optimizer: Any) -> dict[str, float]:
        if not self.enabled:
            return self.report()
        self.steps += 1
        self.cooldown = max(0, self.cooldown - 1)
        self.replacement_credit += float(self.hidden_width) * float(self.cfg.replacement_rate)
        reset = 0
        unit = -1
        if self.cooldown == 0 and self.replacement_credit >= 1.0:
            eligible = self._eligible()
            if bool(eligible.any()):
                scores = self._utility_score().clone()
                scores[~eligible] = float("inf")
                unit = int(torch.argmin(scores).item())
                self._partial_rejuvenate(unit, optimizer)
                self.replacement_credit -= 1.0
                reset = 1
        return self.report(reset=reset, unit=unit)

    def report(self, *, reset: int = 0, unit: int = -1) -> dict[str, float]:
        activity = self.spine.unit_activity_ema
        utility = self.spine.unit_contribution_ema
        return {
            "enabled": float(self.enabled),
            "lifecycle_steps": float(self.steps),
            "lifecycle_rejuvenations": float(self.rejuvenations),
            "lifecycle_last_unit": float(self.last_rejuvenated_unit if unit < 0 else unit),
            "lifecycle_reset_event": float(reset),
            "lifecycle_active_fraction": float((activity > float(self.cfg.silence_threshold)).float().mean().item()),
            "lifecycle_silence_mean": float(self.spine.unit_silence_ema.mean().item()),
            "lifecycle_activity_mean": float(activity.mean().item()),
            "lifecycle_contribution_mean": float(utility.mean().item()),
            "lifecycle_min_contribution": float(utility.min().item()),
            "lifecycle_replacement_credit": float(self.replacement_credit),
            "homeostatic_enabled": float(bool(self.cfg.homeostatic_enabled)),
            "homeostatic_gain_mean": float(self.spine.homeostatic_log_gain.exp().mean().item()),
            "homeostatic_gain_min": float(self.spine.homeostatic_log_gain.exp().min().item()),
            "homeostatic_gain_max": float(self.spine.homeostatic_log_gain.exp().max().item()),
        }

    def state_dict(self) -> dict[str, Any]:
        # Per-unit statistics are model-owned buffers on the spine and therefore serialize exactly once.
        return {
            "state_version": self.STATE_VERSION,
            "enabled": self.enabled,
            "steps": self.steps,
            "rejuvenations": self.rejuvenations,
            "last_rejuvenated_unit": self.last_rejuvenated_unit,
            "cooldown": self.cooldown,
            "replacement_credit": self.replacement_credit,
        }

    def load_state_dict(self, state: dict[str, Any]) -> None:
        if not state:
            return
        self.enabled = bool(state.get("enabled", self.enabled))
        self.spine.lifecycle_observation_enabled = self.enabled or bool(self.cfg.homeostatic_enabled)
        self.spine.homeostatic_enabled = bool(self.cfg.homeostatic_enabled)
        self.spine.homeostatic_target_activity = float(self.cfg.homeostatic_target_activity)
        self.spine.homeostatic_eta = float(self.cfg.homeostatic_eta)
        self.spine.homeostatic_gain_floor = float(self.cfg.homeostatic_gain_floor)
        self.spine.homeostatic_gain_ceiling = float(self.cfg.homeostatic_gain_ceiling)
        self.spine.lifecycle_utility_decay = float(self.cfg.utility_decay)
        self.spine.lifecycle_silence_decay = float(self.cfg.silence_decay)
        self.spine.lifecycle_silence_threshold = float(self.cfg.silence_threshold)
        self.steps = int(state.get("steps", self.steps))
        self.rejuvenations = int(state.get("rejuvenations", self.rejuvenations))
        self.last_rejuvenated_unit = int(state.get("last_rejuvenated_unit", self.last_rejuvenated_unit))
        self.cooldown = int(state.get("cooldown", self.cooldown))
        self.replacement_credit = float(state.get("replacement_credit", self.replacement_credit))
