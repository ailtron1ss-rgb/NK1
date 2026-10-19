from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

import torch
from torch import Tensor
import torch.nn.functional as F

from neurocore.v86 import (
    V86Config,
    mobile_v86_config,
    NeuroWeaveV86,
    OrganismTrainerV86,
    OrganismRuntimeV86,
    RuntimeStateStoreV86,
)
from neurocore.v86.core import (
    _learning_replay_batch_v86,
    _write_learning_transition_v86,
    _signature_bucket,
    replay_quality_report_v86,
)


@dataclass
class V87Config(V86Config):
    replay_utility_weight_v87: float = 0.55
    replay_target_novelty_weight_v87: float = 0.20
    replay_live_alignment_weight_v87: float = 0.15
    replay_underuse_weight_v87: float = 0.10
    replay_utility_ema_decay_v87: float = 0.85
    replay_utility_probe_cap_v87: int = 12
    replay_utility_probe_interval_v87: int = 2
    replay_utility_priority_mix_v87: float = 0.65
    replay_utility_floor_v87: float = 0.05
    replay_utility_temperature_v87: float = 0.50


def mobile_v87_config(raw_observation_dim: int = 9) -> V87Config:
    base = dict(mobile_v86_config(raw_observation_dim).__dict__)
    base.update(
        dict(
            replay_utility_weight_v87=0.55,
            replay_target_novelty_weight_v87=0.20,
            replay_live_alignment_weight_v87=0.15,
            replay_underuse_weight_v87=0.10,
            replay_utility_ema_decay_v87=0.85,
            replay_utility_probe_cap_v87=12,
            replay_utility_probe_interval_v87=2,
            replay_utility_priority_mix_v87=0.65,
            replay_utility_floor_v87=0.05,
            replay_utility_temperature_v87=0.50,
        )
    )
    return V87Config(**base)


def _ensure_replay_metadata_v87(memory) -> None:
    # Reuse V86 buffers whenever possible. V87 adds only a detached utility EMA per slot.
    from neurocore.v86.core import _ensure_replay_metadata_v86

    _ensure_replay_metadata_v86(memory)
    if hasattr(memory, "learning_replay_utility_ema_v87"):
        return
    cap = int(memory.learning_replay_capacity_v83)
    dev = memory.learning_replay_observations_v83.device
    dtype = memory.learning_replay_observations_v83.dtype
    memory.register_buffer("learning_replay_utility_ema_v87", torch.zeros(cap, device=dev, dtype=dtype))
    memory.register_buffer("learning_replay_utility_probe_step_v87", torch.full((cap,), -1, dtype=torch.long, device=dev))


def _normalize_01(values: Tensor, eps: float = 1e-6) -> Tensor:
    lo = values.amin()
    hi = values.amax()
    return (values - lo) / (hi - lo + eps)


