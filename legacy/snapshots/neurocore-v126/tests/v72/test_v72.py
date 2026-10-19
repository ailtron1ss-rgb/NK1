import tempfile
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.v72 import (
    mobile_v72_config, NeuroWeaveV72, OrganismTrainerV72, OrganismRuntimeV72,
    RuntimeStateStoreV72, CanonicalNeuralMemoryOSV72,
)


def mem(seed=1, slots=24, replay=24):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV72(
        54, key_dim=20, value_dim=20, fast_slots=24, fast_rank=2,
        semantic_slots=slots, semantic_rank=2, replay_size=replay, hidden=32,
        long_term_hidden=28, long_term_layers=2, graph_rank=6, graph_topk=min(6, slots),
        structural_rank=6, structural_topk=min(3, slots-1),
        composition_rank=6, composition_horizon=4, composition_capacity=16,
        relation_rank=6, replay_capacity=replay, associative_rank=6,
    )


def test_v72_single_owner_and_bounded_associative_state():
    m = NeuroWeaveV72(mobile_v72_config(9))
    owners = [n for n, _ in m.named_modules() if n.startswith('neural_memory') and '.' not in n]
    assert owners == ['neural_memory_v61']
    mem0 = m.neural_memory_v61
    assert mem0.associative_state_v72.ndim == 3
    assert mem0.associative_state_v72.numel() <= 4 * mem0.key_dim * mem0.key_dim


def test_v72_decoupled_erase_write_are_independent():
    m = mem(2)
    source = F.normalize(torch.randn(m.key_dim), dim=0)
    target = F.normalize(torch.randn(m.key_dim), dim=0)
    with torch.no_grad():
        m.associative_erase_bias_v72.fill_(-6.0)
        m.associative_write_bias_v72.fill_(-0.2)
    m._associative_write_v72(source, target, 0, 1.0)
    a = m.associative_state_v72.clone()
    m.associative_state_v72.zero_(); m.associative_valid_v72.zero_()
    with torch.no_grad():
        m.associative_erase_bias_v72.fill_(0.2)
        m.associative_write_bias_v72.fill_(-6.0)
    m._associative_write_v72(source, target, 0, 1.0)
    b = m.associative_state_v72.clone()
    assert torch.isfinite(a).all() and torch.isfinite(b).all()
    assert not torch.allclose(a, b)


def test_v72_replay_reconstructs_associative_state_after_lesion():
    m = mem(3)
    with torch.no_grad():
        for _ in range(8):
            m._record_composition_path_v72([0, 1, 2], 1.0)
        before = float(m.associative_state_v72.norm().item())
        assert before > 0.0
        m.lesion_associative_memory_v72()
        after_lesion = float(m.associative_state_v72.norm().item())
        assert after_lesion == 0.0
        result = m.replay_associative_state_v72(3)
        after = float(m.associative_state_v72.norm().item())
    assert result['replayed'] >= 1.0
    assert after > 0.0


def test_v72_generation_guard_rejects_stale_path():
    m = mem(4)
    with torch.no_grad():
        for _ in range(6):
            m._record_composition_path_v72([0, 1, 2], 1.0)
        active = torch.nonzero(m.composition_active_v70 > 0.5, as_tuple=False).flatten()
        assert active.numel() == 1
        slot = int(active[0])
        assert m._generation_valid_v72(slot)
        m.semantic_generation_v72[1].add_(1)
        assert not m._generation_valid_v72(slot)


def test_v72_predicted_route_and_retrieve_are_live():
    m = mem(5)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:6] = 1
        m.semantic_key[:6] = F.normalize(torch.randn(6, m.key_dim), dim=-1)
        for _ in range(8):
            m._record_composition_path_v72([0, 1, 2], 1.0)
            m._record_composition_path_v72([0, 3, 4], 1.0)
        m.composition_temporal_valid_v70.fill_(1.0)
    q = F.normalize(m.semantic_key[0] + 0.8 * m.semantic_key[1], dim=0).view(1, -1)
    out = m.retrieve_sequence_v72(q)
    assert torch.isfinite(out['composed']).all()
    assert torch.isfinite(out['scores']).all()
    before = float(m.associative_route_effect_v72.item())
    _ = m._global_semantic_read(q)
    after = float(m.associative_route_effect_v72.item())
    assert after >= before


def test_v72_checkpoint_uses_single_model_state_source():
    m = NeuroWeaveV72(mobile_v72_config(9))
    t = OrganismTrainerV72(m)
    r = OrganismRuntimeV72(m, t)
    with tempfile.NamedTemporaryFile(suffix='.pt') as f:
        RuntimeStateStoreV72.save(Path(f.name), m, t, r)
        m2 = NeuroWeaveV72(mobile_v72_config(9))
        t2 = OrganismTrainerV72(m2)
        r2 = OrganismRuntimeV72(m2, t2)
        report = RuntimeStateStoreV72.load(Path(f.name), m2, t2, r2)
        assert report['loaded_tensors'] > 0
        assert report['optimizer_reset'] is False
        assert not report['unexpected_tensors']


def test_v72_associative_route_has_a_real_intervention():
    m = mem(6)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:6] = 1
        m.semantic_key[:6] = F.normalize(torch.randn(6, m.key_dim), dim=-1)
        for _ in range(8):
            m._record_composition_path_v72([0, 1, 2], 1.0)
        source = F.normalize(m.semantic_key[0] + m.semantic_key[1], dim=0).view(1, -1)
        learned = m.retrieve_sequence_v72(source)["composed"]
        m.associative_route_enabled_v72.zero_()
        ablated = m.retrieve_sequence_v72(source)["composed"]
    delta = float((learned - ablated).norm().item())
    assert delta > 1e-6
    assert torch.isfinite(ablated).all()
