from __future__ import annotations
import torch

def epistemic_score(predictions):
    if predictions.ndim!=4: raise ValueError('predictions [B,C,A,D]')
    return predictions.var(1,unbiased=False).mean(-1)

def choose_action_by_information(predictions): return epistemic_score(predictions).argmax(-1)

def expected_free_energy(reward,uncertainty,information_gain,alpha=.5,beta=.5): return -reward+alpha*uncertainty-beta*information_gain
