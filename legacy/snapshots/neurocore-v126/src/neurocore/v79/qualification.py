from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class ContinualMetricsV79:
    """Stage-by-stage continual-learning matrix and derived metrics."""

    accuracy_matrix: List[List[float]] = field(default_factory=list)
    pre_task_accuracy: List[float] = field(default_factory=list)

    def record_stage(self, accuracies: List[float]) -> None:
        self.accuracy_matrix.append([float(x) for x in accuracies])

    def final_average_accuracy(self) -> float:
        if not self.accuracy_matrix:
            return 0.0
        row = self.accuracy_matrix[-1]
        seen = [x for x in row if x == x]
        return sum(seen) / max(1, len(seen))

    def backward_transfer(self) -> float:
        if len(self.accuracy_matrix) < 2:
            return 0.0
        final = self.accuracy_matrix[-1]
        terms = []
        for task_idx in range(len(final) - 1):
            diagonal = self.accuracy_matrix[task_idx][task_idx]
            terms.append(final[task_idx] - diagonal)
        return sum(terms) / max(1, len(terms))

    def average_forgetting(self) -> float:
        if not self.accuracy_matrix:
            return 0.0
        final = self.accuracy_matrix[-1]
        terms = []
        for task_idx in range(len(final) - 1):
            history = [row[task_idx] for row in self.accuracy_matrix[task_idx:] if task_idx < len(row)]
            if history:
                terms.append(max(history) - final[task_idx])
        return sum(terms) / max(1, len(terms))

    def zero_shot_forward_transfer(self) -> float:
        if not self.pre_task_accuracy:
            return 0.0
        return sum(self.pre_task_accuracy) / len(self.pre_task_accuracy)

    def summary(self) -> Dict[str, float]:
        return {
            "final_average_accuracy": self.final_average_accuracy(),
            "backward_transfer": self.backward_transfer(),
            "average_forgetting": self.average_forgetting(),
            "zero_shot_forward_transfer": self.zero_shot_forward_transfer(),
        }
