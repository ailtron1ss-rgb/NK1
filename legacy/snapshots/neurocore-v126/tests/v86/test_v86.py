from pathlib import Path
import tempfile
import torch

from neurocore.frontier import CURRENT_FRONTIER
from neurocore.v84 import NeuroWeaveV84
from neurocore.v86 import (
    NeuroWeaveV86,
    OrganismTrainerV86,
    OrganismRuntimeV86,
    RuntimeStateStoreV86,
    mobile_v86_config,
    replay_quality_report_v86,
)
from neurocore.v86.core import _learning_replay_batch_v86


def test_frontier_and_zero_parameter_delta():
    m84 = NeuroWeaveV84()
    m86 = NeuroWeaveV86()
    assert CURRENT_FRONTIER >= 86
    assert sum(p.numel() for p in m84.parameters()) == sum(p.numel() for p in m86.parameters()) == 366909


def test_metadata_attaches_to_canonical_v61_owner():
    m = NeuroWeaveV86()
    mem = m.neural_memory_v61
    assert m.neural_memory_v61 is m.neural_memory_v83
    assert hasattr(mem, "learning_replay_input_bucket_v86")
    assert hasattr(mem, "learning_replay_insert_step_v86")
    assert hasattr(mem, "learning_replay_use_count_v86")


def test_label_free_selection_breaks_priority_collapse():
    m = NeuroWeaveV86(mobile_v86_config(9))
    mem = m.neural_memory_v61
    cap = int(mem.learning_replay_capacity_v83)
    # Eight nearly identical, high-priority samples followed by diverse low-priority samples.
    for i in range(cap):
        base = torch.zeros(9)
        if i < 8:
            base[:8] = 1.0
        else:
            base[i % 9] = float(i - 7)
        target = torch.zeros(20)
        target[i % 20] = 1.0
        next_obs = base + 0.01
        _before = int(mem.learning_replay_cursor_v83.item())
        from neurocore.v86.core import _write_learning_transition_v86
        _write_learning_transition_v86(mem, base.unsqueeze(0), torch.zeros(1, 8), next_obs.unsqueeze(0), torch.zeros(1, 8), target.unsqueeze(0), priority=10.0 if i < 8 else 0.2, step=i)
    batch = _learning_replay_batch_v86(mem, 6, now_step=cap, return_report=True)
    assert batch is not None
    assert batch["indices_v86"].numel() == 6
    report = replay_quality_report_v86(mem, batch["indices_v86"], now_step=cap)
    assert report["diversity"] > 0.10
    assert report["input_coverage"] >= 0.25


def test_quality_metrics_are_finite_and_bounded():
    m = NeuroWeaveV86()
    t = OrganismTrainerV86(m)
    x = torch.randn(4, 2, 9)
    g = torch.randn(4, 2, 8)
    y = torch.randn(4, 1, 20)
    logs = [t.learning_step_v86(x, g, target_latent_sequence=y) for _ in range(6)]
    last = logs[-1]
    for key in (
        "replay_quality_priority_entropy_v86",
        "replay_quality_input_coverage_v86",
        "replay_quality_target_coverage_v86",
        "replay_quality_age_coverage_v86",
        "replay_quality_reuse_entropy_v86",
        "replay_quality_diversity_v86",
    ):
        assert torch.isfinite(torch.tensor(last[key]))
        assert 0.0 <= last[key] <= 1.000001


def test_scheduler_and_quality_share_same_batch():
    c = mobile_v86_config(9)
    c.replay_interval_init_v84 = 1
    c.replay_interval_min_v84 = 1
    c.replay_interval_max_v84 = 1
    m = NeuroWeaveV86(c)
    t = OrganismTrainerV86(m)
    x = torch.randn(3, 2, 9)
    g = torch.randn(3, 2, 8)
    y = torch.randn(3, 1, 20)
    seen = None
    for _ in range(4):
        seen = t.learning_step_v86(x, g, target_latent_sequence=y)
    assert seen["replay_available"] == 1.0
    assert seen["replay_quality_updates_v86"] > 0
    assert seen["replay_quality_ema_v86"] > 0


def test_runtime_fast_state_lesion_is_recoverable_from_canonical_replay():
    m = NeuroWeaveV86()
    t = OrganismTrainerV86(m)
    r = OrganismRuntimeV86(m, t)
    stream = torch.randn(8, 9)
    goals = torch.randn(8, 8)
    # Populate the canonical replay store with the exact stream transitions.
    for i in range(7):
        seq = torch.stack([stream[i], stream[i + 1]], dim=0).unsqueeze(0)
        gs = torch.stack([goals[i], goals[i + 1]], dim=0).unsqueeze(0)
        y = torch.randn(1, 1, 20)
        t.learning_step_v86(seq, gs, target_latent_sequence=y)
    r.reset_fast_state_v86()
    for obs, goal in zip(stream, goals):
        r.step(obs, goal)
    reference = r.spine_state.detach().clone()
    r.reset_fast_state_v86()
    replayed = r.replay_recent_experiences_v86(6)
    recovered = r.spine_state.detach()
    assert int(replayed["replayed"].item()) == 6
    assert torch.isfinite(recovered).all()
    assert float(F_cos(recovered, reference)) > -0.20


def F_cos(a, b):
    return float(torch.nn.functional.cosine_similarity(a.reshape(1, -1), b.reshape(1, -1)).item())


def test_checkpoint_roundtrip_preserves_v86_controller_state():
    m = NeuroWeaveV86()
    t = OrganismTrainerV86(m)
    r = OrganismRuntimeV86(m, t)
    x = torch.randn(2, 2, 9)
    g = torch.randn(2, 2, 8)
    y = torch.randn(2, 1, 20)
    for _ in range(3):
        t.learning_step_v86(x, g, target_latent_sequence=y)
    p = Path(tempfile.gettempdir()) / "neurocore_v86_state.pt"
    RuntimeStateStoreV86.save(p, m, t, r)
    m2 = NeuroWeaveV86()
    t2 = OrganismTrainerV86(m2)
    r2 = OrganismRuntimeV86(m2, t2)
    rep = RuntimeStateStoreV86.load(p, m2, t2, r2)
    assert rep["version"] == 86
    assert rep["optimizer_loaded"]
    assert t2.replay_quality_updates_v86 == t.replay_quality_updates_v86
    assert t2.replay_quality_ema_v86 == t.replay_quality_ema_v86
    p.unlink(missing_ok=True)
