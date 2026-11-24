import tempfile
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.v70 import (
    mobile_v70_config, NeuroWeaveV70, OrganismTrainerV70, OrganismRuntimeV70,
    RuntimeStateStoreV70, CanonicalNeuralMemoryOSV70,
)


def mem(seed=1, slots=24, replay=24):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV70(
        54, key_dim=20, value_dim=20, fast_slots=24, fast_rank=2,
        semantic_slots=slots, semantic_rank=2, replay_size=replay, hidden=32,
        long_term_hidden=28, long_term_layers=2, graph_rank=6, graph_topk=min(6, slots),
        structural_rank=6, structural_topk=min(3, slots-1),
        composition_rank=6, composition_horizon=4, composition_capacity=16,
    )


def test_v70_single_owner_and_budget():
    model = NeuroWeaveV70(mobile_v70_config(9))
    params = sum(p.numel() for p in model.parameters())
    owners = [n for n, _ in model.named_modules() if n.startswith('neural_memory') and '.' not in n]
    assert owners == ['neural_memory_v61']
    assert params < 350_000
    assert model.neural_memory_v69 is model.neural_memory_v61


def test_v70_path_storage_requires_repetition():
    m = mem(2)
    for _ in range(4):
        m._record_composition_path_v70([0, 1, 2], 1.0)
    active = torch.nonzero(m.composition_active_v70 > 0.5, as_tuple=False).flatten()
    assert active.numel() == 1
    s = int(active[0])
    assert float(m.composition_repeat_v70[s]) >= 3.0


def test_v70_composition_predictor_trains():
    m = mem(3)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:3] = 1
        eye = F.normalize(torch.eye(m.key_dim)[:3], dim=-1)
        m.semantic_key[:3] = eye
        m._record_composition_path_v70([0, 1, 2], 1.0)
        for _ in range(6):
            m._record_composition_path_v70([0, 1, 2], 1.0)
    opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
    loss0 = float(m._composition_loss_v70().item())
    for _ in range(25):
        loss = m._composition_loss_v70()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
    loss1 = float(m._composition_loss_v70().item())
    assert loss1 <= loss0 + 1e-5


def test_v70_sequence_query_learns_endpoint():
    m = mem(4)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:5] = 1
        keys = torch.zeros(5, m.key_dim)
        keys[0,0] = 1; keys[1,1] = 1; keys[2,2] = 1; keys[3,3] = 1; keys[4,4] = 1
        m.semantic_key[:5] = F.normalize(keys, dim=-1)
    opt = torch.optim.AdamW(m.parameters(), lr=3e-3)
    prefix = m.semantic_key[[0,1,2]].detach().unsqueeze(0)
    target = m.semantic_key[2].detach()
    for _ in range(40):
        pred = m._compose_path_v70(prefix)[0]
        loss = 1.0 - F.cosine_similarity(pred.view(1,-1), target.view(1,-1), dim=-1)[0]
        opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
    out = m.retrieve_sequence_v70(prefix)
    assert int(out['top_index'][0]) == 2
    assert float(out['top_score'][0]) > 0.75


def test_v70_conflicting_prefixes_are_tracked():
    m = mem(31)
    for _ in range(5):
        m._record_composition_path_v70([0, 1, 2], 1.0)
    for _ in range(5):
        m._record_composition_path_v70([0, 1, 3], 1.0)
    assert int(m.composition_conflict_hits_v70.item()) >= 1


def test_v70_branch_loss_trains():
    m = mem(32)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:5] = 1
        m.semantic_key[:5] = F.normalize(torch.randn(5, m.key_dim), dim=-1)
        for _ in range(6):
            m._record_composition_path_v70([0, 1, 2], 1.0)
            m._record_composition_path_v70([0, 1, 3], 1.0)
    opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
    loss0 = float(m._composition_branch_loss_v70().item())
    for _ in range(20):
        loss = m._composition_branch_loss_v70()
        opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
    loss1 = float(m._composition_branch_loss_v70().item())
    assert loss1 <= loss0 + 1e-5


def test_v70_write_records_bounded_paths():
    m = mem(5)
    q = F.normalize(torch.randn(20), dim=0)
    t = F.normalize(torch.randn(20), dim=0)
    for _ in range(8):
        m.write(q, t, strength=1.0, surprise=.2)
    assert int(m.composition_step_v70.item()) >= 1
    assert int(m.composition_last_path_len_v70.item()) >= 1


