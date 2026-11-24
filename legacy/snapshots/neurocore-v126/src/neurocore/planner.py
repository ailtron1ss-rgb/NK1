from __future__ import annotations
import torch
from torch import Tensor
from .world_model import LatentWorldModel

@torch.no_grad()
def score_action_sequences(world:LatentWorldModel,state:Tensor,actions:Tensor,discount:float=0.97,risk_weight:float=0.25):
    states,outcomes,risks,uncertainty=world.rollout(state,actions)
    d=discount**torch.arange(actions.shape[1],device=actions.device,dtype=actions.dtype)
    reward=(outcomes.squeeze(-1)*d).sum(-1)
    risk=(risks.squeeze(-1)*d).sum(-1)
    score=reward-risk_weight*risk
    return score, states, outcomes, risks, uncertainty

@torch.no_grad()
def random_shooting(world,state,action_low,action_high,horizon=6,candidates=64):
    b=state.shape[0]
    actions=torch.rand(b,candidates,horizon,action_low.numel(),device=state.device)*(action_high-action_low)+action_low
    s=actions.shape
    flat=actions.view(b*candidates,horizon,-1); st=state[:,None,:].expand(b,candidates,-1).reshape(b*candidates,-1)
    scores,*rest=score_action_sequences(world,st,flat)
    scores=scores.view(b,candidates)
    best=scores.argmax(-1)
    picked=actions[torch.arange(b),best]
    return picked,scores.max(-1).values
