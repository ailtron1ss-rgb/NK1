from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
import copy
import json
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v53 import (
    V53Config, mobile_v53_config, NeuroWeaveV53, OrganismRuntimeV53,
    OrganismTrainerV53, RuntimeStateStoreV53,
)


def _batch(x: Tensor) -> Tensor:
    return x.unsqueeze(0) if x.ndim == 1 else x


def _finite(x: float, default: float = 0.0) -> float:
    x = float(x)
    return x if math.isfinite(x) else float(default)


def _spearman(x: Sequence[float], y: Sequence[float]) -> float:
    if len(x) != len(y) or len(x) < 2:
        return 0.0
    def rank(vals: Sequence[float]) -> List[float]:
        order = sorted(range(len(vals)), key=lambda i: (vals[i], i))
        out = [0.0] * len(vals)
        i = 0
        while i < len(order):
            j = i + 1
            while j < len(order) and vals[order[j]] == vals[order[i]]:
                j += 1
            r = 0.5 * (i + j - 1)
            for k in range(i, j):
                out[order[k]] = r
            i = j
        return out
    rx, ry = rank(x), rank(y)
    mx, my = sum(rx) / len(rx), sum(ry) / len(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    denx = math.sqrt(sum((a - mx) ** 2 for a in rx))
    deny = math.sqrt(sum((b - my) ** 2 for b in ry))
    return float(num / max(denx * deny, 1e-8))


@dataclass
class V54Config(V53Config):
    """V54: long-horizon counterfactual advantage and plan-real alignment."""

    trajectory_max_horizon_v54: int = 8
    trajectory_horizons_v54: Tuple[int, ...] = (1, 2, 4, 8)
    trajectory_hidden_v54: int = 32
    trajectory_learning_rate_v54: float = 7e-4
    trajectory_discount_v54: float = 0.95
    trajectory_min_pairs_v54: int = 24
    trajectory_train_updates_v54: int = 3
    trajectory_candidate_count_v54: int = 3
    trajectory_candidate_noise_v54: float = 0.045
    trajectory_action_support_v54: float = 0.12
    trajectory_uncertainty_penalty_v54: float = 0.12
    trajectory_admission_margin_v54: float = 0.008
    trajectory_max_uncertainty_v54: float = 0.55
    trajectory_min_rank_v54: float = 0.15
    trajectory_pair_capacity_v54: int = 320
    trajectory_rank_window_v54: int = 48
    trajectory_terminal_weight_v54: float = 0.25
    trajectory_value_weight_v54: float = 0.35
    trajectory_pair_weight_v54: float = 0.65
    trajectory_state_version_v54: int = 1
    trajectory_calibration_min_points_v54: int = 8
    trajectory_calibration_clip_v54: float = 1.5
    trajectory_cem_population_v54: int = 8
    trajectory_cem_elite_v54: int = 3
    trajectory_cem_iterations_v54: int = 2
    trajectory_path_cost_weight_v54: float = 0.15
    trajectory_cem_std_min_v54: float = 0.015


def mobile_v54_config(raw_observation_dim: int = 9) -> V54Config:
    base = dict(mobile_v53_config(raw_observation_dim).__dict__)
    return V54Config(
        **base,
        trajectory_max_horizon_v54=8,
        trajectory_horizons_v54=(1, 2, 4, 8),
        trajectory_hidden_v54=28,
        trajectory_learning_rate_v54=7e-4,
        trajectory_discount_v54=0.95,
        trajectory_min_pairs_v54=18,
        trajectory_train_updates_v54=3,
        trajectory_candidate_count_v54=2,
        trajectory_candidate_noise_v54=0.045,
        trajectory_action_support_v54=0.10,
        trajectory_uncertainty_penalty_v54=0.12,
        trajectory_admission_margin_v54=0.008,
        trajectory_max_uncertainty_v54=0.55,
        trajectory_min_rank_v54=0.15,
        trajectory_pair_capacity_v54=192,
        trajectory_rank_window_v54=48,
        trajectory_terminal_weight_v54=0.25,
        trajectory_value_weight_v54=0.35,
        trajectory_pair_weight_v54=0.65,
        trajectory_state_version_v54=1,
        trajectory_calibration_min_points_v54=8,
        trajectory_calibration_clip_v54=1.5,
        trajectory_cem_population_v54=8,
        trajectory_cem_elite_v54=3,
        trajectory_cem_iterations_v54=2,
        trajectory_path_cost_weight_v54=0.15,
        trajectory_cem_std_min_v54=0.015,
    )


@dataclass
class TrajectoryPairV54:
    pair_id: str
    latent: List[float]
    goal: List[float]
    baseline_actions: List[List[float]]
    candidate_actions: List[List[float]]
    baseline_return: float
    candidate_return: float
    baseline_terminal: float
    candidate_terminal: float
    uncertainty: float
    regime: float
    sensor_health: float
    horizon: int
    step: int
    provenance: str = "true_trajectory_pair"

    @property
    def advantage(self) -> float:
        return float(self.candidate_return - self.baseline_return)

    @property
    def preference(self) -> float:
        return 1.0 if self.advantage > 0 else 0.0

    @property
    def evidence_weight(self) -> float:
        return 1.0 if self.provenance == "true_trajectory_pair" else 0.35


class TrajectoryPairReplayV54:
    """Episode-centric paired trajectory replay.

    The structure deliberately mirrors the useful part of TorchRL's explicit data contract:
    trajectory identity, horizon, action sequence, returns, uncertainty and provenance are
    kept together instead of being split across parallel mutable arrays.
    """

    SCHEMA_VERSION = "v54.1"

    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int,
                 max_horizon: int = 8, capacity: int = 320):
        self.latent_dim = int(latent_dim)
        self.goal_dim = int(goal_dim)
        self.action_dim = int(action_dim)
        self.max_horizon = int(max(1, max_horizon))
        self.capacity = int(max(1, capacity))
        self.items: List[TrajectoryPairV54] = []
        self.priorities: List[float] = []

    @property
    def count(self) -> int:
        return len(self.items)

    @property
    def true_pair_count(self) -> int:
        return sum(x.provenance == "true_trajectory_pair" for x in self.items)

    def ready(self, minimum: int) -> bool:
        return self.true_pair_count >= int(minimum)

    def _validate(self, p: TrajectoryPairV54) -> None:
        if len(p.latent) != self.latent_dim or len(p.goal) != self.goal_dim:
            raise ValueError("latent/goal dimension mismatch")
        h = int(p.horizon)
        if h < 1 or h > self.max_horizon:
            raise ValueError("trajectory horizon outside configured bounds")
        if len(p.baseline_actions) != h or len(p.candidate_actions) != h:
            raise ValueError("action sequence length mismatch")
        for seq in (p.baseline_actions, p.candidate_actions):
            for a in seq:
                if len(a) != self.action_dim or not all(math.isfinite(float(v)) for v in a):
                    raise ValueError("invalid action sequence")
        if all(abs(float(a) - float(b)) < 1e-6 for a, b in zip(p.baseline_actions[0], p.candidate_actions[0])) and h == 1:
            raise ValueError("counterfactual pair needs a distinct first action")
        for v in (p.baseline_return, p.candidate_return, p.baseline_terminal, p.candidate_terminal):
            if not math.isfinite(float(v)):
                raise ValueError("non-finite trajectory target")

    def add(self, p: TrajectoryPairV54) -> None:
        self._validate(p)
        self.items.append(copy.deepcopy(p))
        priority = abs(p.advantage) + 0.10 * abs(p.candidate_terminal - p.baseline_terminal) + 0.03
        self.priorities.append(max(priority, 1e-4))
        if len(self.items) > self.capacity:
            self.items.pop(0)
            self.priorities.pop(0)

    def add_true_pair(self, latent: Tensor, goal: Tensor, baseline_actions: Tensor, candidate_actions: Tensor,
                      baseline_return: float, candidate_return: float, *, baseline_terminal: float = 0.0,
                      candidate_terminal: float = 0.0, uncertainty: float = 0.0, regime: float = 0.0,
                      sensor_health: float = 1.0, horizon: Optional[int] = None, step: int = 0,
                      pair_id: Optional[str] = None) -> None:
        ba = baseline_actions.detach().cpu().float() if baseline_actions.ndim == 2 else _batch(baseline_actions)[0].detach().cpu().float()
        ca = candidate_actions.detach().cpu().float() if candidate_actions.ndim == 2 else _batch(candidate_actions)[0].detach().cpu().float()
        h = int(horizon or ba.shape[0])
        if ba.ndim != 2 or ca.ndim != 2:
            raise ValueError("action sequences must be [H,A]")
        if ba.shape != ca.shape:
            raise ValueError("baseline/candidate shape mismatch")
        p = TrajectoryPairV54(
            pair_id=pair_id or f"traj-{step}-{len(self.items)}",
            latent=_batch(latent)[0].detach().cpu().float().tolist(),
            goal=_batch(goal)[0].detach().cpu().float().tolist(),
            baseline_actions=ba[:h].tolist(), candidate_actions=ca[:h].tolist(),
            baseline_return=_finite(baseline_return), candidate_return=_finite(candidate_return),
            baseline_terminal=_finite(baseline_terminal), candidate_terminal=_finite(candidate_terminal),
            uncertainty=max(0.0, _finite(uncertainty)), regime=max(0.0, _finite(regime)),
            sensor_health=max(0.0, min(1.0, _finite(sensor_health, 1.0))),
            horizon=h, step=int(step), provenance="true_trajectory_pair",
        )
        self.add(p)

    def sample(self, batch_size: int, device=None) -> Dict[str, Tensor]:
        if not self.items:
            raise RuntimeError("trajectory replay is empty")
        n = min(int(batch_size), len(self.items))
        probs = torch.tensor(self.priorities, dtype=torch.float32)
        probs = probs / probs.sum().clamp_min(1e-8)
        idx = torch.multinomial(probs, n, replacement=len(self.items) < n)
        rows = [self.items[int(i)] for i in idx.tolist()]
        hmax = self.max_horizon
        lat = torch.tensor([r.latent for r in rows], dtype=torch.float32, device=device)
        goal = torch.tensor([r.goal for r in rows], dtype=torch.float32, device=device)
        b = torch.zeros(n, hmax, self.action_dim, dtype=torch.float32, device=device)
        c = torch.zeros_like(b)
        mask = torch.zeros(n, hmax, 1, dtype=torch.float32, device=device)
        for i, r in enumerate(rows):
            h = r.horizon
            b[i, :h] = torch.tensor(r.baseline_actions, dtype=torch.float32, device=device)
            c[i, :h] = torch.tensor(r.candidate_actions, dtype=torch.float32, device=device)
            mask[i, :h] = 1.0
        return {
            "latent": lat, "goal": goal, "baseline_actions": b, "candidate_actions": c, "mask": mask,
            "target_advantage": torch.tensor([[r.advantage] for r in rows], dtype=torch.float32, device=device),
            "target_preference": torch.tensor([[r.preference] for r in rows], dtype=torch.float32, device=device),
            "baseline_return": torch.tensor([[r.baseline_return] for r in rows], dtype=torch.float32, device=device),
            "candidate_return": torch.tensor([[r.candidate_return] for r in rows], dtype=torch.float32, device=device),
            "baseline_terminal": torch.tensor([[r.baseline_terminal] for r in rows], dtype=torch.float32, device=device),
            "candidate_terminal": torch.tensor([[r.candidate_terminal] for r in rows], dtype=torch.float32, device=device),
            "uncertainty": torch.tensor([[r.uncertainty] for r in rows], dtype=torch.float32, device=device),
            "regime": torch.tensor([[r.regime] for r in rows], dtype=torch.float32, device=device),
            "sensor_health": torch.tensor([[r.sensor_health] for r in rows], dtype=torch.float32, device=device),
            "weight": torch.tensor([[self.items[int(i)].evidence_weight] for i in idx.tolist()], dtype=torch.float32, device=device),
        }

    def retrieve_sequences(self, latent: Tensor, goal: Tensor, top_k: int = 3, min_similarity: float = 0.0) -> List[Tuple[Tensor, float, float]]:
        """Retrieve real trajectory candidates from similar latent-goal contexts.

        Returns (candidate_sequence, similarity, realized_advantage). Only stored true trajectory
        pairs are eligible. This is an episodic-control proposal, not a learned world-model claim.
        """
        if not self.items:
            return []
        q = torch.cat([_batch(latent)[0], _batch(goal)[0]], -1).detach().cpu().float()
        q = q / q.norm().clamp_min(1e-6)
        scored: List[Tuple[float, TrajectoryPairV54]] = []
        for item in self.items:
            if item.provenance != "true_trajectory_pair":
                continue
            v = torch.tensor(item.latent + item.goal, dtype=torch.float32)
            v = v / v.norm().clamp_min(1e-6)
            sim = float(torch.dot(q, v).item())
            if sim >= float(min_similarity):
                scored.append((sim, item))
        scored.sort(key=lambda x: x[0], reverse=True)
        out: List[Tuple[Tensor, float, float]] = []
        for sim, item in scored[:max(1, int(top_k))]:
            seq = torch.tensor(item.candidate_actions, dtype=torch.float32, device=latent.device).unsqueeze(0)
            out.append((seq, sim, float(item.advantage)))
        return out

    def state_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.SCHEMA_VERSION,
            "latent_dim": self.latent_dim, "goal_dim": self.goal_dim,
            "action_dim": self.action_dim, "max_horizon": self.max_horizon,
            "capacity": self.capacity,
            "items": [asdict(x) for x in self.items],
            "priorities": list(self.priorities),
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.items = [TrajectoryPairV54(**x) for x in state.get("items", [])]
        self.priorities = [float(x) for x in state.get("priorities", [])]
        self.max_horizon = int(state.get("max_horizon", self.max_horizon))
        self.capacity = int(state.get("capacity", self.capacity))