def _probe_replay_utility_v87(
    model: NeuroWeaveV86,
    memory,
    candidate_indices: Tensor,
    *,
    current_prediction: Optional[Tensor] = None,
    current_target: Optional[Tensor] = None,
    now_step: int = 0,
) -> Dict[str, Tensor]:
    """Detached, batched model-aware replay utility probe.

    The probe performs one forward pass over a bounded candidate subset and computes:
      - actual current-model latent error;
      - target novelty relative to the live batch target;
      - a gradient-free alignment/conflict proxy to the current live prediction;
      - underuse pressure.

    No autograd graph is retained and no parameters are updated here.
    """
    _ensure_replay_metadata_v87(memory)
    if candidate_indices.numel() == 0:
        empty = memory.learning_replay_priorities_v83.new_zeros(0)
        return {k: empty for k in ("error", "target_novelty", "live_alignment", "underuse", "gradient_alignment", "utility")}

    idx = candidate_indices.reshape(-1).long()
    if current_prediction is None:
        current_prediction = getattr(model, "_last_learning_prediction_v98", None)
    if current_target is None:
        current_target = getattr(model, "_last_learning_target_v98", None)
    obs = memory.learning_replay_observations_v83[idx]
    goal = memory.learning_replay_goals_v83[idx]
    nxt = memory.learning_replay_next_observations_v83[idx]
    nxt_goal = memory.learning_replay_next_goals_v83[idx]
    target = memory.learning_replay_targets_v83[idx]

    with torch.no_grad():
        x = torch.stack([obs, nxt], dim=1)
        goals = torch.stack([goal, nxt_goal], dim=1)
        out = model.forward_learning_v82(x, goals, target_latent_sequence=target.unsqueeze(1))
        pred = out["spine_next_latent"][:, 0]
        error = (1.0 - F.cosine_similarity(pred, F.normalize(target, dim=-1), dim=-1)).clamp_min(0.0)

        if current_target is None:
            target_ref = F.normalize(target.mean(dim=0, keepdim=True), dim=-1)
        else:
            target_ref = F.normalize(current_target.reshape(-1, current_target.size(-1)).mean(dim=0, keepdim=True), dim=-1)
        target_novelty = 1.0 - F.cosine_similarity(F.normalize(target, dim=-1), target_ref.expand_as(target), dim=-1)
        target_novelty = target_novelty.clamp(0.0, 2.0) / 2.0

        if current_prediction is None:
            live_ref = F.normalize(pred.mean(dim=0, keepdim=True), dim=-1)
        else:
            live_ref = F.normalize(current_prediction.reshape(-1, current_prediction.size(-1)).mean(dim=0, keepdim=True), dim=-1)
        # Larger disagreement with the currently predicted live representation is treated as
        # a gradient-free interference/novelty proxy, not as a proven influence estimate.
        live_alignment = (1.0 - F.cosine_similarity(F.normalize(target, dim=-1), live_ref.expand_as(target), dim=-1)).clamp(0.0, 2.0) / 2.0

        uses = memory.learning_replay_use_count_v86[idx].float()
        underuse = 1.0 / torch.sqrt(1.0 + uses)

        utility = (
            float(model.cfg.replay_utility_weight_v87) * _normalize_01(error)
            + float(model.cfg.replay_target_novelty_weight_v87) * _normalize_01(target_novelty)
            + float(model.cfg.replay_live_alignment_weight_v87) * _normalize_01(live_alignment)
            + float(model.cfg.replay_underuse_weight_v87) * underuse
        )

        decay = float(model.cfg.replay_utility_ema_decay_v87)
        old = memory.learning_replay_utility_ema_v87[idx]
        new_ema = decay * old + (1.0 - decay) * utility
        memory.learning_replay_utility_ema_v87[idx] = new_ema
        memory.learning_replay_utility_probe_step_v87[idx] = int(now_step)
        memory.learning_replay_last_error_v86[idx] = error

    alignment = None
    alignment_probe = getattr(model, "_current_replay_alignment_probe", None)
    alignment_weight = float(getattr(model, "_current_replay_alignment_weight", 0.0))
    if alignment_probe is not None and alignment_weight > 0.0 and current_prediction is not None and current_target is not None:
        alignment = alignment_probe(
            pred.detach(),
            target.detach(),
            current_prediction.detach(),
            current_target.detach(),
            temperature=float(getattr(model, "_current_replay_alignment_temperature", 0.25)),
            clamp_negative=bool(getattr(model, "_current_replay_alignment_clamp_negative", False)),
        )
        utility = (1.0 - alignment_weight) * utility + alignment_weight * alignment
        alignment_memory = getattr(memory, "learning_replay_gradient_alignment_v98", None)
        if alignment_memory is not None:
            old_alignment = alignment_memory[idx]
            alignment_memory[idx] = 0.85 * old_alignment + 0.15 * alignment
    else:
        alignment = utility.new_zeros(utility.shape)

    return {
        "error": error,
        "target_novelty": target_novelty,
        "live_alignment": live_alignment,
        "underuse": underuse,
        "gradient_alignment": alignment,
        "utility": utility,
    }


