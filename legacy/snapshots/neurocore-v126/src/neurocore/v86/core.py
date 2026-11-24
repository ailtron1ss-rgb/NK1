from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v84 import (
    V84Config,
    mobile_v84_config,
    NeuroWeaveV84,
    OrganismTrainerV84,
    OrganismRuntimeV84,
    RuntimeStateStoreV84,
)
from neurocore.v83.core import _learning_replay_batch_v83, _write_learning_transition_v83


@dataclass
class V86Config(V84Config):
    replay_diversity_weight_v86: float = 0.75
    replay_age_weight_v86: float = 0.20
    replay_reuse_penalty_v86: float = 0.20
    replay_coverage_bins_v86: int = 8
    replay_candidate_cap_v86: int = 32
    replay_min_unique_signatures_v86: int = 3
    replay_quality_ema_decay_v86: float = 0.90


def mobile_v86_config(raw_observation_dim: int = 9) -> V86Config:
    base = dict(mobile_v84_config(raw_observation_dim).__dict__)
    base.update(
        dict(
            replay_diversity_weight_v86=0.75,
            replay_age_weight_v86=0.20,
            replay_reuse_penalty_v86=0.20,
            replay_coverage_bins_v86=8,
            replay_candidate_cap_v86=32,
            replay_min_unique_signatures_v86=3,
            replay_quality_ema_decay_v86=0.90,
        )
    )
    return V86Config(**base)


def _signature_bucket(values: Tensor, bins: int = 8) -> Tensor:
    """Cheap label-free bucket from pairwise local contrasts; no task/domain IDs are used."""
    x = values.reshape(values.shape[0], -1)
    d = int(x.size(-1))
    if d <= 1:
        return torch.zeros(x.size(0), dtype=torch.long, device=x.device)
    contrasts = []
    take = min(8, d)
    for i in range(take):
        contrasts.append(x[:, i] - x[:, (i + 1) % d])
    bits = torch.stack(contrasts, dim=-1) >= 0
    weights = (2 ** torch.arange(bits.size(-1), device=bits.device, dtype=torch.long)).view(1, -1)
    raw = (bits.to(torch.long) * weights).sum(dim=-1)
    return raw.remainder(max(1, int(bins))).long()


def _pairwise_diversity(obs: Tensor, targets: Tensor) -> float:
    n = int(obs.size(0))
    if n < 2:
        return 0.0
    o = F.normalize(obs, dim=-1)
    t = F.normalize(targets, dim=-1)
    sim = 0.5 * (o @ o.t()) + 0.5 * (t @ t.t())
    tri = torch.triu(sim, diagonal=1)
    denom = n * (n - 1) / 2.0
    mean_sim = float(tri.sum().item() / max(1.0, denom))
    return float(max(0.0, min(2.0, 1.0 - mean_sim)))


def _ensure_replay_metadata_v86(memory: nn.Module) -> None:
    if hasattr(memory, "learning_replay_insert_step_v86"):
        return
    cap = int(memory.learning_replay_capacity_v83)
    dev = memory.learning_replay_observations_v83.device
    memory.register_buffer("learning_replay_insert_step_v86", torch.zeros(cap, dtype=torch.long, device=dev))
    memory.register_buffer("learning_replay_use_count_v86", torch.zeros(cap, dtype=torch.long, device=dev))
    memory.register_buffer("learning_replay_input_bucket_v86", torch.full((cap,), -1, dtype=torch.long, device=dev))
    memory.register_buffer("learning_replay_target_bucket_v86", torch.full((cap,), -1, dtype=torch.long, device=dev))
    memory.register_buffer("learning_replay_last_error_v86", torch.zeros(cap, device=dev, dtype=memory.learning_replay_observations_v83.dtype))


