from __future__ import annotations

from dataclasses import dataclass, asdict, field
from typing import Any, Dict, Optional, Sequence, Tuple, List
import math
import copy

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v48 import (
    V48Config,
    mobile_v48_config,
    V47BrainState,
    NeuroWeaveV48,
    OrganismTrainerV48,
    RuntimeStateStoreV48,
    EpisodicMemoryV48,
)
from neurocore.v49 import (
    V49Config,
    mobile_v49_config,
    ComplementaryMemoryV49,
    SemanticPrototypeV49,
    OrganismRuntimeV49,
)
from neurocore.v48.embodiment import SensorFrameV48, SensorHealthV48, PhoneTelemetryAdapterV48


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return x / x.norm(dim=-1, keepdim=True).clamp_min(eps)


def _as_batch(x: Tensor) -> Tensor:
    if x.ndim == 1:
        return x.unsqueeze(0)
    return x


@dataclass
class V50Config(V49Config):
    """V50: state-aligned, uncertainty-calibrated, grounded latent world model."""

    world_hidden_v50: int = 28
    world_learning_rate_v50: float = 7e-4
    world_latent_weight_v50: float = 0.16
    world_nll_weight_v50: float = 0.08
    world_reward_weight_v50: float = 0.03
    world_risk_weight_v50: float = 0.03
    world_inverse_weight_v50: float = 0.05
    world_state_align_weight_v50: float = 0.05
    world_horizon_consistency_weight_v50: float = 0.06
    world_uncertainty_min_v50: float = 0.02
    world_uncertainty_max_v50: float = 1.0
    world_horizon_train_v50: int = 4
    world_rollout_horizon_v50: int = 8
    world_candidate_count_v50: int = 6
    world_candidate_noise_v50: float = 0.10
    world_action_support_v50: float = 0.20
    world_admission_margin_v50: float = 0.015
    world_ready_error_v50: float = 0.30
    world_ready_observations_v50: int = 24
    world_ready_horizon_v50: int = 4
    world_horizon_decay_v50: float = 0.94
    world_uncertainty_growth_target_v50: float = 0.05
    world_regime_bin_size_v50: float = 0.10
    runtime_state_version_v50: int = 1
    sensor_fusion_hidden_v50: int = 24
    sensor_fusion_feature_dim_v50: int = 11
    sensor_fusion_reconstruction_weight_v50: float = 0.25
    sensor_fusion_consistency_weight_v50: float = 0.10
    sensor_fusion_mask_dropout_v50: float = 0.15
    horizon_calibration_max_starts_v50: int = 8
    online_world_updates_per_feedback_v50: int = 2


def mobile_v50_config(raw_observation_dim: int = 9) -> V50Config:
    base = dict(mobile_v49_config(raw_observation_dim).__dict__)
    return V50Config(
        **base,
        world_hidden_v50=24,
        world_learning_rate_v50=1e-3,
        world_latent_weight_v50=0.14,
        world_nll_weight_v50=0.07,
        world_reward_weight_v50=0.025,
        world_risk_weight_v50=0.025,
        world_inverse_weight_v50=0.045,
        world_state_align_weight_v50=0.04,
        world_horizon_consistency_weight_v50=0.05,
        world_uncertainty_min_v50=0.02,
        world_uncertainty_max_v50=1.0,
        world_horizon_train_v50=4,
        world_rollout_horizon_v50=8,
        world_candidate_count_v50=5,
        world_candidate_noise_v50=0.10,
        world_action_support_v50=0.20,
        world_admission_margin_v50=0.015,
        world_ready_error_v50=0.30,
        world_ready_observations_v50=24,
        world_ready_horizon_v50=4,
        world_horizon_decay_v50=0.94,
        world_uncertainty_growth_target_v50=0.05,
        world_regime_bin_size_v50=0.10,
        runtime_state_version_v50=1,
        sensor_fusion_hidden_v50=24,
        sensor_fusion_feature_dim_v50=11,
        sensor_fusion_reconstruction_weight_v50=0.25,
        sensor_fusion_consistency_weight_v50=0.10,
        sensor_fusion_mask_dropout_v50=0.15,
        horizon_calibration_max_starts_v50=8,
        online_world_updates_per_feedback_v50=2,
    )


