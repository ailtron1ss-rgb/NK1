from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Callable
import io

import torch

from .structural_plasticity_controller_v1 import StructuralPlasticityControllerV1, StructuralTransactionResultV1
from .neural_substrate_v1 import ModernNeuralSubstrateV1


@dataclass(frozen=True)
class ElasticPlanV1:
    mode: str
    max_grow: int
    max_prune: int
    target_fraction: float
    reason: str
    uncertainty: float = 0.0
    plasticity_gap: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


class ElasticSubstratePolicyV1:
    VERSION = "elastic-substrate-policy-v1"

    def __init__(self, seed: int = 19107, hysteresis: float = 0.04):
        self.seed = int(seed)
        self.hysteresis = float(hysteresis)
        self.transaction = StructuralPlasticityControllerV1(seed=seed + 17)

    def propose(
        self,
        *,
        active_fraction: float,
        target_fraction: float,
        uncertainty: float,
        plasticity_gap: float,
        max_delta: float = 0.08,
    ) -> ElasticPlanV1:
        active = float(active_fraction)
        target = max(0.25, min(0.95, float(target_fraction)))
        u = max(0.0, float(uncertainty))
        gap = float(plasticity_gap)
        delta = target - active
        if abs(delta) <= self.hysteresis and u < 0.35:
            return ElasticPlanV1("defer", 0, 0, target, "inside_hysteresis", u, gap)
        if delta > self.hysteresis or (u >= 0.65 and gap > 0.10):
            grow = max(1, min(8, int(round(abs(delta) * 32)) + (1 if u >= 0.65 else 0)))
            return ElasticPlanV1("grow", min(grow, 8), 0, min(target, active + max_delta), "plasticity_or_uncertainty_pressure", u, gap)
        if delta < -self.hysteresis and gap < 0.10:
            prune = max(1, min(8, int(round(abs(delta) * 32))))
            return ElasticPlanV1("prune", 0, prune, max(target, active - max_delta), "low_utility_or_excess_capacity", u, gap)
        return ElasticPlanV1("defer", 0, 0, target, "insufficient_evidence", u, gap)


    @staticmethod
    def structural_health(substrate, *, target_fraction: float) -> float:
        """Deterministic structural-health utility, not a capability score.

        The utility is intentionally limited to properties directly observable
        from the substrate itself: E/I row coverage, connection-density error,
        activity-rate homeostasis and energy load. It must never be used as a
        substitute for task/holdout/OOD capability evidence.
        """
        mask = substrate.synapse_mask.detach() > 0
        exc = mask[:, : substrate.exc_neurons].any(dim=1)
        inh = mask[:, substrate.exc_neurons :].any(dim=1)
        ei_coverage = float((exc & inh).float().mean().item())
        active = float(mask.float().mean().item())
        density_error = abs(active - float(target_fraction))
        density_score = max(0.0, 1.0 - density_error / 0.25)
        metrics = substrate.metrics()
        target_rate = float(substrate.target_rate)
        rate_error = abs(float(metrics.mean_rate) - target_rate)
        rate_score = max(0.0, 1.0 - rate_error / max(0.05, target_rate))
        energy_score = 1.0 / (1.0 + max(0.0, float(metrics.energy_load)))
        return float(min(ei_coverage, density_score, rate_score, energy_score))

    def structural_evaluator(self, plan: ElasticPlanV1):
        """Return a structural-health evaluator bound to one elastic plan."""
        return lambda substrate: self.structural_health(substrate, target_fraction=plan.target_fraction)

    def apply(self, substrate, plan: ElasticPlanV1, *, evaluator: Callable[[object], float], min_gain: float = 0.0) -> StructuralTransactionResultV1:
        if plan.mode == "defer":
            utility = float(evaluator(substrate))
            active = int((substrate.synapse_mask > 0).sum().item())
            return StructuralTransactionResultV1(False, utility, utility, 0.0, active, active, False, True, "defer", 0.0)
        snapshot = self.transaction._snapshot(substrate)
        proposal = self.transaction.propose(
            substrate,
            max_prune=plan.max_prune,
            max_grow=plan.max_grow,
            min_active_fraction=max(0.25, min(0.95, plan.target_fraction - 0.05)),
        )
        result = self.transaction.apply_transaction(
            substrate, proposal, evaluator=evaluator, min_gain=float(min_gain), max_energy_increase=0.10,
        )
        restart_ok = self._restart_equivalent(substrate)
        if result.accepted and not restart_ok:
            self.transaction._restore(substrate, snapshot)
            return StructuralTransactionResultV1(
                False, result.utility_before, result.utility_before, 0.0,
                result.active_before, result.active_before, True, False,
                "restart_equivalence_reject", result.energy_delta,
            )
        return StructuralTransactionResultV1(
            result.accepted, result.utility_before, result.utility_after, result.gain,
            result.active_before, result.active_after, result.rollback, restart_ok,
            result.reason, result.energy_delta,
        )

    @staticmethod
    def _restart_equivalent(substrate) -> bool:
        # Serialize and reload the full state so the check validates an actual
        # process-boundary-compatible checkpoint rather than copying tensors
        # directly between two live objects.
        buffer = io.BytesIO()
        torch_state = {k: v.detach().cpu() for k, v in substrate.state_dict().items()}
        torch.save(torch_state, buffer)
        buffer.seek(0)
        restored_state = torch.load(buffer, map_location="cpu", weights_only=True)
        fresh = ModernNeuralSubstrateV1(
            substrate.input_dim, exc_neurons=substrate.exc_neurons,
            inh_neurons=substrate.inh_neurons, branches=len(substrate.dendrites.branches),
            dt=float(substrate.dt), membrane_decay=float(substrate.membrane_decay),
            apical_decay=float(substrate.apical_decay), trace_decay=float(substrate.trace_decay),
            fast_decay=float(substrate.fast_decay), target_rate=float(substrate.target_rate), seed=9913,
        )
        fresh.load_state_dict(restored_state, strict=False)
        return bool(fresh.state_digest() == substrate.state_digest())
