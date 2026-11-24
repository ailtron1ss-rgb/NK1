from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v81 import (
    V81Config,
    mobile_v81_config,
    NeuroWeaveV81,
    OrganismRuntimeV81,
    OrganismTrainerV81,
    RuntimeStateStoreV81,
)


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return F.normalize(x, dim=-1, eps=eps)


@dataclass
class V82Config(V81Config):
    """V82: selective delta recurrence + adaptive objective balancing.

    The persistent memory owner remains V61. The V82 recurrent state is a compact, transient
    low-rank associative state used by the unified learning spine. This is a replacement for the
    V80 GRU state, not a second long-term memory owner.
    """

    spine_rank_v82: int = 8
    spine_decay_init_v82: float = 0.965
    spine_erase_bias_v82: float = -1.80
    spine_write_bias_v82: float = -1.10
    spine_read_scale_v82: float = 1.0
    spine_update_clip_v82: float = 0.50
    spine_output_mix_v82: float = 0.55
    spine_input_gate_v82: float = 0.50

    objective_ema_decay_v82: float = 0.97
    objective_min_multiplier_v82: float = 0.35
    objective_max_multiplier_v82: float = 3.0
    objective_balance_enabled_v82: bool = True
    objective_strategy_version_v82: int = 1


def mobile_v82_config(raw_observation_dim: int = 9) -> V82Config:
    base = dict(mobile_v81_config(raw_observation_dim).__dict__)
    base.update({
        "spine_rank_v82": 8,
        "spine_decay_init_v82": 0.965,
        "spine_erase_bias_v82": -1.80,
        "spine_write_bias_v82": -1.10,
        "spine_read_scale_v82": 1.0,
        "spine_update_clip_v82": 0.50,
        "spine_output_mix_v82": 0.55,
        "spine_input_gate_v82": 0.50,
        "objective_ema_decay_v82": 0.97,
        "objective_min_multiplier_v82": 0.35,
        "objective_max_multiplier_v82": 3.0,
        "objective_balance_enabled_v82": True,
        "objective_strategy_version_v82": 1,
    })
    return V82Config(**base)


