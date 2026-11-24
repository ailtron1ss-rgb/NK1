from __future__ import annotations

from dataclasses import replace
from typing import Iterable

import torch
import torch.nn.functional as F

from .causal_trunk import CausalTrunk, CausalTrunkConfig
from .core import CurrentConfig, NeuroCoreCurrent
from .online_plasticity import ThreeFactorFastWeight, ThreeFactorPlasticityConfig
from .temporal_credit import TemporalCreditConfig


def long_horizon_fast_credit(
    *,
    mode: str,
    delay: int,
    seed: int = 0,
    input_dim: int = 16,
    output_dim: int = 8,
    normalize_trace: bool = False,
) -> dict[str, float]:
    """Matched delayed-association probe for temporal-credit candidates.

    The same initialization/data stream is used for every mode. The metric is deliberately
    multi-dimensional: direction (cosine), magnitude retention, and normalized MSE are reported
    together so a candidate cannot hide amplitude collapse behind a good cosine.
    """
    if delay < 0:
        raise ValueError("delay must be >= 0")
    torch.manual_seed(int(seed))
    plasticity = ThreeFactorPlasticityConfig(
        enabled=True,
        learning_rate=0.25,
        modulatory_gate_enabled=False,
        eligibility_decay=0.70,
    )
    temporal = TemporalCreditConfig(
        enabled=True,
        mode=mode,
        short_decay=0.70,
        long_decay=0.975,
        long_mix=0.65,
        adaptive_switch_steps=8.0,
        adaptive_temperature=2.0,
        normalize_trace=normalize_trace,
        event_bank_capacity=4,
        event_similarity_threshold=0.80,
    )
    learner = ThreeFactorFastWeight(input_dim, output_dim, plasticity, temporal_credit=temporal)
    cue = F.normalize(torch.randn(1, input_dim), dim=-1)
    target = F.normalize(torch.randn(1, output_dim), dim=-1)
    zero_hidden = torch.zeros_like(cue)
    zero_prediction = torch.zeros_like(target)
    learner.update(cue, zero_prediction, zero_prediction)
    for _ in range(delay):
        learner.update(zero_hidden, zero_prediction, zero_prediction)
    learner.update(zero_hidden, zero_prediction, target)
    recovered = learner.apply(cue, zero_prediction)
    target_energy = target.pow(2).mean().item()
    mse = F.mse_loss(recovered, target).item()
    cosine = F.cosine_similarity(recovered, target, dim=-1).item() if recovered.norm() > 0 else 0.0
    amplitude = recovered.norm().item() / max(target.norm().item(), 1e-12)
    return {
        "cosine": float(cosine),
        "relative_mse": float(mse / max(target_energy, 1e-12)),
        "amplitude": float(amplitude),
        "trace_norm": float(learner.last_credit_norm.item()),
        "update_norm": float(learner.last_update_norm.item()),
        "event_active": float(learner.event_active.to(torch.float32).sum().item()),
        "event_rejected": float(learner.last_rejected_credit.item()),
        "normalize_trace": float(normalize_trace),
    }


