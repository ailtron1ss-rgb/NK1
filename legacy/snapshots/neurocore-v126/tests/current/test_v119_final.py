from __future__ import annotations

from dataclasses import replace

import torch

from neurocore.current import (
    CurrentConfig, NeuroCoreCurrent, OrganismTrainerCurrent, TemporalCreditConfig,
    ThreeFactorPlasticityConfig, HiPPOCreditConfig, HiPPOHistory,
    ProductKeyMemoryConfig, ProductKeySparseMemory, long_horizon_fast_credit,
    hippo_credit_probe, sparse_product_key_probe,
)


def test_v119_hippo_is_causal_and_runtime_only():
    torch.manual_seed(1191)
    h = HiPPOHistory(16, HiPPOCreditConfig(enabled=True, order=8, dt=0.1))
    cue = torch.randn(2, 16)
    before = h.read_before_update(batch=2, device=cue.device, dtype=cue.dtype)
    assert torch.allclose(before, torch.zeros_like(before))
    h.update(cue)
    after = h.read_before_update(batch=2, device=cue.device, dtype=cue.dtype)
    assert float(after.abs().sum()) > 0.0
    state_keys = set(h.state_dict().keys())
    assert state_keys == set()


def test_v119_hybrid_credit_is_real_and_finite():
    torch.manual_seed(1192)
    tc = TemporalCreditConfig(enabled=True, mode="hybrid", normalize_trace=False, hippo=HiPPOCreditConfig(enabled=True))
    op = ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.2, modulatory_gate_enabled=False)
    learner = __import__("neurocore.current", fromlist=["ThreeFactorFastWeight"]).ThreeFactorFastWeight(16, 8, op, temporal_credit=tc)
    learner.update(torch.randn(2,16), torch.zeros(2,8), torch.randn(2,8))
    learner.update(torch.randn(2,16), torch.zeros(2,8), torch.randn(2,8))
    assert torch.isfinite(learner.fast_weight).all()
    assert float(learner.last_hippo_norm) > 0.0


def test_v119_product_key_memory_writes_selected_slots():
    torch.manual_seed(1193)
    m = ProductKeySparseMemory(16, ProductKeyMemoryConfig(subkey_size=8, slots_per_subkey=8, topk_per_subkey=2, value_dim=20))
    q = torch.randn(2,16); v = torch.randn(2,20)
    before = m.read(q)
    stats = m.write(q,v)
    after = m.read(q)
    assert stats["written_slots"] > 0
    assert not torch.allclose(before, after)
    assert m.slots == 64


def test_v119_new_probes_are_finite():
    for delay in (16, 64, 128):
        row = hippo_credit_probe(seed=119, delay=delay, order=8)
        assert all(torch.isfinite(torch.tensor(v)) for v in row.values())
    row = sparse_product_key_probe(seed=119)
    assert all(torch.isfinite(torch.tensor(v)) for v in row.values())


def test_v119_temporal_modes_include_hippo_and_hybrid():
    for mode in ("hippo", "hybrid"):
        row = long_horizon_fast_credit(mode=mode, delay=16, seed=119)
        assert all(torch.isfinite(torch.tensor(v)) for v in row.values())


def test_v119_default_trunk_remains_compact_and_stable():
    model = NeuroCoreCurrent().train()
    trainer = OrganismTrainerCurrent(model)
    out = trainer.learning_step(
        torch.randn(2, 8, 9), torch.randn(2, 8, 8),
        target_latent_sequence=torch.randn(2, 7, 20),
    )
    assert out["gradient_coverage"] >= 0.98
    assert sum(p.numel() for p in model.parameters()) < 100_000
