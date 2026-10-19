import tempfile
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.v69 import (
    mobile_v69_config, NeuroWeaveV69, OrganismTrainerV69, OrganismRuntimeV69,
    RuntimeStateStoreV69, CanonicalNeuralMemoryOSV69,
)


def mem(seed=1, slots=24, replay=32):
    torch.manual_seed(seed)
    return CanonicalNeuralMemoryOSV69(
        54, key_dim=20, value_dim=20, fast_slots=24, fast_rank=2,
        semantic_slots=slots, semantic_rank=2, replay_size=replay, hidden=32,
        long_term_hidden=28, long_term_layers=2, graph_rank=6, graph_topk=min(6, slots),
        structural_rank=6, structural_topk=min(3, slots-1),
    )


def test_v69_mobile_budget_and_single_owner():
    model = NeuroWeaveV69(mobile_v69_config(9))
    params = sum(p.numel() for p in model.parameters())
    assert params < 360_000
    owners = [n for n, _ in model.named_modules() if n.startswith('neural_memory') and '.' not in n]
    assert owners == ['neural_memory_v61']
    assert model.neural_memory_v68 is model.neural_memory_v61


def test_v69_multi_step_edges_need_repeated_evidence():
    m = mem(2)
    for _ in range(4):
        m._record_multistep_transition_v69(0, 1, 1, 1.0)
        m._record_multistep_transition_v69(1, 2, 1, 1.0)
    assert float(m.multistep_repeat_v69[0, 0, 1]) >= 3.8
    assert float(m.multistep_repeat_v69[0, 1, 2]) >= 3.8
    assert float(m._multistep_loss_v69().item()) >= 0.0


def test_v69_multistep_predictor_trains():
    m = mem(3)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:3] = 1
        eye = F.normalize(torch.eye(m.key_dim)[:3], dim=-1)
        if m.semantic_key.dim() == 3:
            m.semantic_key[:3].zero_()
            m.semantic_key[:3, 0] = eye
        else:
            m.semantic_key[:3] = eye
        m.multistep_repeat_v69.zero_()
        m.multistep_repeat_v69[0, 0, 1] = 8
        m.multistep_repeat_v69[0, 1, 2] = 8
    opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
    loss0 = float(m._multistep_loss_v69().item())
    for _ in range(20):
        loss = m._multistep_loss_v69()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
    loss1 = float(m._multistep_loss_v69().item())
    assert loss1 <= loss0 + 1e-5


def test_v69_counterfactual_branch_training_signal_exists():
    m = mem(4)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:4] = 1
        if m.semantic_key.dim() == 3:
            m.semantic_key[:4, 0] = F.normalize(torch.randn(4, m.key_dim), dim=-1)
        m.counterfactual_repeat_v69[0, 1] = 8
        m.counterfactual_repeat_v69[0, 2] = 3
    loss = m._counterfactual_loss_v69()
    assert torch.isfinite(loss)
    opt = torch.optim.AdamW(m.parameters(), lr=2e-3)
    opt.zero_grad(set_to_none=True)
    loss.backward()
    opt.step()


def test_v69_write_records_sequence_history():
    m = mem(5)
    q = F.normalize(torch.randn(20), dim=0)
    t = F.normalize(torch.randn(20), dim=0)
    for _ in range(6):
        m.write(q, t, strength=1.0, surprise=.4)
    assert int(m.sequence_step_v69.item()) == 6
    assert int(m.last_sequence_len_v69.item()) >= 1
    assert torch.isfinite(m.temporal_context_key_v69).all()


def test_v69_key_retrieval_is_finite_and_uses_full_path():
    m = mem(6)
    q = F.normalize(torch.randn(20), dim=0)
    t = F.normalize(torch.randn(20), dim=0)
    for _ in range(5):
        m.write(q, t, strength=1.0, surprise=.6)
    r = m.retrieve(q.view(1, -1))
    assert torch.isfinite(r['semantic_read']).all()
    assert r['semantic_read'].shape[-1] == 20


