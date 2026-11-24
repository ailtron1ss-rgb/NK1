from dataclasses import replace

import torch

from neurocore.current import (
    AdaptiveComputeConfig,
    CausalTrunk,
    CausalTrunkConfig,
    HiPPOCreditConfig,
    NeuroCoreCurrent,
    TemporalCreditConfig,
    ThreeFactorFastWeight,
    ThreeFactorPlasticityConfig,
    choose_deep,
)


def test_v121_adaptive_mask_respects_fraction_bounds():
    difficulty = torch.tensor([0.01, 0.20, 0.40, 0.60, 0.80, 0.90, 0.95, 0.99])
    cfg = AdaptiveComputeConfig(enabled=True, shallow_threshold=0.90, minimum_deep_fraction=0.25, maximum_deep_fraction=0.50)
    mask = choose_deep(difficulty, cfg=cfg)
    assert 2 <= int(mask.sum()) <= 4
    assert mask[-1] and mask[-2] and mask[-3]
    cfg2 = replace(cfg, shallow_threshold=0.10)
    mask2 = choose_deep(difficulty, cfg=cfg2)
    assert int(mask2.sum()) == 4


def test_v121_adaptive_executor_only_sees_selected_rows():
    torch.manual_seed(1211)
    cfg = AdaptiveComputeConfig(enabled=True, shallow_threshold=1.0, minimum_deep_fraction=0.25, maximum_deep_fraction=0.50, force_first_deep=False)
    trunk = CausalTrunk(CausalTrunkConfig(adaptive_compute=cfg)).eval()
    seen = []
    handle = trunk.spine.state_to_hidden[2].register_forward_hook(lambda module, inputs, output: seen.append(int(inputs[0].size(0))))
    try:
        state = trunk.reset_state(8, torch.device("cpu"), torch.float32)
        features = torch.randn(8, trunk.cfg.feature_dim)
        trunk.spine.step(features, state, force_deep=False)
    finally:
        handle.remove()
    assert seen and seen[-1] == 2


def test_v121_event_bank_stores_explicit_routing_key():
    tc = TemporalCreditConfig(enabled=True, mode="event_bank", event_bank_capacity=2)
    op = ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.2, modulatory_gate_enabled=False)
    learner = ThreeFactorFastWeight(8, 4, op, temporal_credit=tc)
    hidden = torch.randn(1, 8)
    key = -hidden
    prediction = torch.zeros(1, 4)
    target = torch.ones(1, 4)
    learner.update(hidden, prediction, target, credit_key=key)
    active = torch.nonzero(learner.event_active, as_tuple=False).flatten()
    assert active.numel() == 1
    slot = int(active[0])
    assert torch.allclose(learner.event_keys[slot], key, atol=1e-6)
    recovered = learner.apply(hidden, prediction, query_key=key)
    assert torch.isfinite(recovered).all()


def test_v121_mamba3_activation_mode_is_real_and_finite():
    from neurocore.current import CurrentConfig
    base = NeuroCoreCurrent(CurrentConfig(trunk=CausalTrunkConfig(state_activation_mode="silu_tanh")))
    cand = NeuroCoreCurrent(CurrentConfig(trunk=CausalTrunkConfig(state_activation_mode="mamba3_heavy_tail")))
    x = torch.randn(1, 4, 9); g = torch.randn(1, 4, 8)
    a = base(x, g)["latent"]; b = cand(x, g)["latent"]
    assert torch.isfinite(a).all() and torch.isfinite(b).all()
    assert not torch.allclose(a, b)


def test_v121_token_decay_candidate_changes_runtime_and_adds_only_expected_parameters():
    base = CausalTrunkConfig()
    cand = replace(base, token_decay_enabled=True, token_decay_strength=1.0)
    from neurocore.current import CurrentConfig
    a = NeuroCoreCurrent(CurrentConfig(trunk=base))
    b = NeuroCoreCurrent(CurrentConfig(trunk=cand))
    delta = sum(p.numel() for p in b.parameters()) - sum(p.numel() for p in a.parameters())
    assert delta == 520
    x = torch.randn(1, 3, 9); g = torch.randn(1, 3, 8)
    out = b.trunk.spine.step(b.trunk.encoder(torch.cat([x[:,0], g[:,0], torch.zeros(1,20)], dim=-1)), b.trunk.reset_state(1, torch.device("cpu"), torch.float32))
    assert torch.isfinite(out["decay"]).all() and float(out["decay"].detach().min()) >= 0.80 and float(out["decay"].detach().max()) <= 0.9999


