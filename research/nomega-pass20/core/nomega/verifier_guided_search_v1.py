from __future__ import annotations

"""Bounded verifier-guided candidate portfolio search.

The module deliberately separates proposal from verification.  A proposal source may
be neural, retrieval, mutation, or another research strategy.  The verifier is supplied
by the caller, which prevents hidden benchmark oracles from leaking into production
runtime paths.
"""
from dataclasses import dataclass, asdict
from typing import Callable, Generic, Iterable, List, Sequence, Tuple, TypeVar
import math

T = TypeVar("T")


@dataclass(frozen=True)
class CandidateEvidenceV1:
    candidate_id: int
    source: str
    prior_score: float
    verification_score: float
    final_score: float
    accepted: bool
    novelty: float
    complexity: float

    def to_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class SearchReportV1(Generic[T]):
    version: str
    candidates_considered: int
    evaluations_performed: int
    selected_index: int
    selected_score: float
    selected_accepted: bool
    evidence: Tuple[CandidateEvidenceV1, ...]
    selected: T

    def to_dict(self):
        d = asdict(self)
        d["evidence"] = [x.to_dict() for x in self.evidence]
        return d


class VerifierGuidedSearchV1(Generic[T]):
    """Score a bounded candidate portfolio under explicit execution budget.

    verify(candidate) must return (score, accepted).  The verifier can be backed by
    hidden holdout tests during research, or by a real execution/verifier service in
    production.  The search itself does not assume either.
    """

    VERSION = "verifier-guided-search-v1"

    @staticmethod
    def _novelty(candidate: T, accepted_keys: Sequence[Tuple]) -> float:
        key = tuple(candidate) if isinstance(candidate, list) else repr(candidate)
        if not accepted_keys:
            return 1.0
        # Cheap deterministic diversity proxy; exact semantic diversity belongs to the caller.
        if key in accepted_keys:
            return 0.0
        return 1.0

    def search(
        self,
        candidates: Iterable[Tuple[str, T, float]],
        verify: Callable[[T], Tuple[float, bool]],
        *,
        max_evaluations: int = 8,
        acceptance_threshold: float = 0.8,
        verification_weight: float = 0.78,
        prior_weight: float = 0.17,
        novelty_weight: float = 0.05,
        complexity_penalty: float = 0.002,
        stop_on_verified: bool = False,
    ) -> SearchReportV1[T]:
        pool = []
        seen = set()
        for source, candidate, prior in candidates:
            key = repr(candidate)
            if key in seen:
                continue
            seen.add(key)
            complexity = float(len(candidate)) if hasattr(candidate, "__len__") else 1.0
            pool.append((str(source), candidate, float(prior), complexity))
        pool.sort(key=lambda x: x[2], reverse=True)
        pool = pool[:max(1, int(max_evaluations))]
        evidence: List[CandidateEvidenceV1] = []
        selected_idx = 0
        best_score = -math.inf
        best_accept = False
        accepted_keys: List[Tuple] = []
        evaluations = 0
        for idx, (source, candidate, prior, complexity) in enumerate(pool):
            score, accepted = verify(candidate)
            evaluations += 1
            key = tuple(candidate) if isinstance(candidate, list) else repr(candidate)
            novelty = 0.0 if key in accepted_keys else 1.0
            final = (
                verification_weight * float(score)
                + prior_weight * float(prior)
                + novelty_weight * novelty
                - complexity_penalty * complexity
            )
            row = CandidateEvidenceV1(idx, source, prior, float(score), float(final), bool(accepted), novelty, complexity)
            evidence.append(row)
            if accepted:
                accepted_keys.append(key)
            if final > best_score:
                best_score = final
                selected_idx = idx
                best_accept = bool(accepted and score >= acceptance_threshold)
            if stop_on_verified and bool(accepted) and float(score) >= float(acceptance_threshold):
                break
        selected = pool[selected_idx][1]
        return SearchReportV1(
            version=self.VERSION,
            candidates_considered=len(pool),
            evaluations_performed=evaluations,
            selected_index=selected_idx,
            selected_score=float(best_score),
            selected_accepted=best_accept,
            evidence=tuple(evidence),
            selected=selected,
        )
