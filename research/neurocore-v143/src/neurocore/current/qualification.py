from __future__ import annotations

from dataclasses import replace
from typing import Iterable

import torch
import torch.nn.functional as F

from importlib import import_module


def _load_research_module(name: str):
    root = __package__.rsplit(".", 1)[0]
    return import_module(f"{root}.research.{name}")

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
    from importlib import import_module
    ref = import_module(f"{__package__.rsplit('.', 1)[0]}.research.product_key_sparse_memory_reference")
    ProductKeyMemoryConfig, ProductKeySparseDeltaMemory = ref.ProductKeyMemoryConfig, ref.ProductKeySparseDeltaMemory
    cfg = ProductKeyMemoryConfig(subkey_size=8, slots_per_subkey=8, topk_per_subkey=2, value_dim=20)
    memory = ProductKeySparseDeltaMemory(16, cfg)
    key = torch.randn(2, 16); value = torch.randn(2, 20)
    before = memory.read(key); stats = memory.write(key, value); after = memory.read(key)
    return {"written_slots": float(stats["written_slots"]), "read_delta": float((after-before).norm().item()), "mean_delta_gain": float(stats["mean_delta_gain"]), "slot_capacity": float(memory.slots)}


def sparse_product_key_probe(*, seed: int = 0) -> dict[str, float]:
    """Reference probe for real product-key routing and bounded sparse write."""
    torch.manual_seed(int(seed))
    from importlib import import_module
    ref = import_module(f"{__package__.rsplit('.', 1)[0]}.research.product_key_sparse_memory_reference")
    ProductKeyMemoryConfig, ProductKeySparseMemory = ref.ProductKeyMemoryConfig, ref.ProductKeySparseMemory
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
    values, strength, last_time_digits, fingerprints, persistence, clock_digits = memory._split_state_with_fingerprint(state)
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


def correlated_fast_weight_ablation(*, seed: int = 0, steps: int = 120, curvature_power: float = 0.5) -> dict[str, float]:
    """Matched anisotropic-stream probe for the diagonal curvature candidate.

    The stream deliberately contains high/medium/low-energy input dimensions. The baseline and
    candidate share identical data/initialization; only the existing eligibility update's diagonal
    conditioning differs. This is a candidate qualification, not a claim of full PGDN equivalence.
    """
    torch.manual_seed(int(seed))
    from .online_plasticity import ThreeFactorFastWeight, ThreeFactorPlasticityConfig
    d, o = 16, 8
    mapping = torch.randn(o, d)
    base = dict(
        enabled=True,
        learning_rate=0.03,
        eligibility_decay=0.85,
        fast_weight_decay=0.995,
        modulatory_gate_enabled=False,
    )
    plain = ThreeFactorFastWeight(d, o, ThreeFactorPlasticityConfig(**base))
    conditioned = ThreeFactorFastWeight(
        d, o, ThreeFactorPlasticityConfig(
            **base,
            curvature_precondition_enabled=True,
            curvature_power=float(curvature_power),
        )
    )
    scales = torch.tensor([4.0] * 4 + [1.0] * 4 + [0.5] * 4 + [0.25] * 4)
    for _ in range(int(steps)):
        x = torch.randn(d) * scales
        target = x @ mapping.T
        for learner in (plain, conditioned):
            prediction = learner.apply(x.unsqueeze(0), torch.zeros(1, o)).detach()
            learner.update(x.unsqueeze(0), prediction, target.unsqueeze(0))
    x_eval = torch.randn(512, d) * scales
    y_eval = x_eval @ mapping.T
    p_plain = plain.apply(x_eval, torch.zeros(512, o)).detach()
    p_cond = conditioned.apply(x_eval, torch.zeros(512, o)).detach()
    mse_plain = F.mse_loss(p_plain, y_eval)
    mse_cond = F.mse_loss(p_cond, y_eval)
    return {
        "baseline_mse": float(mse_plain.item()),
        "candidate_mse": float(mse_cond.item()),
        "relative_mse_gain": float((mse_plain - mse_cond).div(mse_plain.clamp_min(1e-12)).item()),
        "curvature_condition": float(conditioned.last_curvature_condition.item()),
        "preconditioner_min": float(conditioned.last_preconditioner_min.item()),
        "preconditioner_max": float(conditioned.last_preconditioner_max.item()),
        "curvature_power": float(curvature_power),
        "steps": float(steps),
    }


