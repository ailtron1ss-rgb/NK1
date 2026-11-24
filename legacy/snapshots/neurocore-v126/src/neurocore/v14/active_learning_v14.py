from __future__ import annotations
import torch
def choose_by_information_gain(candidate_states):
    if candidate_states.ndim!=3: raise ValueError('candidate_states must be [B,C,D]')
    mu=candidate_states.mean(1,keepdim=True); return ((candidate_states-mu)**2).mean(-1).argmax(1)
def counterfactual_gain(model,z,actions):
    vals=[]
    for a in actions.unbind(1):
        nxt,rew,unc=model.world(z,a); vals.append((rew+unc).squeeze(-1))
    return torch.stack(vals,1)
