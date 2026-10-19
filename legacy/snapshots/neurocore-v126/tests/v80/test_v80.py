from pathlib import Path
import tempfile
import torch

from neurocore.frontier import CURRENT_FRONTIER
from neurocore.v79 import NeuroWeaveV79, mobile_v79_config, OrganismRuntimeV79, OrganismTrainerV79
from neurocore.v80 import NeuroWeaveV80, OrganismRuntimeV80, OrganismTrainerV80, RuntimeStateStoreV80, mobile_v80_config


def _batch():
    x = torch.randn(2, 5, 9)
    goal = torch.randn(2, 5, 8)
    return x, goal


def test_v80_surface_and_learning_contract():
    m = NeuroWeaveV80(mobile_v80_config(9))
    report = m.learning_parameter_report_v80()
    assert CURRENT_FRONTIER >= 80
    assert report['active_fraction'] > 0.15
    assert report['active_fraction'] < 0.40
    assert m.neural_memory_v80 is m.neural_memory_v61
    frozen_legacy = [p for n, p in m.named_parameters() if not p.requires_grad and not n.startswith('target47.')]
    assert frozen_legacy


def test_v80_forward_is_differentiable_and_coupled():
    m = NeuroWeaveV80(mobile_v80_config(9))
    m.train()
    x, goal = _batch()
    out = m.forward_learning_v80(x, goal)
    assert torch.isfinite(out['loss'])
    out['loss'].backward()
    active = [(n, p) for n, p in m.named_parameters() if p.requires_grad]
    nonzero = [p for _, p in active if p.grad is not None and torch.isfinite(p.grad).all() and p.grad.abs().sum() > 0]
    covered = sum(p.numel() for p in nonzero) / sum(p.numel() for _, p in active)
    assert covered > 0.50
    assert any(n.startswith('unified_spine_v80.') for n, p in active if p.grad is not None)
    assert any(n.startswith('neural_memory_v61.') for n, p in active if p.grad is not None)
    assert any(n.startswith('brain46.') for n, p in active if p.grad is not None)
    assert any(n.startswith('brain47.') for n, p in active if p.grad is not None)
    assert any(n.startswith('world_model_v50.') for n, p in active if p.grad is not None)
    assert any(n.startswith('unified_spine_v80.memory_to_action.') for n, p in active if p.grad is not None and p.grad.abs().sum() > 0)


def test_v80_learning_step_updates_shared_trunk():
    m = NeuroWeaveV80(mobile_v80_config(9))
    t = OrganismTrainerV80(m, lr=5e-4, warmup_steps=1)
    x, goal = _batch()
    before = {n: p.detach().clone() for n, p in m.named_parameters() if p.requires_grad}
    stats = t.learning_step_v80(x, goal)
    assert stats['gradient_coverage'] > 0.50
    changed = [n for n, p in m.named_parameters() if p.requires_grad and not torch.equal(before[n], p.detach())]
    assert len(changed) > 10
    assert stats['steps'] == 1.0


def test_v80_runtime_and_checkpoint():
    m = NeuroWeaveV80(mobile_v80_config(9))
    t = OrganismTrainerV80(m, lr=5e-4, warmup_steps=1)
    r = OrganismRuntimeV80(m, trainer=t)
    out = r.step(torch.randn(9))
    assert all(torch.isfinite(v).all() for v in out.values() if torch.is_tensor(v))
    path = Path(tempfile.gettempdir()) / 'neurocore_v80_roundtrip.pt'
    RuntimeStateStoreV80.save(path, m, trainer=t, runtime=r)
    m2 = NeuroWeaveV80(mobile_v80_config(9))
    t2 = OrganismTrainerV80(m2, lr=5e-4, warmup_steps=1)
    r2 = OrganismRuntimeV80(m2, trainer=t2)
    result = RuntimeStateStoreV80.load(path, m2, trainer=t2, runtime=r2)
    assert result['version'] == 80
    assert not result['shape_mismatch']
    assert result['optimizer_loaded'] is True
    path.unlink(missing_ok=True)


def test_v80_runtime_spine_changes_behavior_and_persists_state():
    torch.manual_seed(23)
    m80 = NeuroWeaveV80(mobile_v80_config(9))
    m79 = NeuroWeaveV79(mobile_v79_config(9))
    # Start from the same inherited weights so any action delta comes from V80 runtime integration.
    common = {k: v for k, v in m80.state_dict().items() if k in m79.state_dict() and m79.state_dict()[k].shape == v.shape}
    m79.load_state_dict(common, strict=False)
    r80 = OrganismRuntimeV80(m80, trainer=OrganismTrainerV80(m80))
    obs = torch.randn(9)
    goal = torch.randn(8)
    first = r80.step(obs, goal)
    second = r80.step(obs, goal)
    assert torch.isfinite(first['v80_action_correction']).all()
    assert first['v80_action_correction'].abs().max().item() <= 0.100001
    assert second['v80_runtime_steps'].item() == 2.0
    assert second['v80_spine_state'].norm().item() > 0.0
    baseline = OrganismRuntimeV79(m79, trainer=OrganismTrainerV79(m79))
    base = baseline.step(obs, goal)
    assert torch.isfinite(base['action']).all()
    assert not torch.allclose(second['action'], base['action'])
    path = Path(tempfile.gettempdir()) / 'neurocore_v80_runtime_roundtrip.pt'
    RuntimeStateStoreV80.save(path, m80, trainer=r80.trainer, runtime=r80)
    m3 = NeuroWeaveV80(mobile_v80_config(9))
    t3 = OrganismTrainerV80(m3)
    r3 = OrganismRuntimeV80(m3, trainer=t3)
    rr = RuntimeStateStoreV80.load(path, m3, trainer=t3, runtime=r3)
    assert rr['optimizer_loaded'] is True
    assert r3.v80_runtime_steps == r80.v80_runtime_steps
    assert r3.v80_spine_state is not None
    path.unlink(missing_ok=True)


def test_v80_unified_optimizer_replay_gradient_path_is_live():
    torch.manual_seed(31)
    m = NeuroWeaveV80(mobile_v80_config(9))
    t = OrganismTrainerV80(m, lr=5e-4, warmup_steps=1)
    for _ in range(4):
        ctx = torch.randn(1, m.neural_memory_v61.input_dim)
        tgt = torch.nn.functional.normalize(torch.randn(1, m.neural_memory_v61.value_dim), dim=-1)
        m.neural_memory_v61.write(ctx, tgt, strength=1.0, surprise=0.2)
    stats = t.learning_step_v80(torch.randn(2, 5, 9), torch.randn(2, 5, 8))
    assert stats['replay_available'] == 1.0
    assert stats['replay_grad_norm'] > 0.0
    assert 0.0 <= stats['replay_mix'] <= 1.0
    assert stats['gradient_coverage'] > 0.50
