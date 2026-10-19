from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from neurocore.v73 import (
    V73Config, mobile_v73_config, CanonicalNeuralMemoryOSV73, NeuroWeaveV73,
    OrganismRuntimeV73, OrganismTrainerV73,
)

@dataclass
class V74Config(V73Config):
    """V74: continuum memory with slower internal consolidation inside the canonical owner."""
    neural_memory_continuum_slow_decay_v74: float = 0.992
    neural_memory_continuum_update_interval_v74: int = 8
    neural_memory_continuum_mix_v74: float = 0.22
    neural_memory_continuum_rank_v74: int = 4

def mobile_v74_config(raw_observation_dim: int = 9) -> V74Config:
    base=dict(mobile_v73_config(raw_observation_dim).__dict__)
    base.update({
        'neural_memory_continuum_slow_decay_v74':0.992,
        'neural_memory_continuum_update_interval_v74':8,
        'neural_memory_continuum_mix_v74':0.22,
        'neural_memory_continuum_rank_v74':4,
    })
    return V74Config(**base)

class CanonicalNeuralMemoryOSV74(CanonicalNeuralMemoryOSV73):
    """V74 adds a slower EMA timescale to the same canonical associative owner.

    The fast V72 state remains the online plastic state. The slow state is an explicitly
    slower compressed trajectory, updated only during consolidation intervals, so it is
    not a second source of memory truth. Retrieval combines the two timescales with a
    bounded gain and V73 conflict control.
    """
    def __init__(self,input_dim:int,*args,continuum_slow_decay:float=0.992,continuum_update_interval:int=8,continuum_mix:float=0.22,continuum_rank:int=4,**kwargs):
        super().__init__(input_dim,*args,**kwargs)
        self.continuum_slow_decay_v74=max(0.90,min(0.99999,float(continuum_slow_decay)))
        self.continuum_update_interval_v74=max(1,int(continuum_update_interval))
        self.continuum_mix_v74=max(0.0,min(0.5,float(continuum_mix)))
        self.continuum_rank_v74=max(1,min(int(continuum_rank),int(self.associative_state_v72.size(-1))))
        h,d,_=self.associative_state_v72.shape
        self.register_buffer('associative_slow_left_v74',torch.zeros((h,d,self.continuum_rank_v74),dtype=self.associative_state_v72.dtype))
        self.register_buffer('associative_slow_singular_v74',torch.zeros((h,self.continuum_rank_v74),dtype=self.associative_state_v72.dtype))
        self.register_buffer('associative_slow_right_v74',torch.zeros((h,self.continuum_rank_v74,d),dtype=self.associative_state_v72.dtype))
        self.register_buffer('associative_slow_valid_v74',torch.zeros_like(self.associative_valid_v72))
        self.register_buffer('associative_slow_updates_v74',torch.zeros((),dtype=torch.long))
        self.register_buffer('associative_slow_last_time_v74',torch.tensor(-1.0))
        self.register_buffer('associative_slow_gain_effect_v74',torch.zeros(()))
        self.continuum_mix_logit_v74=nn.Parameter(torch.full((self.associative_state_v72.size(0),1),-1.25))

    @classmethod
    def from_existing(cls,base:CanonicalNeuralMemoryOSV73,**extra_kwargs)->'CanonicalNeuralMemoryOSV74':
        # Reuse the explicit V73 constructor contract while preserving older tensors.
        p=dict(input_dim=base.input_dim,key_dim=base.key_dim,value_dim=base.value_dim,fast_slots=base.fast_slots,fast_rank=base.fast_rank,semantic_slots=base.semantic_slots,semantic_rank=base.semantic_rank,hidden=base.hidden,temperature=base.temperature,fast_decay=base.fast_decay,semantic_decay=base.semantic_decay,replay_size=base.replay_size,autobiographical_decay=base.autobiographical_decay,procedural_decay=base.procedural_decay,topk=base.topk,long_term_hidden=base.long_term_memory[0].out_features if isinstance(base.long_term_memory[0],nn.Linear) else 40,long_term_layers=max(1,sum(isinstance(m,nn.Linear) for m in base.long_term_memory)-1),long_term_mix=base.long_term_mix,router_hidden=base.memory_router[0].out_features,router_temperature=base.router_temperature,conflict_threshold=base.conflict_threshold,multistep_horizon=getattr(base,'multistep_horizon_v69',3),multistep_rank=getattr(base,'multistep_rank_v69',6),multistep_gain=getattr(base,'multistep_gain_v69',0.10),multistep_loss_weight=getattr(base,'multistep_loss_weight_v69',0.06),multistep_decay=getattr(base,'multistep_decay_v69',0.998),multistep_min_repeat=getattr(base,'multistep_min_repeat_v69',3.0),counterfactual_rank=getattr(base,'counterfactual_rank_v69',6),counterfactual_gain=getattr(base,'counterfactual_gain_v69',0.08),counterfactual_loss_weight=getattr(base,'counterfactual_loss_weight_v69',0.04),counterfactual_margin=getattr(base,'counterfactual_margin_v69',0.12),counterfactual_min_repeat=getattr(base,'counterfactual_min_repeat_v69',3.0),temporal_context_decay=getattr(base,'temporal_context_decay_v69',0.96),sequence_gate=getattr(base,'sequence_gate_v69',0.24),rollout_temperature=getattr(base,'rollout_temperature_v69',0.40),rollout_uncertainty=getattr(base,'rollout_uncertainty_v69',0.52),branch_topk=getattr(base,'branch_topk_v69',3),structural_bridge_weight=getattr(base,'structural_bridge_weight_v69',0.14),composition_rank=getattr(base,'composition_rank_v70',6),composition_horizon=getattr(base,'composition_horizon_v70',4),composition_capacity=getattr(base,'composition_capacity_v70',24),composition_gain=getattr(base,'composition_gain_v70',0.16),composition_loss_weight=getattr(base,'composition_loss_weight_v70',0.06),composition_min_repeat=getattr(base,'composition_min_repeat_v70',3.0),composition_temperature=getattr(base,'composition_temperature_v70',0.36),composition_uncertainty=getattr(base,'composition_uncertainty_v70',0.45),composition_decay=getattr(base,'composition_decay_v70',0.997),composition_update_interval=getattr(base,'composition_update_interval_v70',4),composition_diversity=getattr(base,'composition_diversity_v70',0.22),relation_rank=getattr(base,'relation_rank_v71',6),route_gain=getattr(base,'route_gain_v71',0.20),relation_gain=getattr(base,'relation_gain_v71',0.32),replay_capacity=getattr(base,'replay_capacity_v71',32),replay_decay=getattr(base,'replay_decay_v71',0.995),replay_min_evidence=getattr(base,'replay_min_evidence_v71',2.0),branch_temperature=getattr(base,'branch_temperature_v71',0.32),associative_rank=getattr(base,'associative_rank_v72',6),associative_gain=getattr(base,'associative_gain_v72',0.28),associative_min_write=getattr(base,'associative_min_write_v72',0.08),associative_decay=getattr(base,'associative_decay_v72',0.985),replay_priority_gain=getattr(base,'replay_priority_gain_v72',0.45),replay_budget=getattr(base,'replay_budget_v72',3),path_generation_guard=getattr(base,'path_generation_guard_v72',True),factor_rank=getattr(base,'factor_rank_v73',6),factor_gain=getattr(base,'factor_gain_v73',0.34),factor_temperature=getattr(base,'factor_temperature_v73',0.55),equivalence_threshold=getattr(base,'equivalence_threshold_v73',0.86),equivalence_gain=getattr(base,'equivalence_gain_v73',0.08),conflict_gain=getattr(base,'conflict_gain_v73',0.70),conflict_decay=getattr(base,'conflict_decay_v73',0.94),branch_ambiguity_gain=getattr(base,'branch_ambiguity_gain_v73',0.70),continuum_slow_decay=extra_kwargs.pop('continuum_slow_decay',0.992),continuum_update_interval=extra_kwargs.pop('continuum_update_interval',8),continuum_mix=extra_kwargs.pop('continuum_mix',0.22),continuum_rank=extra_kwargs.pop('continuum_rank',4))
        new=cls(**p)
        target=new.state_dict(); compatible={k:v for k,v in base.state_dict().items() if k in target and tuple(v.shape)==tuple(target[k].shape)}
        new.load_state_dict(compatible,strict=False)
        return new

    def _slow_matrix_v74(self,idx:int,dtype:Optional[torch.dtype]=None)->Tensor:
        left=self.associative_slow_left_v74[idx]
        singular=self.associative_slow_singular_v74[idx]
        right=self.associative_slow_right_v74[idx]
        if dtype is not None:
            left=left.to(dtype); singular=singular.to(dtype); right=right.to(dtype)
        return (left*singular.unsqueeze(0))@right

    @torch.no_grad()
    def _set_slow_matrix_v74(self,idx:int,target:Tensor)->float:
        d=target.size(-1); rank=self.continuum_rank_v74
        if not torch.isfinite(target).all():
            return 0.0
        u,s,vh=torch.linalg.svd(target,full_matrices=False)
        r=min(rank,s.numel())
        self.associative_slow_left_v74[idx].zero_(); self.associative_slow_singular_v74[idx].zero_(); self.associative_slow_right_v74[idx].zero_()
        self.associative_slow_left_v74[idx,:,:r].copy_(u[:,:r])
        self.associative_slow_singular_v74[idx,:r].copy_(s[:r].clamp(max=4.0))
        self.associative_slow_right_v74[idx,:r,:].copy_(vh[:r,:])
        return float(s[:r].norm().item())

    @torch.no_grad()
    def _maybe_update_slow_v74(self,force:bool=False)->Dict[str,float]:
        now=float(self.model_time_v72.item())
        if not force and self.associative_slow_last_time_v74.item() >= 0 and now-self.associative_slow_last_time_v74.item() < self.continuum_update_interval_v74:
            return {'updated':0.0,'gain':0.0}
        decay=self.continuum_slow_decay_v74
        before_norm=(self.associative_slow_left_v74.norm()+self.associative_slow_singular_v74.norm()+self.associative_slow_right_v74.norm())
        valid=(self.associative_valid_v72>0.5)
        for idx in torch.nonzero(valid,as_tuple=False).flatten().tolist():
            old=self._slow_matrix_v74(idx,dtype=self.associative_state_v72.dtype)
            target=decay*old+(1.0-decay)*self.associative_state_v72[idx]
            self._set_slow_matrix_v74(idx,target)
            self.associative_slow_valid_v74[idx]=1.0
        self.associative_slow_last_time_v74.fill_(now)
        self.associative_slow_updates_v74.add_(1)
        after_norm=(self.associative_slow_left_v74.norm()+self.associative_slow_singular_v74.norm()+self.associative_slow_right_v74.norm())
        gain=float((after_norm-before_norm).abs().item())
        self.associative_slow_gain_effect_v74.mul_(0.9).add_(0.1*gain)
        return {'updated':1.0,'gain':gain}

    def read_slow_v74(self,source:Tensor,level:int)->Tensor:
        idx=min(max(int(level),0),self.associative_state_v72.size(0)-1)
        base=F.normalize(source,dim=-1)
        return F.normalize(base@self._slow_matrix_v74(idx,dtype=source.dtype),dim=-1)

    def _associative_predict_v72(self,source:Tensor,level:int)->Tensor:
        idx=min(max(int(level),0),self.associative_state_v72.size(0)-1)
        base=F.normalize(source,dim=-1)
        fast_raw=base@self.associative_state_v72[idx].to(source)
        slow_raw=base@self._slow_matrix_v74(idx,dtype=source.dtype)
        fast_valid=self.associative_valid_v72[idx].to(source)
        slow_valid=self.associative_slow_valid_v74[idx].to(source)
        mix=torch.sigmoid(self.continuum_mix_logit_v74[idx]).to(source)*self.continuum_mix_v74
        combined=fast_raw*fast_valid + mix*slow_raw*slow_valid
        combined=F.normalize(combined,dim=-1)
        confidence=torch.sigmoid(8.0*(combined.norm(dim=-1,keepdim=True)-0.08))
        conflict=self.associative_conflict_v73[idx].to(source)
        interference=self.associative_interference_gate_v73[idx].to(source)
        gate=torch.sigmoid(self.associative_mix_logit_v72[idx]).to(source)
        route=(gate*confidence*interference*(1.0-self.conflict_gain_v73*conflict).clamp(0.10,1.0)).clamp(0.0,0.8)
        out=F.normalize((1.0-route)*base+route*combined,dim=-1)
        slow_effect=float((combined-F.normalize(fast_raw,dim=-1)).norm().item()) if combined.ndim>1 else 0.0
        self.associative_slow_gain_effect_v74.mul_(0.98).add_(0.02*slow_effect)
        return out

    def consolidate(self,optimizer:torch.optim.Optimizer,steps:int=1)->Dict[str,float]:
        out=super().consolidate(optimizer,steps=steps)
        out.update({f'associative_continuum_v74_{k}':v for k,v in self._maybe_update_slow_v74(force=True).items()})
        out['associative_slow_updates_v74']=float(self.associative_slow_updates_v74.item())
        out['associative_slow_gain_effect_v74']=float(self.associative_slow_gain_effect_v74.item())
        return out

    def diagnostics(self)->Dict[str,Tensor]:
        d=super().diagnostics(); d.update({'v74_slow_valid_levels':self.associative_slow_valid_v74.sum().reshape(1,1),'v74_slow_rank':torch.tensor(float(self.continuum_rank_v74)).reshape(1,1),'v74_slow_updates':self.associative_slow_updates_v74.float().reshape(1,1),'v74_slow_gain_effect':self.associative_slow_gain_effect_v74.reshape(1,1),'v74_continuum_last_time':self.associative_slow_last_time_v74.reshape(1,1)})
        return d

