from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
import json
import math
import time

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v51 import (
    V51Config,
    mobile_v51_config,
    NeuroWeaveV51,
    OrganismRuntimeV51,
    OrganismTrainerV51,
    RuntimeStateStoreV51,
)


def _batch(x: Tensor) -> Tensor:
    return x.unsqueeze(0) if x.ndim == 1 else x


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return x / x.norm(dim=-1, keepdim=True).clamp_min(eps)


@dataclass
class V52Config(V51Config):
    """V52: stochastic latent companion + risk-sensitive selection + episode spine."""

    stochastic_modes_v52: int = 4
    stochastic_hidden_v52: int = 28
    stochastic_learning_rate_v52: float = 8e-4
    stochastic_target_temperature_v52: float = 0.12
    stochastic_diversity_weight_v52: float = 0.01
    stochastic_entropy_weight_v52: float = 0.005
    stochastic_min_observations_v52: int = 24
    stochastic_horizon_scale_v52: float = 0.35
    stochastic_runtime_blend_v52: float = 0.0
    stochastic_risk_quantile_v52: float = 0.80
    stochastic_candidate_count_v52: int = 3
    stochastic_candidate_noise_v52: float = 0.05
    stochastic_action_support_v52: float = 0.12
    stochastic_admission_margin_v52: float = 0.01
    stochastic_max_spread_v52: float = 0.45
    episode_flush_every_v52: int = 32
    runtime_state_version_v52: int = 1


def mobile_v52_config(raw_observation_dim: int = 9) -> V52Config:
    base = dict(mobile_v51_config(raw_observation_dim).__dict__)
    return V52Config(
        **base,
        stochastic_modes_v52=3,
        stochastic_hidden_v52=24,
        stochastic_learning_rate_v52=8e-4,
        stochastic_target_temperature_v52=0.12,
        stochastic_diversity_weight_v52=0.01,
        stochastic_entropy_weight_v52=0.005,
        stochastic_min_observations_v52=24,
        stochastic_horizon_scale_v52=0.35,
        stochastic_runtime_blend_v52=0.0,
        stochastic_risk_quantile_v52=0.80,
        stochastic_candidate_count_v52=2,
        stochastic_candidate_noise_v52=0.045,
        stochastic_action_support_v52=0.10,
        stochastic_admission_margin_v52=0.01,
        stochastic_max_spread_v52=0.45,
        episode_flush_every_v52=32,
        runtime_state_version_v52=1,
    )