def gated_oja_ablation(*, seed: int = 0, steps: int = 120, gamma: float = 0.001) -> dict[str, float]:
    """Matched anisotropic-stream probe for the actual Oja candidate."""
    torch.manual_seed(int(seed))
    from .online_plasticity import ThreeFactorFastWeight, ThreeFactorPlasticityConfig
    d, o = 16, 8
    mapping = torch.randn(o, d)
    base = dict(enabled=True, learning_rate=0.03, eligibility_decay=0.85, fast_weight_decay=0.995, modulatory_gate_enabled=False)
    plain = ThreeFactorFastWeight(d, o, ThreeFactorPlasticityConfig(**base))
    oja = ThreeFactorFastWeight(d, o, ThreeFactorPlasticityConfig(**base, oja_enabled=True, oja_gamma=float(gamma)))
    scales = torch.tensor([4.0] * 4 + [1.0] * 4 + [0.5] * 4 + [0.25] * 4)
    for _ in range(int(steps)):
        x = torch.randn(d) * scales
        target = x @ mapping.T
        for learner in (plain, oja):
            prediction = learner.apply(x.unsqueeze(0), torch.zeros(1, o)).detach()
            learner.update(x.unsqueeze(0), prediction, target.unsqueeze(0))
    x_eval = torch.randn(512, d) * scales
    y_eval = x_eval @ mapping.T
    p_plain = plain.apply(x_eval, torch.zeros(512, o)).detach()
    p_oja = oja.apply(x_eval, torch.zeros(512, o)).detach()
    mse_plain = F.mse_loss(p_plain, y_eval)
    mse_oja = F.mse_loss(p_oja, y_eval)
    return {
        "baseline_mse": float(mse_plain.item()),
        "candidate_mse": float(mse_oja.item()),
        "relative_mse_gain": float((mse_plain - mse_oja).div(mse_plain.clamp_min(1e-12)).item()),
        "oja_update_norm": float(oja.last_oja_update_norm.item()),
        "gamma": float(gamma),
        "steps": float(steps),
    }


def mlstm_reference_probe(*, seed: int = 7, batch: int = 2, steps: int = 9) -> dict[str, float]:
    """Check mLSTM statefulness and exact parity between step and sequence execution paths."""
    torch.manual_seed(int(seed))
    from .mlstm_candidate import MLSTMCandidate, MLSTMConfig
    cfg = MLSTMConfig(num_heads=4, head_dim=8)
    module = MLSTMCandidate(cfg.num_heads * cfg.head_dim, cfg).eval()
    x = torch.randn(batch, steps, module.d_model)
    with torch.no_grad():
        y_seq, state_seq = module(x)
        state = module.initial_state(batch, x.device, x.dtype)
        rows = []
        for t in range(steps):
            y, state = module.step(x[:, t], state)
            rows.append(y)
        y_step = torch.stack(rows, dim=1)
    max_error = float((y_seq - y_step).abs().max().item())
    state_error = max(
        float((state_seq["c"] - state["c"]).abs().max().item()),
        float((state_seq["n"] - state["n"]).abs().max().item()),
        float((state_seq["m"] - state["m"]).abs().max().item()),
    )
    # Perturb only the first token and verify that a later output changes.
    x_alt = x.clone()
    x_alt[:, 0] = x_alt[:, 0] + 0.25
    with torch.no_grad():
        y_alt, _ = module(x_alt)
    temporal_effect = float((y_alt[:, -1] - y_seq[:, -1]).abs().mean().item())
    if max_error > 1e-6 or state_error > 1e-6:
        raise AssertionError(f"mLSTM step/sequence mismatch: output={max_error} state={state_error}")
    if temporal_effect <= 1e-8:
        raise AssertionError("mLSTM recurrent state is behaviorally inert")
    return {
        "step_sequence_max_error": max_error,
        "state_max_error": state_error,
        "late_temporal_effect": temporal_effect,
        "state_c_norm": float(state["c"].float().norm().item()),
        "state_n_norm": float(state["n"].float().norm().item()),
    }


def unified_sparse_memory_abi_probe(*, seed: int = 133, steps: int = 4096) -> dict[str, float]:
    """Verify exact base-256 logical time plus legacy-state migration into the current ABI."""
    torch.manual_seed(int(seed))
    from .unified_sparse_memory import UnifiedSparseAssociativeMemory, UnifiedSparseMemoryConfig
    cfg = UnifiedSparseMemoryConfig(enabled=True, subkey_dim=8, slots_per_subkey=8, topk_per_subkey=2, value_dim=8, fingerprint_dim=4)
    memory = UnifiedSparseAssociativeMemory(hidden=32, cfg=cfg).eval()
    counters = torch.tensor([0, 1, 2047, 2048, 65535, 1_000_000, memory.TIME_MODULUS - 1], dtype=torch.int64)
    digits = memory._encode_counter(counters, torch.float16)
    decoded = memory._decode_counter(digits)
    exact = float((decoded == counters).to(torch.float32).all().item())

    legacy = torch.zeros(1, cfg.legacy_state_size, dtype=torch.float32)
    value_n = cfg.slot_count * cfg.value_dim
    strength_n = cfg.slot_count
    old_time_start = value_n + strength_n
    legacy[:, old_time_start + 3] = 2047.0
    legacy[:, -1] = 4095.0
    upgraded = memory.upgrade_state(legacy)
    _values, _strength, last_time_digits, _fp, _persistence, clock_digits = memory._split_state_with_fingerprint(upgraded)
    migrated_time = int(memory._decode_counter(last_time_digits[:, [3]]).item())
    migrated_clock = int(memory._decode_counter(clock_digits).item())
    for idx, expected in ((2047, 2047), (4095, 4095)):
        if idx == 2047:
            assert migrated_time == expected
        else:
            assert migrated_clock == expected

    state = memory.initial_state(1, torch.device("cpu"), torch.float32)
    h = torch.randn(1, 32)
    for _ in range(int(steps)):
        state = memory.step(h, state)["state"].detach()
    *_, clock = memory._split_state_with_fingerprint(state)
    decoded_clock = int(memory._decode_counter(clock).item())
    return {
        "counter_exact_fp16": exact,
        "legacy_state_upgraded": 1.0,
        "migrated_last_time": float(migrated_time),
        "migrated_clock": float(migrated_clock),
        "clock_after_steps": float(decoded_clock),
        "steps": float(steps),
        "state_size": float(memory.state_size),
        "legacy_state_size": float(memory.legacy_state_size),
    }


