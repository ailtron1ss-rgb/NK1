from __future__ import annotations

from dataclasses import dataclass
import torch
from torch import Tensor


@dataclass(frozen=True)
class BytePatchPlan:
    boundaries: tuple[tuple[int, int], ...]
    mean_entropy: float
    mean_patch_bytes: float
    source: str = "entropy_greedy_reference"

    def as_dict(self) -> dict[str, object]:
        return {
            "boundaries": [list(x) for x in self.boundaries],
            "mean_entropy": self.mean_entropy,
            "mean_patch_bytes": self.mean_patch_bytes,
            "source": self.source,
        }


class EntropyPatchPlanner:
    """Reference-only adaptive byte patch planner inspired by BLT/ByteFlow.

    It does not change the canonical NeuroCore sequence contract. It groups adjacent bytes while
    the next-byte predictive entropy remains below a threshold, bounded by max_patch_bytes. A later
    optimization pass can replace this planner with a learned Top-K/static-graph backend.
    """

    def __init__(self, *, entropy_threshold: float = 0.35, max_patch_bytes: int = 16) -> None:
        if not 0.0 < entropy_threshold <= 1.0:
            raise ValueError("entropy_threshold must be in (0,1]")
        if max_patch_bytes <= 0:
            raise ValueError("max_patch_bytes must be positive")
        self.entropy_threshold = float(entropy_threshold)
        self.max_patch_bytes = int(max_patch_bytes)

    def plan(self, logits: Tensor) -> BytePatchPlan:
        if logits.ndim != 3 or logits.size(-1) != 256:
            raise ValueError("logits must be [B,T,256]")
        probs = torch.softmax(logits.detach(), dim=-1)
        entropy = -(probs.clamp_min(1e-9) * probs.clamp_min(1e-9).log2()).sum(dim=-1) / 8.0
        mean_entropy = float(entropy.mean().item())
        if logits.size(0) != 1:
            raise ValueError("reference patch planner currently requires B=1")
        ent = entropy[0].cpu().tolist()
        boundaries: list[tuple[int, int]] = []
        start = 0
        while start < len(ent):
            stop = min(start + self.max_patch_bytes, len(ent))
            while stop > start + 1 and any(v > self.entropy_threshold for v in ent[start:stop]):
                stop -= 1
            boundaries.append((start, stop))
            start = stop
        mean_patch = sum(stop - begin for begin, stop in boundaries) / max(1, len(boundaries))
        return BytePatchPlan(tuple(boundaries), mean_entropy, float(mean_patch))