class _SequenceEncoderV54(nn.Module):
    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int, hidden: int = 32):
        super().__init__()
        self.latent_dim = int(latent_dim)
        self.goal_dim = int(goal_dim)
        self.action_dim = int(action_dim)
        self.hidden = int(hidden)
        self.context = nn.Sequential(
            nn.Linear(latent_dim + goal_dim, hidden), nn.SiLU(),
        )
        self.input = nn.Linear(action_dim + hidden + 1, hidden)
        self.gru = nn.GRU(hidden, hidden, batch_first=True)
        self.out = nn.Sequential(nn.Linear(hidden, hidden), nn.SiLU())

    def forward(self, latent: Tensor, goal: Tensor, actions: Tensor, mask: Tensor) -> Tensor:
        latent, goal, actions, mask = _batch(latent), _batch(goal), actions, mask
        if actions.ndim == 2:
            actions = actions.unsqueeze(0)
        if mask.ndim == 2:
            mask = mask.unsqueeze(-1)
        ctx = self.context(torch.cat([latent, goal], -1))
        ctx = ctx[:, None, :].expand(-1, actions.size(1), -1)
        x = torch.cat([actions, ctx, mask], -1)
        h = torch.tanh(self.input(x))
        h = h * mask
        out, _ = self.gru(h)
        lengths = mask.squeeze(-1).sum(1).long().clamp_min(1) - 1
        final = out[torch.arange(out.size(0), device=out.device), lengths]
        return self.out(final)


