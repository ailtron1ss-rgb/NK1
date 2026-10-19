from pathlib import Path
import tempfile
import torch
from neurocore.frontier import CURRENT_FRONTIER
from neurocore.v78 import NeuroWeaveV78, OrganismRuntimeV78, OrganismTrainerV78, RuntimeStateStoreV78, mobile_v78_config
from neurocore.v78.benchmark import ContinualTaskV78, make_task_batch


def test_v78_surface_and_owner():
    m = NeuroWeaveV78(mobile_v78_config(9))
    assert CURRENT_FRONTIER >= 78
    assert m.neural_memory_v61 is m.neural_memory_v78
    assert sum(p.numel() for p in m.parameters()) < 390_000


def test_v78_gradient_conflict_projection_is_causal():
    g = torch.tensor([1.0, -0.5, 0.25])
    rg = torch.tensor([-1.0, 0.5, -0.1])
    out, conflicted, reduction = OrganismTrainerV78.project_gradient_family_v78(g, rg, strength=1.0, threshold=0.0)
    assert conflicted
    assert float((out * rg).sum().item()) >= -1e-6
    assert reduction > 0.0


def test_v78_adaptive_replay_mix_is_monotonic():
    aligned = OrganismTrainerV78.adaptive_replay_mix_v78(0.5, 0.4, threshold=0.0, gain=0.25)
    conflict = OrganismTrainerV78.adaptive_replay_mix_v78(0.5, -0.4, threshold=0.0, gain=0.25)
    strong_conflict = OrganismTrainerV78.adaptive_replay_mix_v78(0.5, -1.0, threshold=0.0, gain=0.25)
    assert aligned == 0.5
    assert 0.5 < conflict < strong_conflict <= 0.75


def test_v78_aligned_gradient_is_preserved():
    g = torch.tensor([1.0, 0.5, 0.25])
    rg = torch.tensor([0.5, 0.25, 0.1])
    out, conflicted, reduction = OrganismTrainerV78.project_gradient_family_v78(g, rg, strength=1.0, threshold=0.0)
    assert not conflicted
    assert torch.allclose(out, g)
    assert reduction == 0.0


def test_v78_continual_update_is_live():
    torch.manual_seed(78)
    model = NeuroWeaveV78(mobile_v78_config(9))
    trainer = OrganismTrainerV78(model, lr=4e-4, warmup_steps=1)
    a = ContinualTaskV78(0, 0.0, 1.0)
    b = ContinualTaskV78(1, 0.0, -1.0)
    ctx_a, tgt_a = make_task_batch(a, 6, seed=7801)
    ctx_b, tgt_b = make_task_batch(b, 6, seed=7802)
    for i in range(6):
        model.neural_memory_v61.write(ctx_a[i:i+1], tgt_a[i:i+1], strength=1.0, surprise=1.0)
    replay = model.neural_memory_v61._replay_batch()
    stats = trainer.continual_update_v78(ctx_b, tgt_b, replay[0], replay[1], task_id=1)
    assert torch.isfinite(model.neural_memory_v61.continual_interference_cos_v78)
    assert stats['task_id'] == 1.0
    assert stats['base_grad_norm'] >= 0.0


def test_v78_runtime_diagnostics_and_checkpoint():
    model = NeuroWeaveV78(mobile_v78_config(9))
    runtime = OrganismRuntimeV78(model)
    out = runtime.step(torch.randn(9))
    required = {'v78_interference_cos','v78_interference_ema','v78_projection_ratio','v78_projection_energy','v78_conflict_events','v78_update_events','v78_retention_pressure','v78_current_task'}
    assert required.issubset(out.keys())
    assert all(torch.isfinite(v).all() for v in out.values() if torch.is_tensor(v))
    path = Path(tempfile.gettempdir()) / 'neurocore_v78_roundtrip.pt'
    trainer = OrganismTrainerV78(model, lr=4e-4, warmup_steps=1)
    RuntimeStateStoreV78.save(path, model, trainer=trainer, runtime=runtime)
    model2 = NeuroWeaveV78(mobile_v78_config(9))
    trainer2 = OrganismTrainerV78(model2, lr=4e-4, warmup_steps=1)
    runtime2 = OrganismRuntimeV78(model2)
    result = RuntimeStateStoreV78.load(path, model2, trainer=trainer2, runtime=runtime2)
    assert result['version'] == 78
    assert not result['shape_mismatch']
    assert not result['missing_tensors']
    path.unlink(missing_ok=True)
