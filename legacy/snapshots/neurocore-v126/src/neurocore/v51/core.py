from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, List, Tuple
import copy
import math

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v50 import (
    V50Config,
    mobile_v50_config,
    NeuroWeaveV50,
    OrganismRuntimeV50,
    OrganismTrainerV50,
    RuntimeStateStoreV50,
)
from neurocore.v48.embodiment import SensorFrameV48


def _batch(x: Tensor) -> Tensor:
    return x.unsqueeze(0) if x.ndim == 1 else x


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return x / x.norm(dim=-1, keepdim=True).clamp_min(eps)


@dataclass
class V51Config(V50Config):
    """V51: actionable world model, grounded utility verification and robust sensor belief."""

    critic_hidden_v51: int = 24
    critic_learning_rate_v51: float = 8e-4
    critic_min_observations_v51: int = 12
    critic_blend_v51: float = 0.30
    critic_uncertainty_penalty_v51: float = 0.10
    critic_admission_margin_v51: float = 0.012
    critic_action_candidates_v51: int = 3
    critic_candidate_noise_v51: float = 0.07
    critic_action_support_v51: float = 0.16
    critic_horizon_v51: int = 3
    critic_compute_gate_uncertainty_v51: float = 0.35
    probe_probability_v51: float = 0.18
    probe_noise_v51: float = 0.045
    probe_action_support_v51: float = 0.10
    probe_max_risk_v51: float = 0.25
    probe_max_regime_v51: float = 0.30
    regime_window_v51: int = 12
    regime_threshold_v51: float = 2.2
    regime_recovery_rate_v51: float = 0.88
    regime_sensor_weight_v51: float = 0.35
    option_commit_steps_v51: int = 2
    option_max_uncertainty_v51: float = 0.35
    option_max_regime_v51: float = 0.80
    sensor_filter_tau_v51: float = 250.0
    sensor_process_noise_v51: float = 0.015
    sensor_measurement_floor_v51: float = 0.05
    sensor_max_staleness_ms_v51: int = 2500
    outcome_memory_capacity_v51: int = 256
    outcome_memory_top_k_v51: int = 8
    outcome_memory_min_items_v51: int = 6
    outcome_memory_bandwidth_v51: float = 0.35
    outcome_memory_blend_v51: float = 0.0
    outcome_memory_gate_uncertainty_v51: float = 0.55
    outcome_memory_uncertainty_penalty_v51: float = 0.10
    runtime_state_version_v51: int = 1


def mobile_v51_config(raw_observation_dim: int = 9) -> V51Config:
    base = dict(mobile_v50_config(raw_observation_dim).__dict__)
    return V51Config(**base,
        critic_hidden_v51=24, critic_learning_rate_v51=8e-4,
        critic_min_observations_v51=24, critic_blend_v51=0.28,
        critic_uncertainty_penalty_v51=0.10, critic_admission_margin_v51=0.012,
        critic_action_candidates_v51=1, critic_candidate_noise_v51=0.065,
        critic_action_support_v51=0.16, critic_horizon_v51=2,
        critic_compute_gate_uncertainty_v51=0.35,
        probe_probability_v51=0.18, probe_noise_v51=0.045, probe_action_support_v51=0.10,
        probe_max_risk_v51=0.25, probe_max_regime_v51=0.30,
        regime_window_v51=12, regime_threshold_v51=2.2,
        regime_recovery_rate_v51=0.88, regime_sensor_weight_v51=0.35,
        option_commit_steps_v51=2, option_max_uncertainty_v51=0.35,
        option_max_regime_v51=0.80, sensor_filter_tau_v51=250.0,
        sensor_process_noise_v51=0.015, sensor_measurement_floor_v51=0.05,
        sensor_max_staleness_ms_v51=2500, outcome_memory_capacity_v51=256, outcome_memory_top_k_v51=8,
        outcome_memory_min_items_v51=6, outcome_memory_bandwidth_v51=0.35, outcome_memory_blend_v51=0.0,
        outcome_memory_gate_uncertainty_v51=0.55, outcome_memory_uncertainty_penalty_v51=0.10, runtime_state_version_v51=1)


