from __future__ import annotations

import json
import statistics
import time
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import torch

from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
from core.nomega.neural_program_synth_v8 import NeuralProgramSynthesizerV8
from core.nomega.neural_program_synth_v9 import NeuralProgramSynthesizerV9
from core.nomega.neural_program_trainer_v5 import AtomicProgramTrainerV5
from core.nomega.neural_program_trainer_v6 import AtomicProgramTrainerV6
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
from core.nomega.task_spec_ood_benchmark_v1 import TaskSpecOodBenchmarkV1
from core.nomega.task_spec_v1 import FAMILY_ORDER, CUES, CANONICAL_PROMPT, FAMILY_TO_ID

SEEDS = (15001, 15002, 15003)
FAMILIES = tuple(FAMILY_ORDER[:10])
STEPS = 8
HIDDEN = 32


def family_accuracy(model) -> float:
    correct = total = 0
    for family in FAMILIES:
        cue = next((c for c in CUES[family] if c != CANONICAL_PROMPT[family]), CANONICAL_PROMPT[family])
        text = f"In direct terms, {cue}."
        with torch.no_grad():
            _, logits = model._condition(text, None, None)
            pred = int(logits.argmax(-1).item())
        correct += int(pred == FAMILY_TO_ID[family]); total += 1
    return correct / max(1, total)


def verified_rate(model, seed: int):
    bench = TaskSpecOodBenchmarkV1(ROOT)
    out = bench.evaluate_model(model, seed=seed + 800, max_len=20, condition_mode='end_to_end')
    return float(out['prompt_level_verification'])


def run_track(seed: int, track: str):
    learner = ExecutionGuidedProgramLearnerV1(ROOT, seed=seed, hidden=HIDDEN)
    rows = learner.training_rows(FAMILIES, condition_mode='typed', include_replay=False)
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    if track == 'v8_v5':
        model = NeuralProgramSynthesizerV8(vocab=2048, hidden=HIDDEN, latent_dim=HIDDEN, max_len=20, max_b=64, layers=1, heads=4, family_count=20)
        trainer = AtomicProgramTrainerV5(model, seed=seed, lr=8e-4)
        t0 = time.perf_counter()
        report = trainer.fit(rows, epochs=STEPS, batch_size=8, max_examples=len(rows), scheduled_prefix_start=0.0, scheduled_prefix_end=0.30, scheduled_max_tokens=8)
    elif track == 'v9_v5':
        model = NeuralProgramSynthesizerV9(vocab=2048, hidden=HIDDEN, latent_dim=HIDDEN, max_len=20, max_b=64, layers=1, heads=4, family_count=20)
        trainer = AtomicProgramTrainerV5(model, seed=seed, lr=8e-4)
        t0 = time.perf_counter()
        report = trainer.fit(rows, epochs=STEPS, batch_size=8, max_examples=len(rows), scheduled_prefix_start=0.0, scheduled_prefix_end=0.30, scheduled_max_tokens=8)
    else:
        model = NeuralProgramSynthesizerV9(vocab=2048, hidden=HIDDEN, latent_dim=HIDDEN, max_len=20, max_b=64, layers=1, heads=4, family_count=20)
        trainer = AtomicProgramTrainerV6(model, seed=seed, lr=8e-4)
        t0 = time.perf_counter()
        report = trainer.fit(rows, epochs=STEPS, batch_size=8, max_examples=len(rows), scheduled_prefix_start=0.0, scheduled_prefix_end=0.30, scheduled_max_tokens=8, semantic_weight=0.20)
    elapsed = time.perf_counter() - t0
    return {
        'seed': seed, 'track': track, 'steps': int(report.steps),
        'family_accuracy': family_accuracy(model),
        'verified_rate': verified_rate(model, seed),
        'parameters': sum(p.numel() for p in model.parameters()),
        'wall_s': elapsed,
        'loss': float(report.loss),
        'semantic_loss': float(getattr(report, 'semantic_loss', 0.0)),
    }


def main():
    t0 = time.perf_counter()
    results = []
    for seed in SEEDS:
        for track in ('v8_v5', 'v9_v5', 'v9_v6'):
            row = run_track(seed, track)
            print(row, flush=True)
            results.append(row)
    summary = {}
    for track in ('v8_v5', 'v9_v5', 'v9_v6'):
        rows = [x for x in results if x['track'] == track]
        summary[track] = {k: statistics.mean(x[k] for x in rows) for k in ('family_accuracy','verified_rate','parameters','wall_s','loss','semantic_loss','steps')}
    out = {
        'protocol': {'release':'1.15.0-dev', 'families':list(FAMILIES), 'seeds':list(SEEDS), 'steps_per_model':STEPS, 'hidden':HIDDEN,
                     'tracks': ['v8_v5','v9_v5','v9_v6']},
        'results': results, 'summary': summary, 'elapsed_s': time.perf_counter()-t0,
        'interpretation': 'research_only; V9/V6 is not promoted unless independent holdout/OOD evidence passes governance.'
    }
    path = ROOT/'runtime'/'typed_grounding_v9_matched_ablation.json'
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
