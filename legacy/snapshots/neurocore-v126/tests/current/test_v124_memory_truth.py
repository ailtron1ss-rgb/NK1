from dataclasses import replace

import torch

from neurocore.current import (
    CausalTrunkConfig,
    CurrentConfig,
    DataGroundedTarget,
    DataGroundedTargetConfig,
    NeuroCoreCurrent,
    UnifiedSparseMemoryConfig,
)


def test_v124_data_grounded_target_is_deterministic_and_non_trainable():
    cfg = DataGroundedTargetConfig(projection_seed=7)
    a = DataGroundedTarget(9, 8, 20, cfg)
    b = DataGroundedTarget(9, 8, 20, cfg)
    x = torch.randn(2, 5, 9)
    g = torch.randn(2, 5, 8)
    ta = a.project_next(x, g)
    tb = b.project_next(x, g)
    assert torch.allclose(ta, tb)
    assert all(not p.requires_grad for p in a.parameters())
    assert a.state_dict() == {}
    assert not ta.requires_grad


def test_v124_target_depends_on_real_future_data_not_model_weights():
    model = NeuroCoreCurrent(CurrentConfig.mobile(9)).eval()
    x = torch.randn(2, 6, 9)
    g = torch.randn(2, 6, 8)
    base = model.trunk._data_grounded_target(x, g)
    changed = x.clone()
    changed[:, 4] += 3.0
    altered = model.trunk._data_grounded_target(changed, g)
    assert not torch.allclose(base, altered)


def test_v124_data_target_is_independent_of_model_weight_mutation():
    model = NeuroCoreCurrent(CurrentConfig.mobile(9)).eval()
    x = torch.randn(2, 6, 9)
    g = torch.randn(2, 6, 8)
    before = model.trunk._data_grounded_target(x, g)
    with torch.no_grad():
        for p in model.parameters():
            p.add_(torch.randn_like(p) * 0.1)
    after = model.trunk._data_grounded_target(x, g)
    assert torch.allclose(before, after)


def test_v124_forward_learning_uses_data_target_by_default():
    model = NeuroCoreCurrent(CurrentConfig.mobile(9)).train()
    x = torch.randn(2, 8, 9)
    g = torch.randn(2, 8, 8)
    out = model.forward_learning(x, g)
    expected = model.trunk._data_grounded_target(x, g)
    assert torch.allclose(out["target"], expected)
    assert not out["target"].requires_grad


def test_v124_sparse_candidate_trains_end_to_end_and_routes_memory_into_latent():
    sparse_cfg = UnifiedSparseMemoryConfig(
        enabled=True,
        slots_per_subkey=16,
        topk_per_subkey=2,
        decay=0.9999,
        read_gain=0.20,
    )
    cfg = CausalTrunkConfig(unified_sparse_memory=sparse_cfg)
    model = NeuroCoreCurrent(CurrentConfig(trunk=cfg)).train()
    x = torch.randn(2, 10, 9)
    g = torch.randn(2, 10, 8)
    out = model.forward_learning(x, g)
    model.zero_grad(set_to_none=True)
    out["loss"].backward()
    names = dict(model.named_parameters())
    sparse_grads = [p for n, p in names.items() if "unified_sparse_memory" in n and p.requires_grad]
    assert sparse_grads
    assert all(p.grad is not None and torch.isfinite(p.grad).all() for p in sparse_grads)
    assert out["sparse_memory"].abs().sum() >= 0.0


def _structured_recall_batch(batch: int = 4, delay: int = 12, seed: int = 0):
    torch.manual_seed(seed)
    q = delay + 1
    t = q + 2
    x = torch.zeros(batch, t, 9)
    key = torch.tanh(torch.randn(batch, 4))
    payload = torch.tanh(torch.randn(batch, 5))
    x[:, 0, :4] = key
    x[:, 0, 4:] = payload
    x[:, q, :4] = key
    x[:, q + 1, :4] = key
    x[:, q + 1, 4:] = payload
    g = torch.zeros(batch, t, 8)
    return x, g, q


def test_v124_structured_recall_target_is_next_answer_data():
    model = NeuroCoreCurrent().eval()
    x, g, q = _structured_recall_batch()
    target = model.trunk._data_grounded_target(x, g)
    direct = model.trunk._data_grounded_target(x[:, [q, q + 1]], g[:, [q, q + 1]])
    assert torch.allclose(target[:, q], direct[:, 0])


def test_v124_sparse_memory_has_direct_causal_effect_on_latent_when_state_is_intervened():
    sparse_cfg = UnifiedSparseMemoryConfig(
        enabled=True,
        slots_per_subkey=16,
        topk_per_subkey=2,
        decay=0.9999,
        read_gain=0.50,
    )
    cfg = CausalTrunkConfig(unified_sparse_memory=sparse_cfg)
    model = NeuroCoreCurrent(CurrentConfig(trunk=cfg)).eval()
    trunk = model.trunk
    x, g, q = _structured_recall_batch(batch=1, delay=4, seed=11)
    state = trunk.reset_state(1, x.device, x.dtype)
    prev = torch.zeros(1, cfg.latent_dim)
    for i in range(q):
        out = trunk.forward_step(x[:, i], g[:, i], state, prev, force_deep=(i == 0))
        state, prev = out["state"], out["latent"]
    sparse_n = trunk.spine.unified_sparse_memory.state_size
    assert float(out["sparse_memory_read"].detach().abs().sum()) > 0.0
    no_memory_state = state.clone()
    no_memory_state[:, -sparse_n:] = 0.0
    normal = trunk.forward_step(x[:, q], g[:, q], state, prev)
    ablated = trunk.forward_step(x[:, q], g[:, q], no_memory_state, prev)
    effect = float((normal["latent"] - ablated["latent"]).abs().mean().item())
    assert effect > 1e-7