def multi_event_isolation(*, seed: int = 0, delay: int = 32) -> dict[str, float]:
    """Measure cross-event leakage in shared versus event-specific plasticity state."""
    torch.manual_seed(int(seed))
    cue_a = F.normalize(torch.randn(1, 16), dim=-1)
    cue_b = F.normalize(torch.randn(1, 16), dim=-1)
    target_a = F.normalize(torch.randn(1, 8), dim=-1)
    raw_b = torch.randn(1, 8)
    target_b = F.normalize(raw_b - (raw_b * target_a).sum(dim=-1, keepdim=True) * target_a, dim=-1)
    zero_x, zero_y = torch.zeros_like(cue_a), torch.zeros_like(target_a)

    def run(mode: str, keyed: bool = False) -> tuple[float, float, float]:
        cfg = ThreeFactorPlasticityConfig(enabled=True, learning_rate=0.30, modulatory_gate_enabled=False)
        tc = TemporalCreditConfig(enabled=True, mode=mode, normalize_trace=False, event_bank_capacity=4)
        learner = ThreeFactorFastWeight(16, 8, cfg, temporal_credit=tc)
        learner.update(cue_a, zero_y, zero_y)
        for _ in range(delay):
            learner.update(zero_x, zero_y, zero_y)
        learner.update(zero_x, zero_y, target_a, credit_key=(cue_a if keyed else None))
        learner.update(cue_b, zero_y, zero_y)
        for _ in range(delay):
            learner.update(zero_x, zero_y, zero_y)
        learner.update(zero_x, zero_y, target_b, credit_key=(cue_b if keyed else None))
        a = learner.apply(cue_a, zero_y)
        b = learner.apply(cue_b, zero_y)
        a_target = F.cosine_similarity(a, target_a, dim=-1).item()
        b_target = F.cosine_similarity(b, target_b, dim=-1).item()
        leakage = 0.5 * (
            F.cosine_similarity(a, target_b, dim=-1).abs().item()
            + F.cosine_similarity(b, target_a, dim=-1).abs().item()
        )
        return a_target, b_target, leakage

    shared = run("single")
    bank_unkeyed = run("event_bank", keyed=False)
    bank_keyed = run("event_bank", keyed=True)
    return {
        "shared_a_target_cosine": shared[0],
        "shared_b_target_cosine": shared[1],
        "shared_cross_leak": shared[2],
        "event_bank_unkeyed_a_target_cosine": bank_unkeyed[0],
        "event_bank_unkeyed_b_target_cosine": bank_unkeyed[1],
        "event_bank_unkeyed_cross_leak": bank_unkeyed[2],
        "event_bank_keyed_a_target_cosine": bank_keyed[0],
        "event_bank_keyed_b_target_cosine": bank_keyed[1],
        "event_bank_keyed_cross_leak": bank_keyed[2],
        "keyed_cross_leak_reduction": shared[2] - bank_keyed[2],
    }


def trunk_profile(*, seed: int = 0, seq_len: int = 32, rank: int = 8) -> dict[str, float]:
    """One matched full-trunk coverage/resource probe for a rank setting."""
    torch.manual_seed(int(seed))
    cfg = CurrentConfig.mobile(9)
    cfg = replace(cfg, trunk=replace(cfg.trunk, spine_rank=int(rank)))
    model = NeuroCoreCurrent(cfg)
    x = torch.randn(1, seq_len, 9)
    g = torch.randn(1, seq_len, 8)
    target = F.normalize(torch.randn(1, seq_len - 1, 20), dim=-1)
    out = model.forward_learning(x, g, target_latent_sequence=target)
    out["loss"].backward()
    trainable = [p for p in model.parameters() if p.requires_grad]
    used = [p for p in trainable if p.grad is not None and torch.isfinite(p.grad).all() and p.grad.detach().abs().sum() > 0]
    named = dict(model.named_parameters())
    return {
        "total_parameters": float(sum(p.numel() for p in model.parameters())),
        "trainable_parameters": float(sum(p.numel() for p in trainable)),
        "gradient_parameter_coverage": float(len(used) / max(1, len(trainable))),
        "gradient_element_coverage": float(sum(p.grad.numel() for p in used) / max(1, sum(p.numel() for p in trainable))),
        "named_parameter_count": float(len(named)),
        "loss": float(out["loss"].detach().item()),
        "seq_len": float(seq_len),
        "rank": float(rank),
    }


def surprise_write_probe(*, seed: int = 0) -> dict[str, float]:
    """Check that the optional novelty write gate changes write magnitude without adding parameters."""
    torch.manual_seed(int(seed))
    def run(strength: float, volatile_scale: float) -> float:
        cfg = CausalTrunkConfig(surprise_write_strength=strength)
        trunk = CausalTrunk(cfg)
        trunk.spine.collect_diagnostics = True
        state = trunk.reset_state(1, torch.device("cpu"), torch.float32)
        prev = torch.zeros(1, cfg.latent_dim)
        obs = torch.randn(1, cfg.raw_observation_dim) * volatile_scale
        goal = torch.randn(1, cfg.goal_dim)
        features = trunk.encoder(torch.cat([obs, goal, prev], dim=-1))
        out = trunk.spine.step(features, state, force_deep=True)
        return float(out["write"].mean().item())
    return {
        "baseline_low": run(0.0, 0.10),
        "candidate_low": run(0.75, 0.10),
        "baseline_high": run(0.0, 3.0),
        "candidate_high": run(0.75, 3.0),
    }