def unified_sparse_memory_retention_ablation(*, seed: int = 133, repeats: int = 16, delay: int = 256) -> dict[str, float]:
    """Matched persistent-retention ablation inside the one canonical bank."""
    torch.manual_seed(int(seed))
    from .unified_sparse_memory import UnifiedSparseAssociativeMemory, UnifiedSparseMemoryConfig
    common = dict(enabled=True, subkey_dim=8, slots_per_subkey=8, topk_per_subkey=2, value_dim=8, decay=0.997, write_rate=0.65, fingerprint_dim=4)
    persistent_cfg = UnifiedSparseMemoryConfig(**common, persistent_decay=0.99999, persistence_update_rate=0.20, collision_admission_enabled=True)
    working_cfg = UnifiedSparseMemoryConfig(**common, persistent_decay=common["decay"], persistence_update_rate=0.20, collision_admission_enabled=True)
    persistent = UnifiedSparseAssociativeMemory(32, persistent_cfg).eval()
    working = UnifiedSparseAssociativeMemory(32, working_cfg).eval()
    with torch.no_grad():
        working.load_state_dict(persistent.state_dict())
    cue = torch.randn(1, 32)
    target = torch.tanh(persistent.value_proj(cue)).detach()
    state_p = persistent.initial_state(1, torch.device("cpu"), torch.float32)
    state_w = working.initial_state(1, torch.device("cpu"), torch.float32)
    for _ in range(int(repeats)):
        state_p = persistent.step(cue, state_p)["state"].detach()
        state_w = working.step(cue, state_w)["state"].detach()
    for _ in range(int(delay)):
        distractor = torch.randn(1, 32)
        state_p = persistent.step(distractor, state_p)["state"].detach()
        state_w = working.step(distractor, state_w)["state"].detach()
    rp = persistent.read_only(cue, state_p)
    rw = working.read_only(cue, state_w)
    cp = float(F.cosine_similarity(rp["read"], target, dim=-1).item())
    cw = float(F.cosine_similarity(rw["read"], target, dim=-1).item())
    return {
        "persistent_cosine": cp,
        "working_cosine": cw,
        "cosine_gain": cp - cw,
        "selected_persistence_mean": float(rp["selected_persistence"].mean().item()) if "selected_persistence" in rp else 0.0,
        "delay": float(delay),
        "repeats": float(repeats),
    }


def _identity_projector(linear: torch.nn.Linear) -> None:
    with torch.no_grad():
        linear.weight.zero_()
        n = min(linear.weight.size(0), linear.weight.size(1))
        linear.weight[:n, :n].copy_(torch.eye(n, device=linear.weight.device, dtype=linear.weight.dtype))
        linear.bias.zero_()