class StochasticLatentDynamicsV52(nn.Module):
    """Compact multimodal latent companion inspired by categorical/RSSM world models.

    It keeps K next-state hypotheses rather than collapsing uncertainty into one scalar.
    The production V50/V51 path remains authoritative until this branch proves utility.
    """

    def __init__(self, latent_dim: int, action_dim: int, goal_dim: int,
                 modes: int = 4, hidden: int = 28):
        super().__init__()
        if modes < 2:
            raise ValueError("stochastic_modes_v52 must be >= 2")
        self.latent_dim = int(latent_dim)
        self.action_dim = int(action_dim)
        self.goal_dim = int(goal_dim)
        self.modes = int(modes)
        self.hidden = int(hidden)
        self.trunk = nn.Sequential(
            nn.Linear(latent_dim + action_dim + goal_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
        )
        self.mode_logits = nn.Linear(hidden, modes)
        self.mode_delta = nn.Linear(hidden, modes * latent_dim)
        self.mode_scale = nn.Linear(hidden, modes)

    def forward(self, latent: Tensor, action: Tensor, goal: Tensor, horizon: int = 1) -> Dict[str, Tensor]:
        latent = _batch(latent)
        action = _batch(action)
        goal = _batch(goal)
        h = self.trunk(torch.cat([latent, action, goal], dim=-1))
        logits = self.mode_logits(h)
        probs = torch.softmax(logits, dim=-1)
        delta = torch.tanh(self.mode_delta(h).view(-1, self.modes, self.latent_dim))
        modes = _norm(latent[:, None, :] + 0.5 * delta)
        scale = F.softplus(self.mode_scale(h)) + 0.02
        spread = torch.sqrt(((modes - (probs[..., None] * modes).sum(1, keepdim=True)) ** 2).mean((1, 2)) + 1e-6)
        hscale = 1.0 + float(max(0, int(horizon) - 1)) * 0.10
        uncertainty = (spread + scale.mean(-1) * 0.10) * hscale
        expected = _norm((probs[..., None] * modes).sum(1))
        return {
            "mode_logits": logits,
            "mode_probs": probs,
            "modes": modes,
            "scale": scale,
            "expected_latent": expected,
            "spread": spread,
            "uncertainty": uncertainty,
        }

    @torch.no_grad()
    def predict(self, latent: Tensor, action: Tensor, goal: Tensor, horizon: int = 1) -> Dict[str, Tensor]:
        return self.forward(latent, action, goal, horizon=horizon)


@dataclass
class StochasticTrainingStatsV52:
    loss: float
    fit_loss: float
    diversity_loss: float
    entropy_loss: float
    observations: int
    mean_spread: float


class StochasticLatentTrainerV52:
    def __init__(self, model: StochasticLatentDynamicsV52, lr: float = 8e-4,
                 target_temperature: float = 0.12, diversity_weight: float = 0.01,
                 entropy_weight: float = 0.005):
        self.model = model
        self.temperature = float(max(0.02, target_temperature))
        self.diversity_weight = float(max(0.0, diversity_weight))
        self.entropy_weight = float(max(0.0, entropy_weight))
        self.optimizer = torch.optim.Adam(model.parameters(), lr=lr)
        self.observations = 0
        self.update_steps = 0

    def train_batch(self, latent: Tensor, action: Tensor, goal: Tensor, target_latent: Tensor,
                    horizon: int = 1) -> StochasticTrainingStatsV52:
        device = next(self.model.parameters()).device
        latent = _batch(latent).to(device)
        action = _batch(action).to(device)
        goal = _batch(goal).to(device)
        target_latent = _norm(_batch(target_latent)).to(device)
        out = self.model(latent, action, goal, horizon=horizon)
        target = target_latent[:, None, :].expand(-1, self.model.modes, -1)
        errors = 1.0 - F.cosine_similarity(out["modes"], target, dim=-1)
        responsibilities = torch.softmax(-errors.detach() / self.temperature, dim=-1)
        fit_loss = (responsibilities * errors).sum(-1).mean()
        probs = out["mode_probs"]
        entropy = -(probs * probs.clamp_min(1e-8).log()).sum(-1).mean()
        diversity = out["modes"].new_tensor(0.0)
        pair_count = 0
        for i in range(self.model.modes):
            for j in range(i + 1, self.model.modes):
                sim = F.cosine_similarity(out["modes"][:, i], out["modes"][:, j], dim=-1).mean()
                diversity = diversity + (sim + 1.0).clamp_min(0.0)
                pair_count += 1
        if pair_count:
            diversity = diversity / pair_count
        loss = fit_loss + self.diversity_weight * diversity + self.entropy_weight * entropy
        self.optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
        self.optimizer.step()
        self.observations += int(latent.size(0))
        self.update_steps += 1
        return StochasticTrainingStatsV52(
            loss=float(loss.detach().item()),
            fit_loss=float(fit_loss.detach().item()),
            diversity_loss=float(diversity.detach().item()),
            entropy_loss=float(entropy.detach().item()),
            observations=self.observations,
            mean_spread=float(out["spread"].detach().mean().item()),
        )




class StochasticParticleRolloutV52:
    """Bounded particle imagination over the stochastic latent companion.

    This keeps a fixed particle budget instead of expanding the full K-ary tree. Each
    step samples/propagates mode hypotheses and resamples the most relevant particles.
    """

    def __init__(self, model: StochasticLatentDynamicsV52, particle_count: int = 6,
                 resample_top_k: int = 4, temperature: float = 0.5):
        self.model = model
        self.particle_count = int(max(2, particle_count))
        self.resample_top_k = int(max(1, min(self.particle_count, resample_top_k)))
        self.temperature = float(max(0.05, temperature))

    @torch.no_grad()
    def rollout(self, start_latent: Tensor, actions: Tensor, goal_latent: Tensor) -> Dict[str, Tensor]:
        if actions.ndim != 3:
            raise ValueError("actions must be [B,H,A]")
        if start_latent.ndim != 2 or goal_latent.ndim != 2:
            raise ValueError("start_latent and goal_latent must be [B,D]")
        b, h, _ = actions.shape
        # Deterministic first particle set, then maintain bounded population.
        particles = start_latent[:, None, :].expand(b, self.particle_count, -1).clone()
        weights = start_latent.new_full((b, self.particle_count), 1.0 / self.particle_count)
        particle_history = [particles]
        spread_history = []
        entropy_history = []
        for t in range(h):
            action = actions[:, t]
            flat_z = particles.reshape(b * self.particle_count, -1)
            flat_g = goal_latent[:, None, :].expand(-1, self.particle_count, -1).reshape(b * self.particle_count, -1)
            flat_a = action[:, None, :].expand(-1, self.particle_count, -1).reshape(b * self.particle_count, -1)
            out = self.model.predict(flat_z, flat_a, flat_g, horizon=t + 1)
            probs = out["mode_probs"].reshape(b, self.particle_count, self.model.modes)
            modes = out["modes"].reshape(b, self.particle_count, self.model.modes, -1)
            # Mode probabilities become particle importance; keep the most relevant modes.
            local_w = torch.softmax(probs.log().clamp_min(-20.0) / self.temperature, dim=-1)
            expanded = (weights[:, :, None] * local_w).reshape(b, -1)
            new_particles = modes.reshape(b, -1, modes.size(-1))
            k = min(self.resample_top_k, new_particles.size(1))
            top_w, idx = torch.topk(expanded, k=k, dim=1, largest=True)
            idx = idx.clamp_max(new_particles.size(1) - 1)
            gathered = torch.gather(new_particles, 1, idx[..., None].expand(-1, -1, new_particles.size(-1)))
            if k < self.particle_count:
                pad_idx = idx[:, :1].expand(-1, self.particle_count - k)
                pad = torch.gather(new_particles, 1, pad_idx[..., None].expand(-1, -1, new_particles.size(-1)))
                particles = torch.cat([gathered, pad], dim=1)
            else:
                particles = gathered
            weights = F.softmax(torch.log(top_w.clamp_min(1e-8)), dim=-1)
            if weights.size(1) < self.particle_count:
                weights = F.pad(weights, (0, self.particle_count - weights.size(1)), value=0.0)
            spread = torch.sqrt(((particles - (weights[..., None] * particles).sum(1, keepdim=True)) ** 2).mean((1, 2)) + 1e-6)
            ent = -(weights * weights.clamp_min(1e-8).log()).sum(-1)
            spread_history.append(spread)
            entropy_history.append(ent)
            particle_history.append(particles)
        return {
            "particles": torch.stack(particle_history, 1),
            "spread": torch.stack(spread_history, 1),
            "entropy": torch.stack(entropy_history, 1),
            "final_particles": particles,
            "final_weights": weights,
        }

class RiskSensitiveStochasticSelectorV52:
    """Uses stochastic modes as a risk envelope, never as an uncontrolled replacement."""

    def __init__(self, cfg: V52Config, stochastic: StochasticLatentDynamicsV52):
        self.cfg = cfg
        self.stochastic = stochastic
        self.observations = 0

    @torch.no_grad()
    def candidates(self, baseline: Tensor) -> Tensor:
        baseline = _batch(baseline)
        count = max(1, int(self.cfg.stochastic_candidate_count_v52))
        support = float(self.cfg.stochastic_action_support_v52)
        items = [baseline]
        for _ in range(count):
            local = baseline + torch.randn_like(baseline) * float(self.cfg.stochastic_candidate_noise_v52)
            local = (baseline + (local - baseline).clamp(-support, support)).clamp(-1.0, 1.0)
            items.append(local)
        return torch.cat(items, dim=0)

    @torch.no_grad()
    def select(self, current_latent: Tensor, goal_latent: Tensor, baseline: Tensor,
               horizon: int, trained: bool, risk_floor: float = 0.0) -> Tuple[Tensor, Dict[str, Tensor]]:
        baseline = _batch(baseline)
        if not trained:
            return baseline, {
                "stochastic52_accepted": baseline.new_zeros((1, 1)),
                "stochastic52_ready": baseline.new_zeros((1, 1)),
                "stochastic52_spread": baseline.new_zeros((1, 1)),
            }
        candidates = self.candidates(baseline)
        z = current_latent.repeat(candidates.size(0), 1)
        g = goal_latent.repeat(candidates.size(0), 1)
        out = self.stochastic.predict(z, candidates, g, horizon=horizon)
        endpoint = out["modes"]
        target = g[:, None, :]
        distance = 1.0 - F.cosine_similarity(endpoint, target, dim=-1)
        mode_utility = -distance
        risk_q = max(0.5, min(0.99, float(self.cfg.stochastic_risk_quantile_v52)))
        k = max(1, int(math.ceil(self.stochastic.modes * (1.0 - risk_q))))
        worst = torch.topk(mode_utility, k=k, largest=False, dim=-1).values.mean(-1)
        expected = (out["mode_probs"] * mode_utility).sum(-1)
        score = expected + 0.40 * worst - float(risk_floor) * out["uncertainty"]
        best = int(score.argmax().item())
        base_score = float(score[0].item())
        margin = float(score[best].item() - base_score)
        spread = float(out["spread"].max().item())
        accept = bool(best != 0 and margin > float(self.cfg.stochastic_admission_margin_v52)
                      and spread <= float(self.cfg.stochastic_max_spread_v52))
        chosen = candidates[best:best + 1] if accept else baseline
        self.observations += 1
        return chosen, {
            "stochastic52_accepted": baseline.new_tensor([[1.0 if accept else 0.0]]),
            "stochastic52_ready": baseline.new_tensor([[1.0]]),
            "stochastic52_margin": baseline.new_tensor([[margin]]),
            "stochastic52_spread": baseline.new_tensor([[spread]]),
            "stochastic52_expected": score[best].reshape(1, 1),
            "stochastic52_base_score": baseline.new_tensor([[base_score]]),
            "stochastic52_mode_entropy": (-out["mode_probs"] * out["mode_probs"].clamp_min(1e-8).log()).sum(-1).mean().reshape(1, 1),
        }


@dataclass
class EpisodeFrameV52:
    episode_index: int
    frame_index: int
    timestamp: float
    task_index: int
    observation: List[float]
    observation_mask: List[float]
    sensor_mask: List[float]
    action: List[float]
    reward: float
    risk: float
    done: bool
    sensor_health: float = 1.0
    model_confidence: float = 0.0


class EpisodeStoreV52:
    """Lightweight LeRobot-inspired episode store with no external dependency.

    The schema mirrors LeRobot's useful episode/frame separation (episode_index,
    frame_index, timestamp, task_index, observation/state, action, reward, done)
    while staying JSONL/mobile friendly. It is an adapter, not a claim of LeRobot
    format compatibility until exported through the explicit conversion method.
    """

    SCHEMA_VERSION = "v52.1"

    def __init__(self, path: Optional[str | Path] = None, flush_every: int = 32):
        self.path = Path(path) if path is not None else None
        self.flush_every = int(max(1, flush_every))
        self.frames: List[EpisodeFrameV52] = []
        self.count = 0
        if self.path is not None:
            self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, frame: EpisodeFrameV52) -> None:
        if len(frame.observation) != len(frame.observation_mask):
            raise ValueError("observation and observation_mask must have equal length")
        if not frame.sensor_mask:
            raise ValueError("sensor_mask must be preserved separately from fused observation mask")
        self.frames.append(frame)
        self.count += 1
        if self.path is not None and self.count % self.flush_every == 0:
            self.flush()

    def extend(self, frames: Sequence[EpisodeFrameV52]) -> None:
        for frame in frames:
            self.append(frame)

    def flush(self) -> None:
        if self.path is None or not self.frames:
            return
        with self.path.open("a", encoding="utf-8") as f:
            for frame in self.frames:
                f.write(json.dumps(asdict(frame), ensure_ascii=False, separators=(",", ":")) + "\n")
        self.frames.clear()

    def close(self) -> None:
        self.flush()

    @classmethod
    def from_jsonl(cls, path: str | Path) -> "EpisodeStoreV52":
        store = cls()
        p = Path(path)
        with p.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                obj = json.loads(line)
                store.append(EpisodeFrameV52(**obj))
        return store

    def metadata(self, fps: float, features: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "schema_version": self.SCHEMA_VERSION,
            "fps": float(fps),
            "frame_count": int(sum(1 for _ in self.iter_frames(include_buffer=True))),
            "episodes": sorted({int(x.episode_index) for x in self.iter_frames(include_buffer=True)}),
            "features": features,
        }

    def iter_frames(self, include_buffer: bool = True):
        if self.path is not None and self.path.exists():
            with self.path.open("r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        yield EpisodeFrameV52(**json.loads(line))
        if include_buffer:
            yield from self.frames

    def save_metadata(self, path: str | Path, fps: float, features: Dict[str, Any]) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.metadata(fps, features), ensure_ascii=False, indent=2), encoding="utf-8")