def hippo_credit_probe(*, seed: int = 0, delay: int = 32, order: int = 8) -> dict[str, float]:
    """Causal HiPPO probe: the cue is written before the teaching signal, never retroactively."""
    torch.manual_seed(int(seed))
    from .hippo_credit import HiPPOCreditConfig, HiPPOHistory
    history = HiPPOHistory(16, HiPPOCreditConfig(enabled=True, order=order, dt=0.10, normalize=True))
    cue = torch.randn(1, 16)
    before = history.read_before_update(batch=1, device=cue.device, dtype=cue.dtype)
    history.update(cue)
    for _ in range(delay):
        history.update(torch.zeros_like(cue))
    reconstructed = history.read_before_update(batch=1, device=cue.device, dtype=cue.dtype)
    cosine = F.cosine_similarity(reconstructed, cue, dim=-1).item()
    return {
        "initial_norm": float(before.norm().item()),
        "reconstructed_norm": float(reconstructed.norm().item()),
        "cosine": float(cosine),
        "state_norm": history.state_norm(),
        "delay": float(delay),
        "order": float(order),
    }

def sparse_delta_memory_probe(*, seed: int = 0) -> dict[str, float]:
    torch.manual_seed(int(seed))
    from .sparse_memory import ProductKeyMemoryConfig, ProductKeySparseDeltaMemory
    cfg = ProductKeyMemoryConfig(subkey_size=8, slots_per_subkey=8, topk_per_subkey=2, value_dim=20)
    memory = ProductKeySparseDeltaMemory(16, cfg)
    key = torch.randn(2, 16); value = torch.randn(2, 20)
    before = memory.read(key); stats = memory.write(key, value); after = memory.read(key)
    return {"written_slots": float(stats["written_slots"]), "read_delta": float((after-before).norm().item()), "mean_delta_gain": float(stats["mean_delta_gain"]), "slot_capacity": float(memory.slots)}


def sparse_product_key_probe(*, seed: int = 0) -> dict[str, float]:
    """Reference probe for real product-key routing and bounded sparse write."""
    torch.manual_seed(int(seed))
    from .sparse_memory import ProductKeyMemoryConfig, ProductKeySparseMemory
    memory = ProductKeySparseMemory(16, ProductKeyMemoryConfig(subkey_size=8, slots_per_subkey=8, topk_per_subkey=2, value_dim=20))
    key = torch.randn(1, 16)
    value = torch.randn(1, 20)
    before = memory.read(key)
    stats = memory.write(key, value)
    after = memory.read(key)
    return {
        "written_slots": float(stats["written_slots"]),
        "read_delta": float((after - before).norm().item()),
        "slot_capacity": float(memory.slots),
    }



