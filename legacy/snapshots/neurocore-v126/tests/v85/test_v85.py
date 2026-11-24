from neurocore.v84 import NeuroWeaveV84
from neurocore.v85.benchmark import STRATEGIES, V85QualificationConfig, _dataset, _target_from_observation
import torch


def test_v85_does_not_add_model_parameters():
    assert sum(p.numel() for p in NeuroWeaveV84().parameters()) == 366909


def test_v85_has_four_strategies():
    assert list(STRATEGIES) == ["current_only", "fixed_replay", "adaptive_replay", "adaptive_sparse_surgery"]


def test_v85_external_stream_shape_and_task_targets():
    cfg = V85QualificationConfig(seeds=(0,), steps_per_task=1, batch_size=2, train_per_task=20, test_per_task=20, num_tasks=2)
    ds = _dataset(0, cfg)
    assert list(ds["tasks"]) == ["original", "rot90"]
    assert ds["tasks"]["original"]["train_x"].shape[-1] == 9
    x = torch.randn(2, 9)
    assert _target_from_observation(x, 0).shape == (2, 20)
    assert not torch.allclose(_target_from_observation(x, 0), _target_from_observation(x, 1))
    assert not torch.allclose(_target_from_observation(x, 1), _target_from_observation(x, 2))
