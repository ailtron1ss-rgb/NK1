from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Sequence
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from neurocore.v83 import NeuroWeaveV83, OrganismTrainerV83, OrganismRuntimeV83, RuntimeStateStoreV83
from neurocore.v82 import V82Config, mobile_v82_config
from neurocore.v83.core import _learning_replay_batch_v83, _write_learning_transition_v83

@dataclass
class V84Config(V82Config):
    replay_interval_min_v84: int = 1
    replay_interval_max_v84: int = 6
    replay_interval_init_v84: int = 2
    replay_diagnostic_interval_v84: int = 3
    replay_pressure_spike_threshold_v84: float = 0.04
    replay_conflict_threshold_v84: float = -0.05
    replay_interval_adaptation_rate_v84: float = 1.0
    replay_priority_floor_v84: float = 0.05
    replay_policy_v84: str = 'adaptive'
    replay_surgery_enabled_v84: bool = True

def mobile_v84_config(raw_observation_dim: int = 9) -> V84Config:
    base = dict(mobile_v82_config(raw_observation_dim).__dict__)
    base.update(dict(replay_interval_min_v84=1,replay_interval_max_v84=6,replay_interval_init_v84=2,
                     replay_diagnostic_interval_v84=3,replay_pressure_spike_threshold_v84=0.04,
                     replay_conflict_threshold_v84=-0.05,replay_interval_adaptation_rate_v84=1.0,
                     replay_priority_floor_v84=0.05,replay_policy_v84='adaptive',replay_surgery_enabled_v84=True))
    return V84Config(**base)

class NeuroWeaveV84(NeuroWeaveV83):
    def __init__(self, cfg: Optional[V84Config] = None):
        super().__init__(cfg or mobile_v84_config(9))
        self.cfg = cfg or self.cfg
    def learning_parameter_report_v84(self) -> Dict[str,float]:
        rep = self.learning_parameter_report_v83(); rep['replay_controller_parameter_delta']=0.0; return rep