class SelectiveDeltaSpineV82(nn.Module):
    """Compact recurrent state based on a gated delta-rule update.

    State is an 8x8-style low-rank associative matrix flattened into the legacy 64-wide state
    interface. Each step reads with q, computes a residual against v, selectively erases rows,
    selectively writes columns, then projects the read back into the existing feature space.
    This borrows the useful erase/write separation of Gated DeltaNet-2 without importing its full
    model, kernels, or parameter scale.
    """

    def __init__(
        self,
        feature_dim: int,
        hidden: int,
        context_dim: int,
        latent_dim: int,
        rank: int = 8,
        decay_init: float = 0.965,
        erase_bias: float = -1.8,
        write_bias: float = -1.1,
        read_scale: float = 1.0,
        update_clip: float = 0.5,
        output_mix: float = 0.55,
        input_gate: float = 0.5,
    ):
        super().__init__()
        self.feature_dim = int(feature_dim)
        self.hidden = int(hidden)
        self.context_dim = int(context_dim)
        self.latent_dim = int(latent_dim)
        self.rank = int(rank)
        self.read_scale = float(read_scale)
        self.update_clip = float(update_clip)
        self.output_mix = float(output_mix)
        self.input_gate = float(input_gate)

        self.input_norm = nn.LayerNorm(self.feature_dim)
        self.input_proj = nn.Sequential(
            nn.Linear(self.feature_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
        )
        self.q_proj = nn.Linear(hidden, rank, bias=False)
        self.k_proj = nn.Linear(hidden, rank, bias=False)
        self.v_proj = nn.Linear(hidden, rank, bias=False)
        self.erase_proj = nn.Linear(hidden, rank)
        self.write_proj = nn.Linear(hidden, rank)
        nn.init.constant_(self.erase_proj.bias, float(erase_bias))
        nn.init.constant_(self.write_proj.bias, float(write_bias))

        decay_p = torch.full((rank,), float(torch.logit(torch.tensor(decay_init)).item()))
        self.decay_logit = nn.Parameter(decay_p)
        self.state_to_hidden = nn.Sequential(
            nn.Linear(rank + hidden, hidden), nn.SiLU(), nn.Linear(hidden, hidden), nn.Tanh()
        )
        self.next_latent_head = nn.Sequential(
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, latent_dim)
        )
        self.memory_context_head = nn.Sequential(
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, context_dim)
        )
        self.confidence_head = nn.Sequential(nn.Linear(hidden, 1), nn.Sigmoid())
        self.memory_to_action = nn.Sequential(
            nn.Linear(20, hidden), nn.SiLU(), nn.Linear(hidden, 3), nn.Tanh()
        )
        self.register_buffer("update_count_v82", torch.zeros((), dtype=torch.long))
        self.register_buffer("last_update_norm_v82", torch.zeros(()))

    def _unflatten(self, state: Tensor) -> Tensor:
        if state.ndim != 2 or state.size(-1) != self.rank * self.rank:
            raise ValueError(f"expected [B,{self.rank*self.rank}] recurrent state")
        return state.view(state.size(0), self.rank, self.rank)

    def _flatten(self, state: Tensor) -> Tensor:
        return state.reshape(state.size(0), self.rank * self.rank)

    def step(self, features: Tensor, state: Optional[Tensor] = None) -> Dict[str, Tensor]:
        if features.ndim != 2 or features.size(-1) != self.feature_dim:
            raise ValueError(f"expected [B,{self.feature_dim}] features")
        h = self.input_proj(self.input_norm(features))
        if state is None:
            state = h.new_zeros(h.size(0), self.rank * self.rank)
        S = self._unflatten(state)

        q = _norm(self.q_proj(h))
        k = _norm(self.k_proj(h))
        v = torch.tanh(self.v_proj(h))
        read = torch.bmm(q.unsqueeze(1), S).squeeze(1) * self.read_scale
        delta = (v - read).clamp(-self.update_clip, self.update_clip)

        erase = torch.sigmoid(self.erase_proj(h)).clamp(0.01, 0.99)
        write = torch.sigmoid(self.write_proj(h)).clamp(0.01, 0.99)
        decay = torch.sigmoid(self.decay_logit).to(h).view(1, self.rank)

        row_keep = decay * (1.0 - erase)
        new_S = S * row_keep.unsqueeze(-1)
        write_term = k.unsqueeze(-1) * (write * delta).unsqueeze(-2)
        new_S = new_S + write_term

        read_after = torch.bmm(q.unsqueeze(1), new_S).squeeze(1)
        gated_hidden = self.state_to_hidden(torch.cat([read_after, h], dim=-1))
        mixed = self.input_gate * h + (1.0 - self.input_gate) * gated_hidden
        output = torch.tanh(mixed)

        update_norm = (new_S - S).pow(2).mean().sqrt()
        with torch.no_grad():
            self.update_count_v82.add_(1)
            self.last_update_norm_v82.copy_(update_norm.detach())

        return {
            "state": self._flatten(new_S),
            "next_latent": _norm(self.next_latent_head(output)),
            "memory_context": self.memory_context_head(output),
            "confidence": self.confidence_head(output),
            "read": read_after,
            "hidden": output,
            "erase": erase,
            "write": write,
            "decay": decay.expand(output.size(0), -1),
        }

    def forward(self, features: Tensor) -> Dict[str, Tensor]:
        if features.ndim != 3 or features.size(-1) != self.feature_dim:
            raise ValueError(f"expected [B,T,{self.feature_dim}] features")
        state = None
        rows = []
        for i in range(features.size(1)):
            out = self.step(features[:, i], state)
            state = out["state"]
            rows.append(out)
        return {k: torch.stack([r[k] for r in rows], dim=1) for k in rows[0]}


