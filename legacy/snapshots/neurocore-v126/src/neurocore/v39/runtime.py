from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Dict, List
import torch
from torch import Tensor
from .core import NeuroWeaveV39,V39Config,V39State,OrganismTrainerV39,RuntimeStateStoreV39

@dataclass
class LiveOrganismV39:
    model: NeuroWeaveV39
    trainer: Optional[OrganismTrainerV39]=None
    state: Optional[V39State]=None
    last_output: Optional[Dict[str,Tensor]]=None
    last_observation: Optional[Tensor]=None
    online_steps: int=0
    _obs_buffer: List[Tensor]=field(default_factory=list)
    _reward_buffer: List[Tensor]=field(default_factory=list)
    _risk_buffer: List[Tensor]=field(default_factory=list)

    @classmethod
    def create(cls,cfg:Optional[V39Config]=None,device=None,dtype=torch.float32,with_trainer=True,lr=3e-4):
        model=NeuroWeaveV39(cfg).to(device=device,dtype=dtype)
        trainer=OrganismTrainerV39(model,lr=lr) if with_trainer else None
        return cls(model=model,trainer=trainer)

    def reset(self,batch_size=1,device=None,dtype=None):
        device=next(self.model.parameters()).device if device is None else device
        dtype=next(self.model.parameters()).dtype if dtype is None else dtype
        self.state=self.model.initial_state(batch_size,device=device,dtype=dtype); self.last_output=None; self.last_observation=None; self.online_steps=0
        self._obs_buffer=[]; self._reward_buffer=[]; self._risk_buffer=[]
        return self.state

    def act(self,observation:Tensor,goal:Optional[Tensor]=None):
        if observation.ndim==1: observation=observation.unsqueeze(0)
        if self.state is None or self.state.base.base.base.macro_state.size(0)!=observation.size(0): self.reset(observation.size(0),observation.device,observation.dtype)
        out,self.state=self.model.step(observation,self.state,goal=goal,commit_memory=True,force_planning=None)
        self.last_output=out; self.last_observation=observation.detach().clone();
        self._obs_buffer.append(observation.detach().clone()); self._obs_buffer=self._obs_buffer[-6:]
        return out

    def observe_outcome(self,next_observation:Tensor,reward:Tensor,risk:Tensor,done:Optional[Tensor]=None):
        if self.last_output is None or self.state is None: raise RuntimeError('observe_outcome requires act()')
        if next_observation.ndim==1: next_observation=next_observation.unsqueeze(0)
        if reward.ndim==1: reward=reward.unsqueeze(-1)
        if risk.ndim==1: risk=risk.unsqueeze(-1)
        observed,self.state=self.model.observe_outcome(self.state,self.last_output,next_observation,reward,risk,done)
        self.online_steps += 1
        self._obs_buffer.append(next_observation.detach().clone()); self._obs_buffer=self._obs_buffer[-6:]
        self._reward_buffer.append(reward.detach().clone()); self._reward_buffer=self._reward_buffer[-6:]
        self._risk_buffer.append(risk.detach().clone()); self._risk_buffer=self._risk_buffer[-6:]
        if self.trainer is not None and self.online_steps % max(1,self.model.cfg.policy_online_update_interval_v39)==0 and len(self._obs_buffer)>=4:
            xs=torch.stack([v.squeeze(0) for v in self._obs_buffer[-4:]],0).unsqueeze(0)
            # For the compact runtime window we supervise every transition with the next
            # frame. The held-out verifier still decides whether weights remain committed.
            target=xs.clone()
            rew=torch.stack([self._reward_buffer[max(0,len(self._reward_buffer)-4+i)].squeeze(-1) if self._reward_buffer else torch.zeros(1,device=xs.device,dtype=xs.dtype) for i in range(4)],0).unsqueeze(0)
            rk=torch.stack([self._risk_buffer[max(0,len(self._risk_buffer)-4+i)].squeeze(-1) if self._risk_buffer else torch.zeros(1,device=xs.device,dtype=xs.dtype) for i in range(4)],0).unsqueeze(0)
            _,_=self.trainer.step(xs,target_sequence=target,reward_sequence=rew,risk_sequence=rk,force_planning=False)
            report=self.trainer.last_update_report
            if report.get('accepted'):
                self.state.update_accepts=(self.state.update_accepts+1).detach()
                self.state.policy_version=(self.state.policy_version+1).detach()
            elif report.get('rolled_back'):
                self.state.update_rejects=(self.state.update_rejects+1).detach()
        self.last_observation=next_observation.detach().clone()
        if done is not None and bool(done.detach().any().item()): self.last_output=None
        return observed,self.state

    def save(self,path:str)->None:
        if self.state is None: raise RuntimeError('cannot save before reset/act')
        RuntimeStateStoreV39.save(path,self.state)

    def load(self,path:str,device=None,dtype=None):
        self.state=RuntimeStateStoreV39.load(path,device=device,dtype=dtype); self.last_output=None; return self.state
