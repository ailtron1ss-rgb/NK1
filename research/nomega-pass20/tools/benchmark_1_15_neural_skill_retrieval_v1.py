from __future__ import annotations

import json
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import torch

from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
from core.nomega.neural_program_synth_v9 import NeuralProgramSynthesizerV9
from core.nomega.neural_program_trainer_v5 import AtomicProgramTrainerV5
from core.nomega.neural_skill_retrieval_v1 import NeuralSkillRetrievalV1
from core.nomega.task_spec_v1 import CUES, CANONICAL_PROMPT

SEEDS = (18101, 18102, 18103)
FAMILIES = ("sum3", "xor3", "mul2", "sub_offset", "minmax3", "parity_mix")
STEPS = 8
HIDDEN = 32
MAX_CANDIDATES = 12


def run(seed: int):
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    learner = ExecutionGuidedProgramLearnerV1(ROOT, seed=seed, hidden=HIDDEN)
    rows = learner.training_rows(FAMILIES, condition_mode="typed", include_replay=False)
    model = NeuralProgramSynthesizerV9(vocab=2048, hidden=HIDDEN, latent_dim=HIDDEN, max_len=20, max_b=64, layers=1, heads=4, family_count=20)
    trainer = AtomicProgramTrainerV5(model, seed=seed, lr=8e-4)
    t0 = time.perf_counter()
    report = trainer.fit(rows, epochs=STEPS, batch_size=8, max_examples=len(rows), scheduled_prefix_start=0.0, scheduled_prefix_end=0.30, scheduled_max_tokens=8)
    train_s = time.perf_counter() - t0
    pure = []
    hybrid = []
    for idx, family in enumerate(FAMILIES):
        cue = next((c for c in CUES[family] if c != CANONICAL_PROMPT[family]), CANONICAL_PROMPT[family])
        prompt = f"In direct terms, {cue}."
        code = model.generate(prompt, family_id=None, max_len=20, beam_size=1, family_beam=3)
        result = NeuralSkillRetrievalV1(ROOT, seed=seed + idx + 1).search(code, family, max_candidates=MAX_CANDIDATES)
        pure.append({"family": family, "verified": result.original_verified, "holdout": result.original_holdout, "adversarial": result.original_adversarial, "hvm": result.original_hvm, "code": [list(x) for x in code]})
        hybrid.append(result.to_dict())
    return {
        "seed": seed,
        "steps": int(report.steps),
        "train_wall_s": train_s,
        "pure_verified_rate": statistics.mean(int(x["verified"]) for x in pure),
        "hybrid_verified_rate": statistics.mean(int(x["selected_verified"]) for x in hybrid),
        "pure_holdout": statistics.mean(x["holdout"] for x in pure),
        "hybrid_holdout": statistics.mean(x["selected_holdout"] for x in hybrid),
        "pure_adversarial": statistics.mean(x["adversarial"] for x in pure),
        "hybrid_adversarial": statistics.mean(x["selected_adversarial"] for x in hybrid),
        "pure_hvm": statistics.mean(x["hvm"] for x in pure),
        "hybrid_hvm": statistics.mean(x["selected_hvm"] for x in hybrid),
        "pure": pure,
        "hybrid": hybrid,
    }


def main():
    t0 = time.perf_counter()
    results = []
    for seed in SEEDS:
        r = run(seed)
        results.append(r)
        print({k: r[k] for k in ("seed", "pure_verified_rate", "hybrid_verified_rate", "pure_holdout", "hybrid_holdout")}, flush=True)
    summary = {k: statistics.mean(float(r[k]) for r in results) for k in ("pure_verified_rate", "hybrid_verified_rate", "pure_holdout", "hybrid_holdout", "pure_adversarial", "hybrid_adversarial", "pure_hvm", "hybrid_hvm", "train_wall_s")}
    summary["verified_rate_delta"] = summary["hybrid_verified_rate"] - summary["pure_verified_rate"]
    summary["holdout_delta"] = summary["hybrid_holdout"] - summary["pure_holdout"]
    summary["adversarial_delta"] = summary["hybrid_adversarial"] - summary["pure_adversarial"]
    summary["hvm_delta"] = summary["hybrid_hvm"] - summary["pure_hvm"]
    out = {
        "protocol": {
            "release": "1.15.0-dev",
            "track": "NEURAL_PLUS_SKILL_RETRIEVAL_VERIFICATION",
            "description": "Neural proposal is followed by bounded structural skill retrieval. Retrieved candidates are never trusted by similarity and must pass target holdout, adversarial, and HVM checks.",
            "families": list(FAMILIES), "seeds": list(SEEDS), "steps_per_model": STEPS,
            "hidden": HIDDEN, "max_candidates": MAX_CANDIDATES,
        },
        "results": results,
        "summary": summary,
        "elapsed_s": time.perf_counter() - t0,
        "interpretation": "research_only; hybrid memory/retrieval capability is measured separately from pure neural capability and is not promoted automatically.",
    }
    path = ROOT / "runtime" / "neural_skill_retrieval_v1_matched_ablation.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"summary": summary, "elapsed_s": out["elapsed_s"]}, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
