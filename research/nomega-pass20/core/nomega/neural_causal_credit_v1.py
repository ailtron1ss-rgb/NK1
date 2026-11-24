from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Mapping, Sequence, Tuple
import json
import math


@dataclass(frozen=True)
class LeaveOneOutReportV1:
    baseline_reward: float
    credits: Tuple[float, ...]
    normalized_credits: Tuple[float, ...]
    counterfactual_rewards: Tuple[float, ...]
    counterfactual_evaluations: int

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class ReplacementCreditReportV1:
    baseline_reward: float
    replacement_rewards: Dict[int, float]
    replacement_credits: Dict[int, float]
    advantages: Tuple[float, ...]
    replacement_evaluations: int

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class ProgramPositionCreditReportV1:
    baseline_reward: float
    credits: Dict[int, float]
    counterfactual_rewards: Dict[int, float]
    counterfactual_evaluations: int

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class ParameterAblationReportV1:
    baseline_score: float
    ablated_scores: Dict[str, float]
    group_effects: Dict[str, float]
    causal_groups: Tuple[str, ...]
    threshold: float
    ablation_evaluations: int

    def to_dict(self) -> dict:
        return asdict(self)


class NeuralCausalCreditAssignerV1:
    """Execution-grounded causal attribution utilities.

    The implementation deliberately uses executed counterfactuals rather than
    treating gradients or correlations as causal evidence. This keeps the first
    neural-causality layer compatible with deterministic verifiers and later
    allows a learned critic to be compared against actually replayed outcomes.
    """

    VERSION = "neural-causal-credit-v1"

    def __init__(self, root: Path, seed: int = 7341, causal_threshold: float = 1e-6):
        self.root = Path(root)
        self.seed = int(seed)
        self.causal_threshold = float(causal_threshold)
        self.runtime = self.root / "runtime"
        self.runtime.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _normalize(values: Sequence[float]) -> Tuple[float, ...]:
        if not values:
            return tuple()
        scale = max(max(abs(float(v)) for v in values), 1e-12)
        return tuple(max(-1.0, min(1.0, float(v) / scale)) for v in values)

    def leave_one_out(
        self,
        actions: Sequence[Any],
        reward_fn: Callable[[Sequence[Any]], float],
    ) -> LeaveOneOutReportV1:
        actions = list(actions)
        baseline = float(reward_fn(tuple(actions)))
        cf_rewards = []
        credits = []
        for index in range(len(actions)):
            counterfactual = actions[:index] + actions[index + 1 :]
            reward = float(reward_fn(tuple(counterfactual)))
            cf_rewards.append(reward)
            credits.append(baseline - reward)
        report = LeaveOneOutReportV1(
            baseline_reward=baseline,
            credits=tuple(credits),
            normalized_credits=self._normalize(credits),
            counterfactual_rewards=tuple(cf_rewards),
            counterfactual_evaluations=len(actions),
        )
        self._write("neural_causal_credit_loo_v1.json", report.to_dict())
        return report

    def replacement_credit(
        self,
        actions: Sequence[Any],
        reward_fn: Callable[[Sequence[Any]], float],
        replacements: Mapping[int, Any],
    ) -> ReplacementCreditReportV1:
        actions = list(actions)
        baseline = float(reward_fn(tuple(actions)))
        replacement_rewards: Dict[int, float] = {}
        credits: Dict[int, float] = {}
        advantages = [0.0] * len(actions)
        for index, replacement in sorted(replacements.items()):
            if index < 0 or index >= len(actions):
                raise IndexError(f"replacement index {index} outside action sequence")
            counterfactual = list(actions)
            counterfactual[index] = replacement
            reward = float(reward_fn(tuple(counterfactual)))
            credit = reward - baseline
            replacement_rewards[int(index)] = reward
            credits[int(index)] = credit
            advantages[int(index)] = credit
        report = ReplacementCreditReportV1(
            baseline_reward=baseline,
            replacement_rewards=replacement_rewards,
            replacement_credits=credits,
            advantages=tuple(advantages),
            replacement_evaluations=len(replacements),
        )
        self._write("neural_causal_credit_replacement_v1.json", report.to_dict())
        return report

    def program_position_credit(
        self,
        code: Sequence[Any],
        reward_fn: Callable[[Sequence[Any]], float],
        *,
        neutral_action: Any = (0, 0, 0),
        skip_halt: bool = True,
    ) -> ProgramPositionCreditReportV1:
        """Assign execution credit by replaying a program with one action neutralized."""
        original = list(code)
        baseline = float(reward_fn(tuple(original)))
        credits: Dict[int, float] = {}
        counterfactual_rewards: Dict[int, float] = {}
        for index, action in enumerate(original):
            try:
                opcode = int(action[0])
            except (TypeError, ValueError, IndexError):
                opcode = -1
            if skip_halt and opcode == 14:
                continue
            counterfactual = list(original)
            counterfactual[index] = neutral_action
            reward = float(reward_fn(tuple(counterfactual)))
            counterfactual_rewards[index] = reward
            credits[index] = baseline - reward
        report = ProgramPositionCreditReportV1(
            baseline_reward=baseline,
            credits=credits,
            counterfactual_rewards=counterfactual_rewards,
            counterfactual_evaluations=len(credits),
        )
        self._write("neural_causal_credit_program_positions_v1.json", report.to_dict())
        return report

    def parameter_ablation(
        self,
        model: Any,
        score_fn: Callable[[Any], float],
        *,
        groups: Iterable[str],
        threshold: float | None = None,
    ) -> ParameterAblationReportV1:
        baseline = float(score_fn(model))
        threshold = self.causal_threshold if threshold is None else float(threshold)
        ablated_scores: Dict[str, float] = {}
        effects: Dict[str, float] = {}
        causal_groups = []
        state = model.state_dict()
        names = tuple(str(name) for name in state.keys())
        group_list = tuple(str(group) for group in groups)
        for group in group_list:
            group = str(group)
            selected = [name for name in names if name == group or name.startswith(group + ".")]
            if not selected:
                raise KeyError(f"model parameter group not found: {group}")
            candidate = deepcopy(model)
            with __import__("torch").no_grad():
                cand_state = candidate.state_dict()
                for name in selected:
                    cand_state[name].zero_()
                candidate.load_state_dict(cand_state)
            score = float(score_fn(candidate))
            effect = score - baseline
            ablated_scores[group] = score
            effects[group] = effect
            if abs(effect) >= threshold:
                causal_groups.append(group)
        report = ParameterAblationReportV1(
            baseline_score=baseline,
            ablated_scores=ablated_scores,
            group_effects=effects,
            causal_groups=tuple(causal_groups),
            threshold=threshold,
            ablation_evaluations=len(group_list),
        )
        self._write("neural_causal_credit_parameter_ablation_v1.json", report.to_dict())
        return report

    def _write(self, filename: str, payload: dict) -> None:
        path = self.runtime / filename
        path.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str), encoding="utf-8")
