from pathlib import Path
import tempfile

import torch

from neurocore.frontier import CURRENT_FRONTIER
from neurocore.v86.core import _write_learning_transition_v86
from neurocore.v88 import NeuroWeaveV88, OrganismTrainerV88, OrganismRuntimeV88, RuntimeStateStoreV88
from neurocore.v88.core import _pick_probe_candidates_v88


def _populate(model, n=24):
    mem = model.neural_memory_v61
    for i in range(n):
        obs = torch.zeros(9)
        obs[i % 9] = float(i + 1) / float(n)
        nxt = obs.roll(1)
        goal = torch.zeros(8)
        goal[i % 8] = 1.0
        target = torch.zeros(20)
        target[i % 20] = 1.0
        _write_learning_transition_v86(
            mem,
            obs.unsqueeze(0),
            goal.unsqueeze(0),
            nxt.unsqueeze(0),
            goal.unsqueeze(0),
            target.unsqueeze(0),
            priority=1.0 + float(i % 3),
            step=i,
        )
    return mem


def test_frontier_and_parameter_count_are_stable():
    m = NeuroWeaveV88()
    assert CURRENT_FRONTIER >= 88
    assert sum(p.numel() for p in m.parameters()) == 366909


def test_probe_picker_prefers_new_and_stale_slots():
    m = NeuroWeaveV88()
    mem = _populate(m)
    idx = torch.arange(24)
    mem.learning_replay_priorities_v83[idx] = 1.0
    mem.learning_replay_utility_probe_step_v87[idx] = 10
    mem.learning_replay_utility_probe_step_v87[3] = -1
    mem.learning_replay_utility_probe_step_v87[7] = 0
    chosen = _pick_probe_candidates_v88(m, idx, now_step=20, cap=4)
    assert 3 in chosen.tolist()
    assert 7 in chosen.tolist()


def test_sparse_probe_scheduler_refreshes_cache_without_per_step_probe():
    m = NeuroWeaveV88()
    _populate(m)
    t = OrganismTrainerV88(m)
    x = torch.randn(3, 2, 9)
    g = torch.randn(3, 2, 8)
    y = torch.randn(3, 1, 20)
    logs = [t.learning_step_v88(x, g, target_latent_sequence=y) for _ in range(6)]
    assert t.v88_probe_scheduler_events >= 1
    assert t.v88_cache_refresh_slots >= 1
    assert t.v88_cache_requests == 6
    assert t.v88_probe_scheduler_events < 6
    assert t.v88_cache_hits >= 1
    assert any(row["replay_utility_cache_refresh_v88"] > 0 for row in logs)


def test_gradient_spike_can_force_early_refresh():
    m = NeuroWeaveV88()
    _populate(m)
    t = OrganismTrainerV88(m)
    mem = m.neural_memory_v61
    now = 20
    mem.learning_replay_utility_probe_step_v87[:] = now
    t.v88_last_probe_step = now
    t.v88_last_gradient_spike = 2.0
    x = torch.randn(3, 2, 9)
    g = torch.randn(3, 2, 8)
    y = torch.randn(3, 1, 20)
    log = t.learning_step_v88(x, g, target_latent_sequence=y)
    assert log["replay_utility_cache_triggered_v88"] == 1.0


def test_checkpoint_roundtrip_preserves_cache_scheduler_state():
    m = NeuroWeaveV88()
    _populate(m)
    t = OrganismTrainerV88(m)
    r = OrganismRuntimeV88(m, t)
    x = torch.randn(3, 2, 9)
    g = torch.randn(3, 2, 8)
    y = torch.randn(3, 1, 20)
    for _ in range(4):
        t.learning_step_v88(x, g, target_latent_sequence=y)
    p = Path(tempfile.gettempdir()) / "neurocore_v88_state.pt"
    RuntimeStateStoreV88.save(p, m, t, r)
    m2 = NeuroWeaveV88()
    t2 = OrganismTrainerV88(m2)
    r2 = OrganismRuntimeV88(m2, t2)
    rep = RuntimeStateStoreV88.load(p, m2, t2, r2)
    assert rep["version"] == 88
    assert rep["optimizer_loaded"]
    assert t2.v88_probe_scheduler_events == t.v88_probe_scheduler_events
    assert t2.v88_cache_refresh_slots == t.v88_cache_refresh_slots
    assert t2.v88_last_probe_step == t.v88_last_probe_step
    p.unlink(missing_ok=True)