def test_v121_token_decay_candidate_checkpoint_roundtrip():
    from neurocore.current import CurrentConfig, NeuroCoreCurrent
    import tempfile
    cand = CausalTrunkConfig(token_decay_enabled=True)
    model = NeuroCoreCurrent(CurrentConfig(trunk=cand))
    with tempfile.NamedTemporaryFile(suffix=".pt") as tmp:
        torch.save(model.state_dict(), tmp.name)
        restored = NeuroCoreCurrent(CurrentConfig(trunk=cand))
        result = restored.load_state_dict(torch.load(tmp.name, map_location="cpu"), strict=True)
    assert result.missing_keys == [] and result.unexpected_keys == []


def test_v122_unified_sparse_memory_candidate_state_is_real_and_gradients_are_connected():
    from neurocore.current import CurrentConfig, UnifiedSparseMemoryConfig, NeuroCoreCurrent
    cfg = CurrentConfig(trunk=CausalTrunkConfig(unified_sparse_memory=UnifiedSparseMemoryConfig(enabled=True)))
    model = NeuroCoreCurrent(cfg).train()
    state = model.trunk.reset_state(2, torch.device("cpu"), torch.float32)
    assert state.shape == (2, model.trunk.spine.state_size)
    assert model.trunk.spine.state_size > model.trunk.cfg.spine_rank * model.trunk.cfg.spine_rank
    out = model.forward_learning(torch.randn(2, 8, 9), torch.randn(2, 8, 8), target_latent_sequence=torch.randn(2, 7, 20))
    out["loss"].backward()
    trainable = [p for p in model.parameters() if p.requires_grad]
    assert all(p.grad is not None and torch.isfinite(p.grad).all() for p in trainable)


def test_v122_unified_sparse_memory_rejects_duplicate_canonical_memory_owner():
    import pytest
    from neurocore.current import CausalTrunkConfig, ProductKeyMemoryConfig, UnifiedSparseMemoryConfig
    with pytest.raises(ValueError):
        CausalTrunkConfig(
            product_key_memory=ProductKeyMemoryConfig(enabled=True),
            unified_sparse_memory=UnifiedSparseMemoryConfig(enabled=True),
        )


def test_v122_unified_sparse_memory_accepts_v121_dense_runtime_state():
    from neurocore.current import CausalTrunkConfig, UnifiedSparseMemoryConfig, CausalTrunk
    cfg = CausalTrunkConfig(unified_sparse_memory=UnifiedSparseMemoryConfig(enabled=True))
    trunk = CausalTrunk(cfg)
    legacy_state = torch.zeros(1, cfg.spine_rank * cfg.spine_rank)
    out = trunk.spine.step(torch.randn(1, cfg.feature_dim), legacy_state, force_deep=True)
    assert out["state"].shape[-1] == trunk.spine.state_size


def test_v122_unified_sparse_memory_delayed_recall_probe_is_not_cosine_only():
    from neurocore.current import unified_sparse_memory_probe
    row = unified_sparse_memory_probe(seed=0, delay=128, distractors=128)
    assert row["cosine"] > 0.95
    assert row["amplitude"] > 0.50
    assert row["relative_mse"] < 0.20


def test_v122_lazy_memory_does_not_sweep_unrouted_slots():
    from neurocore.current import UnifiedSparseAssociativeMemory, UnifiedSparseMemoryConfig
    torch.manual_seed(2201)
    mem = UnifiedSparseAssociativeMemory(32, UnifiedSparseMemoryConfig(enabled=True, slots_per_subkey=16, value_dim=8))
    state = mem.initial_state(1, torch.device("cpu"), torch.float32)
    h0 = torch.randn(1, 32)
    out0 = mem.step(h0, state)
    state = out0["state"].detach()
    touched = set(out0["slot_indices"][0].tolist())
    untouched = next(i for i in range(mem.slot_count) if i not in touched)
    values0, strength0, last0, clock0 = mem._split_state(state)
    untouched_value = values0[:, untouched].clone()
    untouched_strength = strength0[:, untouched].clone()
    untouched_time = last0[:, untouched].clone()
    target_h = None
    for _ in range(256):
        cand = torch.randn(1, 32)
        if not touched.intersection(set(mem._route(mem.key_proj(cand))[0][0].tolist())):
            target_h = cand
            break
    assert target_h is not None
    for _ in range(6):
        state = mem.step(target_h, state)["state"].detach()
    values1, strength1, last1, clock1 = mem._split_state(state)
    assert torch.allclose(values1[:, untouched], untouched_value)
    assert torch.allclose(strength1[:, untouched], untouched_strength)
    assert torch.allclose(last1[:, untouched], untouched_time)
    assert float(clock1.item()) == float(clock0.item()) + 6.0