class NeuroWeaveV74(NeuroWeaveV73):
    def __init__(self,cfg:Optional[V74Config]=None):
        cfg=cfg or mobile_v74_config(9); NeuroWeaveV73.__init__(self,cfg); old=self.neural_memory_v61; c=cfg
        self.neural_memory_v61=CanonicalNeuralMemoryOSV74.from_existing(old,continuum_slow_decay=c.neural_memory_continuum_slow_decay_v74,continuum_update_interval=c.neural_memory_continuum_update_interval_v74,continuum_mix=c.neural_memory_continuum_mix_v74,continuum_rank=c.neural_memory_continuum_rank_v74)
        for name in ('neural_memory_v60','neural_memory_v63'): self._modules.pop(name,None)
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

class OrganismRuntimeV74(OrganismRuntimeV73):
    @torch.no_grad()
    def step(self,observation:Tensor,goal:Optional[Tensor]=None)->Dict[str,Tensor]:
        out=super().step(observation,goal); d=self.model.neural_memory_v61.diagnostics()
        for k in ('v74_slow_valid_levels','v74_slow_updates','v74_slow_gain_effect','v74_continuum_last_time'): out[k]=d[k]
        return out

class OrganismTrainerV74(OrganismTrainerV73):
    def __init__(self,model:NeuroWeaveV74,lr:float=3e-4,warmup_steps:int=4,external_verifier=None): super().__init__(model,lr=lr,warmup_steps=warmup_steps,external_verifier=external_verifier)

