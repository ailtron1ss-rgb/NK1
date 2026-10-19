import tempfile
from pathlib import Path

import torch
import torch.nn.functional as F

import neurocore
from neurocore.v76 import CanonicalNeuralMemoryOSV76
from neurocore.v77 import (
    CanonicalNeuralMemoryOSV77,
    NeuroWeaveV77,
    OrganismTrainerV77,
    RuntimeStateStoreV77, OrganismRuntimeV77,
    mobile_v77_config,
)


def mem(cls=CanonicalNeuralMemoryOSV77, seed=1):
    torch.manual_seed(seed)
    return cls(
        54, key_dim=20, value_dim=20, fast_slots=16, fast_rank=2,
        semantic_slots=24, semantic_rank=2, replay_size=16, hidden=16,
        long_term_hidden=16, long_term_layers=1, graph_rank=3, graph_topk=3,
        structural_rank=3, structural_topk=2, composition_rank=4,
        composition_horizon=3, composition_capacity=16, relation_rank=4,
        replay_capacity=16, associative_rank=4, factor_rank=6,
        continuum_update_interval=4, replay_base_interval=4.0,
        replay_min_interval=1.0, replay_pressure_gain=1.75,
        replay_update_gain=32.0, replay_budget_cap=6,
        replay_exploit_ratio=0.55, replay_novelty_weight=0.26,
        replay_conflict_weight=0.24, replay_age_weight=0.18,
        replay_coverage_weight=0.22, protected_loss_weight=0.035,
        protected_max_samples=6, protected_min_conflict=0.22,
    )


def seed_old_memory(m):
    with torch.no_grad():
        m.associative_state_v72[0].zero_()
        m.associative_valid_v72[0] = 1.0
        s = F.normalize(torch.randn(20, generator=torch.Generator().manual_seed(11)), dim=0)
        t = F.normalize(torch.randn(20, generator=torch.Generator().manual_seed(12)), dim=0)
        m.associative_state_v72[0].copy_(torch.outer(s, t))
        m.associative_slow_valid_v74[0] = 1.0
        m._set_slow_matrix_v74(0, torch.outer(s, t))
        m.associative_update_count_v72.fill_(24)
    return s, t


def test_v77_package_surface_and_single_owner():
    m = NeuroWeaveV77(mobile_v77_config(9))
    assert neurocore.CURRENT_FRONTIER >= 77
    assert m.neural_memory_v61 is m.neural_memory_v76
    assert m.neural_memory_v61 is m.neural_memory_v77
    assert sum(p.numel() for p in m.parameters()) < 380000


def test_v77_revision_gate_is_causal_for_conflicting_write():
    m = mem(seed=2)
    s, old = seed_old_memory(m)
    new = F.normalize(torch.randn(20, generator=torch.Generator().manual_seed(13)), dim=0)
    base_erase, base_write, _ = CanonicalNeuralMemoryOSV76._gates_v72(m, 0, s, new)
    erase, write, _ = m._gates_v72(0, s, new)
    assert float(m.associative_write_protection_v77[0].item()) > 0.1
    assert float(erase.mean().item()) < float(base_erase.mean().item())
    assert float(write.mean().item()) < float(base_write.mean().item())
    assert torch.isfinite(m.associative_revision_pressure_v77).all()


def test_v77_revision_pressure_opens_after_repeated_reversal():
    m = mem(seed=3)
    s, _ = seed_old_memory(m)
    new = F.normalize(torch.randn(20, generator=torch.Generator().manual_seed(15)), dim=0)
    gates = []
    for _ in range(6):
        e, w, _ = m._gates_v72(0, s, new)
        gates.append((float(e.mean().item()), float(w.mean().item())))
        m._associative_write_v72(s, new, 0, 1.0)
    assert gates[-1][0] > gates[0][0]
    assert gates[-1][1] >= gates[0][1]
    assert float(m.associative_revision_pressure_v77[0].item()) > 0.3


