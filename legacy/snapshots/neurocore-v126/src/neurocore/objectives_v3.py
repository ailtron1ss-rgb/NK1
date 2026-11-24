from __future__ import annotations
import torch
from torch import Tensor
import torch.nn.functional as F

def masked_mean(x:Tensor, mask:Tensor|None=None):
    if mask is None: return x.mean()
    return (x*mask).sum()/mask.sum().clamp_min(1)

def next_latent_loss(latent:Tensor, target:Tensor|None=None):
    if target is None: target=latent.detach().roll(-1,1); target[:,-1]=latent[:,-1].detach()
    return ((latent-target)**2).mean()

def prediction_error_loss(pred:Tensor, x:Tensor):
    return F.smooth_l1_loss(pred, x)

def memory_consistency_loss(latent:Tensor,memory:Tensor):
    return (1-F.cosine_similarity(latent,memory,dim=-1)).mean()

def slow_stability_loss(slow:Tensor, fast:Tensor, weight=0.1):
    delta=slow[:,1:]-slow[:,:-1]
    ref=fast[:,1:]-fast[:,:-1]
    return weight*(delta.pow(2).mean()+0.25*F.relu(delta.abs().mean()-ref.abs().mean().detach()).pow(2))

def route_entropy_loss(route:Tensor,target_entropy:float=0.6):
    p=route.clamp_min(1e-8)
    h=-(p*p.log()).sum(-1)
    return (h-target_entropy).pow(2).mean()

def uncertainty_calibration_loss(uncertainty:Tensor,error:Tensor):
    target=(error.detach()/(error.detach().mean(dim=1,keepdim=True)+1e-6)).clamp(0,1)
    return F.mse_loss(uncertainty.clamp(0,1),target)

def world_consistency_loss(world_reward:Tensor, risk:Tensor):
    return (F.softplus(-world_reward)+0.01*risk).mean()

def self_prediction_loss(self_prediction:Tensor, latent:Tensor):
    target=latent.detach().roll(-1,1); target[:,-1]=latent[:,-1].detach()
    return F.smooth_l1_loss(self_prediction[:,:-1],target[:,:-1])

def composite_v3(outputs,inputs,target=None,weights=None):
    w={'next':1.0,'prediction':1.0,'memory':0.25,'slow':0.1,'route':0.05,'uncertainty':0.1,'world':0.05,'self':0.5}
    if weights: w.update(weights)
    losses={
        'next':next_latent_loss(outputs.latent,target),
        'prediction':prediction_error_loss(outputs.prediction,inputs),
        'memory':memory_consistency_loss(outputs.latent,outputs.memory),
        'slow':slow_stability_loss(outputs.slow,outputs.fast,w['slow']),
        'route':route_entropy_loss(outputs.route),
        'uncertainty':uncertainty_calibration_loss(outputs.uncertainty,outputs.prediction_error),
        'world':world_consistency_loss(torch.zeros_like(outputs.prediction_error),outputs.deep_probability),
        'self':self_prediction_loss(outputs.self_prediction,outputs.latent),
    }
    total=sum(w[k]*losses[k] for k in losses)
    return total,losses