class NeuroWeaveV82(NeuroWeaveV81):
    """V82 current trunk.

    V82 replaces the V80 GRU recurrence with a compact gated-delta recurrence while preserving
    the same state width and public context interface. It also exposes diagnostics needed to
    qualify whether the new recurrence actually replaces or merely duplicates V72 associative work.
    """

    FEATURE_DIM_V82 = NeuroWeaveV81.FEATURE_DIM_V81

    def __init__(self, cfg: Optional[V82Config] = None):
        cfg = cfg or mobile_v82_config(9)
        super().__init__(cfg)
        self.cfg = cfg
        old = self.unified_spine_v80
        self.unified_spine_v80 = SelectiveDeltaSpineV82(
            feature_dim=self.FEATURE_DIM_V82,
            hidden=cfg.unified_hidden_v80,
            context_dim=cfg.unified_context_dim_v80,
            latent_dim=cfg.latent_dim_v46,
            rank=cfg.spine_rank_v82,
            decay_init=cfg.spine_decay_init_v82,
            erase_bias=cfg.spine_erase_bias_v82,
            write_bias=cfg.spine_write_bias_v82,
            read_scale=cfg.spine_read_scale_v82,
            update_clip=cfg.spine_update_clip_v82,
            output_mix=cfg.spine_output_mix_v82,
            input_gate=cfg.spine_input_gate_v82,
        )
        # The inherited V81 contract is intentionally re-run after replacing the spine.
        self._configure_current_learning_contract_v81()
        self.v82_replaced_v80_spine_parameter_count = sum(p.numel() for p in old.parameters())

    @property
    def unified_spine_v82(self) -> SelectiveDeltaSpineV82:
        return self.unified_spine_v80

    def learning_parameter_report_v82(self) -> Dict[str, float]:
        total = sum(p.numel() for p in self.parameters())
        active = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return {
            "total_parameters": float(total),
            "active_parameters": float(active),
            "active_fraction": float(active / max(1, total)),
            "frozen_parameters": float(total - active),
            "replaced_v80_spine_parameters": float(self.v82_replaced_v80_spine_parameter_count),
        }

    def forward_learning_v82(self, x: Tensor, goal_sequence: Optional[Tensor] = None, *, target_latent_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        # V81 forward path is intentionally reused: the V82 recurrence is API-compatible with
        # the V80/V81 spine surface but uses a different internal state transition.
        return self.forward_learning_v81(x, goal_sequence, target_latent_sequence=target_latent_sequence)


class OrganismTrainerV82(OrganismTrainerV81):
    """Unified trainer with adaptive objective balancing and full current-spine gradients."""

    LOSS_KEYS = (
        "memory_loss", "predictive_loss", "world_loss", "spine_loss", "cross_system_loss",
        "temporal_loss", "self_loss", "multiscale_loss",
    )
    BASE_WEIGHT_ATTRS = {
        "memory_loss": "unified_memory_loss_weight_v80",
        "predictive_loss": "unified_predictive_loss_weight_v80",
        "world_loss": "unified_world_loss_weight_v80",
        "spine_loss": "unified_spine_loss_weight_v80",
        "cross_system_loss": "unified_cross_system_weight_v80",
        "temporal_loss": "unified_temporal_weight_v80",
        "self_loss": "unified_self_loss_weight_v81",
        "multiscale_loss": "unified_multiscale_loss_weight_v81",
    }

    def __init__(self, model: NeuroWeaveV82, lr: Optional[float] = None, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV82 = model
        self.unified_optimizer_v80 = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=lr or model.cfg.unified_learning_lr_v80,
            weight_decay=1e-4,
        )
        self.loss_ema_v82 = {k: 1.0 for k in self.LOSS_KEYS}
        self.unified_steps_v82 = 0

    def _balanced_total_v82(self, out: Dict[str, Tensor]) -> tuple[Tensor, Dict[str, float]]:
        raw = {k: out[k] for k in self.LOSS_KEYS}
        if not self.model.cfg.objective_balance_enabled_v82:
            total = sum(float(getattr(self.model.cfg, self.BASE_WEIGHT_ATTRS[k])) * raw[k] for k in self.LOSS_KEYS)
            return total, {k: float(getattr(self.model.cfg, self.BASE_WEIGHT_ATTRS[k])) for k in self.LOSS_KEYS}
        decay = float(self.model.cfg.objective_ema_decay_v82)
        multipliers: Dict[str, float] = {}
        base_sum = sum(float(getattr(self.model.cfg, self.BASE_WEIGHT_ATTRS[k])) for k in self.LOSS_KEYS)
        raw_weights = {}
        for k, value in raw.items():
            v = float(value.detach().item())
            self.loss_ema_v82[k] = decay * self.loss_ema_v82[k] + (1.0 - decay) * max(v, 1e-6)
            raw_weights[k] = float(getattr(self.model.cfg, self.BASE_WEIGHT_ATTRS[k])) / (self.loss_ema_v82[k] ** 0.5)
        scale = base_sum / max(sum(raw_weights.values()), 1e-8)
        for k, w in raw_weights.items():
            mult = float(w * scale / max(float(getattr(self.model.cfg, self.BASE_WEIGHT_ATTRS[k])), 1e-8))
            multipliers[k] = min(float(self.model.cfg.objective_max_multiplier_v82), max(float(self.model.cfg.objective_min_multiplier_v82), mult))
        total = sum(
            float(getattr(self.model.cfg, self.BASE_WEIGHT_ATTRS[k])) * multipliers[k] * raw[k]
            for k in self.LOSS_KEYS
        )
        return total, multipliers

    def learning_step_v82(self, x: Tensor, goal_sequence: Optional[Tensor] = None, *, target_latent_sequence: Optional[Tensor] = None) -> Dict[str, float]:
        self.model.train()
        out = self.model.forward_learning_v82(x, goal_sequence, target_latent_sequence=target_latent_sequence)
        total, weights = self._balanced_total_v82(out)
        active = [p for p in self.model.parameters() if p.requires_grad]
        self.unified_optimizer_v80.zero_grad(set_to_none=True)
        total.backward()
        coverage = self._gradient_coverage_v80()
        nn.utils.clip_grad_norm_(active, self.model.cfg.unified_gradient_clip_v80)
        self.unified_optimizer_v80.step()
        self.unified_steps_v82 += 1
        return {
            "loss": float(total.detach().item()),
            "memory_loss": float(out["memory_loss"].detach().item()),
            "predictive_loss": float(out["predictive_loss"].detach().item()),
            "world_loss": float(out["world_loss"].detach().item()),
            "spine_loss": float(out["spine_loss"].detach().item()),
            "self_loss": float(out["self_loss"].detach().item()),
            "multiscale_loss": float(out["multiscale_loss"].detach().item()),
            "gradient_coverage": float(coverage["gradient_coverage"]),
            "objective_weight_min": float(min(weights.values())),
            "objective_weight_max": float(max(weights.values())),
            "steps": float(self.unified_steps_v82),
        }

    def state_dict_v82(self):
        return {
            "unified_optimizer": self.unified_optimizer_v80.state_dict(),
            "unified_steps": self.unified_steps_v82,
            "loss_ema": dict(self.loss_ema_v82),
        }

    def load_state_dict_v82(self, state):
        if state.get("unified_optimizer") is not None:
            self.unified_optimizer_v80.load_state_dict(state["unified_optimizer"])
        self.unified_steps_v82 = int(state.get("unified_steps", 0))
        ema = state.get("loss_ema", {})
        for k in self.LOSS_KEYS:
            if k in ema:
                self.loss_ema_v82[k] = float(ema[k])


class OrganismRuntimeV82(OrganismRuntimeV81):
    """Compact V82 runtime using the selective-delta spine with the V81 state contract."""

    def __init__(self, model: NeuroWeaveV82, trainer: Optional[OrganismTrainerV82] = None):
        # Do not call V81.__init__ by type assumptions beyond shared state construction.
        self.model = model
        self.trainer = trainer
        dev = next(model.parameters()).device
        dt = next(model.parameters()).dtype
        self.h46 = model.brain46.initial(1, dev, dt)
        self.fast47 = model.brain47.initial_fast(1, dev, dt)
        self.slow47 = model.brain47.initial_slow(1, dev, dt)
        self.world_h = model.world_model_v50.initial_hidden(1, dev, dt)
        self.spine_state = torch.zeros(1, model.cfg.spine_rank_v82 * model.cfg.spine_rank_v82, device=dev, dtype=dt)
        self.memory_prior = torch.zeros(1, model.cfg.action_dim, device=dev, dtype=dt)
        self.self_state = model.self_model_v55.initial_state(1, dev, dt)
        self.mts_state = model.multiscale_v56.initial_state(1, dev, dt)
        self.steps = 0

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        obs = observation.reshape(1, -1)
        g = goal.reshape(1, -1) if goal is not None else obs.new_zeros(1, self.model.cfg.goal_dim)
        if g.size(-1) != self.model.cfg.goal_dim:
            raise ValueError(f"V82 runtime goal shape mismatch: expected {self.model.cfg.goal_dim}, got {g.size(-1)}")
        goal_latent = self.model.brain46.goal_latent(g)
        brain46 = self.model.brain46(obs, self.h46, self.memory_prior, g, memory_prior=self.memory_prior, planner_strength=1.0)
        self.h46 = brain46["hidden"].detach()
        brain47 = self.model.brain47(obs, self.fast47, self.slow47, brain46["action"], g, self.steps + 1, memory_prior=self.memory_prior, planning_strength=1.0)
        self.fast47 = brain47["fast_hidden"].detach(); self.slow47 = brain47["slow_hidden"].detach()
        world = self.model.world_model_v50.step(brain47["current_latent"], brain47["action"], goal_latent, self.world_h, horizon=1)
        self.world_h = world["hidden"].detach()
        body = obs.new_zeros(1, self.model.cfg.body_dim)
        mem_context = self.model.unified_spine_v80.memory_context_head(self.spine_state)
        mem_read = self.model.neural_memory_v61(mem_context)["read"]
        prior_from_memory = 0.25 * torch.tanh(self.model.unified_spine_v80.memory_to_action(mem_read[..., :20]))
        self_pred = self.model.self_model_v55.predict_self(self.self_state, brain47["current_latent"], goal_latent, brain47["action"], body)
        self.self_state = self.model.self_model_v55.observe_outcome(
            self.self_state, prior_prediction=self_pred, next_latent=brain47["current_latent"], goal=goal_latent,
            action=brain47["action"], body=body, reward=obs.new_zeros(1,1), risk=world["horizon_uncertainty"].reshape(1,1),
            prediction_error=obs.new_zeros(1,1), update_rate=0.06,
        )["state"]
        pe = (1.0 - F.cosine_similarity(_norm(brain47["predicted_latent"]), _norm(brain47["current_latent"]), dim=-1, eps=1e-6)).reshape(1,1)
        mts = self.model.multiscale_v56.step(
            self.mts_state, latent=brain47["current_latent"], goal=goal_latent, self_state=self_pred.detach(), memory=mem_read.detach(),
            action=brain47["action"].detach(), body=body, uncertainty=world["horizon_uncertainty"].reshape(1,1), prediction_error=pe,
            confidence=brain47["confidence"].reshape(1,1), fast_rate=self.model.cfg.mts_fast_rate_v56, medium_rate=self.model.cfg.mts_medium_rate_v56,
            slow_rate=self.model.cfg.mts_slow_rate_v56, temperature=self.model.cfg.mts_fusion_temperature_v56,
        )
        self.mts_state = mts["state"]
        features = torch.cat([
            brain46["hidden"], brain47["current_latent"], brain47["workspace"], brain47["predicted_latent"], world["next_latent"],
            brain47["action"], prior_from_memory, world["horizon_uncertainty"].reshape(1,1), brain47["confidence"].reshape(1,1), obs, g,
        ], dim=-1)
        spine = self.model.unified_spine_v80.step(features, self.spine_state)
        self.spine_state = spine["state"].detach()
        refined_read = self.model.neural_memory_v61(spine["memory_context"])["read"]
        refined_prior = 0.25 * torch.tanh(self.model.unified_spine_v80.memory_to_action(refined_read[..., :20]))
        confidence = spine["confidence"].clamp(0.0, 1.0)
        correction = 0.10 * confidence * refined_prior
        action = (brain47["action"] + correction).clamp(-1.0, 1.0)
        self.memory_prior = refined_prior.detach()
        self.steps += 1
        rep = self.model.learning_parameter_report_v82()
        return {
            "action": action,
            "v82_spine_read": spine["read"],
            "v82_spine_erase": spine["erase"],
            "v82_spine_write": spine["write"],
            "v82_spine_decay": spine["decay"],
            "v82_spine_state": self.spine_state,
            "v82_action_correction": correction,
            "v82_active_parameter_fraction": obs.new_tensor([[rep["active_fraction"]]]),
            "v82_runtime_steps": obs.new_tensor([[float(self.steps)]]),
        }

    def state_dict(self):
        return {
            "h46": self.h46.detach().cpu(), "fast47": self.fast47.detach().cpu(), "slow47": self.slow47.detach().cpu(),
            "world_h": self.world_h.detach().cpu(), "spine_state": self.spine_state.detach().cpu(), "memory_prior": self.memory_prior.detach().cpu(),
            "self_state": self.self_state, "mts_state": self.mts_state, "steps": self.steps,
        }

    def load_state_dict(self, state):
        device = next(self.model.parameters()).device; dtype = next(self.model.parameters()).dtype
        self.h46 = state["h46"].to(device=device, dtype=dtype); self.fast47 = state["fast47"].to(device=device, dtype=dtype); self.slow47 = state["slow47"].to(device=device, dtype=dtype)
        self.world_h = state["world_h"].to(device=device, dtype=dtype); self.spine_state = state["spine_state"].to(device=device, dtype=dtype); self.memory_prior = state["memory_prior"].to(device=device, dtype=dtype)
        ss = state["self_state"]
        self.self_state = ss
        ms = state["mts_state"]
        self.mts_state = ms
        self.steps = int(state.get("steps", 0))


class RuntimeStateStoreV82(RuntimeStateStoreV81):
    VERSION = 82

    @classmethod
    def save(cls, path, model, trainer=None, runtime=None):
        torch.save({
            "version_v82": cls.VERSION,
            "base_version": 81,
            "model": model.state_dict(),
            "trainer": trainer.state_dict_v82() if trainer else None,
            "runtime": runtime.state_dict() if runtime else None,
        }, path)

    @classmethod
    def load(cls, path, model, trainer=None, runtime=None):
        p = torch.load(path, map_location="cpu", weights_only=False)
        state = p.get("model", p)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        shape = [k for k in state if k in target and tuple(state[k].shape) != tuple(target[k].shape)]
        missing = [k for k in target if k not in compatible]
        unexpected = [k for k in state if k not in target]
        model.load_state_dict(compatible, strict=False)
        opt = False; reset = False
        if trainer is not None and p.get("trainer") is not None:
            try:
                trainer.load_state_dict_v82(p["trainer"]); opt = True
            except (ValueError, RuntimeError):
                reset = True
        if runtime is not None and p.get("runtime") is not None:
            runtime.load_state_dict(p["runtime"])
        return {
            "version": int(p.get("version_v82", p.get("version_v81", 0))),
            "loaded_tensors": len(compatible),
            "missing_tensors": missing,
            "shape_mismatch": shape,
            "unexpected_tensors": unexpected,
            "optimizer_loaded": opt,
            "optimizer_reset": reset,
        }
