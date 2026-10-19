from pathlib import Path

import torch

from core.nomega.neural_causal_credit_trainer_v1 import NeuralCausalCreditTrainerV1
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2


def test_credit_weights_are_bounded_and_preserve_neutral_signal(tmp_path: Path):
    trainer = NeuralCausalCreditTrainerV1(tmp_path)
    weights = trainer.credit_to_weights([2.0, 0.0, -2.0])

    assert len(weights) == 3
    assert all(0.2 <= value <= 2.0 for value in weights)
    assert weights[0] > weights[1] > weights[2]


def test_causal_training_updates_neural_parameters(tmp_path: Path):
    model = NeuralProgramSynthesizerV2(hidden=16, latent_dim=16, max_len=8, max_b=16, layers=1, heads=2, family_count=8)
    trainer = NeuralCausalCreditTrainerV1(tmp_path, seed=17)
    rows = [("sum3 causal", [(1, 0, 0), (13, 0, 0), (14, 0, 0)], 0)]
    before = {name: tensor.detach().clone() for name, tensor in model.state_dict().items()}

    report = trainer.fit(model, rows, {0: [2.0, 1.0, 0.25]}, epochs=1, lr=1e-3)

    changed = any(not torch.equal(before[name], tensor) for name, tensor in model.state_dict().items())
    assert report.examples == 1
    assert report.steps == 1
    assert changed
    assert report.weighted_loss >= 0.0
