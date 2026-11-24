from __future__ import annotations
import torch
import torch.nn.functional as F

def prediction_objective(out,target): return F.mse_loss(out['latent'][:,-1],target)
def temporal_prediction_loss(out): return out['prediction_error'].mean()+.1*out['prediction_uncertainty'].mean()
def memory_retrieval_loss(out,target): return F.mse_loss(out['memory_read'][:,-1],target)
def evidence_regularizer(out): return (out['evidence']*(1-out['evidence'])).mean()
def compute_budget_loss(out,target_rate=.25): return (out['compute_probability'].mean()-target_rate).abs()
def world_consistency_loss(out): return out['world_disagreement'].mean()+.1*(out['world_uncertainty'] if 'world_uncertainty' in out else out['prediction_uncertainty']).mean()
def total_loss(out,target):
    return prediction_objective(out,target)+.15*temporal_prediction_loss(out)+.10*evidence_regularizer(out)+.10*compute_budget_loss(out)+.10*world_consistency_loss(out)