class RuntimeStateStoreV74:
    VERSION=74
    @classmethod
    def save(cls,path:Path,model:NeuroWeaveV74,trainer:Optional[OrganismTrainerV74]=None,runtime:Optional[OrganismRuntimeV74]=None):
        torch.save({'version_v74':cls.VERSION,'base_version':73,'model':model.state_dict(),'neural_memory_optimizer':trainer.neural_memory_optimizer.state_dict() if trainer else None,'neural_memory_updates_v61':int(getattr(trainer,'neural_memory_updates_v61',0)) if trainer else 0,'runtime':runtime.state_dict() if runtime else None},path)
    @classmethod
    def load(cls,path:Path,model:NeuroWeaveV74,trainer:Optional[OrganismTrainerV74]=None,runtime:Optional[OrganismRuntimeV74]=None):
        p=torch.load(path,map_location='cpu',weights_only=False); state=p.get('model',p); target=model.state_dict(); compatible={k:v for k,v in state.items() if k in target and tuple(v.shape)==tuple(target[k].shape)}; missing=[k for k in target if k not in compatible]; shape=[k for k in state if k in target and tuple(state[k].shape)!=tuple(target[k].shape)]; unexpected=[k for k in state if k not in target]; model.load_state_dict(compatible,strict=False); optimizer_loaded=False; optimizer_reset=False
        if trainer is not None and p.get('neural_memory_optimizer') is not None:
            try: trainer.neural_memory_optimizer.load_state_dict(p['neural_memory_optimizer']); optimizer_loaded=True
            except (ValueError,RuntimeError): optimizer_reset=True
            trainer.neural_memory_updates_v61=int(p.get('neural_memory_updates_v61',0))
        if runtime is not None and p.get('runtime') is not None: runtime.load_state_dict(p['runtime'])
        return {'version':int(p.get('version_v74',p.get('version_v73',0))),'loaded_tensors':len(compatible),'missing_tensors':missing,'shape_mismatch':shape,'unexpected_tensors':unexpected,'optimizer_loaded':optimizer_loaded,'optimizer_reset':optimizer_reset}