class NeuroWeaveV52(NeuroWeaveV51):
    """V52: V51 organism plus experimental stochastic predictive companion."""

    def __init__(self, cfg: Optional[V52Config] = None):
        super().__init__(cfg or V52Config())
        self.cfg: V52Config
        self.stochastic_world_v52 = StochasticLatentDynamicsV52(
            latent_dim=self.cfg.latent_dim_v46,
            action_dim=self.cfg.action_dim,
            goal_dim=self.cfg.latent_dim_v46,
            modes=self.cfg.stochastic_modes_v52,
            hidden=self.cfg.stochastic_hidden_v52,
        )
        self.stochastic_selector_v52 = RiskSensitiveStochasticSelectorV52(self.cfg, self.stochastic_world_v52)


class OrganismRuntimeV52(OrganismRuntimeV51):
    def __init__(self, model: NeuroWeaveV52, trainer: Optional["OrganismTrainerV52"] = None):
        super().__init__(model, trainer)
        self.model: NeuroWeaveV52 = model
        self.trainer = trainer
        self.episode_store_v52 = EpisodeStoreV52(flush_every=model.cfg.episode_flush_every_v52)
        self.last_timestamp_v52: Optional[float] = None
        self.episode_index_v52 = 0
        self.episode_frame_index_v52 = 0
        self.stochastic_decisions_v52 = 0
        self._last_sensor_mask_v52: Optional[Tensor] = None

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        current = out["brain_current_latent_v47"]
        subgoal = out["brain_subgoal_v47"]
        baseline = out["chosen_action_v51"]
        horizon = max(1, int(round(float(out.get("world50_horizon", observation.new_tensor([[2.0]])).mean().item()))))
        trained = bool(self.trainer is not None and self.trainer.stochastic_update_steps_v52 >= self.model.cfg.stochastic_min_observations_v52)
        selected, meta = self.model.stochastic_selector_v52.select(
            current, subgoal, baseline, horizon=horizon, trained=trained,
            risk_floor=float(out.get("world50_uncertainty", observation.new_zeros((1, 1))).mean().item()),
        )
        blend = float(self.model.cfg.stochastic_runtime_blend_v52)
        if meta.get("stochastic52_accepted") is not None:
            accepted = float(meta["stochastic52_accepted"].item()) > 0.5
            if accepted:
                self.stochastic_decisions_v52 += 1
        if blend <= 0.0:
            final = selected if trained and float(meta.get("stochastic52_accepted", observation.new_zeros((1,1))).item()) > 0.5 else baseline
        else:
            final = ((1.0 - blend) * baseline + blend * selected).clamp(-1.0, 1.0)
        out.update(meta)
        out["chosen_action_v52"] = final
        out["stochastic52_trained"] = observation.new_tensor([[1.0 if trained else 0.0]])
        self._pending_action = final[0].detach().cpu()
        if goal is None:
            goal = observation.new_zeros((1, self.model.cfg.goal_dim))
        self._pending_critic_features = {
            "latent": current.detach().cpu(),
            "goal": subgoal.detach().cpu(),
            "action": final.detach().cpu(),
            "reward_pred": out.get("brain_predicted_reward_v47", observation.new_zeros((1,1))).detach().cpu(),
            "risk_pred": out.get("brain_predicted_risk_v47", observation.new_zeros((1,1))).detach().cpu(),
            "uncertainty": out.get("world50_uncertainty", observation.new_zeros((1,1))).detach().cpu(),
            "sensor_health": observation.new_tensor([[self._sensor_health_v51]]).detach().cpu(),
        }
        return out

    @torch.no_grad()
    def step_sensor_frame(self, frame, goal: Optional[Tensor] = None, now_ms: Optional[int] = None):
        self.telemetry.ingest(frame)
        values, mask = self.telemetry.vector_and_mask(now_ms)
        self._last_sensor_mask_v52 = mask.detach().cpu().clone()
        belief = self.sensor_belief_v51.update(values, mask, now_ms)
        self._sensor_health_v51 = float(belief["health"].item())
        fused = self.model.sensor_fusion_v50(belief["values"].unsqueeze(0), mask)
        out = self.step(fused["observation"], goal=goal)
        out["sensor52_mean_confidence"] = belief["confidence"].mean().reshape(1, 1).to(out["chosen_action_v52"])
        out["sensor52_fresh_fraction"] = belief["freshness"].mean().reshape(1, 1).to(out["chosen_action_v52"])
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float,
                           actual_risk: float, goal: Optional[Tensor] = None,
                           update_world_model: bool = True) -> Dict[str, Any]:
        result = super().observe_transition(next_observation, actual_reward=actual_reward,
                                            actual_risk=actual_risk, goal=goal,
                                            update_world_model=update_world_model)
        if self._pending_critic_features is not None and self.trainer is not None:
            f = self._pending_critic_features
            target_latent = self.trainer.encode_target_v52(next_observation, goal)
            current_latent = f["latent"]
            horizon = 1
            stats = self.trainer.train_stochastic_transition_v52(
                current_latent, f["action"], f["goal"], target_latent, horizon=horizon
            )
            result["stochastic52_loss"] = stats.loss
            result["stochastic52_spread"] = stats.mean_spread
            result["stochastic52_observations"] = stats.observations
        obs_mask = self._last_sensor_mask_v52 if self._last_sensor_mask_v52 is not None and self._last_sensor_mask_v52.numel() == next_observation.numel() else next_observation.new_ones(next_observation.numel())
        self.episode_store_v52.append(EpisodeFrameV52(
            episode_index=self.episode_index_v52,
            frame_index=self.episode_frame_index_v52,
            timestamp=time.time(),
            task_index=0,
            observation=[float(x) for x in next_observation.reshape(-1).detach().cpu().tolist()],
            observation_mask=[1.0] * int(next_observation.numel()),
            sensor_mask=[float(x) for x in (self._last_sensor_mask_v52.reshape(-1) if self._last_sensor_mask_v52 is not None else next_observation.new_ones(self.model.cfg.sensor_fusion_feature_dim_v50)).detach().cpu().tolist()],
            action=[float(x) for x in self._pending_action.reshape(-1).tolist()] if self._pending_action is not None else [0.0] * self.model.cfg.action_dim,
            reward=float(actual_reward), risk=float(actual_risk), done=False,
            sensor_health=float(self._sensor_health_v51), model_confidence=float(result.get("confidence", 0.0) if isinstance(result.get("confidence"), (float, int)) else 0.0),
        ))
        self.episode_frame_index_v52 += 1
        return result

    def end_episode_v52(self) -> None:
        if self.episode_store_v52.path is not None:
            self.episode_store_v52.flush()
        self.episode_index_v52 += 1
        self.episode_frame_index_v52 = 0

    def state_dict(self):
        return {
            **super().state_dict(),
            "episode_index_v52": self.episode_index_v52,
            "episode_frame_index_v52": self.episode_frame_index_v52,
            "stochastic_decisions_v52": self.stochastic_decisions_v52,
            "last_timestamp_v52": self.last_timestamp_v52,
            "last_sensor_mask_v52": self._last_sensor_mask_v52,
        }

    def load_state_dict(self, state):
        super().load_state_dict(state)
        self.episode_index_v52 = int(state.get("episode_index_v52", 0))
        self.episode_frame_index_v52 = int(state.get("episode_frame_index_v52", 0))
        self.stochastic_decisions_v52 = int(state.get("stochastic_decisions_v52", 0))
        self.last_timestamp_v52 = state.get("last_timestamp_v52")
        self._last_sensor_mask_v52 = state.get("last_sensor_mask_v52")


