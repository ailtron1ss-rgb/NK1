from __future__ import annotations
import torch
from torch import Tensor
import torch.nn.functional as F

def cosine_prediction_loss(pred:Tensor,target:Tensor)->Tensor:
    return 1-F.cosine_similarity(pred,target,dim=-1).mean()

def temporal_smoothness(z:Tensor)->Tensor:
    if z.shape[1]<2: return z.new_zeros(())
    return (z[:,1:]-z[:,:-1]).pow(2).mean()

def contrastive_event_loss(a:Tensor,b:Tensor,temperature:float=0.1)->Tensor:
    a=F.normalize(a,dim=-1); b=F.normalize(b,dim=-1)
    logits=a@b.T/temperature; labels=torch.arange(a.shape[0],device=a.device)
    return 0.5*(F.cross_entropy(logits,labels)+F.cross_entropy(logits.T,labels))

def composite_loss(out,target_next,weights=None):
    weights=weights or dict(pred=1.0,temp=0.02,latent=0.1)
    pred=F.mse_loss(out.predicted_next,target_next)
    smooth=temporal_smoothness(out.latent)
    return weights['pred']*pred+weights['temp']*smooth+weights['latent']*out.latent.pow(2).mean(), {'prediction':float(pred.detach()),'smoothness':float(smooth.detach())}