def sparse_memory_collision_probe(*, seed: int = 3, fingerprint_score_gain: float = 0.60) -> dict[str, float]:
    """Matched collision probe: two keys intentionally share part of their product route.

    The fingerprint candidate is parameter-free: it stores a compact slice of the already computed
    key. The test compares the same memory weights with and without fingerprint scoring.
    """
    torch.manual_seed(int(seed))
    from .unified_sparse_memory import UnifiedSparseAssociativeMemory, UnifiedSparseMemoryConfig

    common = dict(enabled=True, slots_per_subkey=8, topk_per_subkey=2, value_dim=8, decay=0.9999, write_rate=0.65)
    plain = UnifiedSparseAssociativeMemory(16, UnifiedSparseMemoryConfig(**common, fingerprint_dim=0, fingerprint_score_gain=fingerprint_score_gain)).eval()
    plain_state_dict = {k: v.detach().clone() for k, v in plain.state_dict().items()}
    fingerprinted = UnifiedSparseAssociativeMemory(16, UnifiedSparseMemoryConfig(**common, fingerprint_dim=4, fingerprint_score_gain=fingerprint_score_gain)).eval()
    with torch.no_grad():
        for k, v in plain_state_dict.items():
            if k in fingerprinted.state_dict() and fingerprinted.state_dict()[k].shape == v.shape:
                fingerprinted.state_dict()[k].copy_(v)
        eye = torch.eye(16, dtype=plain.key_proj.weight.dtype, device=plain.key_proj.weight.device)
        for memory in (plain, fingerprinted):
            memory.key_proj.weight.copy_(eye)
            memory.key_proj.bias.zero_()

    sa = F.normalize(plain.subkeys_a, dim=-1)
    sb = F.normalize(plain.subkeys_b, dim=-1)
    h_a = torch.cat([sa[0] + 1.0 * sa[1], sb[0] + 0.05 * sb[1]], dim=-1).unsqueeze(0)
    h_b = torch.cat([sa[0] + 1.0 * sa[2], sb[0] + 0.05 * sb[1]], dim=-1).unsqueeze(0)
    route_a = plain._route(h_a)[0][0].tolist()
    route_b = plain._route(h_b)[0][0].tolist()
    overlap = len(set(route_a).intersection(route_b))
    va = torch.tanh(plain.value_proj(h_a)).detach()
    vb = torch.tanh(plain.value_proj(h_b)).detach()

    rows = []
    for memory in (plain, fingerprinted):
        state = memory.initial_state(1, torch.device("cpu"), torch.float32)
        state = memory.step(h_a, state)["state"].detach()
        state = memory.step(h_b, state)["state"].detach()
        ra = memory.read_only(h_a, state)["read"]
        rb = memory.read_only(h_b, state)["read"]
        own = 0.5 * (F.cosine_similarity(ra, va, dim=-1).item() + F.cosine_similarity(rb, vb, dim=-1).item())
        cross = 0.5 * (abs(F.cosine_similarity(ra, vb, dim=-1).item()) + abs(F.cosine_similarity(rb, va, dim=-1).item()))
        rows.append((own, cross))

    base_own, base_cross = rows[0]
    fp_own, fp_cross = rows[1]
    if overlap < 1:
        raise AssertionError("collision probe failed to construct a shared route")
    return {
        "route_overlap": float(overlap),
        "baseline_mean_target_cosine": float(base_own),
        "fingerprint_mean_target_cosine": float(fp_own),
        "baseline_cross_leak": float(base_cross),
        "fingerprint_cross_leak": float(fp_cross),
        "target_cosine_gain": float(fp_own - base_own),
        "cross_leak_reduction": float(base_cross - fp_cross),
        "fingerprint_score_gain": float(fingerprint_score_gain),
    }