def test_v70_full_retrieval_is_finite():
    m = mem(6)
    q = F.normalize(torch.randn(20), dim=0)
    t = F.normalize(torch.randn(20), dim=0)
    for _ in range(6):
        m.write(q, t, strength=1.0, surprise=.5)
    r = m.retrieve(q.view(1,-1))
    assert torch.isfinite(r['semantic_read']).all()
    assert r['semantic_read'].shape[-1] == 20


def test_v70_memory_loss_integrates_composition():
    m = mem(7)
    p = m.memory_loss(torch.randn(1,54), F.normalize(torch.randn(1,20), dim=-1))
    assert 'composition_path_v70' in p
    assert 'composition_diversity_v70' in p
    assert 'composition_branch_v70' in p
    assert torch.isfinite(p['loss']).all()
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    opt.zero_grad(set_to_none=True); p['loss'].backward(); opt.step()


def test_v70_lesion_regrowth():
    m = mem(8)
    with torch.no_grad():
        m.composition_paths_v70[0,:3] = torch.tensor([0,1,2])
        m.composition_path_len_v70[0] = 3
        m.composition_repeat_v70[0] = 8
        m.composition_utility_v70[0] = 1
        m.composition_active_v70[0] = 1
        m.composition_paths_v70[1,:3] = torch.tensor([2,3,4])
        m.composition_path_len_v70[1] = 3
        m.composition_repeat_v70[1] = 8
        m.composition_utility_v70[1] = 1
        m.composition_active_v70[1] = 1
    before = int(m.composition_active_v70.sum())
    les = m.lesion_composition_paths_v70(.5)
    reg = m.regrow_composition_paths_v70()
    assert les['lesioned'] >= 1
    assert reg['active'] >= 1
    assert reg['active'] <= before


def test_v70_runtime_and_diagnostics():
    cfg = mobile_v70_config(9)
    model = NeuroWeaveV70(cfg)
    tr = OrganismTrainerV70(model)
    rt = OrganismRuntimeV70(model, tr)
    out = rt.step(torch.randn(1,9))
    for k in ('v70_composition_loss','v70_composition_branch_loss','v70_composition_route_effect','v70_composition_active_paths'):
        assert torch.isfinite(out[k]).all()


def test_v70_checkpoint_roundtrip_and_v69_migration():
    from neurocore.v69 import NeuroWeaveV69, OrganismTrainerV69, OrganismRuntimeV69, RuntimeStateStoreV69, mobile_v69_config
    m70 = NeuroWeaveV70(mobile_v70_config(9)); t70 = OrganismTrainerV70(m70); r70 = OrganismRuntimeV70(m70,t70)
    with torch.no_grad():
        m70.neural_memory_v61.composition_repeat_v70[0] = 7
        m70.neural_memory_v61.composition_active_v70[0] = 1
    with tempfile.NamedTemporaryFile(suffix='.pt') as f:
        RuntimeStateStoreV70.save(Path(f.name), m70, t70, r70)
        m2 = NeuroWeaveV70(mobile_v70_config(9)); t2 = OrganismTrainerV70(m2); r2 = OrganismRuntimeV70(m2,t2)
        RuntimeStateStoreV70.load(Path(f.name), m2, t2, r2)
        assert float(m2.neural_memory_v61.composition_repeat_v70[0]) == 7.0
        assert float(m2.neural_memory_v61.composition_active_v70[0]) == 1.0
    m69 = NeuroWeaveV69(mobile_v69_config(9)); t69=OrganismTrainerV69(m69); r69=OrganismRuntimeV69(m69,t69)
    with tempfile.NamedTemporaryFile(suffix='.pt') as f:
        RuntimeStateStoreV69.save(Path(f.name), m69, t69, r69)
        m3 = NeuroWeaveV70(mobile_v70_config(9)); t3=OrganismTrainerV70(m3); r3=OrganismRuntimeV70(m3,t3)
        RuntimeStateStoreV70.load(Path(f.name), m3, t3, r3)
        assert m3.neural_memory_v61.semantic_key.shape == m69.neural_memory_v61.semantic_key.shape