def learned_long_term_memory_probe(
    *, seed: int = 0, delay: int = 1024, items: int = 8, writes_per_item: int = 6,
    value_dim: int = 8, key_dim: int = 8, feature_degree: int = 1,
    update_rule: str = "auto", newton_schulz_steps: int | None = None,
) -> dict[str, float]:
    """Matched long-horizon recall using one shared runtime memory state."""
    torch.manual_seed(int(seed))
    ref = _load_research_module("learned_long_term_memory_candidate")
    LearnedLongTermMemoryCandidate = ref.LearnedLongTermMemoryCandidate
    LearnedLongTermMemoryConfig = ref.LearnedLongTermMemoryConfig
    cfg = LearnedLongTermMemoryConfig(
        key_dim=key_dim, value_dim=value_dim, feature_degree=feature_degree,
        learning_rate=0.04 if feature_degree == 2 else 0.08,
        memory_decay=0.9999, surprise_scale=4.0, context_window=8, momentum=0.85,
        max_update_norm=0.20, update_rule=update_rule,
        newton_schulz_steps=(2 if feature_degree == 2 else 0) if newton_schulz_steps is None else int(newton_schulz_steps),
    )
    mem = LearnedLongTermMemoryCandidate(key_dim, cfg).eval()
    _identity_projector(mem.key_proj); _identity_projector(mem.value_proj)
    keys = F.normalize(torch.randn(items, key_dim), dim=-1)
    values = F.normalize(torch.randn(items, value_dim), dim=-1)
    state = mem.initial_state(1, torch.device("cpu"), torch.float32)
    # One shared memory: this loop is deliberately serial across associations.
    for _ in range(int(writes_per_item)):
        for idx in torch.randperm(items):
            state = mem.step_kv(keys[idx:idx + 1], values[idx:idx + 1], state)["state"]
    for _ in range(int(delay)):
        dkey = F.normalize(torch.randn(1, key_dim), dim=-1)
        dval = F.normalize(torch.randn(1, value_dim), dim=-1)
        state = mem.step_kv(dkey, dval, state)["state"]
    recalled = torch.cat([mem._read(keys[i:i + 1], state) for i in range(items)], dim=0)
    target_cos = F.cosine_similarity(recalled, values, dim=-1)
    cross = F.cosine_similarity(recalled.unsqueeze(1), values.unsqueeze(0), dim=-1)
    cross_abs = cross.masked_fill(torch.eye(items, dtype=torch.bool), 0.0).abs().max()
    return {
        "target_cosine_mean": float(target_cos.mean().item()),
        "target_cosine_min": float(target_cos.min().item()),
        "cross_item_leak_max": float(cross_abs.item()),
        "state_elements": float(sum(v.numel() for v in state.values())),
        "state_bytes_fp32": float(sum(v.numel() * v.element_size() for v in state.values())),
        "delay": float(delay), "items": float(items), "writes_per_item": float(writes_per_item),
        "feature_degree": float(feature_degree),
        "update_rule": float({"auto": 0.0, "titans_surprise": 1.0, "atlas_omega": 2.0, "lattice_orthogonal": 3.0}[update_rule]),
    }


def learned_long_term_memory_capacity_probe(*, seed: int = 0, delay: int = 512, items: int = 16, feature_degree: int = 2) -> dict[str, float]:
    """Capacity/interference probe with many associations in one shared memory state."""
    torch.manual_seed(int(seed))
    ref = _load_research_module("learned_long_term_memory_candidate")
    LearnedLongTermMemoryCandidate = ref.LearnedLongTermMemoryCandidate
    LearnedLongTermMemoryConfig = ref.LearnedLongTermMemoryConfig
    cfg = LearnedLongTermMemoryConfig(key_dim=8, value_dim=8, feature_degree=feature_degree, learning_rate=0.035, context_window=8, newton_schulz_steps=0, update_rule="atlas_omega", max_update_norm=0.15)
    mem = LearnedLongTermMemoryCandidate(8, cfg).eval()
    _identity_projector(mem.key_proj); _identity_projector(mem.value_proj)
    keys = F.normalize(torch.randn(items, 8), dim=-1)
    values = F.normalize(torch.randn(items, 8), dim=-1)
    state = mem.initial_state(1, torch.device("cpu"), torch.float32)
    for idx in range(items):
        for _ in range(4):
            state = mem.step_kv(keys[idx:idx + 1], values[idx:idx + 1], state)["state"]
    for _ in range(delay):
        dkey = F.normalize(torch.randn(1, 8), dim=-1)
        dval = F.normalize(torch.randn(1, 8), dim=-1)
        state = mem.step_kv(dkey, dval, state)["state"]
    pred = torch.cat([mem._read(keys[i:i + 1], state) for i in range(items)], dim=0)
    cos = F.cosine_similarity(pred, values, dim=-1)
    pairwise = F.cosine_similarity(pred.unsqueeze(1), values.unsqueeze(0), dim=-1)
    eye = torch.eye(items, dtype=torch.bool)
    leak = pairwise.masked_fill(eye, 0.0).abs().max()
    return {
        "recall_mean": float(cos.mean().item()),
        "recall_p10": float(torch.quantile(cos, 0.10).item()),
        "cross_item_leak_max": float(leak.item()),
        "items": float(items), "delay": float(delay),
        "state_bytes_fp32": float(sum(v.numel() * v.element_size() for v in state.values())),
        "memory_matrix_elements": float(state["memory"].numel()),
    }