class OrganismTrainerV84(OrganismTrainerV83):
    def __init__(self, model: NeuroWeaveV84, lr=None, warmup_steps=4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV84 = model
        self.replay_interval_v84 = max(model.cfg.replay_interval_min_v84, min(model.cfg.replay_interval_max_v84, model.cfg.replay_interval_init_v84))
        self.steps_since_replay_v84=0; self.replay_events_v84=0; self.replay_diagnostic_events_v84=0
        self.replay_last_conflict_v84=0.0; self.replay_pressure_ema_v84=0.0; self.replay_controller_updates_v84=0
        self.last_replay_mode_v84='none'

    @staticmethod
    def _global_gradient_cosine(a: Sequence[Optional[Tensor]], b: Sequence[Optional[Tensor]], eps=1e-12):
        dot=aa=bb=0.0
        for ga,gb in zip(a,b):
            if ga is None or gb is None: continue
            dot+=float((ga*gb).sum().item()); aa+=float((ga*ga).sum().item()); bb+=float((gb*gb).sum().item())
        return float(dot/((aa**0.5)*(bb**0.5)+eps))
    @staticmethod
    def _gradient_coverage(parameters, gradients):
        total=sum(p.numel() for p in parameters)
        covered=sum(p.numel() for p,g in zip(parameters,gradients) if g is not None and torch.isfinite(g).all() and float(g.abs().sum().item())>0)
        return float(covered/max(1,total))
    @staticmethod
    def _merge_gradients(current,replay,replay_mix):
        merged=[]; energy=0.0
        for cg,rg in zip(current,replay):
            if cg is None and rg is None: merged.append(None); continue
            if cg is None: merged.append(float(replay_mix)*rg.detach().clone()); continue
            if rg is None: merged.append(cg.detach().clone()); continue
            rg2=rg.detach(); dot=torch.sum(cg*rg2); denom=torch.sum(rg2*rg2).clamp_min(1e-12)
            if float(dot.item())<0.0:
                proj=cg-(dot/denom)*rg2; energy+=float((cg-proj).pow(2).sum().item()); merged.append(proj+float(replay_mix)*rg2)
            else: merged.append(cg.detach().clone()+float(replay_mix)*rg2)
        return merged,energy
    def _pressure(self,x,goals,out,target_latent_sequence=None):
        if x.size(1)<2: return 0.0
        g=goals if goals is not None else x.new_zeros(x.size(0),x.size(1),self.model.cfg.goal_dim)
        with torch.no_grad():
            if target_latent_sequence is None:
                tgt=torch.stack([self.model.brain46.target_latent(x[:,i+1],g[:,i+1]) for i in range(x.size(1)-1)],1)
            else:
                tgt=target_latent_sequence.reshape(x.size(0), x.size(1)-1, self.model.cfg.latent_dim_v46).detach().to(x)
            pred=out['spine_next_latent'][:,:-1]
            return float((1.0-F.cosine_similarity(pred,tgt,dim=-1)).clamp_min(0).mean().item())
    def _should_replay(self,pressure,pressure_spike):
        policy=str(getattr(self.model.cfg,'replay_policy_v84','adaptive'))
        if policy == 'current_only': return False
        if policy == 'fixed': return self.steps_since_replay_v84>=1
        if self.replay_events_v84==0: return self.steps_since_replay_v84>=1
        spike_trigger = pressure_spike >= float(self.model.cfg.replay_pressure_spike_threshold_v84)
        conflict_trigger = self.replay_last_conflict_v84<=float(self.model.cfg.replay_conflict_threshold_v84)
        periodic_trigger = self.steps_since_replay_v84>=self.replay_interval_v84
        return bool(spike_trigger or conflict_trigger or periodic_trigger)
    def _adapt_interval(self,pressure_spike,conflict=None):
        lo,hi=int(self.model.cfg.replay_interval_min_v84),int(self.model.cfg.replay_interval_max_v84)
        spike_thr=float(self.model.cfg.replay_pressure_spike_threshold_v84)
        delta=0
        conflict_value = self.replay_last_conflict_v84 if conflict is None else float(conflict)
        if pressure_spike>=spike_thr or conflict_value<=float(self.model.cfg.replay_conflict_threshold_v84): delta=-1
        elif pressure_spike <= 0.0 and (conflict is None or conflict_value>=0.15): delta=1
        self.replay_interval_v84=max(lo,min(hi,self.replay_interval_v84+delta)); self.replay_controller_updates_v84+=1
    def _write(self,x,goals,out,target_latent_sequence=None):
        if x.size(1)<2:return 0
        g=goals if goals is not None else x.new_zeros(x.size(0),x.size(1),self.model.cfg.goal_dim)
        with torch.no_grad():
            if target_latent_sequence is None:
                tgt=torch.stack([self.model.brain46.target_latent(x[:,i+1],g[:,i+1]) for i in range(x.size(1)-1)],1)
            else:
                tgt=target_latent_sequence.reshape(x.size(0), x.size(1)-1, self.model.cfg.latent_dim_v46).detach().to(x)
            pred=out['spine_next_latent'][:,:-1]
            novelty=(1.0-F.cosine_similarity(pred,tgt,dim=-1)).clamp_min(0.0)
            boost=min(3.0,(1+0.75*max(0,self.replay_pressure_ema_v84))*(1+0.75*max(0,-self.replay_last_conflict_v84)))
            pri=novelty*boost+self.model.cfg.replay_priority_floor_v84
            for i in range(x.size(1)-1):
                _write_learning_transition_v83(self.model.neural_memory_v61,x[:,i],g[:,i],x[:,i+1],g[:,i+1],tgt[:,i],priority=float(pri[:,i].mean().item()))
        return (x.size(1)-1)*x.size(0)
    def learning_step_v84(self,x,goal_sequence=None,*,target_latent_sequence=None):
        self.model.train(); out=self.model.forward_learning_v82(x,goal_sequence,target_latent_sequence=target_latent_sequence)
        current_total,weights=self._balanced_total_v82(out); pressure=self._pressure(x,goal_sequence,out,target_latent_sequence)
        prev_pressure_ema=self.replay_pressure_ema_v84
        first_pressure = self.unified_steps_v82 == 0
        pressure_spike = 0.0 if first_pressure else pressure-prev_pressure_ema
        self.replay_pressure_ema_v84 = pressure if first_pressure else 0.9*prev_pressure_ema+0.1*pressure
        active=[p for p in self.model.parameters() if p.requires_grad]; replay=_learning_replay_batch_v83(self.model.neural_memory_v61,min(6,self.model.cfg.neural_memory_replay_minibatch_v61))
        available=replay is not None; execute=bool(available and self._should_replay(pressure,pressure_spike)); replay_total=x.new_zeros(()); replay_cos=self.replay_last_conflict_v84; replay_cos_exact=False; replay_mix=0.; cov=0.; energy=0.; mode='current_only'
        self.unified_optimizer_v80.zero_grad(set_to_none=True)
        if execute:
            ro=self.model.forward_replay_learning_v83(replay['observation'],replay['goal'],replay['next_observation'],replay['next_goal'],replay['target_latent'])
            replay_total=sum(float(getattr(self.model.cfg,self.BASE_WEIGHT_ATTRS[k]))*weights[k]*ro[k] for k in self.LOSS_KEYS)
            self.replay_events_v84+=1; self.steps_since_replay_v84=0
            replay_mix=self.adaptive_replay_mix_v78(self.model.cfg.unified_replay_base_mix_v80,replay_cos,gain=self.model.cfg.unified_replay_conflict_gain_v80)
            diagnostic=bool(self.model.cfg.replay_surgery_enabled_v84 and (self.replay_events_v84%max(1,int(self.model.cfg.replay_diagnostic_interval_v84))==0))
            if diagnostic:
                cg=torch.autograd.grad(current_total,active,retain_graph=True,allow_unused=True); rg=torch.autograd.grad(replay_total,active,allow_unused=True)
                replay_cos=self._global_gradient_cosine(cg,rg); replay_mix=self.adaptive_replay_mix_v78(self.model.cfg.unified_replay_base_mix_v80,replay_cos,gain=self.model.cfg.unified_replay_conflict_gain_v80)
                cov=self._gradient_coverage(active,rg); merged,energy=self._merge_gradients(cg,rg,replay_mix)
                for p,g in zip(active,merged): p.grad=g
                self.replay_last_conflict_v84=replay_cos; replay_cos_exact=True; self.replay_diagnostic_events_v84+=1; self._adapt_interval(pressure_spike,replay_cos); mode='diagnostic_surgery'
            else:
                (current_total+float(replay_mix)*replay_total).backward(); self.replay_last_conflict_v84=0.95*self.replay_last_conflict_v84+0.05*float(replay_cos); self._adapt_interval(pressure_spike, None); mode='fast_combined'
        else:
            current_total.backward(); self.steps_since_replay_v84+=1
        norm=float(nn.utils.clip_grad_norm_(active,self.model.cfg.unified_gradient_clip_v80).item()); self.unified_optimizer_v80.step(); self.unified_steps_v82+=1; writes=self._write(x,goal_sequence,out,target_latent_sequence); self.last_replay_mode_v84=mode
        return {'loss':float(current_total.detach()),'replay_loss':float(replay_total.detach()),'replay_available':float(available),'replay_executed':float(execute),'replay_cosine':float(replay_cos),'replay_cosine_exact_v84':float(replay_cos_exact),'replay_mix':float(replay_mix),'replay_gradient_coverage':float(cov),'replay_projection_energy':float(energy),'gradient_coverage':float(self._gradient_coverage(active,[p.grad for p in active])),'gradient_norm':norm,'replay_transition_writes':float(writes),'replay_events_v84':float(self.replay_events_v84),'replay_diagnostic_events_v84':float(self.replay_diagnostic_events_v84),'replay_interval_v84':float(self.replay_interval_v84),'steps_since_replay_v84':float(self.steps_since_replay_v84),'replay_pressure_v84':float(pressure),'replay_pressure_spike_v84':float(pressure_spike),'replay_pressure_ema_v84':float(self.replay_pressure_ema_v84),'replay_mode_v84':mode,'replay_extra_backward_v84':float(mode=='diagnostic_surgery'),'steps':float(self.unified_steps_v82)}
    def state_dict_v84(self):
        return {**super().state_dict_v83(),'replay_interval_v84':self.replay_interval_v84,'steps_since_replay_v84':self.steps_since_replay_v84,'replay_events_v84':self.replay_events_v84,'replay_diagnostic_events_v84':self.replay_diagnostic_events_v84,'replay_last_conflict_v84':self.replay_last_conflict_v84,'replay_pressure_ema_v84':self.replay_pressure_ema_v84,'replay_controller_updates_v84':self.replay_controller_updates_v84}
    def load_state_dict_v84(self,state):
        self.load_state_dict_v83(state); self.replay_interval_v84=int(state.get('replay_interval_v84',self.replay_interval_v84)); self.steps_since_replay_v84=int(state.get('steps_since_replay_v84',0)); self.replay_events_v84=int(state.get('replay_events_v84',0)); self.replay_diagnostic_events_v84=int(state.get('replay_diagnostic_events_v84',0)); self.replay_last_conflict_v84=float(state.get('replay_last_conflict_v84',0)); self.replay_pressure_ema_v84=float(state.get('replay_pressure_ema_v84',0)); self.replay_controller_updates_v84=int(state.get('replay_controller_updates_v84',0))

class OrganismRuntimeV84(OrganismRuntimeV83): pass
class RuntimeStateStoreV84(RuntimeStateStoreV83):
    VERSION=84
    @classmethod
    def save(cls,path,model,trainer=None,runtime=None): torch.save({'version_v84':cls.VERSION,'base_version':83,'model':model.state_dict(),'trainer':trainer.state_dict_v84() if trainer else None,'runtime':runtime.state_dict() if runtime else None},path)
    @classmethod
    def load(cls,path,model,trainer=None,runtime=None):
        p=torch.load(path,map_location='cpu',weights_only=False); state=p.get('model',p); target=model.state_dict(); compatible={k:v for k,v in state.items() if k in target and tuple(v.shape)==tuple(target[k].shape)}
        shape=[k for k in state if k in target and tuple(state[k].shape)!=tuple(target[k].shape)]; missing=[k for k in target if k not in compatible]; unexpected=[k for k in state if k not in target]; model.load_state_dict(compatible,strict=False); opt=reset=False
        if trainer is not None and p.get('trainer') is not None:
            try: trainer.load_state_dict_v84(p['trainer']); opt=True
            except (ValueError,RuntimeError): reset=True
        if runtime is not None and p.get('runtime') is not None: runtime.load_state_dict(p['runtime'])
        return {'version':int(p.get('version_v84',p.get('version_v83',0))),'loaded_tensors':len(compatible),'missing_tensors':missing,'shape_mismatch':shape,'unexpected_tensors':unexpected,'optimizer_loaded':opt,'optimizer_reset':reset}