def _write_learning_transition_v86(
    memory: nn.Module,
    observation: Tensor,
    goal: Tensor,
    next_observation: Tensor,
    next_goal: Tensor,
    target_latent: Tensor,
    *,
    priority: float = 1.0,
    step: int = 0,
) -> None:
    _ensure_replay_metadata_v86(memory)
    before = int(memory.learning_replay_cursor_v83.item())
    obs = observation.reshape(-1, int(memory.learning_replay_observation_dim_v83)).detach()
    tgt = target_latent.reshape(-1, int(memory.learning_replay_target_dim_v83)).detach()
    if obs.size(0) != tgt.size(0):
        raise ValueError("V86 replay transition batch dimensions must match")
    _write_learning_transition_v83(memory, observation, goal, next_observation, next_goal, target_latent, priority=priority)
    cap = int(memory.learning_replay_capacity_v83)
    obs_b = _signature_bucket(obs, bins=max(1, int(getattr(memory, "learning_replay_metadata_bins_v86", 8))))
    tgt_b = _signature_bucket(tgt, bins=max(1, int(getattr(memory, "learning_replay_metadata_bins_v86", 8))))
    with torch.no_grad():
        for i in range(obs.size(0)):
            slot = (before + i) % cap
            memory.learning_replay_insert_step_v86[slot] = int(step)
            memory.learning_replay_use_count_v86[slot] = 0
            memory.learning_replay_input_bucket_v86[slot] = obs_b[i]
            memory.learning_replay_target_bucket_v86[slot] = tgt_b[i]
            memory.learning_replay_last_error_v86[slot] = 0.0


def replay_quality_report_v86(memory: nn.Module, selected_indices: Optional[Tensor] = None, now_step: int = 0) -> Dict[str, float]:
    _ensure_replay_metadata_v86(memory)
    valid = torch.nonzero(memory.learning_replay_valid_v83 > 0.5, as_tuple=False).flatten()
    if valid.numel() == 0:
        return {
            "valid": 0.0,
            "priority_entropy": 0.0,
            "input_coverage": 0.0,
            "target_coverage": 0.0,
            "age_coverage": 0.0,
            "reuse_entropy": 0.0,
            "diversity": 0.0,
        }
    idx = valid if selected_indices is None else selected_indices.reshape(-1).long().to(valid.device)
    pri = memory.learning_replay_priorities_v83[valid].clamp_min(1e-8)
    p = pri / pri.sum().clamp_min(1e-8)
    p_ent = float((-(p * p.log()).sum() / max(1e-8, torch.log(torch.tensor(float(max(2, valid.numel())), device=p.device)))).item())
    in_cov = float(memory.learning_replay_input_bucket_v86[valid].unique().numel() / max(1, min(int(valid.numel()), 8)))
    tg_cov = float(memory.learning_replay_target_bucket_v86[valid].unique().numel() / max(1, min(int(valid.numel()), 8)))
    ages = (int(now_step) - memory.learning_replay_insert_step_v86[valid]).clamp_min(0)
    q = torch.quantile(ages.float(), torch.tensor([0.25, 0.50, 0.75], device=ages.device)) if valid.numel() >= 4 else ages.float().reshape(-1)
    if valid.numel() >= 4:
        age_bins = torch.bucketize(ages.float(), q, right=False).unique().numel()
        age_cov = float(age_bins / 4.0)
    else:
        age_cov = float(min(1.0, valid.numel() / 4.0))
    uses = memory.learning_replay_use_count_v86[valid].float() + 1.0
    ue = uses / uses.sum().clamp_min(1e-8)
    u_ent = float((-(ue * ue.log()).sum() / max(1e-8, torch.log(torch.tensor(float(max(2, valid.numel())), device=ue.device)))).item())
    diversity = _pairwise_diversity(memory.learning_replay_observations_v83[idx], memory.learning_replay_targets_v83[idx]) if idx.numel() else 0.0
    return {
        "valid": float(valid.numel()),
        "priority_entropy": p_ent,
        "input_coverage": in_cov,
        "target_coverage": tg_cov,
        "age_coverage": age_cov,
        "reuse_entropy": u_ent,
        "diversity": diversity,
    }


def _legacy_replay_indices_v86(memory: nn.Module, batch_size: int) -> Tensor:
    valid = torch.nonzero(memory.learning_replay_valid_v83 > 0.5, as_tuple=False).flatten()
    if valid.numel() == 0:
        return valid
    k = min(int(batch_size), int(valid.numel()))
    pri = memory.learning_replay_priorities_v83[valid]
    top_n = min(2, k)
    chosen = valid[torch.topk(pri, k=top_n).indices].tolist()
    chosen_set = set(int(v) for v in chosen)
    remaining = [int(v.item()) for v in valid if int(v.item()) not in chosen_set]
    need = k - len(chosen)
    if need > 0 and remaining:
        pos = torch.linspace(0, len(remaining) - 1, steps=need).round().long().tolist()
        chosen.extend(remaining[i] for i in pos)
    return torch.tensor(chosen[:k], device=valid.device, dtype=torch.long)