def _learning_replay_batch_v87(
    model: NeuroWeaveV86,
    batch_size: int,
    *,
    now_step: int = 0,
    current_prediction: Optional[Tensor] = None,
    current_target: Optional[Tensor] = None,
    return_report: bool = False,
    probe_due: Optional[bool] = None,
) -> Optional[Dict[str, Tensor]]:
    """V86 selector + bounded current-model utility re-ranking.

    Candidate generation remains V86-compatible. Only the top bounded candidate subset is probed
    with a detached forward pass. Selection then mixes legacy information quality with current-model
    utility. The V86 safety floor prevents a utility probe from choosing a clearly worse information batch.
    """
    _ensure_replay_metadata_v87(model.neural_memory_v61)
    memory = model.neural_memory_v61
    valid = torch.nonzero(memory.learning_replay_valid_v83 > 0.5, as_tuple=False).flatten()
    if valid.numel() == 0:
        return None
    k = min(int(batch_size), int(valid.numel()))

    use_snapshot = memory.learning_replay_use_count_v86[valid].clone()
    base_batch = _learning_replay_batch_v86(memory, k, now_step=now_step, return_report=True)
    if base_batch is None:
        return None
    base_idx = base_batch["indices_v86"]
    # V86 increments use_count internally; restore it so V87 records exactly one increment
    # for the final chosen batch and does not bias future utility selection.
    memory.learning_replay_use_count_v86[valid] = use_snapshot

    cap = min(int(model.cfg.replay_utility_probe_cap_v87), int(valid.numel()))
    pri_all = memory.learning_replay_priorities_v83[valid].clamp_min(1e-6)
    top = valid[torch.topk(pri_all, k=min(cap, int(valid.numel()))).indices]
    # Always include the legacy-selected anchors so the model-aware selector cannot lose the
    # baseline's sparse coverage just because an anchor sits outside the priority top-k.
    candidates = torch.unique(torch.cat([top, base_idx]))
    if candidates.numel() > cap + k:
        pri_c = memory.learning_replay_priorities_v83[candidates].clamp_min(1e-6)
        keep = torch.topk(pri_c, k=cap + k).indices
        candidates = candidates[keep]

    if probe_due is None:
        should_probe = True
        if int(model.cfg.replay_utility_probe_interval_v87) > 1:
            last = memory.learning_replay_utility_probe_step_v87[candidates]
            should_probe = bool(((int(now_step) - last) >= int(model.cfg.replay_utility_probe_interval_v87)).any().item())
    else:
        should_probe = bool(probe_due)

    if should_probe:
        probe = _probe_replay_utility_v87(
            model,
            memory,
            candidates,
            current_prediction=current_prediction,
            current_target=current_target,
            now_step=now_step,
        )
    else:
        util = memory.learning_replay_utility_ema_v87[candidates]
        probe = {
            "error": memory.learning_replay_last_error_v86[candidates],
            "target_novelty": util.new_zeros(util.shape),
            "live_alignment": util.new_zeros(util.shape),
            "underuse": 1.0 / torch.sqrt(1.0 + memory.learning_replay_use_count_v86[candidates].float()),
            "gradient_alignment": (
                getattr(memory, "learning_replay_gradient_alignment_v98", util.new_zeros(memory.learning_replay_priorities_v83.shape))[candidates]
                if float(getattr(model, "_current_replay_alignment_weight", 0.0)) > 0.0 and hasattr(memory, "learning_replay_gradient_alignment_v98")
                else util.new_zeros(util.shape)
            ),
            "utility": util,
        }

    pri = memory.learning_replay_priorities_v83[candidates].clamp_min(1e-6)
    info_base = _normalize_01(torch.sqrt(pri))
    util = _normalize_01(probe["utility"])
    temperature = max(1e-3, float(model.cfg.replay_utility_temperature_v87))
    util_sharp = torch.sigmoid((util - 0.5) / temperature)
    mixed = float(model.cfg.replay_utility_priority_mix_v87) * info_base + (1.0 - float(model.cfg.replay_utility_priority_mix_v87)) * util_sharp

    # Preserve V86's information strata: use the legacy selector to determine how many slots
    # each (input_signature, target_signature) stratum contributes, then optimize utility only
    # inside those strata. This creates a causal model-aware choice without throwing away coverage.
    in_b = memory.learning_replay_input_bucket_v86[candidates]
    tg_b = memory.learning_replay_target_bucket_v86[candidates]
    base_pairs = list(zip(memory.learning_replay_input_bucket_v86[base_idx].tolist(), memory.learning_replay_target_bucket_v86[base_idx].tolist()))
    stratum_counts = {}
    for pair in base_pairs:
        stratum_counts[pair] = stratum_counts.get(pair, 0) + 1

    selected: list[int] = []
    for pair, count in stratum_counts.items():
        positions = [i for i, (a, b) in enumerate(zip(in_b.tolist(), tg_b.tolist())) if (int(a), int(b)) == (int(pair[0]), int(pair[1]))]
        if not positions:
            continue
        positions.sort(key=lambda i: float(mixed[i].item()), reverse=True)
        for pos in positions[:count]:
            selected.append(int(candidates[pos].item()))

    if len(selected) < k:
        for pos in torch.argsort(mixed, descending=True).tolist():
            slot = int(candidates[pos].item())
            if slot not in selected:
                selected.append(slot)
                if len(selected) >= k:
                    break

    idx = torch.tensor(selected[:k], device=valid.device, dtype=torch.long)
    quality_new = replay_quality_report_v86(memory, idx, now_step)
    quality_old = replay_quality_report_v86(memory, base_idx, now_step)
    def q(report: Dict[str, float]) -> float:
        return float(
            0.30 * report["diversity"]
            + 0.20 * report["input_coverage"]
            + 0.20 * report["target_coverage"]
            + 0.15 * report["age_coverage"]
            + 0.15 * report["reuse_entropy"]
        )

    # Stratum-preserving selection should normally pass this floor. Keep an explicit check so
    # unusual buffers still fall back safely.
    # The scalar information-quality floor is allowed a small bounded drop so that current-model
    # utility can win when the replay buffer offers genuinely different candidates. Coverage and
    # diversity still dominate the floor; the 0.15 margin is deliberately explicit and testable.
    floor_ok = q(quality_new) >= q(quality_old) - 0.15
    fallback = float(not floor_ok)
    if fallback:
        idx = base_idx

    with torch.no_grad():
        memory.learning_replay_use_count_v86[idx] += 1

    out = {
        "observation": memory.learning_replay_observations_v83[idx],
        "goal": memory.learning_replay_goals_v83[idx],
        "next_observation": memory.learning_replay_next_observations_v83[idx],
        "next_goal": memory.learning_replay_next_goals_v83[idx],
        "target_latent": memory.learning_replay_targets_v83[idx],
        "priority": memory.learning_replay_priorities_v83[idx],
        "indices_v87": idx,
        "indices_v86_base": base_idx,
        "utility_selection_changed_v87": memory.learning_replay_priorities_v83[idx].new_tensor(float(set(idx.tolist()) != set(base_idx.tolist()))),
        "utility_mean_v87": probe["utility"].mean().new_tensor(float(probe["utility"].mean().item())),
        "utility_max_v87": probe["utility"].max().new_tensor(float(probe["utility"].max().item())),
        "utility_error_mean_v87": probe["error"].mean().new_tensor(float(probe["error"].mean().item())),
        "utility_target_novelty_mean_v87": probe["target_novelty"].mean().new_tensor(float(probe["target_novelty"].mean().item())),
        "utility_live_alignment_mean_v87": probe["live_alignment"].mean().new_tensor(float(probe["live_alignment"].mean().item())),
        "utility_underuse_mean_v87": probe["underuse"].mean().new_tensor(float(probe["underuse"].mean().item())),
        "utility_gradient_alignment_mean_v87": probe["gradient_alignment"].mean().new_tensor(float(probe["gradient_alignment"].mean().item())),
        "utility_safety_fallback_v87": memory.learning_replay_priorities_v83[idx].new_tensor(fallback),
        "utility_candidate_count_v87": memory.learning_replay_priorities_v83[idx].new_tensor(float(candidates.numel())),
        "utility_probe_executed_v87": memory.learning_replay_priorities_v83[idx].new_tensor(float(should_probe)),
        "utility_information_quality_new_v87": memory.learning_replay_priorities_v83[idx].new_tensor(q(quality_new)),
        "utility_information_quality_old_v87": memory.learning_replay_priorities_v83[idx].new_tensor(q(quality_old)),
    }
    if return_report:
        rep = replay_quality_report_v86(memory, idx, now_step)
        for name, value in rep.items():
            if name != "valid":
                out[f"quality_{name}_v87"] = memory.learning_replay_priorities_v83[idx].new_tensor(value)
    return out


