from __future__ import annotations
from pathlib import Path
import json


def write_neural_research_evidence(root: Path) -> Path:
    root = Path(root)
    payload = {
        "release": "1.14.0-neural-research",
        "status": "research_only",
        "canonical_neural_track": "neural_program_synth_v2",
        "promotion_decision": "REJECT_V4_V5_V6_AS_DEFAULT",
        "reason": "No causal multi-seed downstream verified-rate improvement was demonstrated over the established V2 typed neural baseline.",
        "measured": [
            {
                "experiment": "atomic_v4_factorized_matched",
                "steps": 70,
                "seeds": [3301, 3302, 3303],
                "v2_params": 127712,
                "atomic_params": 129594,
                "v2_mean_family_accuracy": 0.0,
                "atomic_mean_family_accuracy": 0.3111111111111111,
                "v2_mean_verified_rate": 0.0,
                "atomic_mean_verified_rate": 0.0,
                "all_seed_non_degraded_family": True,
                "all_seed_non_degraded_verified": True,
            },
            {
                "experiment": "v2_typed_baseline",
                "steps": 500,
                "seeds": [6101, 6102, 6103],
                "verified_rates": [0.6, 0.6, 0.8],
                "mean_verified_rate": 0.6666666666666666,
            },
            {
                "experiment": "v2_constrained_and_beam_ablation",
                "steps": 500,
                "seeds": [7101, 7102, 7103],
                "standard_verified_rates": [0.6, 0.6, 0.6],
                "constrained_verified_rates": [0.6, 0.6, 0.6],
                "beam_verified_rates": [0.6, 0.6, 0.6],
                "interpretation": "No measured quality gain from neural-only constrained greedy or beam decoding.",
            },
            {
                "experiment": "semantic_ir_v5",
                "steps": 500,
                "seeds": [8101, 8102, 8103],
                "verified_rates": [0.6, 0.4, 0.6],
                "parameters": 145828,
                "status": "research_only",
            },
            {
                "experiment": "hierarchical_opcode_v6",
                "steps": 300,
                "seeds": [9301, 9302, 9303],
                "verified_rates": [0.0, 0.2, 0.0],
                "parameters": 125028,
                "status": "research_only",
            },
        ],
        "unresolved": [
            "long-horizon scheduled-sampling A/B exceeded the execution budget and is therefore not treated as PASS or FAIL",
            "family routing remains a major neural bottleneck when raw text is used without semantic TaskSpec conditioning",
        ],
        "next_bottleneck": "Improve TaskSpec-to-program neural grounding data and objective before applying additional RL/execution feedback.",
    }
    path = root / "runtime" / "neural_research_evidence_1_14.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return path
