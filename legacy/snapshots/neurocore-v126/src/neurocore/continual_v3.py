import torch
from torch import nn
import torch.nn.functional as F
class StabilityPlasticityRegularizer(nn.Module):
    def __init__(self,strength=.1): super().__init__(); self.strength=float(strength)
    def forward(self,current,reference,importance=None):
        d=(current-reference).pow(2); return self.strength*(d*importance if importance is not None else d).mean()
class ReplayDistillationLoss(nn.Module):
    def __init__(self,temperature=1.,strength=1.): super().__init__(); self.temperature=float(temperature); self.strength=float(strength)
    def forward(self,student,teacher): return self.strength*F.mse_loss(student/self.temperature,teacher.detach()/self.temperature)