def _selector_quality_v86(memory: nn.Module, idx: Tensor, now_step: int) -> float:
    if idx.numel() == 0:
        return 0.0
    report = replay_quality_report_v86(memory, idx, now_step)
    uses = memory.learning_replay_use_count_v86[idx].float()
    reuse_bonus = float((1.0 / torch.sqrt(1.0 + uses)).mean().item())
    return float(0.30 * report["diversity"] + 0.20 * report["input_coverage"] + 0.20 * report["target_coverage"] + 0.15 * report["age_coverage"] + 0.15 * reuse_bonus)


def _learning_replay_batch_v86(memory: nn.Module, batch_size: int, now_step: int = 0, *, return_report: bool = False) -> Optional[Dict[str, Tensor]]:
    _ensure_replay_metadata_v86(memory)
    valid = torch.nonzero(memory.learning_replay_valid_v83 > 0.5, as_tuple=False).flatten()
    if valid.numel() == 0:
        return None
    k = min(int(batch_size), int(valid.numel()))
    cap = min(int(getattr(memory, "learning_replay_candidate_cap_v86", 32)), int(valid.numel()))
    candidates = valid
    if valid.numel() > cap:
        pri_all = memory.learning_replay_priorities_v83[valid]
        candidates = valid[torch.topk(pri_all, k=cap).indices]
    pri = memory.learning_replay_priorities_v83[candidates].clamp_min(1e-6)
    age = (int(now_step) - memory.learning_replay_insert_step_v86[candidates]).clamp_min(0).float()
    age_scale = age / age.max().clamp_min(1.0)
    uses = memory.learning_replay_use_count_v86[candidates].float()
    reuse_pen = 1.0 / torch.sqrt(1.0 + uses)
    base = pri.sqrt() * (1.0 + float(0.20) * age_scale) * (1.0 + float(0.20) * (reuse_pen - 0.5))
    selected: list[int] = []
    buckets = memory.learning_replay_input_bucket_v86[candidates]
    target_buckets = memory.learning_replay_target_bucket_v86[candidates]
    for source in (buckets, target_buckets):
        seen = set()
        order = torch.argsort(base, descending=True).tolist()
        for pos in order:
            slot = int(candidates[pos].item())
            b = int(source[pos].item())
            if b in seen or slot in selected:
                continue
            selected.append(slot)
            seen.add(b)
            if len(selected) >= min(k, 3):
                break
        if len(selected) >= min(k, 3):
            break
    while len(selected) < k:
        best_slot = None
        best_score = -float("inf")
        chosen_tensor = torch.tensor(selected, device=candidates.device, dtype=torch.long) if selected else None
        if chosen_tensor is not None and chosen_tensor.numel():
            sel_obs = F.normalize(memory.learning_replay_observations_v83[chosen_tensor], dim=-1)
            sel_tgt = F.normalize(memory.learning_replay_targets_v83[chosen_tensor], dim=-1)
        for pos, slot_t in enumerate(candidates.tolist()):
            slot = int(slot_t)
            if slot in selected:
                continue
            score = float(base[pos].item())
            if chosen_tensor is not None and chosen_tensor.numel():
                o = F.normalize(memory.learning_replay_observations_v83[slot].reshape(1, -1), dim=-1)
                t = F.normalize(memory.learning_replay_targets_v83[slot].reshape(1, -1), dim=-1)
                max_sim = float((0.5 * (o @ sel_obs.t()) + 0.5 * (t @ sel_tgt.t())).max().item())
                score *= 1.0 + float(0.75) * max(0.0, 1.0 - max_sim)
            if score > best_score:
                best_score = score
                best_slot = slot
        if best_slot is None:
            break
        selected.append(best_slot)
    candidate_idx = torch.tensor(selected[:k], device=candidates.device, dtype=torch.long)
    legacy_idx = _legacy_replay_indices_v86(memory, k)
    # Safety floor: V86 may improve the legacy selector, but it is forbidden to degrade the
    # current batch on the explicit information-quality objective.
    candidate_score = _selector_quality_v86(memory, candidate_idx, now_step)
    legacy_score = _selector_quality_v86(memory, legacy_idx, now_step)
    if legacy_idx.numel() == candidate_idx.numel() and legacy_score >= candidate_score:
        idx = legacy_idx
        selector_fallback = 1.0
    else:
        idx = candidate_idx
        selector_fallback = 0.0
    with torch.no_grad():
        memory.learning_replay_use_count_v86[idx] += 1
    out = {
        "observation": memory.learning_replay_observations_v83[idx],
        "goal": memory.learning_replay_goals_v83[idx],
        "next_observation": memory.learning_replay_next_observations_v83[idx],
        "next_goal": memory.learning_replay_next_goals_v83[idx],
        "target_latent": memory.learning_replay_targets_v83[idx],
        "priority": memory.learning_replay_priorities_v83[idx],
        "indices_v86": idx,
        "selector_fallback_v86": memory.learning_replay_priorities_v83[idx].new_tensor(selector_fallback),
        "selector_candidate_score_v86": memory.learning_replay_priorities_v83[idx].new_tensor(candidate_score),
        "selector_legacy_score_v86": memory.learning_replay_priorities_v83[idx].new_tensor(legacy_score),
    }
    if return_report:
        report = replay_quality_report_v86(memory, idx, now_step)
        for name in ("priority_entropy", "input_coverage", "target_coverage", "age_coverage", "reuse_entropy", "diversity"):
            out[f"quality_{name}_v86"] = memory.learning_replay_priorities_v83[idx].new_tensor(report[name])
    return out