class ActionUtilityCriticV51(nn.Module):
    """Learns realized utility separately from the world model."""
    def __init__(self, latent_dim: int, goal_latent_dim: int, action_dim: int, hidden: int = 24):
        super().__init__()
        self.input_dim = latent_dim + goal_latent_dim + action_dim + 4
        self.body = nn.Sequential(
            nn.Linear(self.input_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
        )
        self.mean = nn.Linear(hidden, 1)
        self.log_scale = nn.Linear(hidden, 1)

    def _features(self, latent, goal, action, reward_pred, risk_pred, uncertainty, sensor_health):
        return torch.cat([
            _batch(latent), _batch(goal), _batch(action),
            _batch(reward_pred).reshape(-1, 1), _batch(risk_pred).reshape(-1, 1),
            _batch(uncertainty).reshape(-1, 1), _batch(sensor_health).reshape(-1, 1),
        ], dim=-1)

    def forward(self, latent, goal, action, reward_pred, risk_pred, uncertainty, sensor_health):
        h = self.body(self._features(latent, goal, action, reward_pred, risk_pred, uncertainty, sensor_health))
        scale = (F.softplus(self.log_scale(h)) + 0.03).clamp(0.03, 2.0)
        return {"mean": self.mean(h), "scale": scale}


class UncertaintyWeightedSensorBeliefV51:
    """Recursive uncertainty-weighted sensor belief; never fabricates missing inputs."""
    def __init__(self, feature_dim: int, tau_ms: float = 250.0, process_noise: float = 0.015,
                 measurement_floor: float = 0.05, max_staleness_ms: int = 2500):
        self.feature_dim = int(feature_dim)
        self.tau_ms = float(max(1.0, tau_ms))
        self.process_noise = float(max(0.0, process_noise))
        self.measurement_floor = float(max(1e-4, measurement_floor))
        self.max_staleness_ms = int(max(1, max_staleness_ms))
        self.estimate = torch.zeros(self.feature_dim)
        self.variance = torch.ones(self.feature_dim)
        self.last_update_ms: Optional[int] = None
        self.updates = 0

    def update(self, values: Tensor, mask: Tensor, now_ms: Optional[int] = None) -> Dict[str, Tensor]:
        values, mask = _batch(values).detach().float().cpu(), _batch(mask).detach().float().cpu().clamp(0.0, 1.0)
        if values.size(-1) != self.feature_dim or mask.size(-1) != self.feature_dim:
            raise ValueError(f"sensor belief schema mismatch: expected {self.feature_dim}")
        dt = 0.0 if (self.last_update_ms is None or now_ms is None) else max(0.0, float(now_ms - self.last_update_ms))
        decay = math.exp(-dt / self.tau_ms) if dt > 0 else 1.0
        prior_var = self.variance + self.process_noise * (1.0 + dt / self.tau_ms)
        meas_var = torch.full_like(prior_var, self.measurement_floor)
        gain = prior_var / (prior_var + meas_var)
        valid = mask[0] > 0.5
        current = values[0]
        self.estimate = torch.where(valid, self.estimate + gain * (current - self.estimate), self.estimate * decay)
        self.variance = torch.where(valid, (1.0 - gain) * prior_var, prior_var)
        self.last_update_ms = int(now_ms) if now_ms is not None else self.last_update_ms
        self.updates += 1
        confidence = 1.0 / (1.0 + self.variance)
        freshness = mask[0].clone()
        if dt > self.max_staleness_ms:
            freshness.zero_()
        return {
            "values": self.estimate.clone(), "variance": self.variance.clone(),
            "confidence": confidence, "freshness": freshness,
            "health": confidence.mean().clamp(0.0, 1.0),
        }

    def state_dict(self):
        return {"feature_dim": self.feature_dim, "tau_ms": self.tau_ms, "process_noise": self.process_noise,
                "measurement_floor": self.measurement_floor, "max_staleness_ms": self.max_staleness_ms,
                "estimate": self.estimate, "variance": self.variance,
                "last_update_ms": self.last_update_ms, "updates": self.updates}

    def load_state_dict(self, state):
        self.feature_dim = int(state.get("feature_dim", self.feature_dim))
        self.tau_ms = float(state.get("tau_ms", self.tau_ms))
        self.process_noise = float(state.get("process_noise", self.process_noise))
        self.measurement_floor = float(state.get("measurement_floor", self.measurement_floor))
        self.max_staleness_ms = int(state.get("max_staleness_ms", self.max_staleness_ms))
        self.estimate = state.get("estimate", self.estimate).detach().cpu().float().clone()
        self.variance = state.get("variance", self.variance).detach().cpu().float().clone()
        self.last_update_ms = state.get("last_update_ms", self.last_update_ms)
        self.updates = int(state.get("updates", 0))


class RegimeMonitorV51:
    """Lightweight sequential drift monitor for prediction-error distribution changes."""
    def __init__(self, window: int = 12, threshold: float = 2.2, recovery_rate: float = 0.88, sensor_weight: float = 0.35):
        self.window = int(max(4, window)); self.threshold = float(max(0.5, threshold))
        self.recovery_rate = float(min(0.999, max(0.5, recovery_rate))); self.sensor_weight = float(min(1.0, max(0.0, sensor_weight)))
        self.errors: List[float] = []; self.baseline_ema = 0.1; self.shift_ema = 0.0; self.severity = 0.0; self.stable_steps = 0

    def update(self, prediction_error: float, uncertainty: float, sensor_health: float = 1.0) -> Dict[str, float]:
        ratio = max(0.0, float(prediction_error)) / max(1e-3, float(uncertainty))
        self.errors.append(ratio); self.errors = self.errors[-self.window:]
        if len(self.errors) < 4:
            self.baseline_ema = 0.9 * self.baseline_ema + 0.1 * ratio
            return self.summary()
        mean = sum(self.errors) / len(self.errors); var = sum((x - mean) ** 2 for x in self.errors) / max(1, len(self.errors)-1)
        z = (ratio - self.baseline_ema) / max(math.sqrt(max(1e-6, var)), 0.25)
        sensor_penalty = self.sensor_weight * (1.0 - float(max(0.0, min(1.0, sensor_health))))
        positive_shift = max(0.0, z)
        raw = min(4.0, positive_shift + sensor_penalty)
        self.shift_ema = self.recovery_rate * self.shift_ema + (1.0 - self.recovery_rate) * raw
        self.baseline_ema = 0.96 * self.baseline_ema + 0.04 * ratio
        stable = raw <= 0.5 and ratio <= max(0.25, self.baseline_ema * 1.25)
        if raw > self.threshold:
            self.stable_steps = 0
        elif stable:
            self.stable_steps += 1
        else:
            self.stable_steps = max(0, self.stable_steps - 1)
        if stable:
            self.shift_ema *= min(0.75, self.recovery_rate)
        self.severity = min(1.0, self.shift_ema / self.threshold)
        return self.summary()

    def summary(self):
        return {"regime_ratio_ema": float(self.baseline_ema), "regime_shift_ema": float(self.shift_ema),
                "regime_severity": float(self.severity), "regime_shift": float(self.severity >= 0.5),
                "stable_steps": float(self.stable_steps)}

    def state_dict(self):
        return {"window": self.window, "threshold": self.threshold, "recovery_rate": self.recovery_rate,
                "sensor_weight": self.sensor_weight, "errors": list(self.errors), "baseline_ema": self.baseline_ema,
                "shift_ema": self.shift_ema, "severity": self.severity, "stable_steps": self.stable_steps}

    def load_state_dict(self, state):
        self.window=int(state.get("window", self.window)); self.threshold=float(state.get("threshold", self.threshold))
        self.recovery_rate=float(state.get("recovery_rate", self.recovery_rate)); self.sensor_weight=float(state.get("sensor_weight", self.sensor_weight))
        self.errors=[float(x) for x in state.get("errors", [])][-self.window:]
        self.baseline_ema=float(state.get("baseline_ema", self.baseline_ema)); self.shift_ema=float(state.get("shift_ema", self.shift_ema))
        self.severity=float(state.get("severity", self.severity)); self.stable_steps=int(state.get("stable_steps", 0))


class OptionCommitmentV51:
    """Short option/chunk commitment, invalidated by regime or uncertainty."""
    def __init__(self, max_steps: int = 2): self.max_steps=int(max(1,max_steps)); self.clear()
    def clear(self): self.action=None; self.remaining=0; self.origin_step=-1
    def can_commit(self, uncertainty, regime, max_uncertainty, max_regime):
        return self.action is not None and self.remaining>0 and uncertainty<=max_uncertainty and regime<=max_regime
    def start(self, action, step, steps):
        self.action=_batch(action).detach().cpu().clone(); self.remaining=int(max(1,min(self.max_steps,steps))); self.origin_step=int(step)
    def consume(self):
        if self.action is None or self.remaining<=0: return None
        out=self.action.clone(); self.remaining-=1
        if self.remaining<=0: self.clear()
        return out
    def state_dict(self): return {"action":self.action,"remaining":self.remaining,"origin_step":self.origin_step,"max_steps":self.max_steps}
    def load_state_dict(self,state):
        self.max_steps=int(state.get("max_steps",self.max_steps)); self.action=state.get("action")
        if self.action is not None: self.action=self.action.detach().cpu().clone()
        self.remaining=int(state.get("remaining",0)); self.origin_step=int(state.get("origin_step",-1))




class SafeProbeControllerV51:
    """Collects local counterfactual evidence through bounded, gated probes.

    A probe is allowed only when the current regime is stable, sensor quality is
    acceptable and the predicted one-step risk is below the configured limit.
    The action perturbation is bounded around the already accepted baseline.
    """
    def __init__(self, probability: float = 0.18, noise: float = 0.045, support: float = 0.10, max_risk: float = 0.25, max_regime: float = 0.30):
        self.probability=float(min(1.0,max(0.0,probability))); self.noise=float(max(0.0,noise)); self.support=float(max(0.0,support)); self.max_risk=float(max(0.0,max_risk)); self.max_regime=float(max(0.0,max_regime)); self.probes=0
    @torch.no_grad()
    def maybe_probe(self, baseline: Tensor, predicted_risk: float, regime: float, sensor_health: float, enabled: bool = True) -> Tuple[Tensor,bool]:
        baseline=_batch(baseline)
        safe = enabled and predicted_risk <= self.max_risk and regime <= self.max_regime and sensor_health >= 0.7
        if not safe or float(torch.rand((),device=baseline.device).item()) >= self.probability:
            return baseline, False
        local=(baseline+torch.randn_like(baseline)*self.noise).clamp(-1.0,1.0)
        delta=(local-baseline).clamp(-self.support,self.support)
        self.probes += 1
        return (baseline+delta).clamp(-1.0,1.0), True
    def state_dict(self):
        return {"probability":self.probability,"noise":self.noise,"support":self.support,"max_risk":self.max_risk,"max_regime":self.max_regime,"probes":self.probes}
    def load_state_dict(self,state):
        self.probability=float(state.get("probability",self.probability)); self.noise=float(state.get("noise",self.noise)); self.support=float(state.get("support",self.support)); self.max_risk=float(state.get("max_risk",self.max_risk)); self.max_regime=float(state.get("max_regime",self.max_regime)); self.probes=int(state.get("probes",0))


class ActionOutcomeMemoryV51:
    """Data-efficient grounded action-value memory.

    Stores observed (latent, goal, action) -> realized utility outcomes. Queries use
    normalized distance-weighted neighbors, which is intentionally non-parametric:
    with sparse evidence it can outperform a tiny critic without inventing gradients.
    """
    def __init__(self, latent_dim: int, goal_dim: int, action_dim: int, capacity: int = 256,
                 top_k: int = 8, min_items: int = 6, bandwidth: float = 0.35,
                 uncertainty_floor: float = 0.05):
        self.latent_dim=int(latent_dim); self.goal_dim=int(goal_dim); self.action_dim=int(action_dim)
        self.capacity=int(max(1, capacity)); self.top_k=int(max(1, top_k)); self.min_items=int(max(1, min_items))
        self.bandwidth=float(max(1e-3, bandwidth)); self.uncertainty_floor=float(max(1e-4, uncertainty_floor))
        self.keys: List[Tensor]=[]; self.utilities: List[float]=[]; self.steps: List[int]=[]; self.next_step=0

    def _key(self, latent: Tensor, goal: Tensor, action: Tensor) -> Tensor:
        z=_batch(latent).detach().cpu().float(); g=_batch(goal).detach().cpu().float(); a=_batch(action).detach().cpu().float()
        if z.size(-1)!=self.latent_dim or g.size(-1)!=self.goal_dim or a.size(-1)!=self.action_dim:
            raise ValueError('action outcome memory schema mismatch')
        return _norm(torch.cat([z,g,a],dim=-1))[0]

    @property
    def count(self) -> int:
        return len(self.keys)

    @property
    def ready(self) -> bool:
        return self.count >= self.min_items

    def add(self, latent: Tensor, goal: Tensor, action: Tensor, realized_utility: float, step: Optional[int] = None):
        key=self._key(latent,goal,action); util=float(realized_utility)
        self.keys.append(key); self.utilities.append(util); self.steps.append(int(self.next_step if step is None else step)); self.next_step += 1
        if len(self.keys)>self.capacity:
            self.keys=self.keys[-self.capacity:]; self.utilities=self.utilities[-self.capacity:]; self.steps=self.steps[-self.capacity:]

    @torch.no_grad()
    def query(self, latent: Tensor, goal: Tensor, actions: Tensor) -> Dict[str, Tensor]:
        actions=_batch(actions).detach().cpu().float(); n=actions.size(0)
        device=actions.device
        if not self.ready:
            return {'mean':torch.zeros(n), 'scale':torch.ones(n), 'distance':torch.full((n,),1.0), 'count':torch.zeros(n)}
        query_base=torch.cat([_batch(latent).detach().cpu().float().repeat(n,1), _batch(goal).detach().cpu().float().repeat(n,1), actions],dim=-1)
        q=_norm(query_base)
        bank=torch.stack(self.keys,0); vals=torch.tensor(self.utilities,dtype=torch.float32)
        dist=1.0 - q @ bank.T
        k=min(self.top_k, bank.size(0)); nearest,idx=torch.topk(dist,k=k,largest=False,dim=1)
        w=torch.softmax(-nearest/max(1e-3,self.bandwidth),dim=1)
        v=vals[idx]
        mean=(w*v).sum(1)
        var=(w*(v-mean.unsqueeze(1)).pow(2)).sum(1)
        scale=torch.sqrt(var + self.uncertainty_floor**2) + 0.25*nearest.mean(1)
        return {'mean':mean.to(device), 'scale':scale.to(device), 'distance':nearest.mean(1).to(device), 'count':torch.full((n,),float(k),device=device)}

    def state_dict(self):
        return {'latent_dim':self.latent_dim,'goal_dim':self.goal_dim,'action_dim':self.action_dim,
                'capacity':self.capacity,'top_k':self.top_k,'min_items':self.min_items,'bandwidth':self.bandwidth,
                'uncertainty_floor':self.uncertainty_floor,'keys':self.keys,'utilities':self.utilities,
                'steps':self.steps,'next_step':self.next_step}

    def load_state_dict(self,state):
        self.latent_dim=int(state.get('latent_dim',self.latent_dim)); self.goal_dim=int(state.get('goal_dim',self.goal_dim)); self.action_dim=int(state.get('action_dim',self.action_dim))
        self.capacity=int(state.get('capacity',self.capacity)); self.top_k=int(state.get('top_k',self.top_k)); self.min_items=int(state.get('min_items',self.min_items)); self.bandwidth=float(state.get('bandwidth',self.bandwidth)); self.uncertainty_floor=float(state.get('uncertainty_floor',self.uncertainty_floor))
        self.keys=[k.detach().cpu().float().clone() for k in state.get('keys',[])]; self.utilities=[float(v) for v in state.get('utilities',[])]; self.steps=[int(v) for v in state.get('steps',[])]; self.next_step=int(state.get('next_step',len(self.keys)))



class CounterfactualActionVerifierV51:
    def __init__(self, cfg: V51Config, critic: ActionUtilityCriticV51, outcome_memory: Optional[ActionOutcomeMemoryV51] = None):
        self.cfg=cfg; self.critic=critic; self.outcome_memory=outcome_memory
    @torch.no_grad()
    def candidates(self, baseline, proposed):
        baseline, proposed=_batch(baseline),_batch(proposed)
        support=float(self.cfg.critic_action_support_v51)
        proposed=(baseline + (proposed-baseline).clamp(-support, support)).clamp(-1.0,1.0)
        items=[baseline,proposed]
        for _ in range(max(0,int(self.cfg.critic_action_candidates_v51))):
            local=(proposed+torch.randn_like(proposed)*self.cfg.critic_candidate_noise_v51).clamp(-1,1)
            delta=(local-baseline).clamp(-self.cfg.critic_action_support_v51,self.cfg.critic_action_support_v51)
            items.append((baseline+delta).clamp(-1,1))
        return torch.cat(items,0)
    @torch.no_grad()
    def select(self, world_model, current_latent, goal_latent, baseline, proposed, horizon, regime_severity, critic_ready, sensor_health=1.0):
        baseline,proposed=_batch(baseline),_batch(proposed)
        memory_candidate_ready=bool(self.outcome_memory is not None and self.outcome_memory.ready)
        # Do not pay retrieval cost unless the feature is explicitly enabled.
        memory_enabled=float(self.cfg.outcome_memory_blend_v51)>0.0
        memory_ready=bool(memory_enabled and memory_candidate_ready)
        if not critic_ready and not memory_ready:
            return proposed,{"critic51_ready":baseline.new_zeros((1,1)),"critic51_accepted":baseline.new_zeros((1,1)),"critic51_margin":baseline.new_zeros((1,1)),"critic51_memory_ready":baseline.new_zeros((1,1))}
        cand=self.candidates(baseline,proposed); n=cand.size(0)
        z=current_latent.repeat(n,1); g=goal_latent.repeat(n,1)
        roll_actions=cand.unsqueeze(1).expand(-1,max(1,int(horizon)),-1)
        roll=world_model.rollout(z,roll_actions,g); endpoint=roll["latents"][:,-1]
        reward=roll["rewards"].mean(1).squeeze(-1); risk=roll["risks"].mean(1).squeeze(-1); unc=roll["horizon_uncertainty"].mean(1).squeeze(-1)
        distance=1.0-F.cosine_similarity(endpoint,g,dim=-1); world_score=-distance+0.05*reward-0.16*risk-0.08*unc
        pred=world_model.step(z,cand,g,world_model.initial_hidden(n),horizon=max(1,int(horizon)))
        health=cand.new_full((n,),float(max(0,min(1,sensor_health))))
        crit=self.critic(z,g,cand,pred["reward"].squeeze(-1),pred["risk"].squeeze(-1),pred["horizon_uncertainty"].squeeze(-1),health)
        neural=crit["mean"].squeeze(-1)-self.cfg.critic_uncertainty_penalty_v51*crit["scale"].squeeze(-1)
        if memory_ready:
            mem=self.outcome_memory.query(current_latent,goal_latent,cand)
            # Uncertainty-gated retrieval: enabled memory only spends compute when the
            # current world model is sufficiently uncertain. This preserves mobile efficiency.
            query_enabled=float(unc.mean().item()) >= float(self.cfg.outcome_memory_gate_uncertainty_v51) or not critic_ready
            if not query_enabled:
                memory_ready=False
                mem={"mean":torch.zeros_like(neural),"scale":torch.ones_like(neural)}
                memory_utility=torch.zeros_like(neural)
            else:
                memory_utility=mem["mean"]-self.cfg.outcome_memory_uncertainty_penalty_v51*mem["scale"]
        else:
            memory_utility=torch.zeros_like(neural)
        neural_blend=float(self.cfg.critic_blend_v51) if critic_ready else 0.0
        neural_blend=neural_blend if regime_severity<0.5 else min(0.08,neural_blend)
        memory_blend=float(self.cfg.outcome_memory_blend_v51) if memory_ready else 0.0
        total_aux=neural_blend+memory_blend
        if total_aux>0.98:
            memory_blend*=0.98/total_aux; neural_blend*=0.98/total_aux
        combined=(1-neural_blend-memory_blend)*world_score+neural_blend*neural+memory_blend*memory_utility
        best=int(torch.argmax(combined).item())
        base_actions=baseline.unsqueeze(1).expand(-1,max(1,int(horizon)),-1)
        baseline_roll=world_model.rollout(current_latent,base_actions,goal_latent)
        base_world=(-(1.0-F.cosine_similarity(baseline_roll["latents"][:,-1],goal_latent,dim=-1))
                     +0.05*baseline_roll["rewards"].mean(1).squeeze(-1)
                     -0.16*baseline_roll["risks"].mean(1).squeeze(-1)
                     -0.08*baseline_roll["horizon_uncertainty"].mean(1).squeeze(-1))[0]
        base_aux=0.0
        if critic_ready: base_aux += neural_blend*neural[0]
        if memory_ready: base_aux += memory_blend*memory_utility[0]
        base_comb=(1-neural_blend-memory_blend)*base_world+base_aux
        margin=combined[best]-base_comb
        evidence_ready=critic_ready or memory_ready
        accept=bool(evidence_ready and margin.item()>self.cfg.critic_admission_margin_v51 and regime_severity<0.95)
        chosen=cand[best:best+1] if accept else baseline
        return chosen,{"critic51_ready":baseline.new_tensor([[1.0 if critic_ready else 0.0]]),"critic51_accepted":baseline.new_tensor([[1.0 if accept else 0.0]]),
                       "critic51_margin":margin.reshape(1,1),"critic51_candidate_count":baseline.new_tensor([[float(n)]]),
                       "critic51_world_score":world_score[best].reshape(1,1),"critic51_utility":combined[best].reshape(1,1),
                       "critic51_utility_scale":crit["scale"][best].reshape(1,1),"critic51_regime":baseline.new_tensor([[float(regime_severity)]]),
                       "critic51_memory_ready":baseline.new_tensor([[1.0 if memory_ready else 0.0]]),
                       "critic51_memory_utility":memory_utility[best].reshape(1,1),
                       "critic51_memory_scale":(mem["scale"][best].reshape(1,1) if memory_ready else baseline.new_ones((1,1)))}


class NeuroWeaveV51(NeuroWeaveV50):
    def __init__(self, cfg: Optional[V51Config] = None):
        super().__init__(cfg or V51Config())
        self.cfg: V51Config
        self.action_utility_critic_v51=ActionUtilityCriticV51(self.cfg.latent_dim_v46,self.cfg.latent_dim_v46,self.cfg.action_dim,self.cfg.critic_hidden_v51)
        self.action_verifier_v51=CounterfactualActionVerifierV51(self.cfg,self.action_utility_critic_v51)


class OrganismRuntimeV51(OrganismRuntimeV50):
    def __init__(self, model: NeuroWeaveV51, trainer: Optional["OrganismTrainerV51"] = None):
        super().__init__(model,trainer); self.model=model; self.trainer=trainer
        self.sensor_belief_v51=UncertaintyWeightedSensorBeliefV51(self.model.cfg.sensor_fusion_feature_dim_v50,self.model.cfg.sensor_filter_tau_v51,
            self.model.cfg.sensor_process_noise_v51,self.model.cfg.sensor_measurement_floor_v51,self.model.cfg.sensor_max_staleness_ms_v51)
        self.regime_v51=RegimeMonitorV51(self.model.cfg.regime_window_v51,self.model.cfg.regime_threshold_v51,self.model.cfg.regime_recovery_rate_v51,self.model.cfg.regime_sensor_weight_v51)
        self.option_v51=OptionCommitmentV51(self.model.cfg.option_commit_steps_v51)
        self.probe_v51=SafeProbeControllerV51(self.model.cfg.probe_probability_v51,self.model.cfg.probe_noise_v51,self.model.cfg.probe_action_support_v51,self.model.cfg.probe_max_risk_v51,self.model.cfg.probe_max_regime_v51)
        self.utility_memory_v51=ActionOutcomeMemoryV51(self.model.cfg.latent_dim_v46,self.model.cfg.latent_dim_v46,self.model.cfg.action_dim,
            self.model.cfg.outcome_memory_capacity_v51,self.model.cfg.outcome_memory_top_k_v51,self.model.cfg.outcome_memory_min_items_v51,
            self.model.cfg.outcome_memory_bandwidth_v51)
        self.model.action_verifier_v51.outcome_memory=self.utility_memory_v51
        self.critic_observations_v51=0; self._pending_critic_features=None; self._sensor_health_v51=1.0

    @torch.no_grad()
    def step(self, observation, goal=None):
        out=super().step(observation,goal=goal); regime=float(self.regime_v51.severity)
        uncertainty=float(out.get("world50_uncertainty",observation.new_zeros((1,1))).mean().item())
        committed=self.option_v51.consume() if self.option_v51.can_commit(uncertainty,regime,self.model.cfg.option_max_uncertainty_v51,self.model.cfg.option_max_regime_v51) else None
        if committed is None:
            baseline=out["chosen_action_v48"]; proposed=out["chosen_action_v50"]
            horizon=max(1,min(int(self.model.cfg.critic_horizon_v51),int(round(float(out["world50_horizon"].mean().item())))))
            critic_ready=self.critic_observations_v51>=self.model.cfg.critic_min_observations_v51
            compute_ready=critic_ready and (uncertainty>=self.model.cfg.critic_compute_gate_uncertainty_v51 or regime>=0.5)
            chosen,meta=self.model.action_verifier_v51.select(self.model.world_model_v50,out["brain_current_latent_v47"],out["brain_subgoal_v47"],baseline,proposed,horizon,regime,compute_ready,self._sensor_health_v51)
            meta["critic51_compute_gate"] = observation.new_tensor([[1.0 if compute_ready else 0.0]])
            out.update(meta); final=chosen; probed=False
            memory_ready=bool(self.utility_memory_v51.ready)
            if not critic_ready and not memory_ready:
                probe_action,probed=self.probe_v51.maybe_probe(baseline,float(out["brain_predicted_risk_v47"].mean().item()),regime,self._sensor_health_v51,enabled=True)
                if probed:
                    final=probe_action; out["critic51_probe"]=observation.new_tensor([[1.0]])
            if float(meta["critic51_accepted"].mean().item())>0.5: self.option_v51.start(final,self.state.step_index,self.model.cfg.option_commit_steps_v51)
        else:
            final=committed.to(observation); out.update({"critic51_ready":observation.new_tensor([[1.0 if self.critic_observations_v51>=self.model.cfg.critic_min_observations_v51 else 0.0]]),"critic51_accepted":observation.new_tensor([[1.0]]),"critic51_margin":observation.new_zeros((1,1)),"critic51_option_reuse":observation.new_tensor([[1.0]])})
        self._pending_action=final[0].detach().cpu()
        self._pending_critic_features={"latent":out["brain_current_latent_v47"].detach().cpu(),"goal":out["brain_subgoal_v47"].detach().cpu(),"action":final.detach().cpu(),
            "reward_pred":out["brain_predicted_reward_v47"].detach().cpu(),"risk_pred":out["brain_predicted_risk_v47"].detach().cpu(),"uncertainty":out.get("world50_uncertainty",observation.new_zeros((1,1))).detach().cpu(),"sensor_health":observation.new_tensor([[self._sensor_health_v51]]).detach().cpu()}
        out["chosen_action_v51"]=final; out["regime51_severity"]=observation.new_tensor([[regime]]); out["sensor51_health"]=observation.new_tensor([[self._sensor_health_v51]])
        return out

    def observe_transition(self,next_observation,*,actual_reward,actual_risk,goal=None,update_world_model=True):
        result=super().observe_transition(next_observation,actual_reward=actual_reward,actual_risk=actual_risk,goal=goal,update_world_model=update_world_model)
        regime=self.regime_v51.update(result["latent_error"],result["uncertainty"],self._sensor_health_v51); utility=float(actual_reward)-0.5*float(actual_risk)
        loss=0.0
        if self.trainer is not None and self._pending_critic_features is not None:
            f=self._pending_critic_features
            self.utility_memory_v51.add(f["latent"],f["goal"],f["action"],utility,step=int(self.state.step_index))
            loss=self.trainer.train_action_utility(**f,realized_utility=utility); self.critic_observations_v51+=1
        result.update({"critic51_training_loss":float(loss),"critic51_observations":float(self.critic_observations_v51),**regime})
        return result

    @torch.no_grad()
    def step_sensor_frame(self,frame: SensorFrameV48 | Dict[str,Any],goal=None,now_ms=None):
        self.telemetry.ingest(frame); values,mask=self.telemetry.vector_and_mask(now_ms); belief=self.sensor_belief_v51.update(values,mask,now_ms); self._sensor_health_v51=float(belief["health"].item())
        fused=self.model.sensor_fusion_v50(belief["values"].unsqueeze(0),mask); out=self.step(fused["observation"],goal=goal)
        out["sensor51_mean_confidence"]=belief["confidence"].mean().reshape(1,1).to(out["chosen_action_v51"]); out["sensor51_fresh_fraction"]=belief["freshness"].mean().reshape(1,1).to(out["chosen_action_v51"]); return out

    def state_dict(self):
        return {**super().state_dict(),"sensor_belief_v51":self.sensor_belief_v51.state_dict(),"regime_v51":self.regime_v51.state_dict(),"option_v51":self.option_v51.state_dict(),"probe_v51":self.probe_v51.state_dict(),
                "critic_observations_v51":self.critic_observations_v51,"pending_critic_features_v51":copy.deepcopy(self._pending_critic_features),"sensor_health_v51":self._sensor_health_v51,
                "utility_memory_v51":self.utility_memory_v51.state_dict()}

    def load_state_dict(self,state):
        super().load_state_dict(state)
        if state.get("sensor_belief_v51") is not None: self.sensor_belief_v51.load_state_dict(state["sensor_belief_v51"])
        if state.get("regime_v51") is not None: self.regime_v51.load_state_dict(state["regime_v51"])
        if state.get("option_v51") is not None: self.option_v51.load_state_dict(state["option_v51"])
        if state.get("probe_v51") is not None: self.probe_v51.load_state_dict(state["probe_v51"])
        self.critic_observations_v51=int(state.get("critic_observations_v51",0)); self._pending_critic_features=state.get("pending_critic_features_v51"); self._sensor_health_v51=float(state.get("sensor_health_v51",1.0))
        if state.get("utility_memory_v51") is not None: self.utility_memory_v51.load_state_dict(state["utility_memory_v51"]); self.model.action_verifier_v51.outcome_memory=self.utility_memory_v51


class OrganismTrainerV51(OrganismTrainerV50):
    def __init__(self,model:NeuroWeaveV51,lr:float=3e-4,warmup_steps:int=4,external_verifier=None):
        super().__init__(model,lr=lr,warmup_steps=warmup_steps,external_verifier=external_verifier); self.model=model
        self.critic_optimizer_v51=torch.optim.Adam(self.model.action_utility_critic_v51.parameters(),lr=self.model.cfg.critic_learning_rate_v51); self.critic_update_steps_v51=0
    def train_action_utility(self,latent,goal,action,reward_pred,risk_pred,uncertainty,sensor_health,realized_utility):
        device=next(self.model.parameters()).device
        tensors=[_batch(x).to(device) for x in (latent,goal,action,reward_pred,risk_pred,uncertainty,sensor_health)]; latent,goal,action,reward_pred,risk_pred,uncertainty,sensor_health=tensors
        out=self.model.action_utility_critic_v51(latent,goal,action,reward_pred,risk_pred,uncertainty,sensor_health); target=torch.full_like(out["mean"],float(realized_utility)); var=out["scale"].pow(2).clamp_min(1e-4)
        loss=((out["mean"]-target).pow(2)/var+torch.log(var)).mean(); self.critic_optimizer_v51.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.action_utility_critic_v51.parameters(),1.0); self.critic_optimizer_v51.step(); self.critic_update_steps_v51+=1; return float(loss.detach().item())


