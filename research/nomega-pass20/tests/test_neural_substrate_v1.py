import json
import torch

from core.nomega.neural_substrate_v1 import ModernNeuralSubstrateV1


def test_ei_substrate_forward_and_metrics():
    s = ModernNeuralSubstrateV1(8, exc_neurons=12, inh_neurons=4, branches=3, seed=7)
    x = torch.randn(5, 8)
    y = s(x)
    assert y["spikes"].shape == (5, 16)
    m = s.metrics().to_dict()
    assert 0.0 <= m["active_synapse_fraction"] <= 1.0
    assert m["exc_rate"] >= 0.0 and m["inh_rate"] >= 0.0


def test_vectorized_teaching_and_local_plasticity_changes_state():
    s = ModernNeuralSubstrateV1(6, exc_neurons=10, inh_neurons=4, branches=2, seed=5)
    s.eligibility.fill_(0.1)
    s.pre_trace.fill_(0.2)
    s.last_spikes.fill_(1.0)
    apical_error = torch.ones(14) * 0.2
    before = s.recurrent.detach().clone()
    s.apply_local_plasticity(torch.tensor(1.0), apical_error, torch.ones(14))
    after = s.recurrent.detach().clone()
    assert torch.isfinite(after).all()
    assert not torch.allclose(before, after)


def test_fast_slow_consolidation_and_structural_plasticity_are_bounded():
    s = ModernNeuralSubstrateV1(5, exc_neurons=8, inh_neurons=4, branches=2, seed=3, structural_interval=2)
    x = torch.randn(6, 5)
    s(x, reward=torch.ones(6), local_plasticity=True, structural_plasticity=True)
    before = s.fast_weight.abs().mean().item()
    s.consolidate(0.4)
    after = s.fast_weight.abs().mean().item()
    assert after <= before + 1e-6
    assert torch.isfinite(s.recurrent).all()


def test_deterministic_initial_signature():
    a = ModernNeuralSubstrateV1(4, 8, 4, seed=11)
    b = ModernNeuralSubstrateV1(4, 8, 4, seed=11)
    assert a.substrate_signature() == b.substrate_signature()


def test_inhibitory_recurrent_weights_survive_local_plasticity():
    s = ModernNeuralSubstrateV1(6, exc_neurons=6, inh_neurons=4, branches=2, seed=17)
    x = torch.randn(12, 6)
    before = s.recurrent[:, s.exc_neurons:].detach().clone()
    s(x, teaching=torch.randn(12, 10) * 0.2, reward=torch.ones(12), local_plasticity=True)
    after = s.recurrent[:, s.exc_neurons:].detach()
    assert torch.any(before > 0)
    assert torch.any(after > 0)
    assert torch.all(after >= 0)


def test_surrogate_spike_path_has_nonzero_gradient():
    s = ModernNeuralSubstrateV1(4, exc_neurons=6, inh_neurons=2, seed=19)
    x = torch.randn(7, 4, requires_grad=True)
    out = s(x)["pooled"].sum()
    out.backward()
    grads = [p.grad for p in s.parameters() if p.requires_grad and p.grad is not None]
    assert grads
    assert any(torch.isfinite(g).all() and g.abs().sum().item() > 0 for g in grads)
