from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Callable, Sequence, Tuple
import copy
import hashlib

import torch


@dataclass(frozen=True)
class StructuralPlanV1:
    grow: Tuple[Tuple[int, int], ...]
    prune: Tuple[Tuple[int, int], ...]
    active_before: int
    active_after: int
    grow_count: int
    prune_count: int
    reason: str
    energy_delta: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class StructuralTransactionResultV1:
    accepted: bool
    utility_before: float
    utility_after: float
    gain: float
    active_before: int
    active_after: int
    rollback: bool
    restart_ok: bool
    reason: str
    energy_delta: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


class StructuralPlasticityControllerV1:
    VERSION = "structural-plasticity-controller-v1"

    @staticmethod
    def _snapshot(substrate):
        return {
            "synapse_mask": substrate.synapse_mask.detach().clone(),
            "recurrent": substrate.recurrent.detach().clone(),
            "fast_weight": substrate.fast_weight.detach().clone(),
            "utility": substrate.synapse_utility.detach().clone(),
            "events": int(substrate._structural_events),
        }

    @staticmethod
    def _restore(substrate, snapshot) -> None:
        with torch.no_grad():
            substrate.synapse_mask.copy_(snapshot["synapse_mask"])
            substrate.recurrent.copy_(snapshot["recurrent"])
            substrate.fast_weight.copy_(snapshot["fast_weight"])
            substrate.synapse_utility.copy_(snapshot["utility"])
            substrate._structural_events = int(snapshot["events"])

    @staticmethod
    def _fingerprint(substrate) -> str:
        data = torch.cat([
            substrate.synapse_mask.detach().reshape(-1).cpu(),
            substrate.recurrent.detach().reshape(-1).cpu(),
        ]).numpy().tobytes()
        return hashlib.sha256(data).hexdigest()[:24]

    def __init__(self, seed: int = 6113):
        self.seed = int(seed)

    def propose(self, substrate, *, max_prune: int = 4, max_grow: int = 4, min_active_fraction: float = 0.55) -> StructuralPlanV1:
        mask = substrate.synapse_mask.detach().clone()
        utility = substrate.synapse_utility.detach().abs()
        eligibility = substrate.eligibility.detach().abs()
        active = mask > 0
        inactive = ~active
        active_before = int(active.sum().item())
        total = int(mask.numel())
        min_active = int(total * float(min_active_fraction))
        prune_budget = max(0, min(int(max_prune), active_before - min_active))
        prune_idx = []
        if prune_budget:
            vals = torch.where(active, utility, torch.full_like(utility, float("inf")))
            order = torch.argsort(vals.reshape(-1))
            working = active.clone()
            for flat_i in order.tolist():
                if len(prune_idx) >= prune_budget:
                    break
                row = int(flat_i // mask.shape[1])
                col = int(flat_i % mask.shape[1])
                if not bool(working[row, col]):
                    continue
                exc_sources = int(working[row, : substrate.exc_neurons].sum().item())
                inh_sources = int(working[row, substrate.exc_neurons :].sum().item())
                is_exc = col < substrate.exc_neurons
                if (is_exc and exc_sources <= 1) or ((not is_exc) and inh_sources <= 1):
                    continue
                working[row, col] = False
                prune_idx.append((row, col))
        grow_budget = min(int(max_grow), int(inactive.sum().item()))
        grow_idx = []
        if grow_budget:
            scores = eligibility * inactive
            flat = torch.topk(scores.reshape(-1), k=grow_budget).indices
            grow_idx = [(int(i // mask.shape[1]), int(i % mask.shape[1])) for i in flat if float(scores.reshape(-1)[i]) > 0.0]
        active_after = active_before - len(prune_idx) + len(grow_idx)
        return StructuralPlanV1(tuple(grow_idx), tuple(prune_idx), active_before, active_after, len(grow_idx), len(prune_idx), "utility-prune+eligibility-grow")

    def apply_transaction(
        self,
        substrate,
        plan: StructuralPlanV1,
        *,
        evaluator: Callable[[object], float],
        min_gain: float = 0.0,
        max_energy_increase: float = 0.10,
    ) -> StructuralTransactionResultV1:
        snap = self._snapshot(substrate)
        before_fp = self._fingerprint(substrate)
        utility_before = float(evaluator(substrate))
        energy_before = float(substrate.metrics().energy_load)
        with torch.no_grad():
            for row, col in plan.prune:
                substrate.synapse_mask[row, col] = 0.0
                substrate.fast_weight[row, col] = 0.0
            for row, col in plan.grow:
                substrate.synapse_mask[row, col] = 1.0
                substrate.recurrent[row, col] = 0.01
        utility_after = float(evaluator(substrate))
        gain = utility_after - utility_before
        energy_delta = float(substrate.metrics().energy_load) - energy_before
        accepted = gain >= float(min_gain) and energy_delta <= float(max_energy_increase)
        if gain < float(min_gain):
            reason = "external_gate_reject"
        elif energy_delta > float(max_energy_increase):
            reason = "energy_budget_reject"
        else:
            reason = "accepted"
        if not accepted:
            self._restore(substrate, snap)
        after_fp = self._fingerprint(substrate)
        restart_ok = before_fp == after_fp if not accepted else True
        return StructuralTransactionResultV1(
            accepted, utility_before, utility_after if accepted else utility_before,
            gain if accepted else 0.0, plan.active_before,
            plan.active_after if accepted else plan.active_before,
            not accepted, restart_ok, reason, energy_delta,
        )