class StateAlignedLatentWorldModelV50(nn.Module):
    """Action-conditioned recurrent latent dynamics with uncertainty and grounding heads.

    The next-latent predictor is complemented by:
      * inverse dynamics (latent transition -> action),
      * state alignment (latent transition -> observation delta),
      * explicit predictive scale for horizon-aware uncertainty.
    """

    def __init__(self, latent_dim: int, action_dim: int, goal_latent_dim: int,
                 observation_dim: int, hidden: int = 28,
                 uncertainty_min: float = 0.02, uncertainty_max: float = 1.0):
        super().__init__()
        self.latent_dim = int(latent_dim)
        self.action_dim = int(action_dim)
        self.goal_latent_dim = int(goal_latent_dim)
        self.observation_dim = int(observation_dim)
        self.hidden = int(hidden)
        self.uncertainty_min = float(max(0.0, uncertainty_min))
        self.uncertainty_max = float(max(self.uncertainty_min, uncertainty_max))
        self.input = nn.Sequential(
            nn.Linear(latent_dim + action_dim + goal_latent_dim, hidden),
            nn.SiLU(),
        )
        self.cell = nn.GRUCell(hidden, hidden)
        self.delta_mean = nn.Sequential(
            nn.Linear(hidden + latent_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, latent_dim),
        )
        self.delta_log_scale = nn.Sequential(
            nn.Linear(hidden + latent_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, latent_dim),
        )
        self.reward = nn.Sequential(
            nn.Linear(hidden + latent_dim + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )
        self.risk = nn.Sequential(
            nn.Linear(hidden + latent_dim + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1), nn.Sigmoid()
        )
        self.confidence = nn.Sequential(
            nn.Linear(hidden + latent_dim, 1), nn.Sigmoid()
        )
        self.inverse_action = nn.Sequential(
            nn.Linear(2 * latent_dim, hidden), nn.SiLU(), nn.Linear(hidden, action_dim), nn.Tanh()
        )
        self.state_align = nn.Sequential(
            nn.Linear(2 * latent_dim, hidden), nn.SiLU(), nn.Linear(hidden, observation_dim)
        )
        self.horizon_uncertainty = nn.Sequential(
            nn.Linear(hidden + latent_dim, 1), nn.Softplus()
        )

    def initial_hidden(self, batch: int, device=None, dtype=None) -> Tensor:
        return torch.zeros(batch, self.hidden, device=device, dtype=dtype)

    def step(self, latent: Tensor, action: Tensor, goal_latent: Tensor,
             hidden: Tensor, horizon: int = 1) -> Dict[str, Tensor]:
        latent = _as_batch(latent)
        action = _as_batch(action)
        goal_latent = _as_batch(goal_latent)
        hidden = _as_batch(hidden)
        inp = self.input(torch.cat([latent, action, goal_latent], -1))
        next_hidden = self.cell(inp, hidden)
        base = torch.cat([next_hidden, latent], -1)
        mean_delta = torch.tanh(self.delta_mean(base))
        scale = F.softplus(self.delta_log_scale(base)) + self.uncertainty_min
        scale = scale.clamp(self.uncertainty_min, self.uncertainty_max)
        pred = _norm(latent + 0.5 * mean_delta)
        rr = self.reward(torch.cat([next_hidden, latent, action], -1))
        rk = self.risk(torch.cat([next_hidden, latent, action], -1))
        conf = self.confidence(torch.cat([next_hidden, pred], -1))
        transition = torch.cat([latent, pred], -1)
        inv_action = self.inverse_action(transition)
        state_delta = self.state_align(transition)
        base_u = self.horizon_uncertainty(torch.cat([next_hidden, pred], -1))
        horizon = max(1, int(horizon))
        horizon_uncertainty = (base_u * math.sqrt(float(horizon)) + scale.mean(-1, keepdim=True)).clamp(0.0, 5.0)
        return {
            "next_latent": pred,
            "delta_mean": mean_delta,
            "scale": scale,
            "reward": rr,
            "risk": rk,
            "confidence": conf,
            "inverse_action": inv_action,
            "state_delta": state_delta,
            "horizon_uncertainty": horizon_uncertainty,
            "hidden": next_hidden,
        }

    def rollout(self, start_latent: Tensor, actions: Tensor, goal_latent: Tensor,
                hidden: Optional[Tensor] = None) -> Dict[str, Tensor]:
        if actions.ndim != 3:
            raise ValueError("actions must be [B,H,A]")
        b = actions.size(0)
        hidden = self.initial_hidden(b, actions.device, actions.dtype) if hidden is None else _as_batch(hidden)
        latent = _norm(start_latent)
        latents = [latent]
        rewards: List[Tensor] = []
        risks: List[Tensor] = []
        confidences: List[Tensor] = []
        scales: List[Tensor] = []
        h_unc: List[Tensor] = []
        for idx in range(actions.size(1)):
            out = self.step(latent, actions[:, idx], goal_latent, hidden, horizon=idx + 1)
            latent, hidden = out["next_latent"], out["hidden"]
            latents.append(latent)
            rewards.append(out["reward"])
            risks.append(out["risk"])
            confidences.append(out["confidence"])
            scales.append(out["scale"].mean(-1, keepdim=True))
            h_unc.append(out["horizon_uncertainty"])
        return {
            "latents": torch.stack(latents, 1),
            "rewards": torch.stack(rewards, 1),
            "risks": torch.stack(risks, 1),
            "confidences": torch.stack(confidences, 1),
            "scales": torch.stack(scales, 1),
            "horizon_uncertainty": torch.stack(h_unc, 1),
            "hidden": hidden,
        }


@dataclass
class HorizonBinV50:
    count: int = 0
    error_ema: float = float("inf")
    uncertainty_ema: float = float("inf")
    absolute_gap_ema: float = float("inf")
    ratio_history: List[float] = field(default_factory=list)

    def update(self, error: float, uncertainty: float, decay: float, max_history: int = 128) -> None:
        self.count += 1
        error_f = float(error)
        uncertainty_f = float(uncertainty)
        ratio = error_f / max(uncertainty_f, 1e-3)
        self.ratio_history.append(float(min(50.0, max(0.0, ratio))))
        if len(self.ratio_history) > max_history:
            del self.ratio_history[:-max_history]
        if math.isfinite(self.error_ema):
            self.error_ema = decay * self.error_ema + (1.0 - decay) * error_f
            self.uncertainty_ema = decay * self.uncertainty_ema + (1.0 - decay) * uncertainty_f
            self.absolute_gap_ema = decay * self.absolute_gap_ema + (1.0 - decay) * abs(error_f - uncertainty_f)
        else:
            self.error_ema = error_f
            self.uncertainty_ema = uncertainty_f
            self.absolute_gap_ema = abs(error_f - uncertainty_f)


class HorizonCalibratedUncertaintyV50:
    """Tracks horizon-specific error/uncertainty alignment from grounded transitions."""

    def __init__(self, min_observations: int = 12, max_gap: float = 0.30,
                 decay: float = 0.94, target_growth: float = 0.05, ratio_quantile: float = 0.90):
        self.min_observations = int(max(1, min_observations))
        self.max_gap = float(max(0.0, max_gap))
        self.decay = float(min(max(decay, 0.0), 0.999))
        self.target_growth = float(max(0.0, target_growth))
        self.ratio_quantile = float(min(0.999, max(0.5, ratio_quantile)))
        self.bins: Dict[int, HorizonBinV50] = {}

    def update(self, horizon: int, error: float, uncertainty: float) -> None:
        h = int(max(1, horizon))
        b = self.bins.setdefault(h, HorizonBinV50())
        b.update(error, uncertainty, self.decay)

    def calibrated(self, horizon: int) -> bool:
        b = self.bins.get(int(horizon))
        return bool(b and b.count >= self.min_observations and math.isfinite(b.absolute_gap_ema) and b.absolute_gap_ema <= self.max_gap)

    def max_calibrated_horizon(self) -> int:
        valid = [h for h in self.bins if self.calibrated(h)]
        return max(valid) if valid else 0


    def uncertainty_bound(self, horizon: int, predicted_uncertainty: float) -> float:
        """Return an empirical upper envelope derived from observed error/uncertainty ratios."""
        b = self.bins.get(int(max(1, horizon)))
        raw = max(0.0, float(predicted_uncertainty))
        if b is None or len(b.ratio_history) < max(4, self.min_observations // 2):
            return raw
        ratios = sorted(b.ratio_history)
        idx = min(len(ratios) - 1, max(0, int(math.ceil(self.ratio_quantile * len(ratios))) - 1))
        scale = max(1.0, ratios[idx])
        return float(raw * scale)

    def horizon_penalty(self, horizon: int) -> float:
        h = int(max(1, horizon))
        b = self.bins.get(h)
        if b is None or not math.isfinite(b.error_ema):
            return 1.0 + 0.08 * math.sqrt(h)
        drift = abs(b.error_ema - b.uncertainty_ema)
        return float(1.0 + 0.08 * math.sqrt(h) + drift)

    def summary(self) -> Dict[str, float]:
        mh = self.max_calibrated_horizon()
        return {
            "horizon_bins": float(len(self.bins)),
            "max_calibrated_horizon": float(mh),
            "calibrated_bins": float(sum(1 for h in self.bins if self.calibrated(h))),
        }

    def state_dict(self) -> Dict[str, Any]:
        return {
            "min_observations": self.min_observations,
            "max_gap": self.max_gap,
            "decay": self.decay,
            "target_growth": self.target_growth,
            "ratio_quantile": self.ratio_quantile,
            "bins": {int(k): asdict(v) for k, v in self.bins.items()},
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.min_observations = int(state.get("min_observations", self.min_observations))
        self.max_gap = float(state.get("max_gap", self.max_gap))
        self.decay = float(state.get("decay", self.decay))
        self.target_growth = float(state.get("target_growth", self.target_growth))
        self.ratio_quantile = float(state.get("ratio_quantile", self.ratio_quantile))
        self.bins = {int(k): HorizonBinV50(**v) for k, v in (state.get("bins") or {}).items()}


class StateAlignedPlannerV50:
    """Risk-aware macro planner with horizon-calibrated uncertainty and baseline fallback."""

    def __init__(self, cfg: V50Config):
        self.cfg = cfg

    def _candidates(self, base: Tensor, horizon: int, count: int) -> Tensor:
        b, a = base.shape
        noise = torch.randn(
            b, count, horizon, a, device=base.device, dtype=base.dtype
        ) * float(self.cfg.world_candidate_noise_v50)
        seq = (base[:, None, None, :] + noise).clamp(-1.0, 1.0)
        support = float(self.cfg.world_action_support_v50)
        return torch.clamp(base[:, None, None, :] + (seq - base[:, None, None, :]).clamp(-support, support), -1.0, 1.0)

    @torch.no_grad()
    def select(self, world_model: StateAlignedLatentWorldModelV50,
               current_latent: Tensor, subgoal_latent: Tensor,
               base_action: Tensor, readiness: HorizonCalibratedUncertaintyV50,
               horizon: Optional[int] = None) -> Tuple[Tensor, Dict[str, Tensor]]:
        current_latent = _as_batch(current_latent)
        subgoal_latent = _as_batch(subgoal_latent)
        base_action = _as_batch(base_action)
        desired = int(horizon or self.cfg.world_rollout_horizon_v50)
        calibrated = readiness.max_calibrated_horizon()
        if calibrated > 0:
            desired = min(desired, max(1, calibrated))
        h = max(1, desired)
        count = max(1, int(self.cfg.world_candidate_count_v50))
        candidates = self._candidates(base_action, h, count)
        flat = candidates.reshape(-1, h, base_action.size(-1))
        cur = current_latent[:, None, :].expand(-1, count, -1).reshape(-1, current_latent.size(-1))
        goal = subgoal_latent[:, None, :].expand(-1, count, -1).reshape(-1, subgoal_latent.size(-1))
        pred = world_model.rollout(cur, flat, goal)
        endpoint = pred["latents"][:, -1].reshape(current_latent.size(0), count, -1)
        rewards = pred["rewards"].mean(1).reshape(current_latent.size(0), count, -1).squeeze(-1)
        risks = pred["risks"].mean(1).reshape(current_latent.size(0), count, -1).squeeze(-1)
        unc_raw = pred["horizon_uncertainty"].mean(1).reshape(current_latent.size(0), count, -1).squeeze(-1)
        unc_scale = float(readiness.uncertainty_bound(h, float(unc_raw.detach().mean().item())) / max(float(unc_raw.detach().mean().item()), 1e-6))
        unc = unc_raw * unc_scale
        distance = 1.0 - F.cosine_similarity(endpoint, subgoal_latent[:, None, :], dim=-1)
        penalty = readiness.horizon_penalty(h)
        score = -distance + 0.05 * rewards - 0.16 * risks - 0.08 * penalty * unc
        best = score.argmax(1)
        proposed = candidates[torch.arange(current_latent.size(0), device=current_latent.device), best, 0]
        proposed_score = score[torch.arange(score.size(0), device=score.device), best].unsqueeze(-1)
        return proposed, {
            "world50_score": proposed_score,
            "world50_distance": distance[torch.arange(distance.size(0), device=distance.device), best].unsqueeze(-1),
            "world50_uncertainty": unc[torch.arange(unc.size(0), device=unc.device), best].unsqueeze(-1),
            "world50_risk": risks[torch.arange(risks.size(0), device=risks.device), best].unsqueeze(-1),
            "world50_horizon": current_latent.new_full((current_latent.size(0), 1), float(h)),
        }


class WorldModelAdmissionGateV50:
    """A proposed world-model action is admitted only when calibrated and better than baseline."""

    def __init__(self, margin: float = 0.015):
        self.margin = float(margin)

    def select(self, proposed: Tensor, proposed_score: Tensor, baseline: Tensor,
               baseline_score: Tensor, readiness: HorizonCalibratedUncertaintyV50,
               horizon: int) -> Tuple[Tensor, Tensor]:
        score_delta = proposed_score - baseline_score
        ready = 1.0 if readiness.calibrated(horizon) else 0.0
        accept = ((score_delta > self.margin).to(proposed.dtype) * ready)
        return (baseline + accept * (proposed - baseline)).clamp(-1.0, 1.0), accept


class SensorFusionEncoderV50(nn.Module):
    """Compact sensor+mask encoder/decoder for real telemetry ingress.

    It is deliberately conservative: missing channels are explicit via masks, and
    reconstruction is available as a trainable auxiliary objective rather than an
    implicit fabricated sensor value.
    """

    def __init__(self, feature_dim: int, output_dim: int = 9, hidden: int = 24):
        super().__init__()
        self.feature_dim = int(feature_dim)
        self.output_dim = int(output_dim)
        self.hidden = int(hidden)
        self.encoder = nn.Sequential(
            nn.Linear(2 * feature_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, output_dim), nn.Tanh()
        )
        self.decoder = nn.Sequential(
            nn.Linear(output_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, feature_dim)
        )

    def forward(self, values: Tensor, mask: Tensor) -> Dict[str, Tensor]:
        values = _as_batch(values)
        mask = _as_batch(mask)
        if values.size(-1) != self.feature_dim or mask.size(-1) != self.feature_dim:
            raise ValueError(
                f"sensor feature schema mismatch: expected {self.feature_dim}, "
                f"got values={values.size(-1)}, mask={mask.size(-1)}"
            )
        inp = torch.cat([values, mask], -1)
        latent = self.encoder(inp)
        reconstruction = self.decoder(latent)
        return {"observation": latent, "reconstruction": reconstruction}

    def encode_frame(self, adapter: PhoneTelemetryAdapterV48, now_ms: Optional[int] = None) -> Tuple[Tensor, SensorHealthV48, Tensor]:
        values, mask = adapter.vector_and_mask(now_ms)
        out = self.forward(values, mask)
        return out["observation"], adapter.health(now_ms), values


@dataclass
class GroundedTransitionV50:
    step: int
    horizon: int
    latent_error: float
    uncertainty: float
    reward_error: float
    risk_error: float
    inverse_action_error: float
    state_alignment_error: float
    used_for_update: bool
    planned_horizon: int = 1


class NeuroWeaveV50(NeuroWeaveV48):
    """V50: unified brain with a state-aligned, horizon-calibrated grounded world model."""

    def __init__(self, cfg: Optional[V50Config] = None):
        # Bypass V49's extra world model: V48 supplies the fast policy/identity substrate;
        # V50 owns the only predictive world model used for action refinement.
        NeuroWeaveV48.__init__(self, cfg or V50Config())
        self.cfg: V50Config
        self.world_model_v50 = StateAlignedLatentWorldModelV50(
            latent_dim=self.cfg.latent_dim_v46,
            action_dim=self.cfg.action_dim,
            goal_latent_dim=self.cfg.latent_dim_v46,
            observation_dim=self.cfg.raw_observation_dim,
            hidden=self.cfg.world_hidden_v50,
            uncertainty_min=self.cfg.world_uncertainty_min_v50,
            uncertainty_max=self.cfg.world_uncertainty_max_v50,
        )
        self.world_planner_v50 = StateAlignedPlannerV50(self.cfg)
        self.world_gate_v50 = WorldModelAdmissionGateV50(self.cfg.world_admission_margin_v50)
        self.sensor_fusion_v50 = SensorFusionEncoderV50(
            self.cfg.sensor_fusion_feature_dim_v50,
            output_dim=self.cfg.raw_observation_dim,
            hidden=self.cfg.sensor_fusion_hidden_v50,
        )

    def create_memory(self) -> ComplementaryMemoryV49:
        episodic = EpisodicMemoryV48(
            capacity=self.cfg.memory_capacity_v46,
            top_k=max(self.cfg.memory_top_k_v46, 2),
            similarity_temperature=self.cfg.memory_similarity_temperature_v46,
            utility_temperature=self.cfg.memory_utility_temperature_v46,
        )
        return ComplementaryMemoryV49(
            episodic=episodic,
            capacity=self.cfg.semantic_capacity_v49,
            top_k=self.cfg.semantic_top_k_v49,
            recurrence_threshold=self.cfg.semantic_recurrence_threshold_v49,
            similarity_threshold=self.cfg.semantic_similarity_threshold_v49,
            confidence_threshold=self.cfg.semantic_confidence_threshold_v49,
            reliability_threshold=self.cfg.semantic_reliability_threshold_v49,
            semantic_blend=self.cfg.semantic_blend_v49,
            consolidation_lr=self.cfg.semantic_consolidation_lr_v49,
            contradiction_penalty=self.cfg.semantic_contradiction_penalty_v49,
            min_cluster_variance=self.cfg.semantic_min_cluster_variance_v49,
            action_coherence_threshold=self.cfg.semantic_action_coherence_threshold_v49,
        )

    @torch.no_grad()
    def step(self, x: Tensor, state: V47BrainState, goal=None,
             memory: Optional[Any] = None, horizon_calibration: Optional[HorizonCalibratedUncertaintyV50] = None,
             **kwargs):
        if horizon_calibration is None:
            horizon_calibration = HorizonCalibratedUncertaintyV50(
                self.cfg.world_ready_observations_v50,
                max_gap=0.30,
                decay=self.cfg.world_horizon_decay_v50,
                target_growth=self.cfg.world_uncertainty_growth_target_v50,
            )
        out48, state48 = NeuroWeaveV48.step(self, x, state, goal=goal, memory=memory, **kwargs)
        current = out48["brain_current_latent_v47"]
        subgoal = out48["brain_subgoal_v47"]
        baseline = out48["chosen_action_v48"]
        proposed, meta = self.world_planner_v50.select(
            self.world_model_v50, current, subgoal, baseline, horizon_calibration,
        )
        h = int(meta["world50_horizon"][0, 0].item())
        base_seq = baseline.unsqueeze(1).expand(-1, h, -1)
        base_pred = self.world_model_v50.rollout(current, base_seq, subgoal)
        base_score = (
            -(1.0 - F.cosine_similarity(base_pred["latents"][:, -1], subgoal, dim=-1))
            + 0.05 * base_pred["rewards"].mean(1).squeeze(-1)
            - 0.16 * base_pred["risks"].mean(1).squeeze(-1)
            - 0.08 * base_pred["horizon_uncertainty"].mean(1).squeeze(-1)
        )
        final, accepted = self.world_gate_v50.select(
            proposed, meta["world50_score"], baseline, base_score.unsqueeze(-1), horizon_calibration, h,
        )
        out = dict(out48)
        out.update(meta)
        out.update({
            "world50_base_score": base_score.unsqueeze(-1),
            "world50_admission": accepted,
            "world50_ready": x.new_full((x.size(0), 1), 1.0 if horizon_calibration.calibrated(h) else 0.0),
            "world50_max_calibrated_horizon": x.new_full((x.size(0), 1), float(horizon_calibration.max_calibrated_horizon())),
            "chosen_action_v50": final,
        })
        return out, state48

    def training_loss(self, out: Dict[str, Tensor], target_sequence=None,
                      reward_sequence=None, risk_sequence=None, **kwargs) -> Tensor:
        base = NeuroWeaveV48.training_loss(self, out, target_sequence, reward_sequence, risk_sequence, **kwargs)
        obs = out["input_observation_v48"]
        if obs.size(1) < 2:
            return base
        goals = out["goal_sequence_v48"]
        current_latent = out["brain_current_latent_v47"][:, :-1].detach()
        actual_actions = out["chosen_action_v48"][:, :-1].detach()
        subgoals = out["brain_subgoal_v47"][:, :-1].detach()
        flat_next_obs = obs[:, 1:].reshape(-1, obs.size(-1))
        flat_next_goal = goals[:, 1:].reshape(-1, goals.size(-1))
        with torch.no_grad():
            target_latent_seq = _norm(self.target47(torch.cat([flat_next_obs, flat_next_goal], -1))).reshape(current_latent.size(0), current_latent.size(1), -1)
        hidden = self.world_model_v50.initial_hidden(current_latent.size(0), current_latent.device, current_latent.dtype)
        one_step_losses: List[Tensor] = []
        nll_losses: List[Tensor] = []
        inverse_losses: List[Tensor] = []
        align_losses: List[Tensor] = []
        rewards: List[Tensor] = []
        risks: List[Tensor] = []
        pred_latents: List[Tensor] = []
        for t in range(current_latent.size(1)):
            w = self.world_model_v50.step(current_latent[:, t], actual_actions[:, t], subgoals[:, t], hidden, horizon=1)
            hidden = w["hidden"]
            target = target_latent_seq[:, t]
            pred_latents.append(w["next_latent"])
            err = 1.0 - F.cosine_similarity(w["next_latent"], target, dim=-1)
            one_step_losses.append(err.mean())
            var = w["scale"].pow(2).clamp_min(1e-4)
            diff2 = (w["next_latent"] - target.detach()).pow(2)
            nll_losses.append((diff2 / var + torch.log(var)).mean())
            inverse_losses.append(F.smooth_l1_loss(w["inverse_action"], actual_actions[:, t]))
            target_delta = obs[:, t + 1] - obs[:, t]
            align_losses.append(F.smooth_l1_loss(w["state_delta"], target_delta))
            if reward_sequence is not None:
                rr = reward_sequence[:, t]
                if rr.ndim == 1: rr = rr.unsqueeze(-1)
                rewards.append(F.smooth_l1_loss(w["reward"], rr))
            if risk_sequence is not None:
                rk = risk_sequence[:, t]
                if rk.ndim == 1: rk = rk.unsqueeze(-1)
                risks.append(F.binary_cross_entropy(w["risk"].clamp(1e-5, 1 - 1e-5), rk.float().clamp(0, 1)))
        latent_loss = torch.stack(one_step_losses).mean()
        nll_loss = torch.stack(nll_losses).mean()
        inverse_loss = torch.stack(inverse_losses).mean()
        align_loss = torch.stack(align_losses).mean()
        reward_loss = torch.stack(rewards).mean() if rewards else current_latent.new_tensor(0.0)
        risk_loss = torch.stack(risks).mean() if risks else current_latent.new_tensor(0.0)
        horizon_loss = current_latent.new_tensor(0.0)
        horizon = min(max(2, int(self.cfg.world_horizon_train_v50)), current_latent.size(1))
        if horizon >= 2:
            seq_actions = actual_actions[:, :horizon]
            seq_goals = subgoals[:, 0]
            rollout = self.world_model_v50.rollout(current_latent[:, 0], seq_actions, seq_goals)
            target_roll = target_latent_seq[:, :horizon]
            weights = torch.linspace(1.0, 1.0 + float(self.cfg.world_uncertainty_growth_target_v50), horizon, device=obs.device, dtype=obs.dtype)
            errors = 1.0 - F.cosine_similarity(rollout["latents"][:, 1:], target_roll, dim=-1)
            horizon_loss = (errors * weights).mean()
        return base + (
            self.cfg.world_latent_weight_v50 * latent_loss
            + self.cfg.world_nll_weight_v50 * nll_loss
            + self.cfg.world_inverse_weight_v50 * inverse_loss
            + self.cfg.world_state_align_weight_v50 * align_loss
            + self.cfg.world_horizon_consistency_weight_v50 * horizon_loss
            + self.cfg.world_reward_weight_v50 * reward_loss
            + self.cfg.world_risk_weight_v50 * risk_loss
        )


class OrganismRuntimeV50:
    """Long-lived V50 runtime with grounded recurrent model and calibrated planning."""

    def __init__(self, model: NeuroWeaveV50, trainer: Optional["OrganismTrainerV50"] = None):
        self.model = model
        self.trainer = trainer
        self.memory = model.create_memory()
        self.state = model.initial_state(1)
        self.horizon_calibration = HorizonCalibratedUncertaintyV50(
            min_observations=model.cfg.world_ready_observations_v50,
            max_gap=0.30,
            decay=model.cfg.world_horizon_decay_v50,
            target_growth=model.cfg.world_uncertainty_growth_target_v50,
        )
        self._world_hidden = model.world_model_v50.initial_hidden(1)
        self._pending_world_hidden = self._world_hidden.clone()
        self.transition_evidence: List[GroundedTransitionV50] = []
        self.events: List[Dict[str, Any]] = []
        self._pending_observation: Optional[Tensor] = None
        self._pending_goal: Optional[Tensor] = None
        self._pending_latent: Optional[Tensor] = None
        self._pending_subgoal: Optional[Tensor] = None
        self._pending_action: Optional[Tensor] = None
        self._pending_step: Optional[int] = None
        self._pending_predicted_reward: Optional[float] = None
        self._pending_predicted_risk: Optional[float] = None
        self._pending_uncertainty: Optional[float] = None
        self.telemetry = PhoneTelemetryAdapterV48()

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        observation = _as_batch(observation)
        out, next_state = self.model.step(
            observation, self.state, goal=goal, memory=self.memory,
            horizon_calibration=self.horizon_calibration,
        )
        self.state = next_state
        self._pending_observation = observation.detach().cpu()
        self._pending_goal = self.model._goal47(goal, observation)[0].detach().cpu()
        self._pending_latent = out["brain_current_latent_v47"][0].detach().cpu()
        self._pending_subgoal = out["brain_subgoal_v47"][0].detach().cpu()
        self._pending_action = out["chosen_action_v50"][0].detach().cpu()
        self._pending_step = int(self.state.step_index)
        self._pending_predicted_reward = float(out["brain_predicted_reward_v47"].mean().item())
        self._pending_predicted_risk = float(out["brain_predicted_risk_v47"].mean().item())
        self._pending_uncertainty = float(out["world50_uncertainty"].mean().item())
        self._pending_world_hidden = self._world_hidden.detach().clone()
        pred = self.model.world_model_v50.step(
            self._pending_latent.to(observation),
            self._pending_action.to(observation),
            self._pending_subgoal.to(observation),
            self._pending_world_hidden.to(observation),
            horizon=int(out["world50_horizon"][0, 0].item()),
        )
        self._world_hidden = pred["hidden"].detach()
        self.events.append({
            "step": self._pending_step,
            "action": self._pending_action.tolist(),
            "horizon": float(out["world50_horizon"].mean().item()),
            "admission": float(out["world50_admission"].mean().item()),
            "uncertainty": self._pending_uncertainty,
        })
        self.events = self.events[-256:]
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float,
                           actual_risk: float, goal: Optional[Tensor] = None,
                           update_world_model: bool = True) -> Dict[str, float]:
        if self._pending_latent is None or self._pending_action is None or self._pending_step is None:
            raise RuntimeError("observe_transition requires a prior step()")
        next_observation = _as_batch(next_observation)
        next_goal = self.model._goal47(goal, next_observation)
        target = _norm(self.model.target47(torch.cat([next_observation, next_goal], -1)))
        planned_horizon = int(max(1, round(self.events[-1].get("horizon", 1)))) if self.events else 1
        observed_horizon = 1
        pred = self.model.world_model_v50.step(
            self._pending_latent.to(next_observation),
            self._pending_action.to(next_observation),
            self._pending_subgoal.to(next_observation),
            self._pending_world_hidden.to(next_observation),
            horizon=observed_horizon,
        )
        latent_error = float((1.0 - F.cosine_similarity(pred["next_latent"], target, dim=-1)).mean().item())
        uncertainty = float(pred["horizon_uncertainty"].mean().item())
        reward_error = abs(float(pred["reward"].mean().item()) - float(actual_reward))
        risk_error = abs(float(pred["risk"].mean().item()) - float(actual_risk))
        with torch.no_grad():
            if self._pending_observation is not None:
                obs_delta = next_observation.cpu()[0] - self._pending_observation[0]
                state_alignment_error = float(F.smooth_l1_loss(pred["state_delta"].cpu()[0], obs_delta).item())
            else:
                state_alignment_error = 0.0
            inverse_error = float(F.smooth_l1_loss(pred["inverse_action"].cpu()[0], self._pending_action).item())
        used = False
        if update_world_model and self.trainer is not None:
            for _ in range(max(1, int(self.model.cfg.online_world_updates_per_feedback_v50))):
                self.trainer.online_world_update(
                    self._pending_latent.to(next_observation),
                    self._pending_action.to(next_observation),
                    self._pending_subgoal.to(next_observation),
                    target,
                    actual_next_observation=next_observation,
                    current_observation=self._pending_observation.to(next_observation) if self._pending_observation is not None else None,
                    next_reward=float(actual_reward),
                    next_risk=float(actual_risk),
                    hidden=self._pending_world_hidden.to(next_observation),
                    horizon=observed_horizon,
                )
            used = True
            pred2 = self.model.world_model_v50.step(
                self._pending_latent.to(next_observation),
                self._pending_action.to(next_observation),
                self._pending_subgoal.to(next_observation),
                self._pending_world_hidden.to(next_observation),
                horizon=observed_horizon,
            )
            self._world_hidden = pred2["hidden"].detach()
            latent_error = float((1.0 - F.cosine_similarity(pred2["next_latent"], target, dim=-1)).mean().item())
            uncertainty = float(pred2["horizon_uncertainty"].mean().item())
            reward_error = abs(float(pred2["reward"].mean().item()) - float(actual_reward))
            risk_error = abs(float(pred2["risk"].mean().item()) - float(actual_risk))
            state_alignment_error = float(F.smooth_l1_loss(pred2["state_delta"], (next_observation - self._pending_observation.to(next_observation)).to(pred2["state_delta"])).item()) if self._pending_observation is not None else state_alignment_error
            inverse_error = float(F.smooth_l1_loss(pred2["inverse_action"], self._pending_action.to(pred2["inverse_action"]).reshape(1, -1)).item())
        self.horizon_calibration.update(observed_horizon, latent_error, uncertainty)
        utility = float(actual_reward) - 0.5 * float(actual_risk)
        signature = torch.cat([self._pending_observation[0], self._pending_goal], -1)
        factors = torch.tensor([
            min(2.0, latent_error), 0.5, max(-1.0, min(1.0, utility)), 0.5,
            max(-1.0, min(1.0, utility)), max(0.0, min(1.0, 1.0 - min(1.0, latent_error))), 1.0,
        ])
        self.memory.add(
            signature, self._pending_action, reward=utility, factors=factors,
            step_id=self._pending_step, risk=float(actual_risk), prediction_error=latent_error,
            semantic_key=torch.cat([
                float(self.model.cfg.semantic_key_latent_weight_v49) * self._pending_latent,
                float(self.model.cfg.semantic_key_goal_weight_v49) * self._pending_goal,
            ]),
        )
        self.memory.update_utility(signature, utility,
                                   lr=self.model.cfg.memory_reliability_lr_v48,
                                   decay=self.model.cfg.memory_utility_decay_v46,
                                   reliability=float(factors[5].item()))
        self.memory.maybe_consolidate(self._pending_step)
        self.transition_evidence.append(GroundedTransitionV50(
            step=self._pending_step,
            horizon=observed_horizon,
            latent_error=latent_error,
            uncertainty=uncertainty,
            reward_error=reward_error,
            risk_error=risk_error,
            inverse_action_error=inverse_error,
            state_alignment_error=state_alignment_error,
            used_for_update=used,
            planned_horizon=planned_horizon,
        ))
        self.transition_evidence = self.transition_evidence[-256:]
        return {
            "latent_error": latent_error,
            "uncertainty": uncertainty,
            "reward_error": reward_error,
            "risk_error": risk_error,
            "inverse_action_error": inverse_error,
            "state_alignment_error": state_alignment_error,
            "world50_planned_horizon": float(planned_horizon),
            "world50_observed_horizon": float(observed_horizon),
            "world50_max_calibrated_horizon": float(self.horizon_calibration.max_calibrated_horizon()),
            "world50_ready": float(self.horizon_calibration.calibrated(observed_horizon)),
            "semantic_items": float(len(self.memory.prototypes)),
        }

    @torch.no_grad()
    def step_sensor_frame(self, frame: SensorFrameV48 | Dict[str, Any], goal: Optional[Tensor] = None,
                          now_ms: Optional[int] = None) -> Dict[str, Tensor]:
        self.telemetry.ingest(frame)
        observation, health, raw = self.model.sensor_fusion_v50.encode_frame(self.telemetry, now_ms)
        out = self.step(observation, goal=goal)
        out["sensor_health_fraction"] = observation.new_tensor([[health.complete_fraction]])
        out["sensor_fresh_fraction"] = observation.new_tensor([[health.fresh_fraction]])
        return out

    def state_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state.state_dict(),
            "memory": self.memory.state_dict(),
            "horizon_calibration": self.horizon_calibration.state_dict(),
            "world_hidden": self._world_hidden,
            "pending_world_hidden": self._pending_world_hidden,
            "transition_evidence": [asdict(e) for e in self.transition_evidence],
            "events": copy.deepcopy(self.events),
            "pending_observation": self._pending_observation,
            "pending_goal": self._pending_goal,
            "pending_latent": self._pending_latent,
            "pending_subgoal": self._pending_subgoal,
            "pending_action": self._pending_action,
            "pending_step": self._pending_step,
            "pending_predicted_reward": self._pending_predicted_reward,
            "pending_predicted_risk": self._pending_predicted_risk,
            "pending_uncertainty": self._pending_uncertainty,
            "telemetry": self.telemetry.state_dict(),
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        raw = state.get("state") or {}
        self.state = V47BrainState(
            base=raw.get("base_obj", self.model.initial_state(1).base),
            fast_hidden=raw.get("fast_hidden", self.model.brain47.initial_fast(1)),
            slow_hidden=raw.get("slow_hidden", self.model.brain47.initial_slow(1)),
            workspace=raw.get("workspace", self.model.brain47.initial_workspace(1)),
            last_action=raw.get("last_action", torch.zeros(1, self.model.cfg.action_dim)),
            step_index=int(raw.get("step_index", 0)),
        )
        if state.get("memory") is not None:
            self.memory.load_state_dict(state["memory"])
        if state.get("horizon_calibration") is not None:
            self.horizon_calibration.load_state_dict(state["horizon_calibration"])
        self._world_hidden = state.get("world_hidden", self.model.world_model_v50.initial_hidden(1))
        self._pending_world_hidden = state.get("pending_world_hidden", self._world_hidden.clone())
        self.transition_evidence = [GroundedTransitionV50(**x) for x in state.get("transition_evidence", [])][-256:]
        self.events = list(state.get("events", []))[-256:]
        for name in (
            "_pending_observation", "_pending_goal", "_pending_latent", "_pending_subgoal",
            "_pending_action", "_pending_step", "_pending_predicted_reward",
            "_pending_predicted_risk", "_pending_uncertainty",
        ):
            setattr(self, name, state.get(name))
        if state.get("telemetry") is not None:
            self.telemetry.load_state_dict(state["telemetry"])


class OrganismTrainerV50(OrganismTrainerV48):
    def __init__(self, model: NeuroWeaveV50, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV50
        self.world_optimizer_v50 = torch.optim.Adam(
            self.model.world_model_v50.parameters(), lr=self.model.cfg.world_learning_rate_v50
        )
        self.sensor_optimizer_v50 = torch.optim.Adam(
            self.model.sensor_fusion_v50.parameters(), lr=lr
        )
        self.world_update_steps_v50 = 0
        self.sensor_update_steps_v50 = 0

    def online_world_update(self, current_latent: Tensor, action: Tensor,
                            subgoal_latent: Tensor, target_latent: Tensor,
                            actual_next_observation: Optional[Tensor], next_reward: float,
                            next_risk: float, hidden: Optional[Tensor] = None,
                            current_observation: Optional[Tensor] = None,
                            horizon: int = 1) -> float:
        current_latent = _as_batch(current_latent)
        action = _as_batch(action)
        subgoal_latent = _as_batch(subgoal_latent)
        target_latent = _as_batch(target_latent)
        if hidden is None:
            hidden = self.model.world_model_v50.initial_hidden(current_latent.size(0), current_latent.device, current_latent.dtype)
        else:
            hidden = _as_batch(hidden).detach().to(device=current_latent.device, dtype=current_latent.dtype)
        pred = self.model.world_model_v50.step(current_latent, action, subgoal_latent, hidden, horizon=horizon)
        reward_target = torch.full_like(pred["reward"], float(next_reward))
        risk_target = torch.full_like(pred["risk"], float(next_risk)).clamp(0.0, 1.0)
        latent_err = 1.0 - F.cosine_similarity(pred["next_latent"], target_latent.detach(), dim=-1)
        var = pred["scale"].pow(2).clamp_min(1e-4)
        nll = ((pred["next_latent"] - target_latent.detach()).pow(2) / var + torch.log(var)).mean()
        inv = F.smooth_l1_loss(pred["inverse_action"], action)
        align = torch.zeros((), device=current_latent.device, dtype=current_latent.dtype)
        if actual_next_observation is not None:
            actual_next_observation = _as_batch(actual_next_observation).to(current_latent)
            if current_observation is not None:
                current_observation = _as_batch(current_observation).to(current_latent)
                align_target = actual_next_observation - current_observation
            else:
                align_target = actual_next_observation
            align = F.smooth_l1_loss(pred["state_delta"], align_target)
        reward_loss = F.smooth_l1_loss(pred["reward"], reward_target)
        risk_loss = F.binary_cross_entropy(pred["risk"].clamp(1e-5, 1 - 1e-5), risk_target)
        loss = (
            self.model.cfg.world_latent_weight_v50 * latent_err.mean()
            + self.model.cfg.world_nll_weight_v50 * nll
            + self.model.cfg.world_inverse_weight_v50 * inv
            + self.model.cfg.world_state_align_weight_v50 * align
            + self.model.cfg.world_reward_weight_v50 * reward_loss
            + self.model.cfg.world_risk_weight_v50 * risk_loss
        )
        self.world_optimizer_v50.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.world_model_v50.parameters(), 1.0)
        self.world_optimizer_v50.step()
        self.world_update_steps_v50 += 1
        return float(loss.detach().item())

    @torch.no_grad()
    def calibrate_horizons(self, current_latent: Tensor, actions: Tensor,
                           subgoals: Tensor, target_latents: Tensor,
                           calibrator: Optional[HorizonCalibratedUncertaintyV50] = None,
                           max_horizon: Optional[int] = None) -> Dict[str, float]:
        """Ground horizon bins from real multi-step sequences before deployment.

        Each (start, horizon) is compared against an observed target trajectory.
        This keeps one-step feedback from masquerading as multi-step evidence.
        """
        calibrator = calibrator or HorizonCalibratedUncertaintyV50(
            min_observations=self.model.cfg.world_ready_observations_v50,
            max_gap=0.30, decay=self.model.cfg.world_horizon_decay_v50,
            target_growth=self.model.cfg.world_uncertainty_growth_target_v50,
        )
        current_latent = current_latent if current_latent.ndim == 3 else current_latent.unsqueeze(1)
        actions = actions if actions.ndim == 3 else actions.unsqueeze(1)
        subgoals = subgoals if subgoals.ndim == 3 else subgoals.unsqueeze(1)
        target_latents = target_latents if target_latents.ndim == 3 else target_latents.unsqueeze(1)
        horizon_limit = min(
            int(max_horizon or self.model.cfg.world_rollout_horizon_v50),
            actions.size(1),
            target_latents.size(1),
        )
        max_starts = max(1, int(self.model.cfg.horizon_calibration_max_starts_v50))
        total_updates = 0
        for h in range(1, horizon_limit + 1):
            starts = min(max_starts, max(1, actions.size(1) - h + 1))
            for start in range(starts):
                rollout = self.model.world_model_v50.rollout(
                    current_latent[:, start],
                    actions[:, start:start + h],
                    subgoals[:, start],
                )
                errors = 1.0 - F.cosine_similarity(
                    rollout["latents"][:, 1:], target_latents[:, start:start + h], dim=-1
                )
                err = float(errors.mean().item())
                unc = float(rollout["horizon_uncertainty"][:, -1].mean().item())
                calibrator.update(h, err, unc)
                total_updates += 1
        return {
            **calibrator.summary(),
            "calibration_updates": float(total_updates),
        }

    def train_sensor_batch(self, values: Tensor, mask: Tensor, target_values: Optional[Tensor] = None) -> float:
        """Train the real-sensor ingress as a masked denoising autoencoder.

        The augmentation drops a bounded subset of currently-valid channels; the
        target remains the original observed values. A latent consistency term
        discourages the phone representation from changing drastically when one
        sensor temporarily disappears. No missing channel is fabricated at runtime.
        """
        values = _as_batch(values)
        mask = _as_batch(mask).float().clamp(0.0, 1.0)
        target = values if target_values is None else _as_batch(target_values)
        clean = self.model.sensor_fusion_v50(values, mask)
        drop_p = float(min(0.95, max(0.0, self.model.cfg.sensor_fusion_mask_dropout_v50)))
        keep = (torch.rand_like(mask) > drop_p).to(mask.dtype)
        augmented_mask = mask * keep
        augmented_values = values * augmented_mask
        noisy = self.model.sensor_fusion_v50(augmented_values, augmented_mask)
        valid = mask
        denom = valid.sum().clamp_min(1.0)
        recon = ((noisy["reconstruction"] - target.detach()).abs() * valid).sum() / denom
        consistency = 1.0 - F.cosine_similarity(clean["observation"], noisy["observation"], dim=-1).mean()
        loss = (
            self.model.cfg.sensor_fusion_reconstruction_weight_v50 * recon
            + self.model.cfg.sensor_fusion_consistency_weight_v50 * consistency
        )
        self.sensor_optimizer_v50.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.sensor_fusion_v50.parameters(), 1.0)
        self.sensor_optimizer_v50.step()
        self.sensor_update_steps_v50 += 1
        return float(loss.detach().item())

    def step(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        result = super().step(x, goal_sequence, target_sequence, reward_sequence, risk_sequence, **kwargs)
        self.last_update_report.update({
            "v50_world_parameters": sum(p.numel() for p in self.model.world_model_v50.parameters() if p.requires_grad),
            "v50_sensor_parameters": sum(p.numel() for p in self.model.sensor_fusion_v50.parameters() if p.requires_grad),
            "v50_world_update_steps": self.world_update_steps_v50,
            "v50_sensor_update_steps": self.sensor_update_steps_v50,
        })
        return result


class RuntimeStateStoreV50(RuntimeStateStoreV48):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV50, trainer: Optional[OrganismTrainerV50] = None,
             runtime: Optional[OrganismRuntimeV50] = None) -> None:
        RuntimeStateStoreV48.save(path, model, trainer, None)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["v50"] = {
            "world_model": model.world_model_v50.state_dict(),
            "world_optimizer": trainer.world_optimizer_v50.state_dict() if trainer is not None else None,
            "world_update_steps": trainer.world_update_steps_v50 if trainer is not None else 0,
            "sensor_fusion": model.sensor_fusion_v50.state_dict(),
            "sensor_optimizer": trainer.sensor_optimizer_v50.state_dict() if trainer is not None else None,
            "sensor_update_steps": trainer.sensor_update_steps_v50 if trainer is not None else 0,
            "runtime": runtime.state_dict() if runtime is not None else None,
        }
        payload["version_v50"] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV50, trainer: Optional[OrganismTrainerV50] = None,
             runtime: Optional[OrganismRuntimeV50] = None, device=None) -> Dict[str, Any]:
        payload = RuntimeStateStoreV48.load(path, model, trainer, None, device=device)
        v50 = payload.get("v50") or {}
        if v50.get("world_model") is not None:
            model.world_model_v50.load_state_dict(v50["world_model"])
        if v50.get("sensor_fusion") is not None:
            model.sensor_fusion_v50.load_state_dict(v50["sensor_fusion"])
        if trainer is not None:
            if v50.get("world_optimizer") is not None:
                trainer.world_optimizer_v50.load_state_dict(v50["world_optimizer"])
            if v50.get("sensor_optimizer") is not None:
                trainer.sensor_optimizer_v50.load_state_dict(v50["sensor_optimizer"])
            trainer.world_update_steps_v50 = int(v50.get("world_update_steps", 0))
            trainer.sensor_update_steps_v50 = int(v50.get("sensor_update_steps", 0))
        if runtime is not None and v50.get("runtime") is not None:
            runtime.load_state_dict(v50["runtime"])
        return payload


__all__ = [
    "V50Config", "mobile_v50_config", "StateAlignedLatentWorldModelV50",
    "HorizonBinV50", "HorizonCalibratedUncertaintyV50", "StateAlignedPlannerV50",
    "WorldModelAdmissionGateV50", "SensorFusionEncoderV50", "GroundedTransitionV50",
    "NeuroWeaveV50", "OrganismRuntimeV50", "OrganismTrainerV50", "RuntimeStateStoreV50",
]