def learned_long_term_memory_checkpoint_probe(*, seed: int = 0, steps: int = 128, feature_degree: int = 2) -> dict[str, float]:
    """Checkpoint/restore parity for runtime learned memory state."""
    torch.manual_seed(int(seed))
    ref = _load_research_module("learned_long_term_memory_candidate")
    LearnedLongTermMemoryCandidate, LearnedLongTermMemoryConfig = ref.LearnedLongTermMemoryCandidate, ref.LearnedLongTermMemoryConfig
    cfg = LearnedLongTermMemoryConfig(key_dim=8, value_dim=8, feature_degree=feature_degree, context_window=8, newton_schulz_steps=2 if feature_degree == 2 else 0)
    mem = LearnedLongTermMemoryCandidate(8, cfg).eval()
    _identity_projector(mem.key_proj); _identity_projector(mem.value_proj)
    state = mem.initial_state(2, torch.device("cpu"), torch.float32)
    stream_k = F.normalize(torch.randn(2, steps, 8), dim=-1)
    stream_v = F.normalize(torch.randn(2, steps, 8), dim=-1)
    for t in range(steps):
        state = mem.step_kv(stream_k[:, t], stream_v[:, t], state)["state"]
    payload = {"state_version": mem.STATE_VERSION, **{k: v.clone() for k, v in state.items()}}
    restored = mem.from_state_dict_compatible(payload, batch_size=2, device=torch.device("cpu"), dtype=torch.float32)
    q = F.normalize(torch.randn(2, 8), dim=-1)
    a = mem.read_only(q, state)["read"]
    b = mem.read_only(q, restored)["read"]
    error = float((a - b).abs().max().item())
    return {"max_abs_checkpoint_error": error, "state_version": float(mem.STATE_VERSION), "steps": float(steps)}


def learned_long_term_memory_background_probe(*, seed: int = 0, delay: int = 4096, feature_degree: int = 1) -> dict[str, float]:
    """Long-horizon needle retention under a stationary, predictable background stream."""
    torch.manual_seed(int(seed))
    ref = _load_research_module("learned_long_term_memory_candidate")
    Candidate, Config = ref.LearnedLongTermMemoryCandidate, ref.LearnedLongTermMemoryConfig
    rule = "titans_surprise" if feature_degree == 1 else "atlas_omega"
    cfg = Config(key_dim=8, value_dim=8, feature_degree=feature_degree, learning_rate=0.08 if feature_degree == 1 else 0.04, memory_decay=0.9999, context_window=8, momentum=0.85, newton_schulz_steps=0, update_rule=rule, max_update_norm=0.20)
    mem = Candidate(8, cfg).eval()
    _identity_projector(mem.key_proj); _identity_projector(mem.value_proj)
    state = mem.initial_state(1, torch.device("cpu"), torch.float32)
    needle_k = F.normalize(torch.randn(1, 8), dim=-1)
    needle_v = F.normalize(torch.randn(1, 8), dim=-1)
    bg_k = F.normalize(torch.randn(1, 8), dim=-1)
    bg_v = F.normalize(torch.randn(1, 8), dim=-1)
    for _ in range(4):
        state = mem.step_kv(needle_k, needle_v, state)["state"]
    for _ in range(delay):
        state = mem.step_kv(bg_k, bg_v, state)["state"]
    pred = mem._read(needle_k, state)
    return {
        "needle_cosine": float(F.cosine_similarity(pred, needle_v, dim=-1).item()),
        "background_loss": float(F.mse_loss(mem._read(bg_k, state), bg_v).item()),
        "state_bytes_fp32": float(sum(v.numel() * v.element_size() for v in state.values())),
        "delay": float(delay), "feature_degree": float(feature_degree),
    }


def unified_sparse_long_memory_probe(*, seed: int = 0, delay: int = 1024, items: int = 8, repeats: int = 6) -> dict[str, float]:
    """Matched baseline using the canonical sparse memory with one shared state."""
    torch.manual_seed(int(seed))
    from .unified_sparse_memory import UnifiedSparseAssociativeMemory, UnifiedSparseMemoryConfig
    cfg = UnifiedSparseMemoryConfig(enabled=True, subkey_dim=4, slots_per_subkey=8, topk_per_subkey=2, value_dim=8, write_rate=0.65, decay=0.9999, persistent_decay=0.99999, persistence_update_rate=0.20, collision_admission_enabled=True, fingerprint_dim=4)
    mem = UnifiedSparseAssociativeMemory(8, cfg).eval()
    _identity_projector(mem.key_proj); _identity_projector(mem.value_proj); _identity_projector(mem.write_gate_proj); _identity_projector(mem.erase_gate_proj)
    keys = F.normalize(torch.randn(items, 8), dim=-1)
    values = torch.tanh(keys)
    state = mem.initial_state(1, torch.device("cpu"), torch.float32)
    for _ in range(repeats):
        for idx in torch.randperm(items):
            state = mem.step(keys[idx:idx + 1], state)["state"]
    for _ in range(delay):
        d = F.normalize(torch.randn(1, 8), dim=-1)
        state = mem.step(d, state)["state"]
    preds = torch.cat([mem.read_only(keys[i:i + 1], state)["read"] for i in range(items)], dim=0)
    cos = F.cosine_similarity(preds, values, dim=-1)
    pairwise = F.cosine_similarity(preds.unsqueeze(1), values.unsqueeze(0), dim=-1)
    leak = pairwise.masked_fill(torch.eye(items, dtype=torch.bool), 0.0).abs().max()
    return {
        "recall_mean": float(cos.mean().item()),
        "recall_p10": float(torch.quantile(cos, 0.10).item()),
        "cross_item_leak_max": float(leak.item()),
        "state_bytes_fp32": float(state.numel() * state.element_size()),
        "state_elements": float(state.numel()), "delay": float(delay), "items": float(items),
    }


