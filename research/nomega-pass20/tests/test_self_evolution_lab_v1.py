from pathlib import Path
from types import SimpleNamespace

from core.nomega.self_evolution_lab_v1 import SelfEvolutionLabV1, EvaluationVectorV1


def test_self_evolution_finds_improvement(tmp_path: Path):
    lab = SelfEvolutionLabV1(tmp_path, seed=1)
    cfg = SimpleNamespace(top_k=1, max_reason_steps=3)

    def evaluate(c):
        quality = 0.8 + 0.1 * (c.top_k == 2)
        verified = 0.7 + 0.1 * (c.top_k == 2)
        adv = 0.8
        latency = 10.0 + 4.0 * c.max_reason_steps
        return EvaluationVectorV1(quality, verified, verified, adv, latency)

    result = lab.run(cfg, evaluate, max_trials=4, min_gain=0.005)
    assert result.trials
    assert result.accepted
    assert result.mutation is not None
    assert result.mutation.name == "top_k"
    assert lab.ledger.exists()