def unified_sparse_memory_probe(*, seed: int = 0, delay: int = 128, distractors: int = 32, slots_per_subkey: int = 32, decay: float = 0.9999) -> dict[str, float]:
    """Direct capacity/retention probe for the V123 sparse state candidate.

    A cue/value pair is written, unrelated cues are streamed, then the original cue is queried.
    The metric reports both direction and amplitude so a tiny near-zero vector cannot score well by
    cosine alone. State lives entirely in the passed recurrent tensor.
    """
    torch.manual_seed(int(seed))
    from .unified_sparse_memory import UnifiedSparseAssociativeMemory, UnifiedSparseMemoryConfig
    cfg = UnifiedSparseMemoryConfig(enabled=True, subkey_dim=8, slots_per_subkey=slots_per_subkey, topk_per_subkey=2, value_dim=8, decay=decay)
    memory = UnifiedSparseAssociativeMemory(hidden=32, cfg=cfg).eval()
    state = memory.initial_state(1, torch.device("cpu"), torch.float32)
    cue_h = torch.randn(1, 32)
    cue_key = memory.key_proj(cue_h).detach()
    cue_value = torch.tanh(memory.value_proj(cue_h)).detach()
    first = memory.step(cue_h, state)
    state = first["state"].detach()
    for _ in range(int(distractors)):
        state = memory.step(torch.randn(1, 32), state)["state"].detach()
    for _ in range(max(0, int(delay) - int(distractors))):
        state = memory.step(torch.randn(1, 32), state)["state"].detach()
    # Query through the canonical production read path without writing a new item.
    read_state = memory.read_only(cue_h, state)
    values, strength, last_time, fingerprints, clock = memory._split_state_with_fingerprint(state)
    recovered = read_state["read"]
    valid = read_state["valid"]
    target_energy = cue_value.pow(2).mean().item()
    mse = F.mse_loss(recovered, cue_value).item()
    return {
        "cosine": float(F.cosine_similarity(recovered, cue_value, dim=-1).item()),
        "amplitude": float(recovered.norm().item() / max(cue_value.norm().item(), 1e-12)),
        "relative_mse": float(mse / max(target_energy, 1e-12)),
        "active_slots": float((strength > cfg.min_strength).sum().item()),
        "valid_selected_fraction": float(valid.to(torch.float32).mean().item()),
        "write_gain": float(first["write_gain"].item()),
        "delay": float(delay),
        "distractors": float(distractors),
        "slots_per_subkey": float(slots_per_subkey),
        "decay": float(decay),
    }


def unified_sparse_memory_isolation_probe(*, seed: int = 0, delay: int = 128, slots_per_subkey: int = 32, decay: float = 0.9999) -> dict[str, float]:
    """Two-event interference probe for the sparse state candidate."""
    torch.manual_seed(int(seed))
    from .unified_sparse_memory import UnifiedSparseAssociativeMemory, UnifiedSparseMemoryConfig
    cfg = UnifiedSparseMemoryConfig(enabled=True, subkey_dim=8, slots_per_subkey=slots_per_subkey, topk_per_subkey=2, value_dim=8, decay=decay)
    memory = UnifiedSparseAssociativeMemory(hidden=32, cfg=cfg).eval()
    state = memory.initial_state(1, torch.device("cpu"), torch.float32)
    h_a = torch.randn(1, 32)
    h_b = torch.randn(1, 32)
    # Force disjoint routing and approximately orthogonal stored values so cross-leak is not merely
    # the natural cosine of two random 8-D targets.
    va = torch.tanh(memory.value_proj(h_a)).detach()
    for _ in range(128):
        h_b = torch.randn(1, 32)
        sa = memory._route(memory.key_proj(h_a))[0][0]
        sb = memory._route(memory.key_proj(h_b))[0][0]
        vb = torch.tanh(memory.value_proj(h_b)).detach()
        value_cos = abs(F.cosine_similarity(va, vb, dim=-1).item())
        route_overlap = len(set(sa.tolist()).intersection(set(sb.tolist())))
        if route_overlap == 0 and value_cos < 0.10:
            break
    state = memory.step(h_a, state)["state"].detach()
    state = memory.step(h_b, state)["state"].detach()
    for _ in range(int(delay)):
        state = memory.step(torch.randn(1, 32), state)["state"].detach()
    def read_for(h, target):
        read_state = memory.read_only(h, state)
        recovered = read_state["read"]
        own = F.cosine_similarity(recovered, target, dim=-1).item()
        return recovered, own
    ra, ca = read_for(h_a, va); rb, cb = read_for(h_b, vb)
    cross = 0.5 * (abs(F.cosine_similarity(ra, vb, dim=-1).item()) + abs(F.cosine_similarity(rb, va, dim=-1).item()))
    return {
        "a_target_cosine": float(ca),
        "b_target_cosine": float(cb),
        "cross_leak": float(cross),
        "mean_target_cosine": float(0.5 * (ca + cb)),
        "delay": float(delay),
        "slots_per_subkey": float(slots_per_subkey),
        "decay": float(decay),
    }