def learned_long_term_memory_promotion_gate(
    *,
    candidate_name: str,
    candidate_random_recall: list[float],
    baseline_random_recall: list[float],
    candidate_stationary_recall: list[float],
    baseline_stationary_recall: list[float],
    checkpoint_errors: list[float],
    candidate_state_bytes: float,
    baseline_state_bytes: float,
    random_margin: float = 0.0,
    stationary_margin: float = 0.0,
    max_state_multiplier: float = 2.0,
) -> dict[str, float | str]:
    """Evidence-only promotion gate; the gate can block promotion but never promotes by naming.

    Promotion requires the candidate to match or exceed the canonical baseline on both adversarial
    random-interference and predictable-background streams for every supplied seed, preserve exact
    checkpoint parity, and remain within a bounded runtime-state multiplier.
    """
    n = min(len(candidate_random_recall), len(baseline_random_recall), len(candidate_stationary_recall), len(baseline_stationary_recall))
    if n == 0 or not checkpoint_errors:
        return {"candidate": candidate_name, "decision": "insufficient_evidence", "matched_seeds": 0.0}
    random_ok = all(candidate_random_recall[i] >= baseline_random_recall[i] + random_margin for i in range(n))
    stationary_ok = all(candidate_stationary_recall[i] >= baseline_stationary_recall[i] + stationary_margin for i in range(n))
    checkpoint_ok = max(checkpoint_errors) <= 1e-7
    state_ok = candidate_state_bytes <= baseline_state_bytes * float(max_state_multiplier)
    passed = random_ok and stationary_ok and checkpoint_ok and state_ok
    return {
        "candidate": candidate_name,
        "decision": "eligible_for_promotion_review" if passed else "keep_candidate",
        "matched_seeds": float(n),
        "random_all_seeds": float(random_ok),
        "stationary_all_seeds": float(stationary_ok),
        "checkpoint_exact": float(checkpoint_ok),
        "state_budget_ok": float(state_ok),
        "candidate_state_bytes": float(candidate_state_bytes),
        "baseline_state_bytes": float(baseline_state_bytes),
        "state_multiplier": float(candidate_state_bytes / max(baseline_state_bytes, 1.0)),
    }


def learned_long_term_memory_overwrite_probe(*, seed: int = 0, writes_old: int = 6, writes_new: int = 6, feature_degree: int = 1, update_rule: str = "auto") -> dict[str, float]:
    """Controlled same-address overwrite test: old target A is replaced by target B."""
    torch.manual_seed(int(seed))
    ref = _load_research_module("learned_long_term_memory_candidate")
    Candidate, Config = ref.LearnedLongTermMemoryCandidate, ref.LearnedLongTermMemoryConfig
    cfg = Config(key_dim=8, value_dim=8, feature_degree=feature_degree, learning_rate=0.08 if feature_degree == 1 else 0.035, context_window=8, momentum=0.5, newton_schulz_steps=0, update_rule=update_rule, max_update_norm=0.20)
    mem = Candidate(8, cfg).eval(); _identity_projector(mem.key_proj); _identity_projector(mem.value_proj)
    state = mem.initial_state(1, torch.device("cpu"), torch.float32)
    key = F.normalize(torch.randn(1, 8), dim=-1)
    old = F.normalize(torch.randn(1, 8), dim=-1)
    raw_new = F.normalize(torch.randn(1, 8), dim=-1)
    new = F.normalize(raw_new - (raw_new * old).sum(dim=-1, keepdim=True) * old, dim=-1)
    for _ in range(writes_old):
        state = mem.step_kv(key, old, state)["state"]
    for _ in range(writes_new):
        state = mem.step_kv(key, new, state)["state"]
    pred = mem._read(key, state)
    return {
        "new_target_cosine": float(F.cosine_similarity(pred, new, dim=-1).item()),
        "old_target_cosine": float(F.cosine_similarity(pred, old, dim=-1).item()),
        "rewrite_margin": float((F.cosine_similarity(pred, new, dim=-1) - F.cosine_similarity(pred, old, dim=-1)).item()),
        "state_bytes_fp32": float(sum(v.numel() * v.element_size() for v in state.values())),
        "writes_old": float(writes_old), "writes_new": float(writes_new),
    }


