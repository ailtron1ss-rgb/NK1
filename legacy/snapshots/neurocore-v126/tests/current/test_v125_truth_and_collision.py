import torch
import torch.nn.functional as F
import pytest

from neurocore.current import (
    CausalTrunkConfig,
    UnifiedSparseAssociativeMemory,
    UnifiedSparseMemoryConfig,
    sparse_memory_collision_probe,
)


def test_v125_sparse_state_split_remains_backward_compatible():
    mem = UnifiedSparseAssociativeMemory(32, UnifiedSparseMemoryConfig(enabled=True, slots_per_subkey=8, value_dim=8))
    state = mem.initial_state(2, torch.device("cpu"), torch.float32)
    values, strength, last_time, clock = mem._split_state(state)
    assert values.shape == (2, 64, 8)
    assert strength.shape == (2, 64)
    assert last_time.shape == (2, 64)
    assert clock.shape == (2, 1)


def test_v125_read_only_is_non_mutating_and_uses_same_read_contract():
    mem = UnifiedSparseAssociativeMemory(32, UnifiedSparseMemoryConfig(enabled=True, slots_per_subkey=8, value_dim=8))
    state = mem.initial_state(1, torch.device("cpu"), torch.float32)
    h = torch.randn(1, 32)
    state1 = mem.step(h, state)["state"].detach()
    before = state1.clone()
    out_a = mem.read_only(h, state1)
    out_b = mem.read_only(h, state1)
    assert torch.equal(state1, before)
    assert torch.allclose(out_a["read"], out_b["read"])
    assert torch.equal(out_a["slot_indices"], out_b["slot_indices"])


def test_v125_collision_fingerprint_has_real_measured_effect():
    row = sparse_memory_collision_probe(seed=3, fingerprint_score_gain=0.60)
    assert row["route_overlap"] >= 1.0
    assert row["target_cosine_gain"] > 0.005
    assert row["cross_leak_reduction"] > 0.01


def test_v125_fingerprint_zero_gain_is_rejected_when_enabled():
    with pytest.raises(ValueError):
        UnifiedSparseMemoryConfig(enabled=True, fingerprint_dim=4, fingerprint_score_gain=0.0)


def test_v125_disabled_sparse_memory_has_zero_state_and_no_fp_runtime():
    mem = UnifiedSparseAssociativeMemory(32, UnifiedSparseMemoryConfig(enabled=False, fingerprint_dim=4))
    state = mem.initial_state(1, torch.device("cpu"), torch.float32)
    out = mem.step(torch.randn(1, 32), state)
    assert state.shape[-1] == 0
    assert out["state"].shape[-1] == 0
