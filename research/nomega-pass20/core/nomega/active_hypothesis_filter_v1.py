from __future__ import annotations

"""Active test-time hypothesis elimination for a finite program portfolio."""
from dataclasses import dataclass, asdict
from typing import Callable, Iterable, List, Sequence, Tuple, TypeVar, Generic
import math

T=TypeVar('T'); X=TypeVar('X')

@dataclass(frozen=True)
class FilterReportV1(Generic[T]):
    version: str
    initial_candidates: int
    final_candidates: int
    tests_selected: int
    candidate_ids: Tuple[int, ...]
    selected_tests: Tuple[int, ...]
    selected: Tuple[T, ...]
    eliminated: int
    def to_dict(self): return asdict(self)

class ActiveHypothesisFilterV1(Generic[T,X]):
    VERSION='active-hypothesis-filter-v1'

    @staticmethod
    def _disagreement(values: Sequence[object]) -> float:
        if not values: return 0.0
        counts={}
        for v in values: counts[v]=counts.get(v,0)+1
        n=float(len(values)); return 1.0-sum((c/n)**2 for c in counts.values())

    def filter(
        self,
        candidates: Sequence[T],
        tests: Sequence[X],
        predict: Callable[[T,X], object],
        expected: Callable[[X], object],
        *, max_queries: int=12, survivors: int=4,
    ) -> FilterReportV1[T]:
        active=list(range(len(candidates)))
        remaining_tests=list(range(len(tests)))
        chosen=[]
        queries=0
        while len(active)>max(1,int(survivors)) and remaining_tests and queries<max(1,int(max_queries)):
            best=None; best_info=-1.0
            for ti in remaining_tests:
                vals=[predict(candidates[i],tests[ti]) for i in active]
                info=self._disagreement(vals)
                # Prefer tests that split the active pool; deterministic tie break by id.
                if info>best_info+1e-12:
                    best_info=info; best=ti
            if best is None: break
            remaining_tests.remove(best); chosen.append(best); queries+=1
            exp=expected(tests[best])
            active=[i for i in active if predict(candidates[i],tests[best])==exp]
        return FilterReportV1(self.VERSION,len(candidates),len(active),len(chosen),tuple(active),tuple(chosen),tuple(candidates[i] for i in active),len(candidates)-len(active))