class NeuroWeaveV86(NeuroWeaveV84):
    def __init__(self, cfg: Optional[V86Config] = None):
        super().__init__(cfg or mobile_v86_config(9))
        self.cfg = cfg or self.cfg
        _ensure_replay_metadata_v86(self.neural_memory_v61)
        self.neural_memory_v61.learning_replay_metadata_bins_v86 = int(self.cfg.replay_coverage_bins_v86)
        self.neural_memory_v61.learning_replay_candidate_cap_v86 = int(self.cfg.replay_candidate_cap_v86)

    def learning_parameter_report_v86(self) -> Dict[str, float]:
        rep = self.learning_parameter_report_v84()
        rep["replay_controller_parameter_delta_v86"] = 0.0
        rep["canonical_memory_identity_preserved_v86"] = float(self.neural_memory_v61 is self.neural_memory_v83)
        return rep


class OrganismTrainerV86(OrganismTrainerV84):
    def __init__(self, model: NeuroWeaveV86, lr=None, warmup_steps=4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV86 = model
        self.replay_quality_ema_v86 = 0.0
        self.replay_quality_updates_v86 = 0

    def learning_step_v86(self, x, goal_sequence=None, *, target_latent_sequence=None):
        self.model.train()
        out = self.model.forward_learning_v82(x, goal_sequence, target_latent_sequence=target_latent_sequence)
        current_total, weights = self._balanced_total_v82(out)
        pressure = self._pressure(x, goal_sequence, out, target_latent_sequence)
        prev_pressure_ema = self.replay_pressure_ema_v84
        first_pressure = self.unified_steps_v82 == 0
        pressure_spike = 0.0 if first_pressure else pressure - prev_pressure_ema
        self.replay_pressure_ema_v84 = pressure if first_pressure else 0.9 * prev_pressure_ema + 0.1 * pressure
        active = [p for p in self.model.parameters() if p.requires_grad]
        replay = _learning_replay_batch_v86(
            self.model.neural_memory_v61,
            min(6, self.model.cfg.neural_memory_replay_minibatch_v61),
            now_step=self.unified_steps_v82,
            return_report=True,
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
                ("quality_priority_entropy_v86", "priority_entropy"),
                ("quality_input_coverage_v86", "input_coverage"),
                ("quality_target_coverage_v86", "target_coverage"),
                ("quality_age_coverage_v86", "age_coverage"),
                ("quality_reuse_entropy_v86", "reuse_entropy"),
                ("quality_diversity_v86", "diversity"),
            ):
                quality[name] = float(replay[key].item())
            q_score = 0.20 * quality["priority_entropy"] + 0.20 * quality["input_coverage"] + 0.20 * quality["target_coverage"] + 0.15 * quality["age_coverage"] + 0.10 * quality["reuse_entropy"] + 0.15 * min(1.0, quality["diversity"])
            self.replay_quality_ema_v86 = q_score if self.replay_quality_updates_v86 == 0 else float(self.model.cfg.replay_quality_ema_decay_v86) * self.replay_quality_ema_v86 + (1.0 - float(self.model.cfg.replay_quality_ema_decay_v86)) * q_score
            self.replay_quality_updates_v86 += 1
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
        norm = float(nn.utils.clip_grad_norm_(active, self.model.cfg.unified_gradient_clip_v80).item())
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
            "steps": float(self.unified_steps_v82),
        }

    def _write_v86(self, x, goals, out, target_latent_sequence=None):
        if x.size(1) < 2:
            return 0
        g = goals if goals is not None else x.new_zeros(x.size(0), x.size(1), self.model.cfg.goal_dim)
        with torch.no_grad():
            if target_latent_sequence is None:
                tgt = torch.stack([self.model.brain46.target_latent(x[:, i + 1], g[:, i + 1]) for i in range(x.size(1) - 1)], 1)
            else:
                tgt = target_latent_sequence.reshape(x.size(0), x.size(1) - 1, self.model.cfg.latent_dim_v46).detach().to(x)
            pred = out["spine_next_latent"][:, :-1]
            novelty = (1.0 - F.cosine_similarity(pred, tgt, dim=-1)).clamp_min(0.0)
            boost = min(3.0, (1 + 0.75 * max(0, self.replay_pressure_ema_v84)) * (1 + 0.75 * max(0, -self.replay_last_conflict_v84)))
            pri = novelty * boost + self.model.cfg.replay_priority_floor_v84
            for i in range(x.size(1) - 1):
                _write_learning_transition_v86(
                    self.model.neural_memory_v61,
                    x[:, i], g[:, i], x[:, i + 1], g[:, i + 1], tgt[:, i],
                    priority=float(pri[:, i].mean().item()), step=self.unified_steps_v82,
                )
        return (x.size(1) - 1) * x.size(0)

    def state_dict_v86(self):
        return {**super().state_dict_v84(), "replay_quality_ema_v86": self.replay_quality_ema_v86, "replay_quality_updates_v86": self.replay_quality_updates_v86}

    def load_state_dict_v86(self, state):
        self.load_state_dict_v84(state)
        self.replay_quality_ema_v86 = float(state.get("replay_quality_ema_v86", 0.0))
        self.replay_quality_updates_v86 = int(state.get("replay_quality_updates_v86", 0))


