import tempfile
from pathlib import Path
import torch
import torch.nn.functional as F

from neurocore.v73 import (
    mobile_v73_config, NeuroWeaveV73, OrganismTrainerV73, OrganismRuntimeV73,
    RuntimeStateStoreV73, CanonicalNeuralMemoryOSV73,
)


def mem(seed=1, slots=32, replay=24):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV73(
        54, key_dim=20, value_dim=20, fast_slots=24, fast_rank=2,
        semantic_slots=slots, semantic_rank=2, replay_size=replay, hidden=32,
        long_term_hidden=28, long_term_layers=2, graph_rank=6, graph_topk=min(8, slots),
        structural_rank=6, structural_topk=min(3, max(2, slots-1)),
        composition_rank=6, composition_horizon=4, composition_capacity=24,
        relation_rank=6, replay_capacity=replay, associative_rank=6,
        factor_rank=6,
    )


def test_v73_single_owner_and_frontier():
    model = NeuroWeaveV73(mobile_v73_config(9))
    owners = [n for n, _ in model.named_modules() if n.startswith('neural_memory') and '.' not in n]
    assert owners == ['neural_memory_v61']
    assert model.neural_memory_v72 is model.neural_memory_v61
    assert sum(p.numel() for p in model.parameters()) < 450_000


def test_v73_factorized_composer_has_gradient_path():
    m = mem(2)
    x = F.normalize(torch.randn(2, 3, 20), dim=-1)
    out = m._factorized_compose_v73(x)
    loss = (1.0 - F.cosine_similarity(out, x[:, -1], dim=-1)).mean()
    loss.backward()
    grads = [p.grad for n, p in m.named_parameters() if 'composition_factor_' in n]
    assert grads and all(g is not None and torch.isfinite(g).all() for g in grads)


def test_v73_equivalence_groups_pool_reusable_relations():
    m = mem(3, slots=12)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:6] = 1
        base_a = F.normalize(torch.randn(20), dim=0)
        base_b = F.normalize(torch.randn(20), dim=0)
        m.semantic_key[0] = base_a
        m.semantic_key[1] = base_b
        m.semantic_key[2] = base_a
        m.semantic_key[3] = base_b
        m.semantic_key[4] = F.normalize(torch.randn(20), dim=0)
        m.semantic_key[5] = F.normalize(torch.randn(20), dim=0)
        for _ in range(5):
            m._record_composition_path_v73([0, 1, 4], 1.0)
            m._record_composition_path_v73([2, 3, 5], 1.0)
        slots = [int(x) for x in torch.nonzero(m.composition_active_v70 > 0.5).flatten().tolist()]
        groups = m._equivalence_groups_v73(slots)
    assert any(len(v) >= 2 for v in groups.values())
    assert int(m.composition_equivalence_hits_v73.item()) >= 1


def test_v73_conflict_is_measured_and_reduces_associative_dominance():
    m = mem(4)
    with torch.no_grad():
        s = F.normalize(torch.randn(20), dim=0)
        t1 = F.normalize(torch.randn(20), dim=0)
        t2 = F.normalize(torch.randn(20), dim=0)
    m._associative_write_v72(s, t1, 0, 1.0)
    first = float(m.associative_conflict_v73[0].item())
    m._associative_write_v72(s, -t1, 0, 1.0)
    second = float(m.associative_conflict_v73[0].item())
    assert second > first
    assert float(m.associative_interference_gate_v73[0].item()) < 1.0


def test_v73_route_and_retrieval_are_live():
    m = mem(5)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:8] = 1
        m.semantic_key[:8] = F.normalize(torch.randn(8, 20), dim=-1)
        for _ in range(8):
            m._record_composition_path_v73([0, 1, 2], 1.0)
            m._record_composition_path_v73([3, 4, 5], 1.0)
        q = F.normalize(m.semantic_key[0] + 0.7 * m.semantic_key[1], dim=0).view(1, -1)
        out = m.retrieve_sequence_v73(q)
        before = float(m.associative_route_effect_v72.item())
        _ = m._global_semantic_read(q)
        after = float(m.associative_route_effect_v72.item())
    assert torch.isfinite(out['composed']).all()
    assert torch.isfinite(out['scores']).all()
    assert after >= before


def test_v73_checkpoint_roundtrip_reports_single_state_source():
    m = NeuroWeaveV73(mobile_v73_config(9)); t = OrganismTrainerV73(m); r = OrganismRuntimeV73(m, t)
    with tempfile.NamedTemporaryFile(suffix='.pt') as f:
        RuntimeStateStoreV73.save(Path(f.name), m, t, r)
        m2 = NeuroWeaveV73(mobile_v73_config(9)); t2 = OrganismTrainerV73(m2); r2 = OrganismRuntimeV73(m2, t2)
        report = RuntimeStateStoreV73.load(Path(f.name), m2, t2, r2)
    assert report['loaded_tensors'] > 0
    assert not report['unexpected_tensors']


def test_v73_long_sequence_stays_finite():
    m = mem(7, slots=24, replay=24)
    for i in range(900):
        m._record_composition_path_v73([i % 12, (i + 1) % 12, (i + 2) % 12], 0.3 + 0.7 * ((i % 23) == 0))
        if i % 90 == 0:
            m.model_time_v72.add_(1.0)
            m.replay_associative_state_v72(2)
    tensors = [m.associative_state_v72, m.associative_conflict_v73, m.composition_paths_v70, m.semantic_key]
    assert all(torch.isfinite(x).all() for x in tensors)
    assert int(m.composition_active_v70.sum().item()) <= m.composition_capacity_v70


def test_v73_equivalence_route_has_real_intervention():
    m = mem(8, slots=12)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:8] = 1
        base = F.normalize(torch.randn(8, 20), dim=-1)
        base[2] = base[1]
        m.semantic_key[:8] = base
        for _ in range(8):
            m._record_composition_path_v73([0, 1, 4], 1.0)
            m._record_composition_path_v73([0, 2, 5], 1.0)
        q = m.semantic_key[0].view(1, -1)
        base_weights = torch.zeros(1, m.semantic_slots)
        base_weights[0, :8] = 1.0 / 8.0
        conf = torch.zeros(1)
        old_gain = m.equivalence_gain_v73
        enabled = m._composition_route_v72(q, base_weights, conf)
        m.equivalence_gain_v73 = 0.0
        disabled = m._composition_route_v72(q, base_weights, conf)
        m.equivalence_gain_v73 = old_gain
    assert torch.isfinite(enabled).all() and torch.isfinite(disabled).all()
    assert float((enabled - disabled).norm().item()) > 1e-7