def test_v69_lesion_and_regrowth_are_stateful():
    m = mem(7)
    with torch.no_grad():
        m.semantic_slot_valid_v63[:4] = 1
        m.semantic_structural_repeat_v67[0, 1] = 8
        m.semantic_structural_utility_v67[0, 1] = 1
        m.semantic_structural_mask_v67[0, 1] = 1
        m.semantic_structural_repeat_v67[1, 2] = 8
        m.semantic_structural_utility_v67[1, 2] = 1
        m.semantic_structural_mask_v67[1, 2] = 1
    before = int(m.semantic_structural_mask_v67.sum().item())
    out = m.lesion_sequence_routes_v69(.5)
    assert out['lesioned'] >= 1
    reg = m.regrow_sequence_routes_v69()
    assert reg['active'] >= 1
    assert int(m.sequence_lesion_count_v69.item()) >= 1


def test_v69_runtime_and_diagnostics():
    cfg = mobile_v69_config(9)
    model = NeuroWeaveV69(cfg)
    trainer = OrganismTrainerV69(model)
    runtime = OrganismRuntimeV69(model, trainer)
    out = runtime.step(torch.randn(1, 9))
    for k in ('v69_multistep_loss', 'v69_counterfactual_loss', 'v69_multistep_route_effect', 'v69_counterfactual_route_effect'):
        assert torch.isfinite(out[k]).all()


def test_v69_memory_loss_integrates_new_terms():
    m = mem(9, replay=16)
    q = torch.randn(1, 54)
    t = F.normalize(torch.randn(1, 20), dim=-1)
    p = m.memory_loss(q, t)
    assert 'multistep_prediction_v69' in p
    assert 'counterfactual_branch_v69' in p
    assert torch.isfinite(p['loss']).all()
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    opt.zero_grad(set_to_none=True)
    p['loss'].backward()
    opt.step()


def test_v69_checkpoint_roundtrip():
    cfg = mobile_v69_config(9)
    model = NeuroWeaveV69(cfg)
    trainer = OrganismTrainerV69(model)
    runtime = OrganismRuntimeV69(model, trainer)
    with torch.no_grad():
        model.neural_memory_v61.multistep_repeat_v69[0, 0, 1] = 7
        model.neural_memory_v61.sequence_lesion_count_v69.fill_(3)
    with tempfile.NamedTemporaryFile(suffix='.pt') as f:
        RuntimeStateStoreV69.save(Path(f.name), model, trainer, runtime)
        model2 = NeuroWeaveV69(cfg)
        trainer2 = OrganismTrainerV69(model2)
        runtime2 = OrganismRuntimeV69(model2, trainer2)
        RuntimeStateStoreV69.load(Path(f.name), model2, trainer2, runtime2)
        assert float(model2.neural_memory_v61.multistep_repeat_v69[0, 0, 1]) == 7.0
        assert int(model2.neural_memory_v61.sequence_lesion_count_v69.item()) == 3

def test_v69_migrates_v68_checkpoint():
    from neurocore.v68 import NeuroWeaveV68, OrganismTrainerV68, OrganismRuntimeV68, RuntimeStateStoreV68, mobile_v68_config
    cfg68 = mobile_v68_config(9)
    model68 = NeuroWeaveV68(cfg68)
    tr68 = OrganismTrainerV68(model68); rt68 = OrganismRuntimeV68(model68, tr68)
    with torch.no_grad():
        model68.neural_memory_v61.semantic_key[0].copy_(F.normalize(torch.randn(20), dim=0))
        model68.neural_memory_v61.semantic_value[0].copy_(F.normalize(torch.randn(20), dim=0))
    with tempfile.NamedTemporaryFile(suffix='.pt') as f:
        RuntimeStateStoreV68.save(Path(f.name), model68, tr68, rt68)
        model69 = NeuroWeaveV69(mobile_v69_config(9))
        tr69 = OrganismTrainerV69(model69); rt69 = OrganismRuntimeV69(model69, tr69)
        RuntimeStateStoreV69.load(Path(f.name), model69, tr69, rt69)
        assert torch.allclose(model69.neural_memory_v61.semantic_key[0], model68.neural_memory_v61.semantic_key[0], atol=1e-6)
        assert torch.allclose(model69.neural_memory_v61.semantic_value[0], model68.neural_memory_v61.semantic_value[0], atol=1e-6)
