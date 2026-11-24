from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Mapping, Sequence, Tuple
import json
import math
import random
import time

import torch
import torch.nn.functional as F

from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, Program


@dataclass(frozen=True)
class CausalCreditTrainReportV1:
    version: str
    examples: int
    epochs: int
    steps: int
    weighted_loss: float
    base_loss: float
    mean_weight: float
    positive_credit_mass: float
    negative_credit_mass: float
    wall_s: float

    def to_dict(self) -> dict:
        return asdict(self)


class NeuralCausalCreditTrainerV1:
    """Train the existing neural decoder with execution-grounded credit weights.

    Credits only modulate the magnitude of a valid supervised gradient. They are
    never used as signed loss multipliers, avoiding the unstable behavior where a
    negatively credited action would explicitly maximize its own prediction loss.
    """

    VERSION = "neural-causal-credit-trainer-v1"

    def __init__(self, root: Path, seed: int = 5011):
        self.root = Path(root)
        self.seed = int(seed)
        random.seed(self.seed)
        torch.manual_seed(self.seed)
        self.out_path = self.root / "runtime" / "neural_causal_credit_training_v1.json"

    @staticmethod
    def credit_to_weights(credits: Sequence[float], beta: float = 0.65) -> List[float]:
        if not credits:
            return []
        scale = max(1e-6, max(abs(float(v)) for v in credits))
        out = []
        for value in credits:
            normalized = max(-1.0, min(1.0, float(value) / scale))
            # Bounded exponential emphasis: useful steps get more gradient,
            # harmful steps get less, but neither side can dominate the batch.
            weight = math.exp(float(beta) * normalized)
            out.append(max(0.2, min(2.0, weight)))
        return out

    @staticmethod
    def _valid_mask(target: torch.Tensor) -> torch.Tensor:
        B, L = target.shape
        valid = torch.zeros((B, L), dtype=torch.bool, device=target.device)
        for i in range(B):
            row = target[i]
            halt = (row == 14).nonzero(as_tuple=False)
            end = int(halt[0].item()) + 1 if halt.numel() else L
            valid[i, :end] = True
        return valid

    def fit(
        self,
        model: NeuralProgramSynthesizerV2,
        rows: Sequence[Tuple[str, Program, int]],
        credit_weights: Mapping[int, Sequence[float]],
        *,
        epochs: int = 2,
        lr: float = 3e-4,
        batch_size: int = 8,
    ) -> CausalCreditTrainReportV1:
        data = list(rows)
        if not data:
            return CausalCreditTrainReportV1(self.VERSION, 0, int(epochs), 0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0)
        t0 = time.perf_counter()
        opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
        device = next(model.parameters()).device
        rng = random.Random(self.seed)
        model.train()
        total_weighted = 0.0
        total_base = 0.0
        weight_sum = 0.0
        token_count = 0
        positive_mass = 0.0
        negative_mass = 0.0
        steps = 0

        for epoch in range(max(1, int(epochs))):
            order = list(range(len(data)))
            rng.shuffle(order)
            for start in range(0, len(order), max(1, int(batch_size))):
                batch_ids = order[start : start + max(1, int(batch_size))]
                batch = [data[i] for i in batch_ids]
                # The existing trainer already contains the exact batching semantics;
                # this path intentionally reuses the model's causal teacher-forcing API
                # to keep the intervention focused only on the gradient weighting.
                accum_loss = None
                accum_base = None
                accum_w = 0.0
                batch_positive = 0.0
                batch_negative = 0.0
                valid_examples = 0
                for local_index, (text, code, family_id) in enumerate(batch):
                    out = model.forward_teacher(text, code, family_id)
                    valid = self._valid_mask(out['op_y'].unsqueeze(0))[0]
                    weights = self.credit_to_weights(credit_weights.get(batch_ids[local_index], [1.0] * len(out['op_y'])))
                    padded = torch.ones(model.max_len, dtype=torch.float32, device=device)
                    if weights:
                        n = min(len(weights), model.max_len)
                        padded[:n] = torch.tensor(weights[:n], dtype=torch.float32, device=device)
                    op_loss = F.cross_entropy(out['op'].squeeze(0), out['op_y'], reduction='none')
                    a_loss = F.cross_entropy(out['a'].squeeze(0), out['a_y'], reduction='none')
                    b_loss = F.cross_entropy(out['b'].squeeze(0), out['b_y'], reduction='none')
                    per_token = op_loss + 0.5 * a_loss + 0.5 * b_loss
                    masked = valid.float() * padded
                    denom = masked.sum().clamp_min(1.0)
                    weighted = (per_token * masked).sum() / denom
                    base = (per_token * valid.float()).sum() / valid.float().sum().clamp_min(1.0)
                    accum_loss = weighted if accum_loss is None else accum_loss + weighted
                    accum_base = base if accum_base is None else accum_base + base
                    accum_w += float(masked.sum().detach())
                    valid_examples += 1
                    if weights:
                        batch_positive += sum(max(0.0, float(x) - 1.0) for x in weights)
                        batch_negative += sum(max(0.0, 1.0 - float(x)) for x in weights)
                if valid_examples == 0:
                    continue
                loss = accum_loss / float(valid_examples)
                base = accum_base / float(valid_examples)
                opt.zero_grad(set_to_none=True)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                opt.step()
                steps += 1
                total_weighted += float(loss.detach())
                total_base += float(base.detach())
                weight_sum += accum_w
                token_count += max(1, int(accum_w / max(1, valid_examples)))
                positive_mass += batch_positive
                negative_mass += batch_negative

        report = CausalCreditTrainReportV1(
            self.VERSION,
            len(data),
            max(1, int(epochs)),
            steps,
            total_weighted / max(1, steps),
            total_base / max(1, steps),
            weight_sum / max(1, token_count),
            positive_mass,
            negative_mass,
            time.perf_counter() - t0,
        )
        self.out_path.parent.mkdir(parents=True, exist_ok=True)
        self.out_path.write_text(json.dumps(report.to_dict(), indent=2, sort_keys=True), encoding="utf-8")
        return report