class TrajectoryValueModelV54(nn.Module):
    """Trajectory return + terminal-value model.

    Inspired by the useful TD-MPC2 idea of combining short-horizon rollout return with a
    learned terminal value, but implemented as a compact independent NeuroCore component.
    """

    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int, hidden: int = 32):
        super().__init__()
        self.encoder = _SequenceEncoderV54(latent_dim, goal_dim, action_dim, hidden)
        self.value = nn.Sequential(nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.scale = nn.Sequential(nn.Linear(hidden, 1), nn.Softplus())
        self.terminal = nn.Sequential(nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, latent, goal, actions, mask):
        h = self.encoder(latent, goal, actions, mask)
        return {
            "value": self.value(h),
            "scale": (self.scale(h) + 0.02).clamp(0.02, 3.0),
            "terminal_value": self.terminal(h),
        }


class PairedTrajectoryAdvantageV54(nn.Module):
    """Predicts full-trajectory advantage relative to the exact baseline trajectory."""

    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int, hidden: int = 32):
        super().__init__()
        self.encoder = _SequenceEncoderV54(latent_dim, goal_dim, action_dim, hidden)
        self.body = nn.Sequential(
            nn.Linear(2 * hidden + 3, hidden), nn.LayerNorm(hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
        )
        self.mean = nn.Linear(hidden, 1)
        self.scale = nn.Linear(hidden, 1)
        self.preference = nn.Linear(hidden, 1)

    def forward(self, latent, goal, baseline_actions, candidate_actions, mask, uncertainty, regime, sensor_health):
        b = self.encoder(latent, goal, baseline_actions, mask)
        c = self.encoder(latent, goal, candidate_actions, mask)
        ctx = torch.cat([
            b, c, _batch(uncertainty).reshape(-1, 1), _batch(regime).reshape(-1, 1), _batch(sensor_health).reshape(-1, 1)
        ], -1)
        h = self.body(ctx)
        return {
            "mean": self.mean(h),
            "scale": (F.softplus(self.scale(h)) + 0.02).clamp(0.02, 3.0),
            "preference_logit": self.preference(h),
            "preference_prob": torch.sigmoid(self.preference(h)),
            "baseline_embedding": b,
            "candidate_embedding": c,
        }


@dataclass
class TrajectoryTrainingStatsV54:
    loss: float
    advantage_mae: float
    preference_bce: float
    value_mae: float
    pairs: int
    updates: int


class TrajectoryTrainerV54:
    def __init__(self, advantage: PairedTrajectoryAdvantageV54, value_model: TrajectoryValueModelV54,
                 lr: float = 7e-4, discount: float = 0.95, terminal_weight: float = 0.25):
        self.advantage = advantage
        self.value_model = value_model
        self.discount = float(discount)
        self.terminal_weight = float(terminal_weight)
        params = list(advantage.parameters()) + list(value_model.parameters())
        self.optimizer = torch.optim.Adam(params, lr=lr)
        self.update_steps = 0

    def train_store(self, replay: TrajectoryPairReplayV54, batch_size: int = 16, updates: int = 3) -> TrajectoryTrainingStatsV54:
        if replay.count < 1:
            return TrajectoryTrainingStatsV54(0.0, 0.0, 0.0, 0.0, 0, 0)
        losses: List[float] = []; maes: List[float] = []; bces: List[float] = []; value_maes: List[float] = []
        device = next(self.advantage.parameters()).device
        for _ in range(max(1, int(updates))):
            batch = replay.sample(batch_size, device=device)
            aout = self.advantage(
                batch["latent"], batch["goal"], batch["baseline_actions"], batch["candidate_actions"], batch["mask"],
                batch["uncertainty"], batch["regime"], batch["sensor_health"],
            )
            vbase = self.value_model(batch["latent"], batch["goal"], batch["baseline_actions"], batch["mask"])
            vcand = self.value_model(batch["latent"], batch["goal"], batch["candidate_actions"], batch["mask"])
            target_adv = batch["target_advantage"]
            pred_adv = aout["mean"]
            scale = aout["scale"].clamp_min(0.02)
            huber = F.smooth_l1_loss(pred_adv, target_adv, reduction="none")
            nll = ((pred_adv - target_adv).pow(2) / scale.pow(2) + 2.0 * scale.log())
            pref = F.binary_cross_entropy_with_logits(aout["preference_logit"], batch["target_preference"], reduction="none")
            value_target_b = batch["baseline_return"] - self.terminal_weight * batch["baseline_terminal"]
            value_target_c = batch["candidate_return"] - self.terminal_weight * batch["candidate_terminal"]
            vm_return = 0.5 * (F.smooth_l1_loss(vbase["value"], value_target_b, reduction="none") +
                                F.smooth_l1_loss(vcand["value"], value_target_c, reduction="none"))
            vm_terminal = 0.5 * (F.smooth_l1_loss(vbase["terminal_value"], batch["baseline_terminal"], reduction="none") +
                                  F.smooth_l1_loss(vcand["terminal_value"], batch["candidate_terminal"], reduction="none"))
            vm = vm_return + 0.50 * vm_terminal
            loss = ((self.discount * 0.50 * huber + 0.18 * nll + 0.15 * pref + 0.12 * vm_return + 0.05 * vm_terminal) * batch["weight"]).mean()
            self.optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(list(self.advantage.parameters()) + list(self.value_model.parameters()), 1.0)
            self.optimizer.step()
            losses.append(float(loss.detach().item()))
            maes.append(float((pred_adv - target_adv).detach().abs().mean().item()))
            bces.append(float(pref.detach().mean().item()))
            value_maes.append(float(vm.detach().mean().item()))
            self.update_steps += 1
        return TrajectoryTrainingStatsV54(
            float(sum(losses) / len(losses)), float(sum(maes) / len(maes)),
            float(sum(bces) / len(bces)), float(sum(value_maes) / len(value_maes)), replay.count, int(updates),
        )


class PlanEnergyScorerV54:
    """Computes path-aware latent energy for a predicted action trajectory.

    The score combines endpoint distance with intermediate path distance, predicted utility,
    predicted risk and horizon uncertainty. It is an explicit decision metric rather than a
    generic representation loss.
    """

    def __init__(self, gamma: float = 0.95, path_weight: float = 0.15):
        self.gamma = float(gamma)
        self.path_weight = float(max(0.0, path_weight))

    @torch.no_grad()
    def score(self, rollout: Dict[str, Tensor], goal: Tensor) -> Dict[str, Tensor]:
        goal = _batch(goal)
        lat = rollout["latents"][:, 1:]
        per_step = 1.0 - F.cosine_similarity(lat, goal[:, None, :], dim=-1)
        discounts = torch.pow(
            torch.full((lat.size(1),), self.gamma, device=lat.device, dtype=lat.dtype),
            torch.arange(lat.size(1), device=lat.device, dtype=lat.dtype),
        )[None, :]
        path_cost = (per_step * discounts).sum(-1) / discounts.sum().clamp_min(1e-6)
        endpoint_cost = per_step[:, -1]
        reward = (rollout["rewards"].squeeze(-1) * discounts).sum(-1)
        risk = (rollout["risks"].squeeze(-1) * discounts).sum(-1) / discounts.sum().clamp_min(1e-6)
        uncertainty = rollout["horizon_uncertainty"].squeeze(-1)[:, -1]
        energy = endpoint_cost + self.path_weight * path_cost - 0.05 * reward + 0.16 * risk + 0.08 * uncertainty
        return {
            "energy": energy, "path_cost": path_cost, "endpoint_cost": endpoint_cost,
            "discounted_reward": reward, "risk": risk, "uncertainty": uncertainty,
        }


class CEMTrajectoryPlannerV54:
    """Bounded CEM planner over latent-world trajectories.

    Inspired by TD-MPC2/CEM-style planning, but uses a fixed small population and explicit
    path-aware energy so mobile compute remains bounded. Only the first action needs to be
    committed by the real runtime.
    """

    def __init__(self, world_model, cfg: V54Config):
        self.world_model = world_model
        self.cfg = cfg
        self.energy = PlanEnergyScorerV54(cfg.trajectory_discount_v54, cfg.trajectory_path_cost_weight_v54)
    @torch.no_grad()
    def plan(self, latent: Tensor, goal: Tensor, baseline: Tensor, *, horizon: int, hidden: Optional[Tensor] = None) -> Dict[str, Tensor]:
        latent, goal, baseline = _batch(latent), _batch(goal), _batch(baseline)
        h = int(max(1, min(self.cfg.trajectory_max_horizon_v54, horizon)))
        b, a = baseline.shape
        pop = max(4, int(self.cfg.trajectory_cem_population_v54))
        elite_n = max(2, min(pop, int(self.cfg.trajectory_cem_elite_v54)))
        iters = max(1, int(self.cfg.trajectory_cem_iterations_v54))
        mean = baseline[:, None, :].expand(-1, h, -1).clone()
        std = mean.new_full(mean.shape, float(self.cfg.trajectory_candidate_noise_v54))
        best_seq = mean.clone()
        best_energy = mean.new_full((b,), float("inf"))
        last = {}
        for _ in range(iters):
            noise = torch.randn(b, pop, h, a, device=mean.device, dtype=mean.dtype)
            seq = (mean[:, None, :, :] + noise * std[:, None, :, :]).clamp(-1.0, 1.0)
            support = float(self.cfg.trajectory_action_support_v54)
            seq = (mean[:, None, :, :] + (seq - mean[:, None, :, :]).clamp(-support, support)).clamp(-1.0,1.0)
            flat = seq.reshape(b * pop, h, a)
            z = latent[:, None, :].expand(-1, pop, -1).reshape(b * pop, -1)
            g = goal[:, None, :].expand(-1, pop, -1).reshape(b * pop, -1)
            if hidden is None:
                hh = self.world_model.initial_hidden(b * pop, flat.device, flat.dtype)
            else:
                hh0 = _batch(hidden).detach().to(flat)
                hh = hh0[:, None, :].expand(-1, pop, -1).reshape(b * pop, -1)
            roll = self.world_model.rollout(z, flat, g, hidden=hh)
            metrics = self.energy.score(roll, g)
            e = metrics["energy"].reshape(b, pop)
            vals, idx = torch.topk(e, elite_n, dim=1, largest=False)
            elite = torch.gather(seq, 1, idx[:, :, None, None].expand(-1, -1, h, a))
            mean = elite.mean(1)
            std = elite.std(1, unbiased=False).clamp_min(float(self.cfg.trajectory_cem_std_min_v54))
            for bi in range(b):
                if float(vals[bi,0].item()) < float(best_energy[bi].item()):
                    best_energy[bi] = vals[bi,0]
                    best_seq[bi] = elite[bi,0]
            last = {k: v.reshape(b, pop)[torch.arange(b, device=b.device), vals.argmin(1)] if v.ndim == 2 else v for k,v in metrics.items()}
        return {
            "sequence": best_seq, "first_action": best_seq[:,0], "energy": best_energy,
            "path_cost": last.get("path_cost", best_energy.new_zeros(b)),
            "endpoint_cost": last.get("endpoint_cost", best_energy.new_zeros(b)),
            "predicted_reward": last.get("discounted_reward", best_energy.new_zeros(b)),
            "predicted_risk": last.get("risk", best_energy.new_zeros(b)),
            "predicted_uncertainty": last.get("uncertainty", best_energy.new_zeros(b)),
            "horizon": best_energy.new_full((b,), float(h)),
        }


class RobustAdvantageCalibratorV54:
    """Robust additive calibration for systematic advantage bias.

    Calibration uses only an independent set of realized trajectory pairs. The raw critic is
    never overwritten; a robust median residual is removed at decision time.
    """

    def __init__(self, min_points: int = 8, clip: float = 1.5):
        self.min_points = int(max(2, min_points))
        self.clip = float(max(0.1, clip))
        self.predicted: List[float] = []
        self.realized: List[float] = []
        self.bias = 0.0
        self.scale = 1.0

    @property
    def ready(self) -> bool:
        return len(self.predicted) >= self.min_points

    def update(self, predicted: float, realized: float) -> None:
        self.predicted.append(_finite(predicted))
        self.realized.append(_finite(realized))
        residuals = sorted([p - r for p, r in zip(self.predicted, self.realized)])
        mid = len(residuals) // 2
        self.bias = residuals[mid] if len(residuals) % 2 else 0.5 * (residuals[mid - 1] + residuals[mid])
        deviations = sorted(abs(r - self.bias) for r in residuals)
        if deviations:
            dm = len(deviations) // 2
            mad = deviations[dm] if len(deviations) % 2 else 0.5 * (deviations[dm - 1] + deviations[dm])
            self.scale = max(1e-4, 1.4826 * mad)
        self.predicted = self.predicted[-128:]
        self.realized = self.realized[-128:]

    def correct(self, predicted: Tensor) -> Tensor:
        if not self.ready:
            return predicted
        return predicted - float(max(-self.clip, min(self.clip, self.bias)))

    def state_dict(self) -> Dict[str, Any]:
        return {
            "min_points": self.min_points, "clip": self.clip, "predicted": list(self.predicted),
            "realized": list(self.realized), "bias": self.bias, "scale": self.scale,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.min_points = int(state.get("min_points", self.min_points))
        self.clip = float(state.get("clip", self.clip))
        self.predicted = list(state.get("predicted", []))[-128:]
        self.realized = list(state.get("realized", []))[-128:]
        self.bias = float(state.get("bias", 0.0))
        self.scale = float(state.get("scale", 1.0))


class PlanRealRankMonitorV54:
    """Tracks whether predicted trajectory rankings agree with realized returns."""

    def __init__(self, window: int = 48):
        self.window = int(max(8, window))
        self.predicted: List[float] = []
        self.realized: List[float] = []

    def update(self, predicted_advantage: float, realized_advantage: float) -> float:
        self.predicted.append(_finite(predicted_advantage))
        self.realized.append(_finite(realized_advantage))
        self.predicted = self.predicted[-self.window:]
        self.realized = self.realized[-self.window:]
        return self.rank()

    def rank(self) -> float:
        return _spearman(self.predicted, self.realized)

    def state_dict(self) -> Dict[str, Any]:
        return {"window": self.window, "predicted": list(self.predicted), "realized": list(self.realized)}

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.window = int(state.get("window", self.window))
        self.predicted = list(state.get("predicted", []))[-self.window:]
        self.realized = list(state.get("realized", []))[-self.window:]


class LongHorizonAdmissionGateV54:
    """Allows a trajectory plan only when predicted benefit is supported by rank + uncertainty."""

    def __init__(self, cfg: V54Config):
        self.cfg = cfg

    def accept(self, margin: float, uncertainty: float, rank: float, sensor_health: float, regime: float, pairs: int, calibrated_ready: bool = True) -> bool:
        return bool(
            pairs >= int(self.cfg.trajectory_min_pairs_v54)
            and calibrated_ready
            and margin > float(self.cfg.trajectory_admission_margin_v54)
            and uncertainty <= float(self.cfg.trajectory_max_uncertainty_v54)
            and rank >= float(self.cfg.trajectory_min_rank_v54)
            and sensor_health >= 0.25
            and regime <= 0.95
        )


class LongHorizonTrajectoryControllerV54:
    """MPC-style first-action controller with exact baseline fallback.

    Only the first action is committed. The rest of a candidate is an internal counterfactual
    trajectory and is discarded after the decision, so mobile runtime cost stays bounded.
    """

    def __init__(self, cfg: V54Config, critic: PairedTrajectoryAdvantageV54, value_model: TrajectoryValueModelV54,
                 replay: TrajectoryPairReplayV54, rank_monitor: PlanRealRankMonitorV54,
                 calibrator: Optional[RobustAdvantageCalibratorV54] = None):
        self.cfg = cfg
        self.critic = critic
        self.value_model = value_model
        self.replay = replay
        self.rank_monitor = rank_monitor
        self.calibrator = calibrator or RobustAdvantageCalibratorV54(
            min_points=cfg.trajectory_calibration_min_points_v54, clip=cfg.trajectory_calibration_clip_v54
        )
        self.gate = LongHorizonAdmissionGateV54(cfg)
        self.accepted = 0
        self.decisions = 0

    @torch.no_grad()
    def _candidate_sequences(self, baseline: Tensor, horizon: int) -> Tensor:
        baseline = _batch(baseline)
        count = max(1, int(self.cfg.trajectory_candidate_count_v54))
        noise = torch.randn(
            baseline.size(0), count, horizon, baseline.size(-1), device=baseline.device, dtype=baseline.dtype
        ) * float(self.cfg.trajectory_candidate_noise_v54)
        seq = baseline[:, None, None, :] + noise
        delta = (seq - baseline[:, None, None, :]).clamp(
            -float(self.cfg.trajectory_action_support_v54), float(self.cfg.trajectory_action_support_v54)
        )
        return (baseline[:, None, None, :] + delta).clamp(-1.0, 1.0)

    @torch.no_grad()
    def select(self, latent: Tensor, goal: Tensor, baseline: Tensor, *, horizon: int,
               uncertainty: float, regime: float, sensor_health: float) -> Tuple[Tensor, Dict[str, Tensor]]:
        h = int(max(1, min(self.cfg.trajectory_max_horizon_v54, horizon)))
        baseline_seq = _batch(baseline)[:, None, :].expand(-1, h, -1)
        noise_candidates = self._candidate_sequences(baseline, h)
        # Add retrieved real-trajectory proposals for the current latent/goal context.
        retrieved = self.replay.retrieve_sequences(latent, goal, top_k=2, min_similarity=0.82)
        retrieved_seq = [x[0][:, :h, :] for x in retrieved if x[0].size(1) >= h]
        if retrieved_seq:
            ret = torch.cat(retrieved_seq, dim=0).unsqueeze(0)
            candidates = torch.cat([noise_candidates, ret], dim=1)
        else:
            candidates = noise_candidates
        bsz, n, _, ad = candidates.shape
        bflat = baseline_seq[:, None, :, :].expand(-1, n, -1, -1).reshape(bsz * n, h, ad)
        cflat = candidates.reshape(bsz * n, h, ad)
        mask = baseline_seq.new_ones((bsz * n, h, 1))
        z = _batch(latent)[:, None, :].expand(-1, n, -1).reshape(bsz * n, -1)
        g = _batch(goal)[:, None, :].expand(-1, n, -1).reshape(bsz * n, -1)
        u = baseline_seq.new_full((bsz * n, 1), float(uncertainty))
        r = baseline_seq.new_full((bsz * n, 1), float(regime))
        s = baseline_seq.new_full((bsz * n, 1), float(sensor_health))
        out = self.critic(z, g, bflat, cflat, mask, u, r, s)
        vb = self.value_model(z, g, bflat, mask)
        vc = self.value_model(z, g, cflat, mask)
        calibrated_advantage = self.calibrator.correct(out["mean"]).reshape(bsz, n)
        value_delta = (vc["value"] - vb["value"]).reshape(bsz, n)
        terminal_delta = (vc["terminal_value"] - vb["terminal_value"]).reshape(bsz, n)
        scores = (float(self.cfg.trajectory_pair_weight_v54) * calibrated_advantage
                  + float(self.cfg.trajectory_value_weight_v54) * value_delta
                  - float(self.cfg.trajectory_terminal_weight_v54) * terminal_delta
                  - float(self.cfg.trajectory_uncertainty_penalty_v54) * out["scale"].reshape(bsz, n)
                  - 0.05 * vc["scale"].reshape(bsz, n))
        base_candidate = torch.zeros(bsz, 1, device=scores.device, dtype=scores.dtype)
        score_all = torch.cat([base_candidate, scores], 1)
        best = score_all.argmax(1)
        chosen = baseline.clone()
        meta = {
            "trajectory54_ready": baseline.new_tensor([[1.0 if (self.replay.ready(self.cfg.trajectory_min_pairs_v54) and self.calibrator.ready) else 0.0]]),
            "trajectory54_accepted": baseline.new_zeros((1, 1)),
            "trajectory54_margin": baseline.new_zeros((1, 1)),
            "trajectory54_uncertainty": baseline.new_zeros((1, 1)),
            "trajectory54_rank": baseline.new_tensor([[self.rank_monitor.rank()]]),
            "trajectory54_horizon": baseline.new_tensor([[float(h)]]),
        }
        for i in range(bsz):
            k = int(best[i].item())
            if k == 0:
                continue
            margin = float(score_all[i, k].item())
            unc = float(out["scale"].reshape(bsz, n)[i, k - 1].item())
            ok = self.gate.accept(
                margin=margin, uncertainty=unc, rank=self.rank_monitor.rank(), sensor_health=sensor_health,
                regime=regime, pairs=self.replay.true_pair_count, calibrated_ready=self.calibrator.ready,
            )
            if ok:
                chosen[i] = candidates[i, k - 1, 0]
                self.accepted += 1
                meta["trajectory54_accepted"][:] = 1.0
            meta["trajectory54_margin"][:] = margin
            meta["trajectory54_uncertainty"][:] = unc
        self.decisions += bsz
        return chosen, meta


@dataclass
class V54TransitionEvidence:
    horizon: int
    predicted_advantage: float
    realized_advantage: float
    rank_after: float
    step: int


class NeuroWeaveV54(NeuroWeaveV53):
    """V54 adds long-horizon trajectory value and paired counterfactual planning."""

    def __init__(self, cfg: Optional[V54Config] = None):
        super().__init__(cfg or V54Config())
        self.cfg: V54Config
        self.trajectory_value_v54 = TrajectoryValueModelV54(
            self.cfg.latent_dim_v46, self.cfg.latent_dim_v46, self.cfg.action_dim, hidden=self.cfg.trajectory_hidden_v54
        )
        self.trajectory_advantage_v54 = PairedTrajectoryAdvantageV54(
            self.cfg.latent_dim_v46, self.cfg.latent_dim_v46, self.cfg.action_dim, hidden=self.cfg.trajectory_hidden_v54
        )


class OrganismRuntimeV54(OrganismRuntimeV53):
    def __init__(self, model: NeuroWeaveV54, trainer: Optional["OrganismTrainerV54"] = None):
        super().__init__(model, trainer)
        self.model: NeuroWeaveV54 = model
        self.trainer = trainer
        self.trajectory_replay_v54 = TrajectoryPairReplayV54(
            self.model.cfg.latent_dim_v46, self.model.cfg.latent_dim_v46, self.model.cfg.action_dim,
            max_horizon=self.model.cfg.trajectory_max_horizon_v54,
            capacity=self.model.cfg.trajectory_pair_capacity_v54,
        )
        self.rank_monitor_v54 = PlanRealRankMonitorV54(self.model.cfg.trajectory_rank_window_v54)
        self.trajectory_calibrator_v54 = RobustAdvantageCalibratorV54(
            min_points=self.model.cfg.trajectory_calibration_min_points_v54,
            clip=self.model.cfg.trajectory_calibration_clip_v54,
        )
        self.trajectory_controller_v54 = LongHorizonTrajectoryControllerV54(
            self.model.cfg, self.model.trajectory_advantage_v54, self.model.trajectory_value_v54,
            self.trajectory_replay_v54, self.rank_monitor_v54, self.trajectory_calibrator_v54
        )
        self._last_trajectory_meta: Dict[str, Any] = {}
        self.transition_evidence_v54: List[V54TransitionEvidence] = []

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        latent = out["brain_current_latent_v47"]
        subgoal = out["brain_subgoal_v47"]
        baseline = out["chosen_action_v53"]
        uncertainty = float(out.get("world50_uncertainty", observation.new_zeros((1, 1))).mean().item())
        regime = float(getattr(self.regime_v51, "severity", 0.0))
        sensor_health = float(self._sensor_health_v51)
        horizon = min(
            max(1, int(round(float(out.get("world50_horizon", observation.new_tensor([[1.0]])).mean().item())))),
            int(self.model.cfg.trajectory_max_horizon_v54),
        )
        chosen, meta = self.trajectory_controller_v54.select(
            latent, subgoal, baseline, horizon=horizon, uncertainty=uncertainty, regime=regime, sensor_health=sensor_health,
        )
        out.update(meta)
        out["chosen_action_v54"] = chosen
        self._last_trajectory_meta = {k: (float(v.mean().item()) if torch.is_tensor(v) else v) for k, v in meta.items()}
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float,
                           actual_risk: float, goal: Optional[Tensor] = None,
                           update_world_model: bool = True) -> Dict[str, Any]:
        result = super().observe_transition(
            next_observation, actual_reward=actual_reward, actual_risk=actual_risk,
            goal=goal, update_world_model=update_world_model,
        )
        return result

    def state_dict(self) -> Dict[str, Any]:
        return {
            **super().state_dict(),
            "trajectory_replay_v54": self.trajectory_replay_v54.state_dict(),
            "rank_monitor_v54": self.rank_monitor_v54.state_dict(),
            "trajectory_calibrator_v54": self.trajectory_calibrator_v54.state_dict(),
            "transition_evidence_v54": [asdict(x) for x in self.transition_evidence_v54[-128:]],
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        super().load_state_dict(state)
        if state.get("trajectory_replay_v54") is not None:
            self.trajectory_replay_v54.load_state_dict(state["trajectory_replay_v54"])
        if state.get("rank_monitor_v54") is not None:
            self.rank_monitor_v54.load_state_dict(state["rank_monitor_v54"])
        if state.get("trajectory_calibrator_v54") is not None:
            self.trajectory_calibrator_v54.load_state_dict(state["trajectory_calibrator_v54"])
        self.transition_evidence_v54 = [V54TransitionEvidence(**x) for x in state.get("transition_evidence_v54", [])][-128:]


class OrganismTrainerV54(OrganismTrainerV53):
    def __init__(self, model: NeuroWeaveV54, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV54 = model
        self.trajectory_trainer_v54 = TrajectoryTrainerV54(
            self.model.trajectory_advantage_v54, self.model.trajectory_value_v54,
            lr=self.model.cfg.trajectory_learning_rate_v54,
            discount=self.model.cfg.trajectory_discount_v54,
            terminal_weight=self.model.cfg.trajectory_terminal_weight_v54,
        )

    def train_trajectory_pairs_v54(self, replay: TrajectoryPairReplayV54, updates: Optional[int] = None) -> TrajectoryTrainingStatsV54:
        return self.trajectory_trainer_v54.train_store(
            replay, batch_size=min(24, max(2, replay.count)), updates=updates or self.model.cfg.trajectory_train_updates_v54
        )


class RuntimeStateStoreV54(RuntimeStateStoreV53):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV54, trainer: Optional[OrganismTrainerV54] = None,
             runtime: Optional[OrganismRuntimeV54] = None):
        RuntimeStateStoreV53.save(path, model, trainer, runtime)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["v54"] = {
            "trajectory_value": model.trajectory_value_v54.state_dict(),
            "trajectory_advantage": model.trajectory_advantage_v54.state_dict(),
            "trajectory_optimizer": trainer.trajectory_trainer_v54.optimizer.state_dict() if trainer else None,
            "trajectory_updates": trainer.trajectory_trainer_v54.update_steps if trainer else 0,
            "trajectory_replay": runtime.trajectory_replay_v54.state_dict() if runtime else None,
            "rank_monitor": runtime.rank_monitor_v54.state_dict() if runtime else None,
            "trajectory_calibrator": runtime.trajectory_calibrator_v54.state_dict() if runtime else None,
        }
        payload["version_v54"] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV54, trainer: Optional[OrganismTrainerV54] = None,
             runtime: Optional[OrganismRuntimeV54] = None, device=None):
        payload = RuntimeStateStoreV53.load(path, model, trainer, runtime, device=device)
        v54 = payload.get("v54") or {}
        if v54.get("trajectory_value") is not None:
            model.trajectory_value_v54.load_state_dict(v54["trajectory_value"])
        if v54.get("trajectory_advantage") is not None:
            model.trajectory_advantage_v54.load_state_dict(v54["trajectory_advantage"])
        if trainer is not None:
            if v54.get("trajectory_optimizer") is not None:
                trainer.trajectory_trainer_v54.optimizer.load_state_dict(v54["trajectory_optimizer"])
            trainer.trajectory_trainer_v54.update_steps = int(v54.get("trajectory_updates", 0))
        if runtime is not None:
            if v54.get("trajectory_replay") is not None:
                runtime.trajectory_replay_v54.load_state_dict(v54["trajectory_replay"])
            if v54.get("rank_monitor") is not None:
                runtime.rank_monitor_v54.load_state_dict(v54["rank_monitor"])
            if v54.get("trajectory_calibrator") is not None:
                runtime.trajectory_calibrator_v54.load_state_dict(v54["trajectory_calibrator"])
        return payload


__all__ = [
    "V54Config", "mobile_v54_config", "TrajectoryPairV54", "TrajectoryPairReplayV54",
    "TrajectoryValueModelV54", "PairedTrajectoryAdvantageV54", "TrajectoryTrainingStatsV54",
    "TrajectoryTrainerV54", "PlanEnergyScorerV54", "CEMTrajectoryPlannerV54", "RobustAdvantageCalibratorV54", "PlanRealRankMonitorV54", "LongHorizonAdmissionGateV54",
    "LongHorizonTrajectoryControllerV54", "V54TransitionEvidence", "NeuroWeaveV54",
    "OrganismRuntimeV54", "OrganismTrainerV54", "RuntimeStateStoreV54",
]