class RuntimeStateStoreV51(RuntimeStateStoreV50):
    VERSION=1
    @classmethod
    def save(cls,path,model:NeuroWeaveV51,trainer:Optional[OrganismTrainerV51]=None,runtime:Optional[OrganismRuntimeV51]=None):
        RuntimeStateStoreV50.save(path,model,trainer,runtime); payload=torch.load(path,map_location="cpu",weights_only=False)
        payload["v51"]={"critic":model.action_utility_critic_v51.state_dict(),"critic_optimizer":trainer.critic_optimizer_v51.state_dict() if trainer else None,"critic_update_steps":trainer.critic_update_steps_v51 if trainer else 0,
                       "utility_memory":runtime.utility_memory_v51.state_dict() if runtime else None}; payload["version_v51"]=cls.VERSION; torch.save(payload,path)
    @classmethod
    def load(cls,path,model:NeuroWeaveV51,trainer:Optional[OrganismTrainerV51]=None,runtime:Optional[OrganismRuntimeV51]=None,device=None):
        payload=RuntimeStateStoreV50.load(path,model,trainer,runtime,device=device); v51=payload.get("v51") or {}
        if v51.get("critic") is not None: model.action_utility_critic_v51.load_state_dict(v51["critic"])
        if trainer is not None:
            if v51.get("critic_optimizer") is not None: trainer.critic_optimizer_v51.load_state_dict(v51["critic_optimizer"])
            trainer.critic_update_steps_v51=int(v51.get("critic_update_steps",0))
        if runtime is not None and v51.get("utility_memory") is not None:
            runtime.utility_memory_v51.load_state_dict(v51["utility_memory"]); model.action_verifier_v51.outcome_memory=runtime.utility_memory_v51
        return payload


__all__=["V51Config","mobile_v51_config","ActionUtilityCriticV51","UncertaintyWeightedSensorBeliefV51","RegimeMonitorV51","OptionCommitmentV51","ActionOutcomeMemoryV51","CounterfactualActionVerifierV51","SafeProbeControllerV51","NeuroWeaveV51","OrganismRuntimeV51","OrganismTrainerV51","RuntimeStateStoreV51"]
