from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CapabilityScore:
    metric: str
    value: float
    baseline: float | None
    higher_is_better: bool
    evidence: str = "OBSERVED"

    @property
    def delta_vs_baseline(self) -> float | None:
        if self.baseline is None:
            return None
        return self.value - self.baseline


def pass_threshold(value: float, threshold: float, higher_is_better: bool = True) -> bool:
    return value >= threshold if higher_is_better else value <= threshold
