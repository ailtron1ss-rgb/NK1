from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional
import torch
from torch import Tensor, nn
from neurocore.v74 import V74Config, mobile_v74_config, CanonicalNeuralMemoryOSV74, NeuroWeaveV74, OrganismRuntimeV74, OrganismTrainerV74

@dataclass
class V75Config(V74Config):
    """V75: model-time-aware replay scheduling inside the single canonical owner."""
    neural_memory_replay_base_interval_v75: float = 4.0
    neural_memory_replay_min_interval_v75: float = 1.0
    neural_memory_replay_pressure_gain_v75: float = 1.75
    neural_memory_replay_update_gain_v75: float = 32.0
    neural_memory_replay_budget_cap_v75: int = 6

def mobile_v75_config(raw_observation_dim: int = 9) -> V75Config:
    base = dict(mobile_v74_config(raw_observation_dim).__dict__)
    base.update({
        'neural_memory_replay_base_interval_v75': 4.0,
        'neural_memory_replay_min_interval_v75': 1.0,
        'neural_memory_replay_pressure_gain_v75': 1.75,
        'neural_memory_replay_update_gain_v75': 32.0,
        'neural_memory_replay_budget_cap_v75': 6,
    })
    return V75Config(**base)

class CanonicalNeuralMemoryOSV75(CanonicalNeuralMemoryOSV74):
    """V75 makes replay respond to model-centric change rather than only raw step counts.

    The scheduler reuses the canonical V72 replay bank and V73 conflict/branch signals.
    It adds no memory owner and no second truth store. A bounded snapshot of trainable
    canonical parameters is used only at consolidation boundaries to estimate actual
    update mass; this drives a forgetting-curve-like replay interval and budget.
    """
    def __init__(self, input_dim: int, *args, replay_base_interval: float = 4.0, replay_min_interval: float = 1.0, replay_pressure_gain: float = 1.75, replay_update_gain: float = 32.0, replay_budget_cap: int = 6, **kwargs):
        super().__init__(input_dim, *args, **kwargs)
        self.replay_base_interval_v75 = max(1.0, float(replay_base_interval))
        self.replay_min_interval_v75 = max(1.0, min(self.replay_base_interval_v75, float(replay_min_interval)))
        self.replay_pressure_gain_v75 = max(0.0, float(replay_pressure_gain))
        self.replay_update_gain_v75 = max(0.0, float(replay_update_gain))
        self.replay_budget_cap_v75 = max(1, int(replay_budget_cap))
        self.register_buffer('replay_update_mass_v75', torch.zeros(()))
        self.register_buffer('replay_update_ema_v75', torch.zeros(()))
        self.register_buffer('replay_pressure_v75', torch.zeros(()))
        self.register_buffer('replay_last_adaptive_time_v75', torch.tensor(-1.0))
        self.register_buffer('replay_scheduler_events_v75', torch.zeros((), dtype=torch.long))
        self.register_buffer('replay_scheduler_budget_v75', torch.zeros(()))
        self.register_buffer('replay_scheduler_interval_v75', torch.full((), self.replay_base_interval_v75))
        self.register_buffer('replay_scheduler_gain_v75', torch.zeros(()))

    @classmethod
    def from_existing(cls, base: CanonicalNeuralMemoryOSV74, **extra_kwargs) -> 'CanonicalNeuralMemoryOSV75':
        p = dict(
            input_dim=base.input_dim, key_dim=base.key_dim, value_dim=base.value_dim, fast_slots=base.fast_slots,
            fast_rank=base.fast_rank, semantic_slots=base.semantic_slots, semantic_rank=base.semantic_rank,
            hidden=base.hidden, temperature=base.temperature, fast_decay=base.fast_decay, semantic_decay=base.semantic_decay,
            replay_size=base.replay_size, autobiographical_decay=base.autobiographical_decay, procedural_decay=base.procedural_decay,
            topk=base.topk, long_term_hidden=base.long_term_memory[0].out_features if isinstance(base.long_term_memory[0], nn.Linear) else 40,
            long_term_layers=max(1, sum(isinstance(m, nn.Linear) for m in base.long_term_memory) - 1), long_term_mix=base.long_term_mix,
            router_hidden=base.memory_router[0].out_features, router_temperature=base.router_temperature, conflict_threshold=base.conflict_threshold,
            multistep_horizon=getattr(base,'multistep_horizon_v69',3), multistep_rank=getattr(base,'multistep_rank_v69',6),
            multistep_gain=getattr(base,'multistep_gain_v69',0.10), multistep_loss_weight=getattr(base,'multistep_loss_weight_v69',0.06),
            multistep_decay=getattr(base,'multistep_decay_v69',0.998), multistep_min_repeat=getattr(base,'multistep_min_repeat_v69',3.0),
            counterfactual_rank=getattr(base,'counterfactual_rank_v69',6), counterfactual_gain=getattr(base,'counterfactual_gain_v69',0.08),
            counterfactual_loss_weight=getattr(base,'counterfactual_loss_weight_v69',0.04), counterfactual_margin=getattr(base,'counterfactual_margin_v69',0.12),
            counterfactual_min_repeat=getattr(base,'counterfactual_min_repeat_v69',3.0), temporal_context_decay=getattr(base,'temporal_context_decay_v69',0.96),
            sequence_gate=getattr(base,'sequence_gate_v69',0.24), rollout_temperature=getattr(base,'rollout_temperature_v69',0.40),
            rollout_uncertainty=getattr(base,'rollout_uncertainty_v69',0.52), branch_topk=getattr(base,'branch_topk_v69',3),
            structural_bridge_weight=getattr(base,'structural_bridge_weight_v69',0.14), composition_rank=getattr(base,'composition_rank_v70',6),
            composition_horizon=getattr(base,'composition_horizon_v70',4), composition_capacity=getattr(base,'composition_capacity_v70',24),
            composition_gain=getattr(base,'composition_gain_v70',0.16), composition_loss_weight=getattr(base,'composition_loss_weight_v70',0.06),
            composition_min_repeat=getattr(base,'composition_min_repeat_v70',3.0), composition_temperature=getattr(base,'composition_temperature_v70',0.36),
            composition_uncertainty=getattr(base,'composition_uncertainty_v70',0.45), composition_decay=getattr(base,'composition_decay_v70',0.997),
            composition_update_interval=getattr(base,'composition_update_interval_v70',4), composition_diversity=getattr(base,'composition_diversity_v70',0.22),
            relation_rank=getattr(base,'relation_rank_v71',6), route_gain=getattr(base,'route_gain_v71',0.20), relation_gain=getattr(base,'relation_gain_v71',0.32),
            replay_capacity=getattr(base,'replay_capacity_v71',32), replay_decay=getattr(base,'replay_decay_v71',0.995), replay_min_evidence=getattr(base,'replay_min_evidence_v71',2.0),
            branch_temperature=getattr(base,'branch_temperature_v71',0.32), associative_rank=getattr(base,'associative_rank_v72',6),
            associative_gain=getattr(base,'associative_gain_v72',0.28), associative_min_write=getattr(base,'associative_min_write_v72',0.08),
            associative_decay=getattr(base,'associative_decay_v72',0.985), replay_priority_gain=getattr(base,'replay_priority_gain_v72',0.45),
            replay_budget=getattr(base,'replay_budget_v72',3), path_generation_guard=getattr(base,'path_generation_guard_v72',True),
            factor_rank=getattr(base,'factor_rank_v73',6), factor_gain=getattr(base,'factor_gain_v73',0.34), factor_temperature=getattr(base,'factor_temperature_v73',0.55),
            equivalence_threshold=getattr(base,'equivalence_threshold_v73',0.86), equivalence_gain=getattr(base,'equivalence_gain_v73',0.08),
            conflict_gain=getattr(base,'conflict_gain_v73',0.70), conflict_decay=getattr(base,'conflict_decay_v73',0.94),
            branch_ambiguity_gain=getattr(base,'branch_ambiguity_gain_v73',0.70),
            continuum_slow_decay=getattr(base,'continuum_slow_decay_v74',0.992), continuum_update_interval=getattr(base,'continuum_update_interval_v74',8),
            continuum_mix=getattr(base,'continuum_mix_v74',0.22), continuum_rank=getattr(base,'continuum_rank_v74',4),
            replay_base_interval=extra_kwargs.pop('replay_base_interval',4.0), replay_min_interval=extra_kwargs.pop('replay_min_interval',1.0),
            replay_pressure_gain=extra_kwargs.pop('replay_pressure_gain',1.75), replay_update_gain=extra_kwargs.pop('replay_update_gain',32.0),
            replay_budget_cap=extra_kwargs.pop('replay_budget_cap',6),
        )
        new = cls(**p)
        target = new.state_dict()
        compatible = {k:v for k,v in base.state_dict().items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        new.load_state_dict(compatible, strict=False)
        return new

    @torch.no_grad()
    def _replay_pressure_v75(self) -> float:
        conflict = float(self.associative_conflict_v73.mean().item()) if hasattr(self,'associative_conflict_v73') else 0.0
        novelty = float(self.replay_novelty_v72.max().item()) if self.replay_novelty_v72.numel() else 0.0
        update_component = min(1.0, float(self.replay_update_ema_v75.item()) * self.replay_update_gain_v75)
        pressure = max(0.0, min(1.0, 0.55 * conflict + 0.30 * novelty + 0.15 * update_component))
        self.replay_pressure_v75.mul_(0.90).add_(0.10 * pressure)
        return float(self.replay_pressure_v75.item())

    @torch.no_grad()
    def _adaptive_replay_budget_v75(self) -> int:
        p = self._replay_pressure_v75()
        raw = self.replay_budget_v72 * (1.0 + self.replay_pressure_gain_v75 * p)
        budget = max(1, min(self.replay_budget_cap_v75, int(round(raw))))
        interval = self.replay_base_interval_v75 / (1.0 + self.replay_pressure_gain_v75 * p)
        interval = max(self.replay_min_interval_v75, min(self.replay_base_interval_v75, interval))
        self.replay_scheduler_budget_v75.fill_(float(budget))
        self.replay_scheduler_interval_v75.fill_(float(interval))
        return budget

    @torch.no_grad()
    def replay_associative_state_v72(self, budget: Optional[int] = None) -> Dict[str, float]:
        budget = self._adaptive_replay_budget_v75() if budget is None or int(budget) == self.replay_budget_v72 else min(int(budget), self.replay_budget_cap_v75)
        now = float(self.model_time_v72.item())
        interval = float(self.replay_scheduler_interval_v75.item())
        last = float(self.replay_last_adaptive_time_v75.item())
        pressure = float(self.replay_pressure_v75.item())
        if last >= 0.0 and now - last < interval and pressure < 0.82:
            return {'replayed':0.0,'gain':0.0,'scheduled':0.0,'budget':float(budget),'pressure':pressure,'interval':interval}
        out = super().replay_associative_state_v72(budget=budget)
        self.replay_last_adaptive_time_v75.fill_(now)
        self.replay_scheduler_events_v75.add_(1)
        self.replay_scheduler_gain_v75.mul_(0.90).add_(0.10 * float(out.get('gain',0.0)))
        out.update({'scheduled':1.0,'budget':float(budget),'pressure':pressure,'interval':interval})
        return out

    @torch.no_grad()
    def _snapshot_update_sample_v75(self) -> list[Tensor]:
        # Deterministic bounded sample over all trainable canonical parameters. This is a
        # low-cost proxy for optimizer update mass, not a claim of exact full-model delta.
        samples=[]
        for p in self.parameters():
            if not p.requires_grad or p.numel()==0:
                continue
            flat=p.detach().reshape(-1)
            stride=max(1, flat.numel()//512)
            samples.append(flat[::stride][:512].clone())
        return samples

    @torch.no_grad()
    def _update_model_time_from_change_v75(self, before: list[Tensor], after: list[Tensor]) -> float:
        if not before or len(before) != len(after):
            return 0.0
        before_sq=sum(float(b.pow(2).sum().item()) for b in before)
        delta_sq=sum(float((a-b).pow(2).sum().item()) for b,a in zip(before,after))
        mass=(delta_sq**0.5)/(before_sq**0.5 + 1e-6)
        mass=min(1.0,mass)
        self.replay_update_mass_v75.fill_(mass)
        self.replay_update_ema_v75.mul_(0.90).add_(0.10 * mass)
        return mass

    def consolidate(self, optimizer: torch.optim.Optimizer, steps: int = 1) -> Dict[str, float]:
        snapshot=self._snapshot_update_sample_v75()
        out=super().consolidate(optimizer,steps=steps)
        after=self._snapshot_update_sample_v75()
        mass=self._update_model_time_from_change_v75(snapshot,after)
        extra_time=min(8.0, mass*self.replay_update_gain_v75)
        if extra_time > 0:
            self.model_time_v72.add_(extra_time)
        adaptive=self.replay_associative_state_v72(self.replay_budget_v72)
        out.update({
            'v75_model_update_mass':mass,
            'v75_model_time_extra':extra_time,
            'v75_replay_pressure':float(self.replay_pressure_v75.item()),
            'v75_replay_budget':float(self.replay_scheduler_budget_v75.item()),
            'v75_replay_interval':float(self.replay_scheduler_interval_v75.item()),
            'v75_replay_scheduled':float(adaptive.get('scheduled',0.0)),
            'v75_replayed':float(adaptive.get('replayed',0.0)),
        })
        return out

    def diagnostics(self)->Dict[str,Tensor]:
        d=super().diagnostics(); d.update({
            'v75_model_update_mass':self.replay_update_mass_v75.reshape(1,1),
            'v75_model_update_ema':self.replay_update_ema_v75.reshape(1,1),
            'v75_replay_pressure':self.replay_pressure_v75.reshape(1,1),
            'v75_replay_scheduler_budget':self.replay_scheduler_budget_v75.reshape(1,1),
            'v75_replay_scheduler_interval':self.replay_scheduler_interval_v75.reshape(1,1),
            'v75_replay_scheduler_events':self.replay_scheduler_events_v75.float().reshape(1,1),
            'v75_replay_scheduler_gain':self.replay_scheduler_gain_v75.reshape(1,1),
        }); return d

class NeuroWeaveV75(NeuroWeaveV74):
    def __init__(self,cfg:Optional[V75Config]=None):
        cfg=cfg or mobile_v75_config(9); NeuroWeaveV74.__init__(self,cfg); old=self.neural_memory_v61; c=cfg
        self.neural_memory_v61=CanonicalNeuralMemoryOSV75.from_existing(old,replay_base_interval=c.neural_memory_replay_base_interval_v75,replay_min_interval=c.neural_memory_replay_min_interval_v75,replay_pressure_gain=c.neural_memory_replay_pressure_gain_v75,replay_update_gain=c.neural_memory_replay_update_gain_v75,replay_budget_cap=c.neural_memory_replay_budget_cap_v75)
        self._modules.pop('neural_memory_v60',None); self._modules.pop('neural_memory_v63',None)
    @property
    def neural_memory_v70(self): return self.neural_memory_v61
    @property
    def neural_memory_v71(self): return self.neural_memory_v61
    @property
    def neural_memory_v72(self): return self.neural_memory_v61
    @property
    def neural_memory_v73(self): return self.neural_memory_v61
    @property
    def neural_memory_v74(self): return self.neural_memory_v61
    @property
    def neural_memory_v75(self): return self.neural_memory_v61

class OrganismRuntimeV75(OrganismRuntimeV74):
    @torch.no_grad()
    def step(self,observation:Tensor,goal:Optional[Tensor]=None)->Dict[str,Tensor]:
        out=super().step(observation,goal); d=self.model.neural_memory_v61.diagnostics()
        for k in ('v75_model_update_mass','v75_model_update_ema','v75_replay_pressure','v75_replay_scheduler_budget','v75_replay_scheduler_interval','v75_replay_scheduler_events','v75_replay_scheduler_gain'): out[k]=d[k]
        return out

class OrganismTrainerV75(OrganismTrainerV74):
    def __init__(self,model:NeuroWeaveV75,lr:float=3e-4,warmup_steps:int=4,external_verifier=None): super().__init__(model,lr=lr,warmup_steps=warmup_steps,external_verifier=external_verifier)

class RuntimeStateStoreV75:
    VERSION=75
    @classmethod
    def save(cls,path:Path,model:NeuroWeaveV75,trainer:Optional[OrganismTrainerV75]=None,runtime:Optional[OrganismRuntimeV75]=None):
        torch.save({'version_v75':cls.VERSION,'base_version':74,'model':model.state_dict(),'neural_memory_optimizer':trainer.neural_memory_optimizer.state_dict() if trainer else None,'neural_memory_updates_v61':int(getattr(trainer,'neural_memory_updates_v61',0)) if trainer else 0,'runtime':runtime.state_dict() if runtime else None},path)
    @classmethod
    def load(cls,path:Path,model:NeuroWeaveV75,trainer:Optional[OrganismTrainerV75]=None,runtime:Optional[OrganismRuntimeV75]=None):
        p=torch.load(path,map_location='cpu',weights_only=False); state=p.get('model',p); target=model.state_dict(); compatible={k:v for k,v in state.items() if k in target and tuple(v.shape)==tuple(target[k].shape)}; missing=[k for k in target if k not in compatible]; shape=[k for k in state if k in target and tuple(state[k].shape)!=tuple(target[k].shape)]; unexpected=[k for k in state if k not in target]; model.load_state_dict(compatible,strict=False); optimizer_loaded=False; optimizer_reset=False
        if trainer is not None and p.get('neural_memory_optimizer') is not None:
            try: trainer.neural_memory_optimizer.load_state_dict(p['neural_memory_optimizer']); optimizer_loaded=True
            except (ValueError,RuntimeError): optimizer_reset=True
            trainer.neural_memory_updates_v61=int(p.get('neural_memory_updates_v61',0))
        if runtime is not None and p.get('runtime') is not None: runtime.load_state_dict(p['runtime'])
        return {'version':int(p.get('version_v75',p.get('version_v74',0))),'loaded_tensors':len(compatible),'missing_tensors':missing,'shape_mismatch':shape,'unexpected_tensors':unexpected,'optimizer_loaded':optimizer_loaded,'optimizer_reset':optimizer_reset}
