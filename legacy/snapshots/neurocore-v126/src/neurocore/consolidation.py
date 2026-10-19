from __future__ import annotations
from dataclasses import dataclass
import torch
from torch import Tensor, nn

@dataclass
class ConsolidationDecision:
    write: Tensor
    confidence: Tensor
    reason_score: Tensor

class EvidenceConsolidator(nn.Module):
    """Learns when fast traces deserve promotion toward slow state/memory.

    It only emits a decision. The host decides which canonical store, if any,
    receives the trace. No identity or autobiographical truth is written here.
    """
    def __init__(self, d_model: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model + 5, max(32, d_model // 2)), nn.SiLU(),
            nn.Linear(max(32, d_model // 2), 1)
        )

    def forward(self, z: Tensor, novelty: Tensor, uncertainty: Tensor, prediction_error: Tensor, stability: Tensor, repetition: Tensor) -> ConsolidationDecision:
        features = torch.cat([z, novelty, uncertainty, prediction_error, stability, repetition], -1)
        score = self.net(features)
        confidence = torch.sigmoid(score)
        write = (confidence * novelty * (0.5 + 0.5 * uncertainty)).clamp(0, 1)
        return ConsolidationDecision(write=write, confidence=confidence, reason_score=score)
