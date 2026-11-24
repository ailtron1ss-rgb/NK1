import tempfile
from pathlib import Path

import torch

from neurocore.v60 import (
    mobile_v60_config,
    NeuralEpisodeAdapterMemoryV60,
    NestedPlasticityFieldV60,
    NeuroWeaveV60,
    OrganismRuntimeV60,
    OrganismTrainerV60,
    RuntimeStateStoreV60,
)


def test_v60_all_neural_branches_are_real_and_connected():
    torch.manual_seed(1)
    f = NestedPlasticityFieldV60(18, 10, rank=3, hidden=14, topk_fraction=0.2, block_size=3, block_topk_fraction=0.1)
    x = torch.randn(1, 18)
    y = torch.randn(1, 10) * 2.0
    w0 = f.effective_weight().detach().clone()
    out = f.adapt(x, y, min_error=0.0, observed_uncertainty=0.1, observed_reward=0.5)
    w1 = f.effective_weight().detach().clone()
    assert not torch.allclose(w0, w1)
    assert out['sparse_density'].item() < 0.9
    assert out['low_rank_norm'].item() > 0.0
    assert out['diagonal_norm'].item() > 0.0
    assert out['eligibility_norm'].item() > 0.0
    assert out['learned_keep_fraction'].item() > 0.04


def test_v60_low_rank_branch_has_bounded_rank():
    torch.manual_seed(2)
    f = NestedPlasticityFieldV60(24, 12, rank=3, hidden=10)
    x = torch.randn(1, 24)
    y = torch.randn(1, 12)
    f.adapt(x, y, min_error=0.0)
    m = f.fast_low_rank_u @ f.fast_low_rank_v
    rank = int(torch.linalg.matrix_rank(m).item())
    assert rank <= 3


def test_v60_topk_and_block_support_is_sparse():
    torch.manual_seed(3)
    f = NestedPlasticityFieldV60(32, 16, rank=2, hidden=12, topk_fraction=0.10, block_size=4, block_topk_fraction=0.06)
    x = torch.randn(1, 32)
    y = torch.randn(1, 16) * 3
    f.adapt(x, y, min_error=0.0)
    density = float(f.sparse_support.mean())
    assert 0.05 <= density <= 0.60
    assert float(f.fast_state[f.sparse_support < 0.5].abs().max()) == 0.0


def test_v60_meta_optimizer_has_real_gradient_path():
    torch.manual_seed(4)
    f = NestedPlasticityFieldV60(18, 10, rank=3, hidden=12)
    x = torch.randn(4, 18)
    y = torch.randn(4, 10)
    loss = f.plasticity_loss(x, y)['loss']
    loss.backward()
    grads = [p.grad for p in f.meta_programmer.parameters()]
    assert any(g is not None and torch.isfinite(g).all() and float(g.abs().sum()) > 0 for g in grads)


def test_v60_plasticity_loss_is_trainable():
    torch.manual_seed(5)
    f = NestedPlasticityFieldV60(12, 8, rank=2, hidden=10)
    opt = torch.optim.AdamW(f.parameters(), lr=2e-3)
    x = torch.randn(6, 12)
    y = torch.randn(6, 8)
    before = float(f.plasticity_loss(x, y)['loss'].item())
    for _ in range(3):
        opt.zero_grad(set_to_none=True)
        loss = f.plasticity_loss(x, y)['loss']
        loss.backward()
        opt.step()
    after = float(f.plasticity_loss(x, y)['loss'].item())
    assert torch.isfinite(torch.tensor(after))
    assert after <= before + 0.05


def test_v60_neural_memory_is_actual_low_rank_neural_trace():
    torch.manual_seed(6)
    mem = NeuralEpisodeAdapterMemoryV60(12, 10, slots=6, rank=2)
    key = torch.randn(12)
    value = torch.randn(10)
    mem.write(key, value, strength=1.0)
    out = mem.retrieve(key.unsqueeze(0))
    assert out['read'].shape == (1, 10)
    assert out['weights'].shape == (1, 6)
    assert float(out['confidence'].item()) >= 0.0
    nonzero = int((mem.left.abs() > 0).sum().item())
    assert nonzero > 0


def test_v60_runtime_full_closed_loop():
    torch.manual_seed(7)
    c = mobile_v60_config(9)
    c.delay_max_v58 = 3
    c.goal_candidates_v57 = 3
    c.neural_memory_write_threshold_v60 = 0.01
    m = NeuroWeaveV60(c)
    r = OrganismRuntimeV60(m)
    step = r.step(torch.randn(1, 9))
    assert 'v60_neural_memory_read' in step
    result = r.observe_transition(torch.randn(1, 9), actual_reward=0.5, actual_risk=0.1)
    assert result['v60_neural_memory_writes'].item() >= 1.0
    assert result['v60_plastic_update_steps'].item() >= 1.0


def test_v60_state_persistence_roundtrip():
    torch.manual_seed(8)
    c = mobile_v60_config(9)
    c.delay_max_v58 = 3
    c.neural_memory_write_threshold_v60 = 0.01
    m = NeuroWeaveV60(c)
    r = OrganismRuntimeV60(m)
    r.step(torch.randn(1, 9))
    r.observe_transition(torch.randn(1, 9), actual_reward=0.7, actual_risk=0.05)
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / 'state.pt'
        RuntimeStateStoreV60.save(p, m, runtime=r)
        m2 = NeuroWeaveV60(c)
        r2 = OrganismRuntimeV60(m2)
        RuntimeStateStoreV60.load(p, m2, runtime=r2)
        assert int(m2.plastic_field_v60.update_steps.item()) == int(m.plastic_field_v60.update_steps.item())
        assert int(m2.neural_memory_v60.write_count.item()) == int(m.neural_memory_v60.write_count.item())
        assert torch.allclose(m2.plastic_field_v60.effective_weight(), m.plastic_field_v60.effective_weight())


def test_v60_mobile_profile_is_compact():
    c = mobile_v60_config(9)
    m = NeuroWeaveV60(c)
    params = sum(p.numel() for p in m.parameters() if p.requires_grad)
    assert params < 350_000
    assert m.plastic_field_v60.base_weight.numel() == 20 * 54
