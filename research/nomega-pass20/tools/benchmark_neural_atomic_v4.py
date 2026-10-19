from __future__ import annotations
from pathlib import Path
import json, time
import torch

from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2
from core.nomega.neural_program_synth_v4 import AtomicProgramSynthesizerV4, AtomicProgramTrainerV4
from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
from core.nomega.task_spec_ood_benchmark_v1 import TaskSpecOodBenchmarkV1
from core.nomega.task_spec_v1 import FAMILY_TO_ID
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2

ROOT = Path(__file__).resolve().parents[1]
SEEDS = (3301, 3302, 3303)
STEPS = 70
FAMILIES = tuple(TaskSpecOodBenchmarkV1.PROMPTS)


def family_accuracy(model, seed: int):
    correct = 0
    total = 0
    for idx, (family, prompts) in enumerate(TaskSpecOodBenchmarkV1.PROMPTS.items()):
        for prompt in prompts:
            with torch.no_grad():
                if hasattr(model, '_condition_with_family'):
                    _, logits = model._condition_with_family(prompt, None)
                else:
                    _, logits = model._condition(prompt, None)
                pred = int(logits.argmax(-1).item())
            correct += int(pred == FAMILY_TO_ID[family])
            total += 1
    return correct / max(1, total)


def verified_rate(model, seed: int):
    bench = TaskSpecOodBenchmarkV1(ROOT)
    out = bench.evaluate_model(model, seed=seed + 800, max_len=20, condition_mode='end_to_end')
    return float(out['prompt_level_verification']), out


def train_v2(learner, seed: int):
    model = NeuralProgramSynthesizerV2(vocab=2048, hidden=40, latent_dim=40, max_len=20, max_b=64, layers=2, heads=4)
    trainer = NeuralProgramTrainerV2(model, seed=seed + 1, lr=8e-4)
    rows = learner.training_rows(FAMILIES, condition_mode='canonical', include_replay=False)
    for step in range(STEPS):
        trainer.fit([rows[step % len(rows)]], epochs=1, max_examples=1, teacher_forcing_start=1.0, teacher_forcing_end=1.0)
    return model


def train_atomic(learner, seed: int):
    model = AtomicProgramSynthesizerV4(vocab=2048, hidden=40, latent_dim=40, max_len=20, max_b=64, layers=2, heads=4)
    trainer = AtomicProgramTrainerV4(model, seed=seed + 1, lr=8e-4)
    rows = learner.training_rows(FAMILIES, condition_mode='canonical', include_replay=False)
    for step in range(STEPS):
        tf = max(0.0, 1.0 - step / max(1, STEPS - 1))
        trainer.fit([rows[step % len(rows)]], epochs=1, batch_size=1, max_examples=1, family_teacher_forcing_start=tf, family_teacher_forcing_end=tf)
    return model


def run():
    torch.set_num_threads(1)
    results = []
    t0 = time.perf_counter()
    for seed in SEEDS:
        learner = ExecutionGuidedProgramLearnerV1(ROOT, seed=seed, hidden=40)
        for track, train_fn in (('v2', train_v2), ('atomic_v4', train_atomic)):
            model = train_fn(learner, seed)
            vr, eval_out = verified_rate(model, seed)
            fa = family_accuracy(model, seed)
            params = sum(p.numel() for p in model.parameters())
            results.append({'seed': seed, 'track': track, 'steps': STEPS, 'params': params, 'family_accuracy': fa, 'verified_rate': vr})
            Path(ROOT/'runtime').mkdir(parents=True, exist_ok=True)
            (ROOT/'runtime'/f'atomic_v4_{track}_{seed}.json').write_text(json.dumps(eval_out, indent=2, ensure_ascii=False), encoding='utf-8')
    summary = {'seeds': list(SEEDS), 'steps': STEPS, 'families': list(FAMILIES), 'results': results, 'elapsed_s': time.perf_counter() - t0}
    for track in ('v2','atomic_v4'):
        vals = [x for x in results if x['track'] == track]
        summary[track] = {
            'mean_family_accuracy': sum(x['family_accuracy'] for x in vals)/len(vals),
            'mean_verified_rate': sum(x['verified_rate'] for x in vals)/len(vals),
            'all_seed_non_degraded_family': all(x['family_accuracy'] >= next(y['family_accuracy'] for y in results if y['seed']==x['seed'] and y['track']=='v2') for x in vals) if track=='atomic_v4' else None,
            'all_seed_non_degraded_verified': all(x['verified_rate'] >= next(y['verified_rate'] for y in results if y['seed']==x['seed'] and y['track']=='v2') for x in vals) if track=='atomic_v4' else None,
        }
    out_path = ROOT/'runtime'/'neural_atomic_v4_matched_ablation.json'
    out_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(summary, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    run()
