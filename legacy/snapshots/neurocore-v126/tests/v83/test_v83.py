from pathlib import Path
import tempfile
import torch

from neurocore.frontier import CURRENT_FRONTIER
from neurocore.v82 import NeuroWeaveV82
from neurocore.v83 import NeuroWeaveV83, OrganismTrainerV83, OrganismRuntimeV83, RuntimeStateStoreV83


def batch(seed=0, batch_size=2, steps=4):
    g = torch.Generator().manual_seed(seed)
    return torch.randn(batch_size, steps, 9, generator=g), torch.randn(batch_size, steps, 8, generator=g)


def test_frontier_and_canonical_owner_are_preserved():
    m82 = NeuroWeaveV82()
    m83 = NeuroWeaveV83()
    assert CURRENT_FRONTIER >= 83
    assert m83.neural_memory_v83 is m83.neural_memory_v61
    assert type(m83.neural_memory_v61) is type(m82.neural_memory_v61)
    assert sum(p.numel() for p in m83.parameters()) == sum(p.numel() for p in m82.parameters())
    rep = m83.learning_parameter_report_v83()
    assert rep["canonical_memory_identity_preserved"] == 1.0


def test_replay_records_are_reconstructable_and_bounded():
    m = NeuroWeaveV83()
    t = OrganismTrainerV83(m)
    x, g = batch(1)
    r = t.learning_step_v83(x, g)
    assert r["replay_transition_writes"] == 6.0
    mem = m.neural_memory_v61
    rb = mem.learning_replay_valid_v83.sum().item()
    assert rb == 6.0
    sample = __import__("neurocore.v83.core", fromlist=["_learning_replay_batch_v83"])._learning_replay_batch_v83(mem, 4)
    assert sample is not None
    assert sample["observation"].shape == (4, 9)
    assert sample["goal"].shape == (4, 8)
    assert sample["next_observation"].shape == (4, 9)
    assert sample["next_goal"].shape == (4, 8)
    assert sample["target_latent"].shape == (4, 20)


def test_replay_gradients_reach_the_whole_current_trunk():
    m = NeuroWeaveV83()
    t = OrganismTrainerV83(m)
    x, g = batch(2)
    t.learning_step_v83(x, g)
    t.learning_step_v83(x, g)
    mem = m.neural_memory_v61
    from neurocore.v83.core import _learning_replay_batch_v83
    rb = _learning_replay_batch_v83(mem, 4)
    out = m.forward_replay_learning_v83(rb["observation"], rb["goal"], rb["next_observation"], rb["next_goal"], rb["target_latent"])
    total, weights = t._balanced_total_v82(out)
    params = [(n, p) for n, p in m.named_parameters() if p.requires_grad]
    grads = torch.autograd.grad(total, [p for _, p in params], allow_unused=True)
    required = ["brain46.", "brain47.", "world_model_v50.", "neural_memory_v61.", "unified_spine_v80.", "multiscale_v56.", "self_model_v55.", "cognitive_bridge_v81."]
    for prefix in required:
        gs = [g for (n, _), g in zip(params, grads) if n.startswith(prefix)]
        assert any(gx is not None and torch.isfinite(gx).all() and float(gx.abs().sum()) > 0 for gx in gs), prefix
    assert t.last_replay_gradient_coverage_v83 > 0.50


def test_learning_step_uses_replay_after_first_write():
    m = NeuroWeaveV83()
    t = OrganismTrainerV83(m)
    x, g = batch(3)
    first = t.learning_step_v83(x, g)
    second = t.learning_step_v83(x * 0.7, g * 0.7)
    assert first["replay_available"] == 0.0
    assert second["replay_available"] == 1.0
    assert second["replay_gradient_coverage"] > 0.50
    assert second["replay_loss"] > 0.0
    assert second["whole_trunk_replay_events"] == 1.0


def test_checkpoint_preserves_replay_state_and_optimizer():
    m = NeuroWeaveV83()
    t = OrganismTrainerV83(m)
    r = OrganismRuntimeV83(m, t)
    x, g = batch(4)
    t.learning_step_v83(x, g)
    t.learning_step_v83(x, g)
    replay_valid = int(m.neural_memory_v61.learning_replay_valid_v83.sum().item())
    p = Path(tempfile.gettempdir()) / "nc_v83_replay.pt"
    RuntimeStateStoreV83.save(p, m, t, r)
    m2 = NeuroWeaveV83(); t2 = OrganismTrainerV83(m2); r2 = OrganismRuntimeV83(m2, t2)
    rep = RuntimeStateStoreV83.load(p, m2, t2, r2)
    assert rep["version"] == 83
    assert rep["optimizer_loaded"]
    assert int(m2.neural_memory_v61.learning_replay_valid_v83.sum().item()) == replay_valid
    p.unlink(missing_ok=True)


def test_runtime_exposes_replay_diagnostics():
    m = NeuroWeaveV83(); t = OrganismTrainerV83(m); r = OrganismRuntimeV83(m, t)
    out = r.step(torch.randn(9), torch.randn(8))
    assert torch.isfinite(out["action"]).all()
    assert out["v83_learning_replay_valid"].shape == (1, 1)
    assert out["v83_learning_replay_writes"].shape == (1, 1)
