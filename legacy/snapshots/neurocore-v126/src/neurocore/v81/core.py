from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Dict, Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v80 import V80Config, mobile_v80_config, NeuroWeaveV80, OrganismTrainerV80, OrganismRuntimeV80, RuntimeStateStoreV80
from neurocore.v56.core import MultiTimescaleStateV56


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1)


@dataclass
class V81Config(V80Config):
    """V81: cognitive integration of self-model and multi-timescale prediction into the unified spine."""
    unified_self_loss_weight_v81: float = 0.18
    unified_multiscale_loss_weight_v81: float = 0.28
    unified_cognitive_bridge_weight_v81: float = 0.10
    unified_self_state_dim_v81: int = 8
    unified_bridge_scale_v81: float = 0.12
    unified_strategy_version_v81: int = 1


def mobile_v81_config(raw_observation_dim: int = 9) -> V81Config:
    base = dict(mobile_v80_config(raw_observation_dim).__dict__)
    base.update({
        "unified_self_loss_weight_v81": 0.18,
        "unified_multiscale_loss_weight_v81": 0.28,
        "unified_cognitive_bridge_weight_v81": 0.10,
        "unified_self_state_dim_v81": 8,
        "unified_bridge_scale_v81": 0.12,
        "unified_strategy_version_v81": 1,
    })
    return V81Config(**base)


class CognitiveIntegrationBridgeV81(nn.Module):
    """Compact learned cross-system bridge. It transforms self/multiscale evidence into a residual
    over the existing V80 spine feature vector, so both inherited systems affect the same current trunk."""

    def __init__(self, extra_dim: int, feature_dim: int, hidden: int = 32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(extra_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, feature_dim), nn.Tanh(),
        )
        self.gate = nn.Sequential(nn.Linear(extra_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1), nn.Sigmoid())

    def forward(self, extra: Tensor, base_features: Tensor, scale: float) -> Tensor:
        residual = self.net(extra) * self.gate(extra)
        return base_features + float(scale) * residual


