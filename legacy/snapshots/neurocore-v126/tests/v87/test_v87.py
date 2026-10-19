from pathlib import Path
import tempfile
import torch
import torch.nn.functional as F

from neurocore.frontier import CURRENT_FRONTIER
from neurocore.v86 import NeuroWeaveV86
from neurocore.v87 import NeuroWeaveV87, OrganismTrainerV87, OrganismRuntimeV87, RuntimeStateStoreV87, mobile_v87_config
from neurocore.v86.core import _write_learning_transition_v86
from neurocore.v87.core import _probe_replay_utility_v87, _learning_replay_batch_v87


def test_frontier_and_zero_parameter_delta():
    m86 = NeuroWeaveV86()
    m87 = NeuroWeaveV87()
    assert CURRENT_FRONTIER >= 87
    assert sum(p.numel() for p in m86.parameters()) == sum(p.numel() for p in m87.parameters()) == 366909


def _populate(model):
    mem = model.neural_memory_v61
    for i in range(12):
        obs = torch.zeros(9)
        obs[i % 9] = float(i + 1) / 12.0
        nxt = obs.roll(1)
        goal = torch.zeros(8); goal[i % 8] = 1.0
        target = torch.zeros(20); target[i % 20] = 1.0
        _write_learning_transition_v86(mem, obs.unsqueeze(0), goal.unsqueeze(0), nxt.unsqueeze(0), goal.unsqueeze(0), target.unsqueeze(0), priority=1.0 + (i % 3), step=i)
    return mem


def test_model_aware_probe_tracks_actual_current_model_error():
    m = NeuroWeaveV87()
    mem = _populate(m)
    idx = torch.arange(8)
    probe = _probe_replay_utility_v87(m, mem, idx, now_step=20)
    assert torch.isfinite(probe["error"]).all()
    assert torch.isfinite(probe["utility"]).all()
    assert float(probe["error"].max()) >= float(probe["error"].min())
    assert (mem.learning_replay_utility_ema_v87[idx] > 0).any()



def test_model_aware_utility_ranks_harder_current_model_samples():
    m = NeuroWeaveV87()
    mem = _populate(m)
    idx = torch.arange(8)
    with torch.no_grad():
        obs = mem.learning_replay_observations_v83[idx]
        goal = mem.learning_replay_goals_v83[idx]
        nxt = mem.learning_replay_next_observations_v83[idx]
        ng = mem.learning_replay_next_goals_v83[idx]
        out = m.forward_learning_v82(torch.stack([obs, nxt], dim=1), torch.stack([goal, ng], dim=1), target_latent_sequence=mem.learning_replay_targets_v83[idx].unsqueeze(1))
        pred = out["spine_next_latent"][:, 0]
        mem.learning_replay_targets_v83[idx[0]].copy_(F.normalize(pred[0], dim=-1))
        mem.learning_replay_targets_v83[idx[1]].copy_(-F.normalize(pred[1], dim=-1))
    probe = _probe_replay_utility_v87(m, mem, idx, now_step=40)
    assert float(probe["error"][1]) > float(probe["error"][0])
    assert float(probe["utility"][1]) > float(probe["utility"][0])

def test_utility_selection_remains_information_safe():
    m = NeuroWeaveV87()
    mem = _populate(m)
    batch = _learning_replay_batch_v87(m, 6, now_step=20, return_report=True)
    assert batch is not None
    assert batch["indices_v87"].numel() == 6
    assert 0.0 <= float(batch["quality_diversity_v87"]) <= 1.000001
    assert 0.0 <= float(batch["utility_candidate_count_v87"]) <= 32.0
    assert float(batch["utility_selection_changed_v87"]) in (0.0, 1.0)


def test_probe_is_detached_no_parameter_grads():
    m = NeuroWeaveV87()
    mem = _populate(m)
    idx = torch.arange(8)
    _ = _probe_replay_utility_v87(m, mem, idx, now_step=20)
    assert all(p.grad is None for p in m.parameters())


def test_real_learning_step_with_v87_utility():
    m = NeuroWeaveV87()
    t = OrganismTrainerV87(m)
    x = torch.randn(3, 2, 9)
    g = torch.randn(3, 2, 8)
    y = torch.randn(3, 1, 20)
    logs = [t.learning_step_v87(x, g, target_latent_sequence=y) for _ in range(5)]
    assert all(torch.isfinite(torch.tensor(row["loss"])) for row in logs)
    assert any(row["replay_utility_probe_executed_v87"] > 0 for row in logs)
    assert t.replay_utility_probe_events_v87 <= len(logs)
    assert all(row["gradient_coverage"] > 0 for row in logs)


def test_checkpoint_roundtrip_v87_state():
    m = NeuroWeaveV87()
    t = OrganismTrainerV87(m)
    r = OrganismRuntimeV87(m, t)
    x = torch.randn(2, 2, 9)
    g = torch.randn(2, 2, 8)
    y = torch.randn(2, 1, 20)
    for _ in range(3):
        t.learning_step_v87(x, g, target_latent_sequence=y)
    p = Path(tempfile.gettempdir()) / "neurocore_v87_state.pt"
    RuntimeStateStoreV87.save(p, m, t, r)
    m2 = NeuroWeaveV87(); t2 = OrganismTrainerV87(m2); r2 = OrganismRuntimeV87(m2, t2)
    rep = RuntimeStateStoreV87.load(p, m2, t2, r2)
    assert rep["version"] == 87
    assert rep["optimizer_loaded"]
    assert t2.replay_utility_probe_events_v87 == t.replay_utility_probe_events_v87
    assert t2.last_utility_probe_step_v87 == t.last_utility_probe_step_v87
    p.unlink(missing_ok=True)