class OrganismTrainerV52(OrganismTrainerV51):
    def __init__(self, model: NeuroWeaveV52, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV52 = model
        self.stochastic_trainer_v52 = StochasticLatentTrainerV52(
            self.model.stochastic_world_v52,
            lr=self.model.cfg.stochastic_learning_rate_v52,
            target_temperature=self.model.cfg.stochastic_target_temperature_v52,
            diversity_weight=self.model.cfg.stochastic_diversity_weight_v52,
            entropy_weight=self.model.cfg.stochastic_entropy_weight_v52,
        )
        self.stochastic_update_steps_v52 = 0

    @torch.no_grad()
    def encode_target_v52(self, observation: Tensor, goal: Optional[Tensor]) -> Tensor:
        device = next(self.model.parameters()).device
        obs = _batch(observation).to(device)
        if goal is None:
            goal = obs.new_zeros((obs.size(0), self.model.cfg.goal_dim))
        goal = _batch(goal).to(device)
        return _norm(self.model.target47(torch.cat([obs, goal], dim=-1)))

    def train_stochastic_transition_v52(self, latent: Tensor, action: Tensor, goal: Tensor,
                                         target_latent: Tensor, horizon: int = 1) -> StochasticTrainingStatsV52:
        stats = self.stochastic_trainer_v52.train_batch(latent, action, goal, target_latent, horizon=horizon)
        self.stochastic_update_steps_v52 += int(latent.reshape(-1, latent.size(-1)).size(0))
        return stats

    def step(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        return super().step(x, goal_sequence=goal_sequence, target_sequence=target_sequence,
                            reward_sequence=reward_sequence, risk_sequence=risk_sequence, **kwargs)


class RuntimeStateStoreV52(RuntimeStateStoreV51):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV52, trainer: Optional[OrganismTrainerV52] = None,
             runtime: Optional[OrganismRuntimeV52] = None):
        RuntimeStateStoreV51.save(path, model, trainer, runtime)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["v52"] = {
            "stochastic_world": model.stochastic_world_v52.state_dict(),
            "stochastic_optimizer": trainer.stochastic_trainer_v52.optimizer.state_dict() if trainer else None,
            "stochastic_observations": trainer.stochastic_trainer_v52.observations if trainer else 0,
            "stochastic_update_steps": trainer.stochastic_update_steps_v52 if trainer else 0,
        }
        payload["version_v52"] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV52, trainer: Optional[OrganismTrainerV52] = None,
             runtime: Optional[OrganismRuntimeV52] = None, device=None):
        payload = RuntimeStateStoreV51.load(path, model, trainer, runtime, device=device)
        v52 = payload.get("v52") or {}
        if v52.get("stochastic_world") is not None:
            model.stochastic_world_v52.load_state_dict(v52["stochastic_world"])
        if trainer is not None:
            if v52.get("stochastic_optimizer") is not None:
                trainer.stochastic_trainer_v52.optimizer.load_state_dict(v52["stochastic_optimizer"])
            trainer.stochastic_trainer_v52.observations = int(v52.get("stochastic_observations", 0))
            trainer.stochastic_update_steps_v52 = int(v52.get("stochastic_update_steps", 0))
        return payload


__all__ = [
    "V52Config", "mobile_v52_config", "StochasticLatentDynamicsV52", "StochasticTrainingStatsV52",
    "StochasticLatentTrainerV52", "StochasticParticleRolloutV52", "RiskSensitiveStochasticSelectorV52", "EpisodeFrameV52", "EpisodeStoreV52",
    "NeuroWeaveV52", "OrganismRuntimeV52", "OrganismTrainerV52", "RuntimeStateStoreV52",
]