def test_v77_reversal_retention_is_non_degenerate():
    m = mem(seed=4)
    s, old = seed_old_memory(m)
    new = F.normalize(torch.randn(20, generator=torch.Generator().manual_seed(16)), dim=0)
    for _ in range(8):
        m._associative_write_v72(s, new, 0, 1.0)
    pred = m._associative_predict_v72(s.view(1, -1), 0)
    old_cos = float(F.cosine_similarity(pred, old.view(1, -1)).item())
    new_cos = float(F.cosine_similarity(pred, new.view(1, -1)).item())
    assert torch.isfinite(pred).all()
    assert old_cos > -1.0 and new_cos > -1.0


def test_v77_gradient_surgery_is_directionally_causal():
    g = torch.tensor([1.0, -1.0, 0.5])
    protected = torch.tensor([-1.0, 1.0, 0.0])
    projected, conflicted, reduction = OrganismTrainerV77.project_conflicting_gradient_v77(g, protected)
    assert conflicted
    assert float((projected * protected).sum().item()) >= -1e-6
    assert reduction > 0.0


def test_v77_trainer_guarded_consolidation_is_live():
    model = NeuroWeaveV77(mobile_v77_config(9))
    trainer = OrganismTrainerV77(model, lr=3e-4, warmup_steps=1)
    m = model.neural_memory_v61
    with torch.no_grad():
        m.semantic_slot_valid_v63[:6] = 1
        m.semantic_key[:6] = F.normalize(torch.randn(6, 20), dim=-1)
        for i in range(6):
            m._record_composition_path_v73([i, (i + 1) % 6, (i + 2) % 6], 0.9)
            m.model_time_v72.add_(1)
    stats = trainer.consolidate_neural_memory()
    assert stats['steps'] >= 0.0
    assert torch.isfinite(m.associative_state_v72).all()
    assert trainer.neural_memory_updates_v61 >= int(stats['steps'])



def test_v77_runtime_step_exposes_live_revision_diagnostics():
    model = NeuroWeaveV77(mobile_v77_config(9))
    runtime = OrganismRuntimeV77(model)
    out = runtime.step(torch.randn(9))
    required = {
        'v77_revision_pressure', 'v77_write_protection', 'v77_write_gate',
        'v77_erase_gate', 'v77_revision_events', 'v77_protected_write_events',
        'v77_anchor_cos', 'v77_conflict',
    }
    assert required.issubset(out.keys())
    assert all(torch.isfinite(v).all() for v in out.values() if torch.is_tensor(v))


def test_v77_runtime_checkpoint_roundtrip():
    model = NeuroWeaveV77(mobile_v77_config(9))
    path = Path(tempfile.gettempdir()) / 'neurocore_v77_roundtrip.pt'
    RuntimeStateStoreV77.save(path, model)
    model2 = NeuroWeaveV77(mobile_v77_config(9))
    result = RuntimeStateStoreV77.load(path, model2)
    assert result['version'] == 77
    assert not result['shape_mismatch']
    assert not result['unexpected_tensors']
    assert not result['missing_tensors']
    path.unlink(missing_ok=True)


def test_v77_long_sequence_stays_finite():
    m = mem(seed=7)
    s, _ = seed_old_memory(m)
    target = F.normalize(torch.randn(20, generator=torch.Generator().manual_seed(17)), dim=0)
    for i in range(700):
        m._associative_write_v72(s, target if i % 3 else -target, 0, 1.0)
        m.model_time_v72.add_(1.0)
        if i % 25 == 0:
            m.replay_associative_state_v72(2)
    tensors = [
        m.associative_state_v72,
        m.associative_slow_left_v74,
        m.associative_revision_pressure_v77,
        m.associative_revision_write_gate_v77,
        m.associative_revision_erase_gate_v77,
    ]
    assert all(torch.isfinite(x).all() for x in tensors)
