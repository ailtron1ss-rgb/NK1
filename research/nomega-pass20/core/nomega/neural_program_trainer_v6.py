from __future__ import annotations

"""V6 trainer: V5 scheduled sampling plus explicit semantic-sketch auxiliary loss."""
from dataclasses import dataclass, asdict
from typing import Sequence, Tuple
import time
import torch
import torch.nn.functional as F

from .neural_program_trainer_v5 import AtomicProgramTrainerV5
from .task_spec_v1 import parse_task_spec


@dataclass
class AtomicProgramTrainReportV6:
    loss: float
    token_loss: float
    family_loss: float
    semantic_loss: float
    examples: int
    epochs: int
    steps: int
    wall_s: float
    semantic_weight: float

    def to_dict(self):
        return asdict(self)


class AtomicProgramTrainerV6(AtomicProgramTrainerV5):
    """Train a V9 model while explicitly supervising the semantic fusion path."""

    def _semantic_targets(self, texts, device):
        allowed = ("ADD","SUB","MUL","XOR","MIN","MAX","MOD","CLAMP","PARITY","LOOP")
        index = {x:i for i,x in enumerate(allowed)}
        y = torch.zeros((len(texts), len(allowed)), dtype=torch.float32, device=device)
        for i, text in enumerate(texts):
            spec = parse_task_spec(text)
            if not spec.semantic_valid:
                continue
            for op in spec.operators:
                if op in index:
                    y[i, index[op]] += 1.0
        return y.clamp_max(1.0)

    def _semantic_loss(self, texts, device):
        if not hasattr(self.model, "_semantic_vector"):
            return torch.tensor(0.0, device=device)
        sem = self.model._semantic_vector(list(texts), device)
        target = self._semantic_targets(texts, device)
        # Use normalized semantic representation as a bounded multi-label probe.
        probe = self.model.semantic_probe(sem)
        return F.binary_cross_entropy_with_logits(probe, target)

    def fit(self, rows: Sequence[Tuple[str, list, int]], *, epochs=12, batch_size=8, max_examples=128,
            semantic_weight=0.20, **kwargs):
        if not rows:
            return AtomicProgramTrainReportV6(0,0,0,0,0,0,self.steps,0.0,semantic_weight)
        if not hasattr(self.model, "semantic_probe"):
            import torch.nn as nn
            self.model.semantic_probe = nn.Linear(self.model.hidden, 10).to(next(self.model.parameters()).device)
            self.opt.add_param_group({"params": self.model.semantic_probe.parameters()})
        data=list(rows)[:max_examples]
        # Warm the V5 decoder with its proven scheduled-sampling path.
        base = super().fit(data, epochs=max(1, epochs//2), batch_size=batch_size, max_examples=max_examples, **kwargs)
        t0=time.perf_counter(); sem_values=[]
        for _ in range(max(1, epochs - max(1, epochs//2))):
            self.opt.zero_grad(set_to_none=True)
            texts=[str(r[0]) for r in data[:batch_size]]
            loss=self._semantic_loss(texts, next(self.model.parameters()).device)
            (float(semantic_weight)*loss).backward(); self.opt.step(); self.steps += 1
            sem_values.append(float(loss.detach().item()))
        elapsed=time.perf_counter()-t0 + base.wall_s
        return AtomicProgramTrainReportV6(
            loss=base.loss + float(semantic_weight)*(sum(sem_values)/max(1,len(sem_values))),
            token_loss=base.token_loss,
            family_loss=base.family_loss,
            semantic_loss=sum(sem_values)/max(1,len(sem_values)),
            examples=len(data), epochs=epochs, steps=self.steps, wall_s=elapsed,
            semantic_weight=float(semantic_weight),
        )