def learned_long_term_memory_replay_probe(*, seed: int = 0, delay: int = 256, replay_rounds: int = 4, feature_degree: int = 1, update_rule: str = "auto") -> dict[str, float]:
    """Causal replay test: measure recall before and after replaying old associations."""
    torch.manual_seed(int(seed))
    ref = _load_research_module("learned_long_term_memory_candidate")
    Candidate, Config = ref.LearnedLongTermMemoryCandidate, ref.LearnedLongTermMemoryConfig
    cfg = Config(key_dim=8, value_dim=8, feature_degree=feature_degree, learning_rate=0.08 if feature_degree == 1 else 0.035, context_window=8, momentum=0.5, newton_schulz_steps=0, update_rule=update_rule, max_update_norm=0.20)
    mem = Candidate(8, cfg).eval(); _identity_projector(mem.key_proj); _identity_projector(mem.value_proj)
    state = mem.initial_state(1, torch.device("cpu"), torch.float32)
    keys = F.normalize(torch.randn(4, 8), dim=-1)
    values = F.normalize(torch.randn(4, 8), dim=-1)
    for _ in range(4):
        for idx in torch.randperm(4):
            state = mem.step_kv(keys[idx:idx+1], values[idx:idx+1], state)["state"]
    for _ in range(delay):
        state = mem.step_kv(F.normalize(torch.randn(1, 8), dim=-1), F.normalize(torch.randn(1, 8), dim=-1), state)["state"]
    pred_before = torch.cat([mem._read(keys[i:i+1], state) for i in range(4)], dim=0)
    before = F.cosine_similarity(pred_before, values, dim=-1).mean()
    for _ in range(replay_rounds):
        for idx in torch.randperm(4):
            state = mem.step_kv(keys[idx:idx+1], values[idx:idx+1], state)["state"]
    pred_after = torch.cat([mem._read(keys[i:i+1], state) for i in range(4)], dim=0)
    after = F.cosine_similarity(pred_after, values, dim=-1).mean()
    return {
        "recall_before_replay": float(before.item()),
        "recall_after_replay": float(after.item()),
        "recovery_gain": float((after - before).item()),
        "state_bytes_fp32": float(sum(v.numel() * v.element_size() for v in state.values())),
        "delay": float(delay), "replay_rounds": float(replay_rounds),
        "feature_degree": float(feature_degree),
    }


def unified_memory_end_to_end_probe(*, seed: int = 0, delay: int = 256, items: int = 4) -> dict[str, float]:
    """Causal memory probe through the actual current NeuroCore trunk.

    The cue is encoded by the real trunk encoder, written by the real unified sparse memory owner,
    then queried after distractors. The counterfactual zeros only the sparse tier while preserving
    the dense recurrent state, so the output delta isolates the sparse memory contribution.
    """
    if items < 1 or delay < 0:
        raise ValueError("items must be >=1 and delay must be >=0")
    import time
    from dataclasses import replace
    from .causal_trunk import CausalTrunkConfig
    from .core import CurrentConfig, NeuroCoreCurrent
    from .unified_sparse_memory import UnifiedSparseMemoryConfig

    torch.manual_seed(int(seed))
    mem_cfg = UnifiedSparseMemoryConfig(
        enabled=True, subkey_dim=4, slots_per_subkey=16, topk_per_subkey=2,
        value_dim=8, write_rate=0.65, decay=0.9999, persistent_decay=0.999995,
        read_gain=0.20, fingerprint_dim=4, collision_admission_enabled=True,
    )
    trunk_cfg = CausalTrunkConfig(
        raw_observation_dim=9, goal_dim=8, latent_dim=20, hidden_dim=64, feature_dim=64,
        context_dim=20, spine_rank=8, unified_sparse_memory=mem_cfg,
    )
    model = NeuroCoreCurrent(CurrentConfig(trunk=trunk_cfg)).eval()
    trunk = model.trunk
    state = trunk.spine.initial_state(1, torch.device("cpu"), torch.float32)
    prev = torch.zeros(1, trunk_cfg.latent_dim)
    cues: list[Tensor] = []
    targets: list[Tensor] = []
    # Real encoder + spine path creates the memory records.
    for idx in range(items):
        obs = torch.randn(1, trunk_cfg.raw_observation_dim)
        goal = torch.randn(1, trunk_cfg.goal_dim)
        feature = trunk.encoder(torch.cat([obs, goal, prev], dim=-1))
        out = trunk.spine.step(feature, state)
        state = out["state"].detach()
        prev = out["next_latent"].detach()
        cues.append(feature.detach())
        targets.append(trunk.spine.unified_sparse_memory.value_proj(feature).tanh().detach())

    for _ in range(delay):
        obs = torch.randn(1, trunk_cfg.raw_observation_dim)
        goal = torch.randn(1, trunk_cfg.goal_dim)
        feature = trunk.encoder(torch.cat([obs, goal, prev], dim=-1))
        out = trunk.spine.step(feature, state)
        state = out["state"].detach()
        prev = out["next_latent"].detach()

    dense_size = trunk.spine.rank * trunk.spine.rank
    full_reads: list[Tensor] = []
    cf_reads: list[Tensor] = []
    output_effects: list[float] = []
    target_cos: list[float] = []
    for cue, target in zip(cues, targets):
        full = trunk.spine.step(cue, state)
        dense = state[:, :dense_size]
        cf_state = torch.cat([dense, state.new_zeros(1, state.size(1) - dense_size)], dim=-1)
        cf = trunk.spine.step(cue, cf_state)
        _dense_full, sparse_full = trunk.spine._split_recurrent_state(state)
        _dense_cf, sparse_cf = trunk.spine._split_recurrent_state(cf_state)
        full_read = trunk.spine.unified_sparse_memory.read_only(cue, sparse_full)["read"]
        cf_read = trunk.spine.unified_sparse_memory.read_only(cue, sparse_cf)["read"]
        full_reads.append(full_read.detach())
        cf_reads.append(cf_read.detach())
        target_cos.append(float(F.cosine_similarity(full_read, target, dim=-1).item()))
        output_effects.append(float((full["next_latent"] - cf["next_latent"]).abs().mean().item()))

    reads = torch.cat(full_reads, dim=0)
    tgt = torch.cat(targets, dim=0)
    cross = F.cosine_similarity(reads.unsqueeze(1), tgt.unsqueeze(0), dim=-1)
    mask = ~torch.eye(items, dtype=torch.bool)
    cross_leak = float(cross.masked_select(mask).abs().max().item()) if items > 1 else 0.0
    baseline_cos = 0.0
    candidate_cos = float(sum(target_cos) / len(target_cos))

    # Measure only the real current trunk sparse-memory execution, warmed up first.
    warm = cues[0]
    for _ in range(4):
        trunk.spine.step(warm, state)
    t0 = time.perf_counter()
    local_state = state
    for cue in cues:
        local_state = trunk.spine.step(cue, local_state)["state"]
    latency_ms = (time.perf_counter() - t0) * 1000.0 / max(1, items)
    return {
        "candidate_recall": candidate_cos,
        "baseline_recall": baseline_cos,
        "quality_gain": candidate_cos - baseline_cos,
        "cross_item_leak_max": cross_leak,
        "causal_output_effect": float(sum(output_effects) / len(output_effects)),
        "state_bytes_fp32": float(trunk.spine.unified_sparse_memory.state_size * 4),
        "latency_ms_per_query": float(latency_ms),
        "items": float(items),
        "delay": float(delay),
    }