class NeuroWeaveV81(NeuroWeaveV80):
    FEATURE_DIM_V81 = NeuroWeaveV80.FEATURE_DIM_V80

    def __init__(self, cfg: Optional[V81Config] = None):
        cfg = cfg or mobile_v81_config(9)
        super().__init__(cfg)
        self.cfg = cfg
        self.cognitive_bridge_v81 = CognitiveIntegrationBridgeV81(
            extra_dim=cfg.mts_hidden_v56 + cfg.unified_self_state_dim_v81 + cfg.action_dim + 1,
            feature_dim=self.FEATURE_DIM_V81,
            hidden=32,
        )
        self._configure_current_learning_contract_v81()

    def _configure_current_learning_contract_v81(self) -> None:
        active_roots = (
            "brain46.", "brain47.", "world_model_v50.", "neural_memory_v61.",
            "unified_spine_v80.", "multiscale_v56.", "self_model_v55.", "cognitive_bridge_v81.",
        )
        for name, p in self.named_parameters():
            keep = any(name.startswith(prefix) for prefix in active_roots)
            if name.startswith("brain46.target_encoder.") or name.startswith("brain47.target_encoder.") or name.startswith("target47."):
                keep = False
            p.requires_grad_(keep if self.cfg.unified_freeze_legacy_v80 else True)
        self._active_learning_parameter_names_v81 = [n for n, p in self.named_parameters() if p.requires_grad]

    def learning_parameter_report_v81(self) -> Dict[str, float]:
        total = sum(p.numel() for p in self.parameters())
        active = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return {"total_parameters": float(total), "active_parameters": float(active),
                "active_fraction": float(active / max(1, total)), "frozen_parameters": float(total-active)}

    def forward_learning_v81(self, x: Tensor, goal_sequence: Optional[Tensor] = None, *, target_latent_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        if x.ndim != 3:
            raise ValueError("x must be [B,T,D]")
        b, t, _ = x.shape
        goals = goal_sequence if goal_sequence is not None else x.new_zeros(b, t, self.cfg.goal_dim)
        if goals.shape != (b, t, self.cfg.goal_dim):
            raise ValueError("goal_sequence shape mismatch")

        h46 = self.brain46.initial(b, x.device, x.dtype)
        fast47 = self.brain47.initial_fast(b, x.device, x.dtype)
        slow47 = self.brain47.initial_slow(b, x.device, x.dtype)
        world_h = self.world_model_v50.initial_hidden(b, x.device, x.dtype)
        spine_state = x.new_zeros(b, self.cfg.unified_hidden_v80)
        memory_prior = x.new_zeros(b, self.cfg.action_dim)
        action_prev = x.new_zeros(b, self.cfg.action_dim)
        self_state = self.self_model_v55.initial_state(b, x.device, x.dtype)
        mts_state = self.multiscale_v56.initial_state(b, x.device, x.dtype)

        feature_rows, self_rows, mts_rows, spine_rows, world_rows, brain_pred_rows = [], [], [], [], [], []
        memory_context_rows, memory_rows, prior_rows = [], [], []
        body = x.new_zeros(b, self.cfg.body_dim)

        for i in range(t):
            obs_t, goal_t = x[:, i], goals[:, i]
            brain46 = self.brain46(obs_t, h46, action_prev if i > 0 else memory_prior, goal_t,
                                  memory_prior=memory_prior, planner_strength=1.0)
            h46 = brain46["hidden"]
            brain47 = self.brain47(obs_t, fast47, slow47, brain46["action"], goal_t, i + 1,
                                  memory_prior=memory_prior, planning_strength=1.0)
            fast47, slow47, action_prev = brain47["fast_hidden"], brain47["slow_hidden"], brain47["action"]
            goal_latent = self.brain46.goal_latent(goal_t)
            world = self.world_model_v50.step(brain47["current_latent"], brain47["action"], goal_latent, world_h, horizon=1)
            world_h = world["hidden"]
            mem_context = self.unified_spine_v80.memory_context_head(spine_state)
            mem_read = self.neural_memory_v61(mem_context)["read"]
            memory_prior = 0.25 * torch.tanh(self.unified_spine_v80.memory_to_action(mem_read[..., :20]))

            self_pred = self.self_model_v55.predict_self(self_state, brain47["current_latent"], goal_latent, brain47["action"], body)
            self_state = replace(self_state, self_state=self_pred.detach(), life_clock=self_state.life_clock + 1.0)

            pe = (1.0 - F.cosine_similarity(_norm(brain47["predicted_latent"]), _norm(brain47["current_latent"]), dim=-1, eps=1e-6)).reshape(-1,1).detach()
            mts = self.multiscale_v56.forward_training(
                mts_state, latent=brain47["current_latent"], goal=goal_latent, self_state=self_pred,
                memory=mem_read, action=brain47["action"], body=body,
                uncertainty=world["horizon_uncertainty"], prediction_error=pe,
                confidence=brain47["confidence"], fast_rate=self.cfg.mts_fast_rate_v56,
                medium_rate=self.cfg.mts_medium_rate_v56, slow_rate=self.cfg.mts_slow_rate_v56,
                temperature=self.cfg.mts_fusion_temperature_v56,
            )
            mts_state = self.multiscale_v56.step(
                mts_state, latent=brain47["current_latent"], goal=goal_latent, self_state=self_pred.detach(),
                memory=mem_read.detach(), action=brain47["action"].detach(), body=body,
                uncertainty=world["horizon_uncertainty"].detach(), prediction_error=pe,
                confidence=brain47["confidence"].detach(), fast_rate=self.cfg.mts_fast_rate_v56,
                medium_rate=self.cfg.mts_medium_rate_v56, slow_rate=self.cfg.mts_slow_rate_v56,
                temperature=self.cfg.mts_fusion_temperature_v56,
            )["state"]
            base_features = torch.cat([
                brain46["hidden"], brain47["current_latent"], brain47["workspace"], brain47["predicted_latent"],
                world["next_latent"], brain47["action"], memory_prior, world["horizon_uncertainty"],
                brain47["confidence"], obs_t, goal_t,
            ], dim=-1)
            extra = torch.cat([mts["fused"], self_pred, memory_prior, brain47["confidence"]], dim=-1)
            enhanced = self.cognitive_bridge_v81(extra, base_features, self.cfg.unified_bridge_scale_v81)
            spine = self.unified_spine_v80.step(enhanced, spine_state)
            spine_state = spine["state"]

            feature_rows.append(enhanced); self_rows.append(self_pred); mts_rows.append(mts["predicted_latent"])
            spine_rows.append(spine); world_rows.append(world["next_latent"]); brain_pred_rows.append(brain47["predicted_latent"])
            memory_rows.append(mem_read); memory_context_rows.append(mem_context); prior_rows.append(memory_prior)

        features = torch.stack(feature_rows,1)
        self_seq = torch.stack(self_rows,1)
        mts_seq = torch.stack(mts_rows,1)
        world_seq = torch.stack(world_rows,1)
        brain_pred_seq = torch.stack(brain_pred_rows,1)
        spine_seq = {k: torch.stack([r[k] for r in spine_rows],1) for k in spine_rows[0]}
        memory_read_seq = torch.stack(memory_rows,1)
        memory_context_seq = torch.stack(memory_context_rows,1)
        memory_prior_seq = torch.stack(prior_rows,1)

        if t < 2:
            zero=x.new_zeros(())
            return {"loss":zero,"memory_loss":zero,"predictive_loss":zero,"world_loss":zero,"spine_loss":zero,
                    "cross_system_loss":zero,"temporal_loss":zero,"self_loss":zero,"multiscale_loss":zero,
                    "features":features,"spine_state":spine_seq["state"],"spine_next_latent":spine_seq["next_latent"],
                    "memory_context":memory_context_seq,"memory_read":memory_read_seq,"memory_prior":memory_prior_seq}

        if target_latent_sequence is None:
            with torch.no_grad():
                target_next = torch.stack([self.brain46.target_latent(x[:, i+1], goals[:, i+1]) for i in range(t-1)],1)
        else:
            target_next = target_latent_sequence
        target = _norm(target_next.detach())
        # Transient evidence for current replay-control extensions. This is intentionally an
        # attribute rather than a registered buffer: it is the last live batch only, never a
        # second memory owner and never checkpointed as learned knowledge.
        self._last_learning_prediction_v98 = spine_seq["next_latent"][:, :-1].detach()
        self._last_learning_target_v98 = target.detach()
        slice_ctx = memory_context_seq[:, :-1].reshape(-1, self.neural_memory_v61.input_dim)
        flat_target = target_next.reshape(-1, target_next.size(-1))
        memory_loss = self.neural_memory_v61.memory_loss(slice_ctx, flat_target)["loss"]
        spine_pred = spine_seq["next_latent"][:, :-1]
        brain_pred = brain_pred_seq[:,:-1]
        predictive_loss = (1.0 - F.cosine_similarity(brain_pred, target, dim=-1)).mean()
        world_loss = (1.0 - F.cosine_similarity(world_seq[:,:-1], target, dim=-1)).mean()
        spine_loss = (1.0 - F.cosine_similarity(spine_pred, target, dim=-1)).mean()
        cross_system_loss = F.smooth_l1_loss(_norm(spine_pred), _norm(mts_seq[:, :-1]).detach())
        temporal_loss = (spine_seq["state"][:,1:] - spine_seq["state"][:,:-1].detach()).pow(2).mean()
        self_target = _norm(self.self_model_v55.latent_proj(target_next.detach()))
        self_loss = (1.0 - F.cosine_similarity(_norm(self_seq[:,:-1]), self_target, dim=-1)).mean()
        multiscale_loss = (1.0 - F.cosine_similarity(_norm(mts_seq[:,:-1]), target, dim=-1)).mean() + 0.15 * F.smooth_l1_loss(_norm(mts_seq[:,1:]), _norm(spine_seq["next_latent"][:,1:]).detach())
        total = (
            self.cfg.unified_memory_loss_weight_v80 * memory_loss +
            self.cfg.unified_predictive_loss_weight_v80 * predictive_loss +
            self.cfg.unified_world_loss_weight_v80 * world_loss +
            self.cfg.unified_spine_loss_weight_v80 * spine_loss +
            self.cfg.unified_cross_system_weight_v80 * cross_system_loss +
            self.cfg.unified_temporal_weight_v80 * temporal_loss +
            self.cfg.unified_self_loss_weight_v81 * self_loss +
            self.cfg.unified_multiscale_loss_weight_v81 * multiscale_loss +
            self.cfg.unified_cognitive_bridge_weight_v81 * cross_system_loss
        )
        return {"loss":total,"memory_loss":memory_loss,"predictive_loss":predictive_loss,"world_loss":world_loss,
                "spine_loss":spine_loss,"cross_system_loss":cross_system_loss,"temporal_loss":temporal_loss,
                "self_loss":self_loss,"multiscale_loss":multiscale_loss,"features":features,
                "spine_state":spine_seq["state"],"spine_next_latent":spine_seq["next_latent"],
                "memory_context":memory_context_seq,"memory_read":memory_read_seq,"memory_prior":memory_prior_seq}


class OrganismTrainerV81(OrganismTrainerV80):
    def __init__(self, model: NeuroWeaveV81, lr: Optional[float] = None, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV81 = model
        self.unified_optimizer_v80 = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=lr or model.cfg.unified_learning_lr_v80, weight_decay=1e-4)
        self.unified_steps_v81 = 0

    def learning_step_v81(self, x: Tensor, goal_sequence: Optional[Tensor] = None, *, target_latent_sequence: Optional[Tensor] = None) -> Dict[str,float]:
        self.model.train(); out=self.model.forward_learning_v81(x, goal_sequence, target_latent_sequence=target_latent_sequence)
        active=[p for p in self.model.parameters() if p.requires_grad]
        self.unified_optimizer_v80.zero_grad(set_to_none=True); out["loss"].backward()
        coverage=self._gradient_coverage_v80()
        nn.utils.clip_grad_norm_(active, self.model.cfg.unified_gradient_clip_v80); self.unified_optimizer_v80.step(); self.unified_steps_v81 += 1
        return {k:float(v.detach().item()) if torch.is_tensor(v) and v.ndim==0 else v for k,v in {
            "loss":out["loss"],"self_loss":out["self_loss"],"multiscale_loss":out["multiscale_loss"],
            "predictive_loss":out["predictive_loss"],"memory_loss":out["memory_loss"],
            "gradient_coverage":torch.tensor(coverage["gradient_coverage"]),"steps":torch.tensor(float(self.unified_steps_v81))}.items()}

    def state_dict_v81(self):
        return {"unified_optimizer":self.unified_optimizer_v80.state_dict(),"unified_steps":self.unified_steps_v81}

    def load_state_dict_v81(self,state):
        if state.get("unified_optimizer") is not None: self.unified_optimizer_v80.load_state_dict(state["unified_optimizer"])
        self.unified_steps_v81=int(state.get("unified_steps",0))


class OrganismRuntimeV81(OrganismRuntimeV80):
    """Compact current runtime that executes the V81 learning spine directly.

    The historical planner stack remains available through older frontier classes, but the
    current V81 runtime no longer pays for that entire inherited path on every step. The live
    path is brain46/47 -> world model -> canonical memory -> self/multiscale context -> V80
    recurrent spine with the V81 cognitive bridge.
    """
    def __init__(self, model: NeuroWeaveV81, trainer: Optional[OrganismTrainerV81] = None):
        self.model = model
        self.trainer = trainer
        dev = next(model.parameters()).device; dt = next(model.parameters()).dtype
        self.h46 = model.brain46.initial(1, dev, dt)
        self.fast47 = model.brain47.initial_fast(1, dev, dt)
        self.slow47 = model.brain47.initial_slow(1, dev, dt)
        self.world_h = model.world_model_v50.initial_hidden(1, dev, dt)
        self.spine_state = torch.zeros(1, model.cfg.unified_hidden_v80, device=dev, dtype=dt)
        self.memory_prior = torch.zeros(1, model.cfg.action_dim, device=dev, dtype=dt)
        self.self_state = model.self_model_v55.initial_state(1, dev, dt)
        self.mts_state = model.multiscale_v56.initial_state(1, dev, dt)
        self.steps = 0

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        obs = observation.reshape(1, -1)
        g8 = goal.reshape(1, -1) if goal is not None else obs.new_zeros(1, self.model.cfg.goal_dim)
        if g8.size(-1) != self.model.cfg.goal_dim:
            raise ValueError(f"V81 runtime goal shape mismatch: expected {self.model.cfg.goal_dim}, got {g8.size(-1)}")
        goal_latent = self.model.brain46.goal_latent(g8)
        brain46 = self.model.brain46(obs, self.h46, self.memory_prior, g8, memory_prior=self.memory_prior, planner_strength=1.0)
        self.h46 = brain46['hidden'].detach()
        brain47 = self.model.brain47(obs, self.fast47, self.slow47, brain46['action'], g8, self.steps + 1, memory_prior=self.memory_prior, planning_strength=1.0)
        self.fast47 = brain47['fast_hidden'].detach(); self.slow47 = brain47['slow_hidden'].detach()
        goal_latent = self.model.brain46.goal_latent(g8)
        world = self.model.world_model_v50.step(brain47['current_latent'], brain47['action'], goal_latent, self.world_h, horizon=1)
        self.world_h = world['hidden'].detach()
        mem_context = self.model.unified_spine_v80.memory_context_head(self.spine_state)
        mem_read = self.model.neural_memory_v61(mem_context)['read']
        prior_from_memory = 0.25 * torch.tanh(self.model.unified_spine_v80.memory_to_action(mem_read[..., :20]))
        body = obs.new_zeros(1, self.model.cfg.body_dim)
        self_pred = self.model.self_model_v55.predict_self(self.self_state, brain47['current_latent'], goal_latent, brain47['action'], body)
        self_state_next = self.model.self_model_v55.observe_outcome(
            self.self_state, prior_prediction=self_pred, next_latent=brain47['current_latent'], goal=goal_latent,
            action=brain47['action'], body=body, reward=obs.new_zeros(1,1), risk=world['horizon_uncertainty'].reshape(1,1),
            prediction_error=obs.new_zeros(1,1), update_rate=0.06,
        )['state']
        self.self_state = self_state_next
        pe = (1.0 - F.cosine_similarity(_norm(brain47['predicted_latent']), _norm(brain47['current_latent']), dim=-1, eps=1e-6)).reshape(1,1)
        mts = self.model.multiscale_v56.step(
            self.mts_state, latent=brain47['current_latent'], goal=goal_latent, self_state=self_pred.detach(), memory=mem_read.detach(),
            action=brain47['action'].detach(), body=body, uncertainty=world['horizon_uncertainty'].reshape(1,1), prediction_error=pe,
            confidence=brain47['confidence'].reshape(1,1), fast_rate=self.model.cfg.mts_fast_rate_v56, medium_rate=self.model.cfg.mts_medium_rate_v56,
            slow_rate=self.model.cfg.mts_slow_rate_v56, temperature=self.model.cfg.mts_fusion_temperature_v56,
        )
        self.mts_state = mts['state']
        base_features = torch.cat([
            brain46['hidden'], brain47['current_latent'], brain47['workspace'], brain47['predicted_latent'], world['next_latent'],
            brain47['action'], prior_from_memory, world['horizon_uncertainty'].reshape(1,1), brain47['confidence'].reshape(1,1), obs, g8,
        ], dim=-1)
        extra = torch.cat([mts['fused'], self_pred, prior_from_memory, brain47['confidence'].reshape(1,1)], dim=-1)
        enriched = self.model.cognitive_bridge_v81(extra, base_features, self.model.cfg.unified_bridge_scale_v81)
        spine = self.model.unified_spine_v80.step(enriched, self.spine_state)
        self.spine_state = spine['state'].detach()
        refined_read = self.model.neural_memory_v61(spine['memory_context'])['read']
        refined_prior = 0.25 * torch.tanh(self.model.unified_spine_v80.memory_to_action(refined_read[..., :20]))
        confidence = spine['confidence'].clamp(0.0,1.0)
        correction = 0.10 * confidence * refined_prior
        action = (brain47['action'] + correction).clamp(-1.0,1.0)
        self.memory_prior = refined_prior.detach()
        self.steps += 1
        report = self.model.learning_parameter_report_v81()
        return {
            'action': action, 'v81_self_prediction': self_pred, 'v81_multiscale_fused': mts['fused'],
            'v81_action_correction': correction, 'v81_runtime_integrated': obs.new_ones(1,1),
            'v81_spine_state': self.spine_state, 'v81_memory_read': refined_read, 'v81_memory_prior': self.memory_prior,
            'v81_active_parameter_fraction': obs.new_tensor([[report['active_fraction']]]),
            'v81_runtime_steps': obs.new_tensor([[float(self.steps)]]),
        }

    def state_dict(self):
        return {
            'h46': self.h46.detach().cpu(), 'fast47': self.fast47.detach().cpu(), 'slow47': self.slow47.detach().cpu(),
            'world_h': self.world_h.detach().cpu(), 'spine_state': self.spine_state.detach().cpu(), 'memory_prior': self.memory_prior.detach().cpu(),
            'self_state': self.self_state, 'mts_state': self.mts_state, 'steps': self.steps,
        }

    def load_state_dict(self, state):
        device=next(self.model.parameters()).device; dtype=next(self.model.parameters()).dtype
        self.h46=state['h46'].to(device=device,dtype=dtype); self.fast47=state['fast47'].to(device=device,dtype=dtype); self.slow47=state['slow47'].to(device=device,dtype=dtype)
        self.world_h=state['world_h'].to(device=device,dtype=dtype); self.spine_state=state['spine_state'].to(device=device,dtype=dtype); self.memory_prior=state['memory_prior'].to(device=device,dtype=dtype)
        ss=state['self_state']
        self.self_state=replace(ss,
            self_state=ss.self_state.to(device=device,dtype=dtype), anchor=ss.anchor.to(device=device,dtype=dtype),
            value_state=ss.value_state.to(device=device,dtype=dtype), commitment_strengths=ss.commitment_strengths.to(device=device,dtype=dtype),
            commitment_success=ss.commitment_success.to(device=device,dtype=dtype), commitment_failure=ss.commitment_failure.to(device=device,dtype=dtype),
            revision_trace=ss.revision_trace.to(device=device,dtype=dtype), life_clock=ss.life_clock.to(device=device,dtype=dtype))
        ms=state['mts_state']
        self.mts_state=replace(ms,
            fast=ms.fast.to(device=device,dtype=dtype), medium=ms.medium.to(device=device,dtype=dtype), slow=ms.slow.to(device=device,dtype=dtype),
            fused=ms.fused.to(device=device,dtype=dtype), predicted_latent=ms.predicted_latent.to(device=device,dtype=dtype),
            uncertainty=ms.uncertainty.to(device=device,dtype=dtype), consistency_error=ms.consistency_error.to(device=device,dtype=dtype))
        self.steps=int(state.get('steps',0))


class RuntimeStateStoreV81(RuntimeStateStoreV80):
    VERSION=81
    @classmethod
    def save(cls,path,model,trainer=None,runtime=None):
        torch.save({"version_v81":cls.VERSION,"base_version":80,"model":model.state_dict(),"trainer":trainer.state_dict_v81() if trainer else None,"runtime":runtime.state_dict() if runtime else None},path)
    @classmethod
    def load(cls,path,model,trainer=None,runtime=None):
        p=torch.load(path,map_location="cpu",weights_only=False); state=p.get("model",p); target=model.state_dict()
        compatible={k:v for k,v in state.items() if k in target and tuple(v.shape)==tuple(target[k].shape)}
        model.load_state_dict(compatible,strict=False)
        opt=False; reset=False
        if trainer is not None and p.get("trainer"):
            try: trainer.load_state_dict_v81(p["trainer"]); opt=True
            except (ValueError,RuntimeError): reset=True
        if runtime is not None and p.get("runtime") is not None: runtime.load_state_dict(p["runtime"])
        return {"version":int(p.get("version_v81",0)),"loaded_tensors":len(compatible),"shape_mismatch":[k for k in state if k in target and tuple(state[k].shape)!=tuple(target[k].shape)],"optimizer_loaded":opt,"optimizer_reset":reset}
