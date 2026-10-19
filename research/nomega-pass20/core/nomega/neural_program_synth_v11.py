from __future__ import annotations

"""V11 neural synthesizer with a compartmental E/I substrate encoder."""

from typing import Optional
import torch
import torch.nn as nn

from .neural_program_synth_v9 import NeuralProgramSynthesizerV9
from .neural_substrate_v1 import ModernNeuralSubstrateV1


class NeuralProgramSynthesizerV11(NeuralProgramSynthesizerV9):
    version = "compartmental-ei-grounding-v11"

    def __init__(self, *args, substrate_exc: int = 48, substrate_inh: int = 16,
                 substrate_steps: int = 4, branches: int = 4, **kwargs):
        super().__init__(*args, **kwargs)
        self.substrate_steps = max(2, int(substrate_steps))
        self.neural_substrate = ModernNeuralSubstrateV1(
            input_dim=self.hidden,
            exc_neurons=substrate_exc,
            inh_neurons=substrate_inh,
            branches=branches,
            seed=17,
        )
        total = substrate_exc + substrate_inh
        self.substrate_readout = nn.Sequential(
            nn.Linear(total, self.hidden),
            nn.GELU(),
            nn.LayerNorm(self.hidden),
        )
        self.substrate_gate = nn.Sequential(
            nn.Linear(self.hidden * 2, self.hidden),
            nn.GELU(),
            nn.Linear(self.hidden, self.hidden),
            nn.Sigmoid(),
        )
        self.substrate_time = nn.Parameter(torch.randn(self.substrate_steps, self.hidden) * 0.02)

    def _substrate_features(self, base: torch.Tensor) -> torch.Tensor:
        # Treat the encoded semantic state as a short temporal pulse train. Each step
        # has a learned phase so the recurrent substrate can bind order, not only mean.
        bsz = base.shape[0]
        seq = base.unsqueeze(1).expand(bsz, self.substrate_steps, base.shape[-1])
        seq = seq + self.substrate_time.unsqueeze(0)
        outs = []
        for b in range(bsz):
            out = self.neural_substrate(seq[b], local_plasticity=False, reset_state=True)
            outs.append(out["pooled"])
        return torch.stack(outs, 0)

    def encode_text_batch(self, texts):
        base = super().encode_text_batch(texts)
        neural = self._substrate_features(base)
        projected = self.substrate_readout(neural)
        gate = self.substrate_gate(torch.cat([base, projected], dim=-1))
        return base + 0.35 * gate * projected

    @torch.no_grad()
    def adapt_with_local_rule(self, sequence: torch.Tensor, teaching: torch.Tensor, reward: float = 0.0) -> None:
        self.eval()
        self.neural_substrate(
            sequence,
            teaching=teaching,
            reward=torch.full((sequence.shape[0],), float(reward), device=sequence.device),
            local_plasticity=True,
            structural_plasticity=False,
            reset_state=True,
        )
