import torch
from neurocore import NeuroCoreModel, NeuroCoreRuntime
from neurocore.core import NeuroCore, NeuroState, ComputeBudget


def test_trainable_forward_shapes():
    m = NeuroCoreModel(d_model=16, state_size=24, n_experts=4, top_k=2, memory_capacity=16)
    out = m(torch.randn(2, 5, 16))
    assert out.latent.shape == (2, 5, 16)
    assert out.predicted_next.shape == (2, 5, 16)
    assert out.route_logits.shape == (2, 5, 3)


def test_gradient_reaches_core():
    m = NeuroCoreModel(d_model=12, state_size=16, n_experts=2, top_k=1, memory_capacity=8)
    x = torch.randn(2, 4, 12)
    out = m(x)
    target = torch.randn_like(out.predicted_next)
    loss = (out.predicted_next - target).pow(2).mean() + 0.01 * out.latent.pow(2).mean()
    loss.backward()
    grads = [p.grad for p in m.parameters() if p.requires_grad]
    assert any(g is not None and torch.isfinite(g).all() and g.abs().sum() > 0 for g in grads)


def test_runtime_continuity():
    m = NeuroCoreModel(d_model=8, state_size=12, n_experts=2, top_k=1, memory_capacity=8)
    rt = NeuroCoreRuntime(m)
    a = rt.step(torch.zeros(8))
    b = rt.step(torch.ones(8))
    assert a["step"] == 1
    assert b["step"] == 2
    assert a["status"] == "NEURAL_PROTOTYPE"


def test_compatibility_api():
    core = NeuroCore(d_model=8, state_size=12, n_experts=2, top_k=1)
    state = NeuroState(latent=[0.0] * 8)
    out = core.step([0.0] * 8, state, ComputeBudget(max_ms=50))
    assert out.route in {"fast", "adaptive", "deep"}
    assert state.step == 1
    assert 0.0 <= out.confidence <= 1.0
