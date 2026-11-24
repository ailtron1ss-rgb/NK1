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
from core.nomega.neural_program_repair_v1 import NeuralProgramRepairV1
from core.nomega.task_spec_v1 import CUES, CANONICAL_PROMPT, FAMILY_TO_ID

SEEDS = (18001, 18002, 18003)
FAMILIES = ("sum3", "xor3", "mul2", "sub_offset", "minmax3", "parity_mix")
STEPS = 8
HIDDEN = 32
MAX_CANDIDATES = 12


def run_track(seed: int):
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    learner = ExecutionGuidedProgramLearnerV1(ROOT, seed=seed, hidden=HIDDEN)
    rows = learner.training_rows(FAMILIES, condition_mode='typed', include_replay=False)
    model = NeuralProgramSynthesizerV9(
        vocab=2048, hidden=HIDDEN, latent_dim=HIDDEN, max_len=20,
        max_b=64, layers=1, heads=4, family_count=20,
    )
    trainer = AtomicProgramTrainerV5(model, seed=seed, lr=8e-4)
    t0 = time.perf_counter()
    report = trainer.fit(
        rows, epochs=STEPS, batch_size=8, max_examples=len(rows),
        scheduled_prefix_start=0.0, scheduled_prefix_end=0.30,
        scheduled_max_tokens=8,
    )
    train_s = time.perf_counter() - t0

    pure_rows = []
    repaired_rows = []
    for idx, family in enumerate(FAMILIES):
        cue = next((c for c in CUES[family] if c != CANONICAL_PROMPT[family]), CANONICAL_PROMPT[family])
        prompt = f"In direct terms, {cue}."
        code = model.generate(prompt, family_id=None, max_len=20, beam_size=1, family_beam=3)
        repair = NeuralProgramRepairV1(ROOT, seed=seed + 1000 + idx)
        result = repair.repair(code, family, seed_offset=0, max_candidates=MAX_CANDIDATES)
        pure_rows.append({
            'family': family,
            'prompt': prompt,
            'family_id_predicted': None,
            'pure_verified': result.original_verified,
            'pure_holdout': result.original_holdout,
            'pure_adversarial': result.original_adversarial,
            'pure_hvm': result.original_hvm,
            'code': [list(x) for x in code],
        })
        repaired_rows.append(result.to_dict())

    return {
        'seed': seed,
        'steps': int(report.steps),
        'train_wall_s': train_s,
        'parameters': sum(p.numel() for p in model.parameters()),
        'pure_neural_verified_rate': statistics.mean(int(x['pure_verified']) for x in pure_rows),
        'repaired_verified_rate': statistics.mean(int(x['repaired_verified']) for x in repaired_rows),
        'pure_holdout': statistics.mean(x['pure_holdout'] for x in pure_rows),
        'repaired_holdout': statistics.mean(x['repaired_holdout'] for x in repaired_rows),
        'pure_adversarial': statistics.mean(x['pure_adversarial'] for x in pure_rows),
        'repaired_adversarial': statistics.mean(x['repaired_adversarial'] for x in repaired_rows),
        'pure_hvm': statistics.mean(x['pure_hvm'] for x in pure_rows),
        'repaired_hvm': statistics.mean(x['repaired_hvm'] for x in repaired_rows),
        'pure_rows': pure_rows,
        'repaired_rows': repaired_rows,
    }


def main():
    t0 = time.perf_counter()
    results = []
    for seed in SEEDS:
        row = run_track(seed)
        print({k: row[k] for k in ('seed', 'steps', 'train_wall_s', 'pure_neural_verified_rate', 'repaired_verified_rate', 'pure_holdout', 'repaired_holdout')}, flush=True)
        results.append(row)

    summary = {}
    scalar_keys = (
        'pure_neural_verified_rate', 'repaired_verified_rate',
        'pure_holdout', 'repaired_holdout',
        'pure_adversarial', 'repaired_adversarial',
        'pure_hvm', 'repaired_hvm', 'train_wall_s',
    )
    for key in scalar_keys:
        vals = [float(r[key]) for r in results]
        summary[key] = statistics.mean(vals)
    summary['verified_rate_delta'] = summary['repaired_verified_rate'] - summary['pure_neural_verified_rate']
    summary['holdout_delta'] = summary['repaired_holdout'] - summary['pure_holdout']
    summary['adversarial_delta'] = summary['repaired_adversarial'] - summary['pure_adversarial']
    summary['hvm_delta'] = summary['repaired_hvm'] - summary['pure_hvm']

    out = {
        'protocol': {
            'release': '1.15.0-dev',
            'track': 'NEURAL_PLUS_ORACLE_FAMILY_LOCAL_REPAIR',
            'description': 'Pure neural candidate is compared with bounded local execution-guided mutations evaluated using the known benchmark family. This is a hybrid ablation, not pure neural capability.',
            'families': list(FAMILIES),
            'seeds': list(SEEDS),
            'steps_per_model': STEPS,
            'hidden': HIDDEN,
            'max_candidates': MAX_CANDIDATES,
        },
        'results': results,
        'summary': summary,
        'elapsed_s': time.perf_counter() - t0,
        'interpretation': 'research_only; no promotion. Family oracle is intentionally disclosed. Improvement only counts as evidence for the hybrid repair mechanism, not autonomous neural synthesis.',
    }
    path = ROOT / 'runtime' / 'neural_repair_v1_matched_ablation.json'
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'summary': summary, 'elapsed_s': out['elapsed_s']}, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
