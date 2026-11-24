from __future__ import annotations

"""V12: predictive-coding refinement followed by the E/I compartmental substrate."""

import torch
import torch.nn as nn

from .neural_program_synth_v9 import NeuralProgramSynthesizerV9
from .neural_predictive_coding_v1 import PredictiveCodingRefinerV1
from .neural_substrate_v1 import ModernNeuralSubstrateV1


class NeuralProgramSynthesizerV12(NeuralProgramSynthesizerV9):
    version = "predictive-ei-grounding-v12"

    def __init__(self, *args, predictive_iterations: int = 4,
                 substrate_exc: int = 48, substrate_inh: int = 16,
                 substrate_steps: int = 4, **kwargs):
        super().__init__(*args, **kwargs)
        self.predictive = PredictiveCodingRefinerV1(self.hidden, self.hidden, iterations=predictive_iterations)
        self.substrate_steps = max(2, int(substrate_steps))
        self.neural_substrate = ModernNeuralSubstrateV1(
            input_dim=self.hidden, exc_neurons=substrate_exc, inh_neurons=substrate_inh, branches=4, seed=23
        )
        total = substrate_exc + substrate_inh
        self.neural_readout = nn.Sequential(nn.Linear(total, self.hidden), nn.GELU(), nn.LayerNorm(self.hidden))
        self.fusion = nn.Sequential(nn.Linear(self.hidden * 2, self.hidden), nn.GELU(), nn.Linear(self.hidden, self.hidden), nn.Sigmoid())
        self.time_code = nn.Parameter(torch.randn(self.substrate_steps, self.hidden) * 0.015)

    def encode_text_batch(self, texts):
        base = super().encode_text_batch(texts)
        refined = self.predictive(base)
        seq = refined.unsqueeze(1).expand(len(texts), self.substrate_steps, self.hidden) + self.time_code.unsqueeze(0)
        features = []
        for b in range(seq.shape[0]):
            out = self.neural_substrate(seq[b], local_plasticity=False, reset_state=True)
            features.append(out["pooled"])
        neural = self.neural_readout(torch.stack(features, 0))
        gate = self.fusion(torch.cat([base, neural], dim=-1))
        return base + 0.30 * gate * neural
