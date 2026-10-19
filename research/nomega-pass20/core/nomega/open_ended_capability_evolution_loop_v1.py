from __future__ import annotations
from pathlib import Path
from typing import Any
import json

from .capability_evolver_v1 import CapabilityEvolverV1
from .gradual_drift_benchmark_v1 import GradualDriftBenchmarkV1
from .elastic_substrate_policy_v1 import ElasticSubstratePolicyV1
from .neural_substrate_v1 import ModernNeuralSubstrateV1
from .program_acquisition_v2 import ProgramAcquisitionCoreV2


class OpenEndedCapabilityEvolutionLoopV1:
    VERSION = "open-ended-capability-evolution-loop-v1"

    def __init__(self, root: Path, seed: int = 23117):
        self.root = Path(root)
        self.seed = int(seed)
        self.evolver = CapabilityEvolverV1(self.root, seed=seed + 1)
        self.drift = GradualDriftBenchmarkV1(self.root, seed=seed + 2)
        self.elastic = ElasticSubstratePolicyV1(seed=seed + 3)

    def run_smoke(self) -> dict[str, Any]:
        family = "sum3"
        acq = ProgramAcquisitionCoreV2(self.root, seed=self.seed + 8)
        code = [tuple(x) for x in acq.templates(family)[0]]
        rows = [([1, 2, 3, 0], 6), ([2, 4, 1, 0], 7), ([3, 3, 2, 0], 8)]
        report = self.evolver.discover(family, code, rows, budget=6, generations=2)
        stream = self.drift.build_stream("sum3", "xor3", phases=4, rows_per_phase=6)
        scores = [
            float(self.drift._evaluate_program(code, p.holdout_rows)[1])
            for p in stream
        ]
        lag = self.drift.measure_lag(scores, threshold=0.6)
        substrate = ModernNeuralSubstrateV1(6, exc_neurons=4, inh_neurons=2, seed=self.seed + 19)
        plan = self.elastic.propose(active_fraction=float(substrate.synapse_mask.mean()), target_fraction=0.70, uncertainty=0.8, plasticity_gap=0.25)
        structural = self.elastic.apply(
            substrate, plan, evaluator=self.elastic.structural_evaluator(plan), min_gain=0.0
        )
        sources = {str(x.get("source")) for x in report.lineage}
        result = {
            "version": self.VERSION,
            "family": family,
            "candidates": report.candidates,
            "verified": report.verified,
            "baseline_present": report.baseline_present,
            "lineage_events": len(report.lineage),
            "sources": sorted(sources),
            "drift": {"phases": len(stream), "lag": lag, "scores": scores},
            "structural": structural.to_dict(),
            "promotion": {"status": "research-only", "reason": "open_ended_discovery_requires_multiseed_external_gain"},
        }
        path = self.root / "runtime" / "nomega_1_29_smoke.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
        return result
