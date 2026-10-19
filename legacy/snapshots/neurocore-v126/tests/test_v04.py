import torch

from neurocore import AssociativeKeyValueMemory, NeuroCoreModel, LowRankAdapter


def test_gated_delta_state_is_stateful():
    torch.manual_seed(2)
    m = NeuroCoreModel(d_model=10, state_size=16, n_experts=2, top_k=1, memory_capacity=8).eval()
    x = torch.randn(1, 3, 10)
    o1, h1 = m.forward_sequence(x)
    o2, h2 = m.forward_sequence(x, state=h1)
    assert not torch.allclose(o1.latent[:, -1], o2.latent[:, -1])
    assert torch.isfinite(h2).all()


def test_associative_memory_single_write():
    torch.manual_seed(3)
    m = AssociativeKeyValueMemory(6, 5, capacity=8).eval()
    k, v = torch.randn(1, 6), torch.randn(1, 5)
    m.write(k, v)
    got = m.retrieve(k)
    expected = m.value_proj(v)
    assert torch.allclose(got, expected, atol=1e-5)


def test_adapter_identity_then_nonidentity_after_update():
    torch.manual_seed(4)
    a = LowRankAdapter(8, rank=2)
    x = torch.randn(5, 8)
    assert torch.allclose(a(x), x)
    opt = torch.optim.SGD(a.parameters(), lr=0.5)
    target = torch.zeros_like(x)
    loss = ((a(x) - target) ** 2).mean()
    loss.backward(); opt.step()
    assert not torch.allclose(a(x), x)