class NeuroWeaveV87(NeuroWeaveV86):
    def __init__(self, cfg: Optional[V87Config] = None):
        cfg = cfg or mobile_v87_config(9)
        super().__init__(cfg)
        self.cfg = cfg
        _ensure_replay_metadata_v87(self.neural_memory_v61)

    def learning_parameter_report_v87(self) -> Dict[str, float]:
        rep = self.learning_parameter_report_v86()
        rep["replay_utility_parameter_delta_v87"] = 0.0
        rep["replay_utility_has_trainable_parameters_v87"] = 0.0
        return rep


class OrganismTrainerV87(OrganismTrainerV86):
    def __init__(self, model: NeuroWeaveV87, lr=None, warmup_steps=4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV87 = model
        self.replay_utility_probe_events_v87 = 0
        self.replay_utility_fallback_events_v87 = 0
        self.replay_utility_mean_v87 = 0.0
        self.last_utility_probe_step_v87 = -1

    def learning_step_v87(self, x, goal_sequence=None, *, target_latent_sequence=None):
        self.model.train()
        out = self.model.forward_learning_v82(x, goal_sequence, target_latent_sequence=target_latent_sequence)
        current_total, weights = self._balanced_total_v82(out)
        pressure = self._pressure(x, goal_sequence, out, target_latent_sequence)
        prev_pressure_ema = self.replay_pressure_ema_v84
        first_pressure = self.unified_steps_v82 == 0
        pressure_spike = 0.0 if first_pressure else pressure - prev_pressure_ema
        self.replay_pressure_ema_v84 = pressure if first_pressure else 0.9 * prev_pressure_ema + 0.1 * pressure

        # The current prediction/target references are detached and only used by the replay utility probe.
        current_pred = out["spine_next_latent"][:, :-1].detach()
        if target_latent_sequence is None:
            g = goal_sequence if goal_sequence is not None else x.new_zeros(x.size(0), x.size(1), self.model.cfg.goal_dim)
            current_target = torch.stack([self.model.brain46.target_latent(x[:, i + 1], g[:, i + 1]) for i in range(x.size(1) - 1)], dim=1).detach()
        else:
            current_target = target_latent_sequence.detach().to(x)

        active = [p for p in self.model.parameters() if p.requires_grad]
        interval = max(1, int(self.model.cfg.replay_utility_probe_interval_v87))
        probe_due = self.last_utility_probe_step_v87 < 0 or (self.unified_steps_v82 - self.last_utility_probe_step_v87) >= interval
        replay = _learning_replay_batch_v87(
            self.model,
            min(6, self.model.cfg.neural_memory_replay_minibatch_v61),
            now_step=self.unified_steps_v82,
            current_prediction=current_pred,
            current_target=current_target,
            return_report=True,
            probe_due=probe_due,
        )
        available = replay is not None
        execute = bool(available and self._should_replay(pressure, pressure_spike))
        replay_total = x.new_zeros(())
        replay_cos = self.replay_last_conflict_v84
        replay_cos_exact = False
        replay_mix = 0.0
        cov = 0.0
        energy = 0.0
        mode = "current_only"
        quality = {k: 0.0 for k in ("priority_entropy", "input_coverage", "target_coverage", "age_coverage", "reuse_entropy", "diversity")}
        if replay is not None:
            for key, name in (
                ("quality_priority_entropy_v87", "priority_entropy"),
                ("quality_input_coverage_v87", "input_coverage"),
                ("quality_target_coverage_v87", "target_coverage"),
                ("quality_age_coverage_v87", "age_coverage"),
                ("quality_reuse_entropy_v87", "reuse_entropy"),
                ("quality_diversity_v87", "diversity"),
            ):
                quality[name] = float(replay[key].item())
            q_score = 0.20 * quality["priority_entropy"] + 0.20 * quality["input_coverage"] + 0.20 * quality["target_coverage"] + 0.15 * quality["age_coverage"] + 0.10 * quality["reuse_entropy"] + 0.15 * min(1.0, quality["diversity"])
            self.replay_quality_ema_v86 = q_score if self.replay_quality_updates_v86 == 0 else float(self.model.cfg.replay_quality_ema_decay_v86) * self.replay_quality_ema_v86 + (1.0 - float(self.model.cfg.replay_quality_ema_decay_v86)) * q_score
            self.replay_quality_updates_v86 += 1
            self.replay_utility_mean_v87 = 0.9 * self.replay_utility_mean_v87 + 0.1 * float(replay["utility_mean_v87"].item())
            probe_executed = int(replay["utility_probe_executed_v87"].item())
            self.replay_utility_probe_events_v87 += probe_executed
            if probe_executed:
                self.last_utility_probe_step_v87 = self.unified_steps_v82
            self.replay_utility_fallback_events_v87 += int(replay["utility_safety_fallback_v87"].item())

        self.unified_optimizer_v80.zero_grad(set_to_none=True)
        if execute:
            ro = self.model.forward_replay_learning_v83(replay["observation"], replay["goal"], replay["next_observation"], replay["next_goal"], replay["target_latent"])
            replay_total = sum(float(getattr(self.model.cfg, self.BASE_WEIGHT_ATTRS[k])) * weights[k] * ro[k] for k in self.LOSS_KEYS)
            self.replay_events_v84 += 1
            self.steps_since_replay_v84 = 0
            replay_mix = self.adaptive_replay_mix_v78(self.model.cfg.unified_replay_base_mix_v80, replay_cos, gain=self.model.cfg.unified_replay_conflict_gain_v80)
            diagnostic = bool(self.model.cfg.replay_surgery_enabled_v84 and (self.replay_events_v84 % max(1, int(self.model.cfg.replay_diagnostic_interval_v84)) == 0))
            if diagnostic:
                cg = torch.autograd.grad(current_total, active, retain_graph=True, allow_unused=True)
                rg = torch.autograd.grad(replay_total, active, allow_unused=True)
                replay_cos = self._global_gradient_cosine(cg, rg)
                replay_mix = self.adaptive_replay_mix_v78(self.model.cfg.unified_replay_base_mix_v80, replay_cos, gain=self.model.cfg.unified_replay_conflict_gain_v80)
                cov = self._gradient_coverage(active, rg)
                merged, energy = self._merge_gradients(cg, rg, replay_mix)
                for p, g in zip(active, merged):
                    p.grad = g
                self.replay_last_conflict_v84 = replay_cos
                replay_cos_exact = True
                self.replay_diagnostic_events_v84 += 1
                self._adapt_interval(pressure_spike, replay_cos)
                mode = "diagnostic_surgery"
            else:
                (current_total + float(replay_mix) * replay_total).backward()
                self.replay_last_conflict_v84 = 0.95 * self.replay_last_conflict_v84 + 0.05 * float(replay_cos)
                self._adapt_interval(pressure_spike, None)
                mode = "fast_combined"
        else:
            current_total.backward()
            self.steps_since_replay_v84 += 1

        norm = float(torch.nn.utils.clip_grad_norm_(active, self.model.cfg.unified_gradient_clip_v80).item())
        self.unified_optimizer_v80.step()
        self.unified_steps_v82 += 1
        writes = self._write_v86(x, goal_sequence, out, target_latent_sequence)
        self.last_replay_mode_v84 = mode
        return {
            "loss": float(current_total.detach()),
            "replay_loss": float(replay_total.detach()),
            "replay_available": float(available),
            "replay_executed": float(execute),
            "replay_cosine": float(replay_cos),
            "replay_cosine_exact_v84": float(replay_cos_exact),
            "replay_mix": float(replay_mix),
            "replay_gradient_coverage": float(cov),
            "replay_projection_energy": float(energy),
            "gradient_coverage": float(self._gradient_coverage(active, [p.grad for p in active])),
            "gradient_norm": norm,
            "replay_transition_writes": float(writes),
            "replay_events_v84": float(self.replay_events_v84),
            "replay_diagnostic_events_v84": float(self.replay_diagnostic_events_v84),
            "replay_interval_v84": float(self.replay_interval_v84),
            "steps_since_replay_v84": float(self.steps_since_replay_v84),
            "replay_pressure_v84": float(pressure),
            "replay_pressure_spike_v84": float(pressure_spike),
            "replay_pressure_ema_v84": float(self.replay_pressure_ema_v84),
            "replay_mode_v84": mode,
            "replay_extra_backward_v84": float(mode == "diagnostic_surgery"),
            "replay_quality_priority_entropy_v86": quality["priority_entropy"],
            "replay_quality_input_coverage_v86": quality["input_coverage"],
            "replay_quality_target_coverage_v86": quality["target_coverage"],
            "replay_quality_age_coverage_v86": quality["age_coverage"],
            "replay_quality_reuse_entropy_v86": quality["reuse_entropy"],
            "replay_quality_diversity_v86": quality["diversity"],
            "replay_quality_ema_v86": float(self.replay_quality_ema_v86),
            "replay_quality_updates_v86": float(self.replay_quality_updates_v86),
            "replay_selector_fallback_v86": float(replay.get("selector_fallback_v86", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_selector_candidate_score_v86": float(replay.get("selector_candidate_score_v86", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_selector_legacy_score_v86": float(replay.get("selector_legacy_score_v86", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_mean_v87": float(replay.get("utility_mean_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_max_v87": float(replay.get("utility_max_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_error_mean_v87": float(replay.get("utility_error_mean_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_gradient_alignment_mean_v87": float(replay.get("utility_gradient_alignment_mean_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_target_novelty_mean_v87": float(replay.get("utility_target_novelty_mean_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_live_alignment_mean_v87": float(replay.get("utility_live_alignment_mean_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_underuse_mean_v87": float(replay.get("utility_underuse_mean_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_probe_executed_v87": float(replay.get("utility_probe_executed_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_safety_fallback_v87": float(replay.get("utility_safety_fallback_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_candidate_count_v87": float(replay.get("utility_candidate_count_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_information_quality_new_v87": float(replay.get("utility_information_quality_new_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_information_quality_old_v87": float(replay.get("utility_information_quality_old_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "replay_utility_mean_ema_v87": float(self.replay_utility_mean_v87),
            "replay_utility_probe_events_v87": float(self.replay_utility_probe_events_v87),
            "replay_utility_fallback_events_v87": float(self.replay_utility_fallback_events_v87),
            "replay_utility_selection_changed_v87": float(replay.get("utility_selection_changed_v87", x.new_zeros(())).item()) if replay is not None else 0.0,
            "steps": float(self.unified_steps_v82),
        }

    def state_dict_v87(self):
        state = dict(self.state_dict_v86())
        state.update(
            {
                "replay_utility_mean_v87": self.replay_utility_mean_v87,
                "replay_utility_probe_events_v87": self.replay_utility_probe_events_v87,
                "replay_utility_fallback_events_v87": self.replay_utility_fallback_events_v87,
                "last_utility_probe_step_v87": self.last_utility_probe_step_v87,
            }
        )
        return state

    def load_state_dict_v87(self, state):
        self.load_state_dict_v86(state)
        self.replay_utility_mean_v87 = float(state.get("replay_utility_mean_v87", 0.0))
        self.replay_utility_probe_events_v87 = int(state.get("replay_utility_probe_events_v87", 0))
        self.replay_utility_fallback_events_v87 = int(state.get("replay_utility_fallback_events_v87", 0))
        self.last_utility_probe_step_v87 = int(state.get("last_utility_probe_step_v87", -1))


class OrganismRuntimeV87(OrganismRuntimeV86):
    pass


class RuntimeStateStoreV87(RuntimeStateStoreV86):
    VERSION = 87

    @classmethod
    def save(cls, path, model, trainer=None, runtime=None):
        torch.save(
            {
                "version_v87": cls.VERSION,
                "base_version": 86,
                "model": model.state_dict(),
                "trainer": trainer.state_dict_v87() if trainer else None,
                "runtime": runtime.state_dict() if runtime else None,
            },
            path,
        )

    @classmethod
    def load(cls, path, model, trainer=None, runtime=None):
        p = torch.load(path, map_location="cpu", weights_only=False)
        state = p.get("model", p)
        target = model.state_dict()
        compatible = {k: v for k, v in state.items() if k in target and tuple(v.shape) == tuple(target[k].shape)}
        shape = [k for k in state if k in target and tuple(state[k].shape) != tuple(target[k].shape)]
        missing = [k for k in target if k not in compatible]
        unexpected = [k for k in state if k not in target]
        model.load_state_dict(compatible, strict=False)
        opt = reset = False
        if trainer is not None and p.get("trainer") is not None:
            try:
                trainer.load_state_dict_v87(p["trainer"])
                opt = True
            except (ValueError, RuntimeError):
                reset = True
        if runtime is not None and p.get("runtime") is not None:
            runtime.load_state_dict(p["runtime"])
        return {
            "version": int(p.get("version_v87", p.get("version_v86", 0))),
            "loaded_tensors": len(compatible),
            "missing_tensors": missing,
            "shape_mismatch": shape,
            "unexpected_tensors": unexpected,
            "optimizer_loaded": opt,
            "optimizer_reset": reset,
        }
