from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict
import torch
from torch import Tensor
from .core import NeuroWeaveV38,V38Config,V38State,OrganismTrainerV38,RuntimeStateStoreV38

@dataclass
class LiveOrganismV38:
    model: NeuroWeaveV38
    trainer: Optional[OrganismTrainerV38]=None
    state: Optional[V38State]=None
    last_output: Optional[Dict[str,Tensor]]=None

    @classmethod
    def create(cls,cfg:Optional[V38Config]=None,device=None,dtype=torch.float32,with_trainer=True,lr=3e-4):
        model=NeuroWeaveV38(cfg).to(device=device,dtype=dtype)
        trainer=OrganismTrainerV38(model,lr=lr) if with_trainer else None
        return cls(model=model,trainer=trainer)

    def reset(self,batch_size=1,device=None,dtype=None):
        device=next(self.model.parameters()).device if device is None else device
        dtype=next(self.model.parameters()).dtype if dtype is None else dtype
        self.state=self.model.initial_state(batch_size,device=device,dtype=dtype); self.last_output=None; self.last_observation=None; self.online_steps=0; return self.state

    def act(self,observation:Tensor,goal:Optional[Tensor]=None):
        if observation.ndim==1: observation=observation.unsqueeze(0)
        if self.state is None or self.state.base.base.macro_state.size(0)!=observation.size(0):
            self.reset(observation.size(0),observation.device,observation.dtype)
        out,self.state=self.model.step(observation,self.state,goal=goal,commit_memory=True,force_planning=None)
        self.last_output=out; self.last_observation=observation.detach().clone(); return out

    def observe_outcome(self,next_observation:Tensor,reward:Tensor,risk:Tensor,done:Optional[Tensor]=None):
        if self.last_output is None or self.state is None: raise RuntimeError('observe_outcome requires act()')
        if next_observation.ndim==1: next_observation=next_observation.unsqueeze(0)
        if reward.ndim==1: reward=reward.unsqueeze(-1)
        if risk.ndim==1: risk=risk.unsqueeze(-1)
        observed,self.state=self.model.observe_outcome(self.state,self.last_output,next_observation,reward,risk,done)
        self.online_steps += 1
        admission=float(self.last_output.get('development_admission_v38', torch.ones(1,1,device=next_observation.device)).mean().detach().item())
        if self.trainer is not None and self.last_observation is not None and self.online_steps % max(1,self.model.cfg.development_online_update_interval_v38)==0 and admission >= self.model.cfg.development_admission_threshold_v38:
            seq=torch.stack([self.last_observation.squeeze(0), next_observation.squeeze(0)],0).unsqueeze(0)
            target=torch.stack([next_observation.squeeze(0), next_observation.squeeze(0)],0).unsqueeze(0)
            rr=torch.stack([reward.squeeze(-1), reward.squeeze(-1)],0).unsqueeze(0)
            rk=torch.stack([risk.squeeze(-1), risk.squeeze(-1)],0).unsqueeze(0)
            self.trainer.step(seq,target_sequence=target,reward_sequence=rr,risk_sequence=rk,force_planning=False)
        if done is not None and bool(done.detach().any().item()): self.last_output=None
        return observed,self.state

    def save(self,path:str)->None:
        if self.state is None: raise RuntimeError('cannot save before reset/act')
        RuntimeStateStoreV38.save(path,self.state)

    def load(self,path:str,device=None,dtype=None):
        self.state=RuntimeStateStoreV38.load(path,device=device,dtype=dtype); self.last_output=None; return self.state
