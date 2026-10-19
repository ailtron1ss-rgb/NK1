from __future__ import annotations
import torch

class DriftRecoveryController:
    """Bounded state-level recovery controller; it never mutates model parameters."""
    def __init__(self,threshold=0.45,max_gain=0.5): self.threshold=threshold; self.max_gain=max_gain
    def __call__(self,prediction_error,uncertainty):
        signal=(0.6*prediction_error+0.4*uncertainty).clamp(0,1); gain=(signal-self.threshold).clamp_min(0)/max(1e-6,1-self.threshold)
        return (gain*self.max_gain).clamp(0,self.max_gain)
