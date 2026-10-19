from __future__ import annotations

"""V13: predictive + E/I substrate + sparse astrocyte memory/control."""

import torch
import torch.nn as nn

from .neural_program_synth_v12 import NeuralProgramSynthesizerV12
from .neural_astrocyte_memory_v1 import AstrocyteMemoryControllerV1


class NeuralProgramSynthesizerV13(NeuralProgramSynthesizerV12):
    version = "predictive-ei-astro-memory-v13"

    def __init__(self, *args, astrocytes: int = 12, astro_top_k: int = 3,
                 raw_sequence_tokens: int = 12, raw_sequence_scale: float = 0.20, **kwargs):
        super().__init__(*args, **kwargs)
        total = self.neural_substrate.neurons
        self.astro_memory = AstrocyteMemoryControllerV1(total, astrocytes=astrocytes, top_k=astro_top_k)
        self.astro_readout = nn.Sequential(nn.Linear(astrocytes, self.hidden), nn.GELU(), nn.LayerNorm(self.hidden))
        self.astro_gate = nn.Sequential(nn.Linear(self.hidden * 2, self.hidden), nn.GELU(), nn.Linear(self.hidden, self.hidden), nn.Sigmoid())
        # The old V13 path reduced the ordered text encoder to CLS before it ever
        # reached the recurrent substrate.  This branch preserves the full ordered
        # contextual sequence and runs it through the same canonical substrate in a
        # functional batched pass.  It is raw-language input: no TaskSpec/sketch is
        # consumed here.
        self.raw_sequence_tokens = max(2, min(int(raw_sequence_tokens), self.ordered_text.max_tokens + 1))
        self.raw_sequence_scale = float(max(0.0, min(1.0, raw_sequence_scale)))
        self.raw_substrate_readout = nn.Sequential(
            nn.Linear(total, self.hidden), nn.GELU(), nn.LayerNorm(self.hidden)
        )
        self.raw_sequence_gate = nn.Sequential(
            nn.Linear(self.hidden * 2, self.hidden), nn.GELU(),
            nn.Linear(self.hidden, self.hidden), nn.Sigmoid()
        )

    def encode_text_batch(self, texts):
        base = super().encode_text_batch(texts)

        # Preserve word/token order all the way into the recurrent substrate.  The
        # mask prevents padded positions from changing recurrent state or pooled
        # evidence.  This path is fully differentiable and vectorized across batch.
        ordered, valid = self.ordered_text.encode_sequence_batch(list(texts))
        ordered = ordered[:, :self.raw_sequence_tokens]
        valid = valid[:, :self.raw_sequence_tokens]
        raw_out = self.neural_substrate.forward_batch(ordered, mask=valid)
        raw_feat = self.raw_substrate_readout(raw_out["pooled"])

        # Astrocytic memory reads the actual ordered neural trajectory.  The
        # controller is stateful per example, so each trajectory is evaluated from a
        # clean state; this keeps batch examples independent.
        astro_feats = []
        for spikes in raw_out["spikes"]:
            a = self.astro_memory(spikes, reset_state=True)
            astro_feats.append(a["memory_trace"])
        astro = self.astro_readout(torch.stack(astro_feats, 0))
        astro_gate = self.astro_gate(torch.cat([base, astro], dim=-1))
        raw_gate = self.raw_sequence_gate(torch.cat([base, raw_feat], dim=-1))
        result = base + self.raw_sequence_scale * raw_gate * raw_feat + 0.10 * astro_gate * astro
        # encode_text_batch is a functional representation call; do not leak the
        # final example's diagnostic astro state into later batches or checkpoints.
        self.astro_memory.reset_state()
        return result
    @torch.no_grad()
    def checkpoint_signature(self):
        sig = super().checkpoint_signature()
        sig.update({
            "model_class": self.__class__.__module__ + "." + self.__class__.__name__,
            "substrate_steps": int(self.substrate_steps),
            "astrocytes": int(self.astro_memory.astrocytes),
            "astro_top_k": int(self.astro_memory.top_k),
            "raw_sequence_tokens": int(self.raw_sequence_tokens),
            "raw_sequence_scale": float(self.raw_sequence_scale),
        })
        return sig