class OrganismRuntimeV86(OrganismRuntimeV84):
    @torch.no_grad()
    def reset_fast_state_v86(self):
        self.h46.zero_()
        self.fast47.zero_()
        self.slow47.zero_()
        self.world_h.zero_()
        self.spine_state.zero_()
        self.memory_prior.zero_()
        dev = next(self.model.parameters()).device
        dt = next(self.model.parameters()).dtype
        self.self_state = self.model.self_model_v55.initial_state(1, dev, dt)
        self.mts_state = self.model.multiscale_v56.initial_state(1, dev, dt)
        self.steps = 0

    @torch.no_grad()
    def replay_recent_experiences_v86(self, count: int = 4) -> Dict[str, Tensor]:
        mem = self.model.neural_memory_v61
        _ensure_replay_metadata_v86(mem)
        valid = torch.nonzero(mem.learning_replay_valid_v83 > 0.5, as_tuple=False).flatten()
        if valid.numel() == 0:
            return {"replayed": torch.zeros((), dtype=torch.long, device=valid.device), "indices": valid}
        order = torch.argsort(mem.learning_replay_insert_step_v86[valid])
        take = min(int(count), int(valid.numel()))
        idx = valid[order[-take:]]
        # Oldest-to-newest order reconstructs the temporal hidden state rather than merely re-reading a bag.
        for slot in idx:
            obs = mem.learning_replay_observations_v83[slot]
            goal = mem.learning_replay_goals_v83[slot]
            self.step(obs, goal)
        return {"replayed": torch.tensor(int(idx.numel()), device=valid.device), "indices": idx}


class RuntimeStateStoreV86(RuntimeStateStoreV84):
    VERSION = 86

    @classmethod
    def save(cls, path, model, trainer=None, runtime=None):
        torch.save({
            "version_v86": cls.VERSION,
            "base_version": 84,
            "model": model.state_dict(),
            "trainer": trainer.state_dict_v86() if trainer else None,
            "runtime": runtime.state_dict() if runtime else None,
        }, path)

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
                trainer.load_state_dict_v86(p["trainer"])
                opt = True
            except (ValueError, RuntimeError):
                reset = True
        if runtime is not None and p.get("runtime") is not None:
            runtime.load_state_dict(p["runtime"])
        return {
            "version": int(p.get("version_v86", p.get("version_v84", 0))),
            "loaded_tensors": len(compatible),
            "missing_tensors": missing,
            "shape_mismatch": shape,
            "unexpected_tensors": unexpected,
            "optimizer_loaded": opt,
            "optimizer_reset": reset,
        }