def online_learning_e2e_probe(*, seed: int = 0, steps: int = 8, curvature_precondition: bool = False) -> dict[str, float]:
    """Small matched end-to-end learning probe through NeuroCoreCurrent + OrganismTrainerCurrent."""
    from dataclasses import replace
    from .core import CurrentConfig, NeuroCoreCurrent, OrganismTrainerCurrent
    from .online_plasticity import ThreeFactorPlasticityConfig
    from .causal_trunk import CausalTrunkConfig

    torch.manual_seed(int(seed))
    op_cfg = ThreeFactorPlasticityConfig(
        enabled=True, learning_rate=0.03, eligibility_decay=0.85, fast_weight_decay=0.995,
        modulatory_gate_enabled=False, curvature_precondition_enabled=bool(curvature_precondition),
        curvature_power=0.5,
    )
    trunk_cfg = CausalTrunkConfig(online_plasticity=op_cfg)
    model = NeuroCoreCurrent(CurrentConfig(trunk=trunk_cfg)).train()
    trainer = OrganismTrainerCurrent(model, lr=3e-4)
    mapping = torch.randn(trunk_cfg.raw_observation_dim, trunk_cfg.latent_dim)
    train_losses = []
    x_eval = torch.randn(4, 10, trunk_cfg.raw_observation_dim)
    g_eval = torch.randn(4, 10, trunk_cfg.goal_dim)
    target_eval = F.normalize(x_eval[:, 1:] @ mapping, dim=-1)
    for _ in range(int(steps)):
        x = torch.randn(4, 10, trunk_cfg.raw_observation_dim)
        g = torch.randn(4, 10, trunk_cfg.goal_dim)
        target = F.normalize(x[:, 1:] @ mapping, dim=-1)
        log = trainer.learning_step(x, g, target_latent_sequence=target, regime="tbptt")
        train_losses.append(float(log["loss"]))
    with torch.no_grad():
        ev = model.forward_learning(x_eval, g_eval, target_latent_sequence=target_eval)
        eval_loss = float(ev["loss"].item())
    return {
        "initial_loss": float(train_losses[0]),
        "final_loss": float(train_losses[-1]),
        "relative_train_gain": float((train_losses[0] - train_losses[-1]) / max(abs(train_losses[0]), 1e-12)),
        "eval_loss": eval_loss,
        "steps": float(steps),
        "curvature_precondition": float(curvature_precondition),
        "online_fast_weight_norm": float(model.spine.online_plasticity.fast_weight.norm().item()),
        "online_update_norm": float(model.spine.online_plasticity.last_update_norm.item()),
    }
