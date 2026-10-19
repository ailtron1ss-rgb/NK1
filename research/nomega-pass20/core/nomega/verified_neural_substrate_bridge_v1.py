from __future__ import annotations

"""Verified-execution bridge for ModernNeuralSubstrateV1.

The bridge turns TRAIN-only executable evidence into a learned candidate scorer.
It is deliberately a pre-verifier/ranker: hidden HOLDOUT/FUTURE evidence is never
used for fitting or ordering candidates. The bridge can optionally apply bounded
local plasticity using only the TRAIN reward signal after differentiable fitting.
"""

from dataclasses import dataclass, asdict
from typing import Any, Mapping, Sequence
import math

import torch
import torch.nn as nn

from .neural_substrate_v1 import ModernNeuralSubstrateV1

Program = list[tuple[int, int, int]]


@dataclass(frozen=True)
class VerifiedSubstrateTrainingReportV1:
    version: str
    examples: int
    unique_programs: int
    epochs: int
    loss_before: float
    loss_after: float
    train_mae: float
    train_rank_correlation: float
    local_plasticity: bool
    substrate_signature_before: str
    substrate_signature_after: str
    exact_train_evaluations: int
    predicted_evaluations: int
    predicted_top_k: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class _SubstrateScoreHeadV1(nn.Module):
    def __init__(self, input_dim: int, hidden: int = 32):
        super().__init__()
        self.net = nn.Sequential(
            nn.LayerNorm(input_dim),
            nn.Linear(input_dim, hidden),
            nn.SiLU(),
            nn.Linear(hidden, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


class VerifiedNeuralSubstrateBridgeV1:
    VERSION = "verified-neural-substrate-bridge-v1"

    def __init__(
        self,
        *,
        input_dim: int = 10,
        neurons: int = 32,
        inh_neurons: int = 8,
        branches: int = 3,
        seed: int = 31001,
        max_len: int = 24,
        hidden: int = 32,
        learning_rate: float = 2e-3,
    ):
        if input_dim < 8:
            raise ValueError("input_dim must be at least 8")
        self.seed = int(seed)
        self.input_dim = int(input_dim)
        self.max_len = max(4, int(max_len))
        self.hidden = max(4, int(hidden))
        rng_state = torch.random.get_rng_state()
        torch.manual_seed(self.seed)
        try:
            self.substrate = ModernNeuralSubstrateV1(
            input_dim=self.input_dim,
            exc_neurons=max(4, int(neurons)),
            inh_neurons=max(2, int(inh_neurons)),
            branches=max(1, int(branches)),
                structural_interval=64,
                seed=self.seed,
            )
            self.head = _SubstrateScoreHeadV1(self.substrate.neurons, hidden=self.hidden)
        finally:
            torch.random.set_rng_state(rng_state)
        self.optimizer = torch.optim.Adam(
            list(self.substrate.parameters()) + list(self.head.parameters()),
            lr=float(learning_rate),
        )
        self._fitted = False
        self._report: VerifiedSubstrateTrainingReportV1 | None = None

    @staticmethod
    def _safe_norm(value: float, scale: float) -> float:
        return float(max(-1.0, min(1.0, value / max(1.0, scale))))

    def encode_program(self, code: Sequence[Sequence[int]], *, family_id: int = 0) -> torch.Tensor:
        rows: list[list[float]] = []
        limit = min(self.max_len, max(1, len(code)))
        fam = self._safe_norm(float(family_id), 63.0)
        for pos in range(limit):
            op, a, b = (int(x) for x in code[pos][:3])
            opn = self._safe_norm(float(op), 31.0)
            an = self._safe_norm(float(a), 31.0)
            bn = self._safe_norm(float(b), 31.0)
            pair = self._safe_norm(float(a + b), 62.0)
            diff = self._safe_norm(float(a - b), 31.0)
            posn = 0.0 if limit <= 1 else (2.0 * pos / (limit - 1)) - 1.0
            rows.append(
                [
                    opn,
                    an,
                    bn,
                    pair,
                    diff,
                    math.sin(float(op)),
                    math.cos(float(op)),
                    posn,
                    fam,
                    float(op in {1, 2, 3, 4, 5, 15, 17, 18}),
                ][: self.input_dim]
            )
        while len(rows) < self.max_len:
            rows.append([0.0] * self.input_dim)
        return torch.tensor(rows, dtype=torch.float32)

    def _representation(self, code: Sequence[Sequence[int]], family_id: int = 0) -> torch.Tensor:
        sequence = self.encode_program(code, family_id=family_id)
        out = self.substrate(sequence, reset_state=True)
        return out["pooled"]

    @staticmethod
    def _rank_correlation(pred: torch.Tensor, target: torch.Tensor) -> float:
        if pred.numel() < 2:
            return 0.0
        p = torch.argsort(torch.argsort(pred))
        t = torch.argsort(torch.argsort(target))
        pc = p.float() - p.float().mean()
        tc = t.float() - t.float().mean()
        denom = float(pc.norm() * tc.norm())
        return float((pc @ tc / denom).item()) if denom > 1e-9 else 0.0

    def fit_verified(
        self,
        examples: Sequence[Mapping[str, Any]],
        *,
        epochs: int = 8,
        local_plasticity: bool = True,
    ) -> VerifiedSubstrateTrainingReportV1:
        clean = [e for e in examples if e.get("code")]
        if not clean:
            raise ValueError("at least one verified TRAIN example is required")
        before_sig = self.substrate.substrate_signature()
        with torch.no_grad():
            baseline_pred = torch.stack([
                torch.clamp(self.head(self._representation(e["code"], int(e.get("family_id", 0)))).reshape(()), 0.0, 1.0)
                for e in clean
            ])
        targets = torch.tensor(
            [float(max(0.0, min(1.0, e.get("train_score", e.get("label", 0.0))))) for e in clean],
            dtype=torch.float32,
        )
        losses: list[float] = []
        for _ in range(max(1, int(epochs))):
            preds = []
            for e in clean:
                rep = self._representation(e["code"], int(e.get("family_id", 0)))
                preds.append(self.head(rep))
            pred = torch.stack(preds)
            loss = torch.nn.functional.smooth_l1_loss(pred, targets)
            self.optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(list(self.substrate.parameters()) + list(self.head.parameters()), 1.0)
            self.optimizer.step()
            losses.append(float(loss.detach().item()))

        if local_plasticity:
            for e, target in zip(clean, targets.tolist()):
                sequence = self.encode_program(e["code"], family_id=int(e.get("family_id", 0)))
                reward = float(2.0 * target - 1.0)
                with torch.no_grad():
                    self.substrate(
                        sequence,
                        reward=torch.full((sequence.shape[0],), reward),
                        local_plasticity=True,
                        structural_plasticity=False,
                        reset_state=True,
                    )

        with torch.no_grad():
            after_pred = torch.stack([
                torch.clamp(self.head(self._representation(e["code"], int(e.get("family_id", 0)))).reshape(()), 0.0, 1.0)
                for e in clean
            ])
            mae = torch.mean(torch.abs(after_pred - targets)).item()
        self._fitted = True
        after_sig = self.substrate.substrate_signature()
        report = VerifiedSubstrateTrainingReportV1(
            version=self.VERSION,
            examples=len(clean),
            unique_programs=len({str(e["code"]) for e in clean}),
            epochs=max(1, int(epochs)),
            loss_before=float(torch.mean(torch.abs(baseline_pred - targets)).item()),
            loss_after=float(losses[-1] if losses else 0.0),
            train_mae=float(mae),
            train_rank_correlation=self._rank_correlation(after_pred, targets),
            local_plasticity=bool(local_plasticity),
            substrate_signature_before=before_sig,
            substrate_signature_after=after_sig,
            exact_train_evaluations=len(clean),
            predicted_evaluations=0,
            predicted_top_k=0,
        )
        self._report = report
        return report

    def predict(self, code: Sequence[Sequence[int]], *, family_id: int = 0) -> float:
        if not self._fitted:
            raise RuntimeError("bridge must be fit on TRAIN-only evidence before prediction")
        with torch.no_grad():
            rep = self._representation(code, family_id)
            return float(self.head(rep).clamp(0.0, 1.0).item())

    def rank(
        self,
        candidates: Sequence[Sequence[Sequence[int]]],
        *,
        family_id: int = 0,
        top_k: int | None = None,
    ) -> list[tuple[float, Program]]:
        rows = []
        for code in candidates:
            score = self.predict(code, family_id=family_id)
            rows.append((score, [tuple(int(v) for v in row[:3]) for row in code]))
        rows.sort(key=lambda row: (row[0], -len(row[1])), reverse=True)
        return rows if top_k is None else rows[: max(1, int(top_k))]

    def report(self) -> VerifiedSubstrateTrainingReportV1 | None:
        return self._report
