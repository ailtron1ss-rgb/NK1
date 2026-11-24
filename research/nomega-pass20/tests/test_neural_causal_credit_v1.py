from copy import deepcopy
import torch
import torch.nn as nn

from core.nomega.neural_causal_credit_v1 import NeuralCausalCreditAssignerV1


def test_leave_one_out_credit_is_signed_and_normalized(tmp_path):
    assigner = NeuralCausalCreditAssignerV1(tmp_path)

    actions = [1, 2, 3]

    def reward_fn(seq):
        # The middle action is causally important; the first and last are redundant.
        return 2.0 * (2 in seq) + 0.25 * (1 in seq) + 0.25 * (3 in seq)

    report = assigner.leave_one_out(actions, reward_fn)

    assert report.baseline_reward == 2.5
    assert report.credits[1] > report.credits[0]
    assert report.credits[1] > report.credits[2]
    assert all(-1.0 <= value <= 1.0 for value in report.normalized_credits)
    assert report.counterfactual_evaluations == 3


def test_counterfactual_replacement_changes_credit(tmp_path):
    assigner = NeuralCausalCreditAssignerV1(tmp_path)

    actions = ["good", "bad", "neutral"]

    def reward_fn(seq):
        return 1.0 if seq.count("good") >= 2 else 0.0

    report = assigner.replacement_credit(
        actions,
        reward_fn,
        replacements={1: "good"},
    )

    assert report.replacement_evaluations == 1
    assert report.replacement_credits[1] > 0.0
    assert report.advantages[1] > report.advantages[0]


def test_parameter_ablation_reports_real_model_effect(tmp_path):
    assigner = NeuralCausalCreditAssignerV1(tmp_path)
    model = nn.Sequential(nn.Linear(2, 4), nn.Tanh(), nn.Linear(4, 2))
    with torch.no_grad():
        model[0].weight.fill_(2.0)
        model[0].bias.zero_()
        model[2].weight.fill_(1.0)
        model[2].bias.zero_()

    batch = torch.tensor([[1.0, 1.0]])

    def score_fn(candidate):
        return float(candidate(batch)[0, 0].item())

    report = assigner.parameter_ablation(
        model,
        score_fn,
        groups=("0",),
    )

    assert report.baseline_score > 0.0
    assert report.group_effects["0"] < 0.0
    assert report.causal_groups == ("0",)
    assert report.ablation_evaluations == 1
    assert torch.allclose(model[0].weight, torch.full_like(model[0].weight, 2.0))


def test_program_position_credit_uses_execution_counterfactuals(tmp_path):
    assigner = NeuralCausalCreditAssignerV1(tmp_path)
    code = [(1, 0, 0), (13, 0, 0), (14, 0, 0)]

    def reward_fn(candidate):
        return 1.0 if candidate[0][0] == 1 and candidate[1][0] == 13 else 0.0

    report = assigner.program_position_credit(code, reward_fn, skip_halt=True)

    assert report.baseline_reward == 1.0
    assert set(report.credits) == {0, 1}
    assert report.credits[0] > 0.0
    assert report.credits[1] > 0.0
    assert report.counterfactual_evaluations == 2
