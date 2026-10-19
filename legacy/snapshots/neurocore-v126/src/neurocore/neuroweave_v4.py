from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor,nn
import torch.nn.functional as F
from .tri_scale import TriScalePredictiveCell,TriScaleState
from .information_gain import LatentInformationGain
from .replay_consolidation import ConsolidationReplay
@dataclass
class NeuroWeaveV4State: scales:TriScaleState; context:Tensor; prev:Tensor; step:Tensor
@dataclass
class NeuroWeaveV4Output:
    latent:Tensor; fast:Tensor; medium:Tensor; slow:Tensor; prediction:Tensor; prediction_error:Tensor; novelty:Tensor; uncertainty:Tensor; consolidation:Tensor; plasticity:Tensor; compute_probability:Tensor; action:Tensor; information_gain:Tensor
class NeuroWeaveV4(nn.Module):
    def __init__(self,d_model=32,hidden=40,action_dim=16,replay_capacity=512):
        super().__init__(); self.d_model=d_model; self.action_dim=action_dim; self.encoder=nn.Sequential(nn.Linear(d_model,d_model),nn.SiLU(),nn.LayerNorm(d_model)); self.core=TriScalePredictiveCell(d_model,hidden,hidden,d_model); self.pred=nn.Linear(d_model,d_model); self.gate=nn.Sequential(nn.Linear(d_model*3+3,d_model),nn.SiLU(),nn.Linear(d_model,3)); self.action_head=nn.Linear(d_model,action_dim); self.ig=LatentInformationGain(d_model,action_dim); self.replay=ConsolidationReplay(d_model,replay_capacity); self.compute=nn.Sequential(nn.Linear(d_model+3,d_model),nn.SiLU(),nn.Linear(d_model,1))
    def initial_state(self,batch,device=None,dtype=None):
        s=self.core.initial_state(batch,device,dtype); z=torch.zeros(batch,self.d_model,device=device,dtype=dtype); return NeuroWeaveV4State(s,z,z,torch.zeros(batch,1,device=device,dtype=dtype))
    def step(self,x,state,action=None):
        e=self.encoder(x); prior=self.pred(state.prev); err=e-prior; em=err.pow(2).mean(-1,keepdim=True).sqrt(); novelty=(1-F.cosine_similarity(e,state.prev,dim=-1).unsqueeze(-1)).clamp(0,2); uncertainty=torch.sigmoid(em.detach()); mods=torch.sigmoid(self.gate(torch.cat([state.prev,state.context,state.scales.slow,em,novelty,uncertainty],-1))); evidence=(mods[:,0:1]*em.sigmoid()+mods[:,1:2]*novelty.clamp(0,1)+mods[:,2:3]*uncertainty)/3; latent,scales,plasticity=self.core(e,state.scales,em,1-uncertainty); context=.8*state.context+.2*latent; consolidation=torch.sigmoid(4*(evidence-.5))*plasticity; cp=torch.sigmoid(self.compute(torch.cat([latent,em,novelty,uncertainty],-1))); proposal=self.action_head(latent); act=proposal if action is None else action; _,ig=self.ig(latent,act); prediction=self.pred(latent); pe=(e-prediction).pow(2).mean(-1,keepdim=True).sqrt(); return NeuroWeaveV4Output(latent,scales.fast,scales.medium,scales.slow,prediction,pe,novelty,uncertainty,consolidation,plasticity,cp,proposal,ig),NeuroWeaveV4State(scales,context,latent.detach(),state.step+1)
    def forward(self,x,state=None,actions=None,collect_replay=False):
        if x.ndim!=3 or x.size(-1)!=self.d_model: raise ValueError('x must be [B,T,D]')
        state=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; os=[]
        for t in range(x.size(1)):
            a=None if actions is None else actions[:,t]; o,state=self.step(x[:,t],state,a); os.append(o)
            if collect_replay and not self.training:
                with torch.no_grad(): self.replay.add(o.latent,o.prediction,o.consolidation.mean())
        vals={k:torch.stack([getattr(o,k) for o in os],1) for k in NeuroWeaveV4Output.__dataclass_fields__}; return NeuroWeaveV4Output(**vals),state
