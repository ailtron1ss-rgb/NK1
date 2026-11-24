from __future__ import annotations

"""Paired multi-seed evidence analysis for self-improvement promotion."""
from dataclasses import dataclass, asdict
from math import sqrt
from statistics import mean, median
from typing import Any, Dict, Iterable, Sequence, Tuple


@dataclass(frozen=True)
class MatchedEffectV1:
    seeds: Tuple[int, ...]
    baseline: Tuple[float, ...]
    candidate: Tuple[float, ...]
    deltas: Tuple[float, ...]
    mean_delta: float
    median_delta: float
    min_delta: float
    positive_fraction: float
    regression_count: int
    ci95_low: float
    ci95_high: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @property
    def passed(self) -> bool:
        return self.regression_count == 0 and self.mean_delta > 0.0 and self.positive_fraction >= 2.0 / 3.0


class MatchedEvidenceAnalyzerV1:
    VERSION = "matched-evidence-v1"

    @staticmethod
    def analyze(seeds: Sequence[int], baseline: Sequence[float], candidate: Sequence[float]) -> MatchedEffectV1:
        s=tuple(int(x) for x in seeds); b=tuple(float(x) for x in baseline); c=tuple(float(x) for x in candidate)
        if not s or len(s) != len(b) or len(b) != len(c):
            raise ValueError("seeds, baseline and candidate must have equal non-zero length")
        if len(set(s)) != len(s):
            raise ValueError("matched evidence seeds must be unique")
        deltas=tuple(ci-bi for bi,ci in zip(b,c))
        avg=float(mean(deltas)); med=float(median(deltas)); low=float(min(deltas)); pos=sum(d>0 for d in deltas)/len(deltas); reg=sum(d<0 for d in deltas)
        if len(deltas) == 1:
            half=0.0
        else:
            mu=avg
            var=sum((d-mu)**2 for d in deltas)/(len(deltas)-1)
            half=1.96*sqrt(max(0.0,var)/len(deltas))
        return MatchedEffectV1(s,b,c,deltas,avg,med,low,float(pos),int(reg),avg-half,avg+half)

    @staticmethod
    def require(effect: MatchedEffectV1, *, min_mean_gain: float = 0.01, min_positive_fraction: float = 2.0/3.0, max_regressions: int = 0) -> Dict[str, Any]:
        gates={
            'mean_gain': effect.mean_delta >= float(min_mean_gain),
            'positive_fraction': effect.positive_fraction >= float(min_positive_fraction),
            'no_regressions': effect.regression_count <= int(max_regressions),
            'ci_excludes_large_negative_effect': effect.ci95_high >= 0.0,
        }
        return {'accepted': all(gates.values()), 'gates': gates, 'effect': effect.to_dict(), 'version': MatchedEvidenceAnalyzerV1.VERSION}
