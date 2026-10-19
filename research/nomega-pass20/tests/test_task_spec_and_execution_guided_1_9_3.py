from pathlib import Path
from core.nomega.task_spec_v1 import parse_task_spec, validate_task_spec, CANONICAL_PROMPT, FAMILY_TO_ID
from core.nomega.task_spec_ood_benchmark_v1 import TaskSpecOodBenchmarkV1
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2


def test_taskspec_semantic_normalization():
    cases={
        'aggregate the first three observations':'sum3',
        'toggle bits across three inputs':'xor3',
        'form the product of the first pair':'mul2',
        'combine min and max across three inputs':'minmax3',
        'addition followed by xor':'compose_sum_xor',
    }
    for text,family in cases.items():
        spec=parse_task_spec(text); validate_task_spec(spec)
        assert spec.semantic_valid and spec.family==family
        assert spec.family_id==FAMILY_TO_ID[family]
        assert spec.canonical_prompt==CANONICAL_PROMPT[family]


def test_taskspec_rejects_ambiguous_or_unknown():
    assert not parse_task_spec('do something useful').semantic_valid


def test_taskspec_ood_benchmark_uses_neural_generation(tmp_path):
    m=NeuralProgramSynthesizerV2(vocab=128,hidden=32,latent_dim=32,max_len=8,max_b=16,layers=1,heads=4)
    out=TaskSpecOodBenchmarkV1(tmp_path).evaluate_model(m,seed=8,max_len=8)
    assert out['track']=='TASKSPEC_PLUS_PURE_NEURAL'
    assert out['families']==5
    assert out['semantic_invalid_prompts']==0


def test_execution_guided_smoke(tmp_path):
    from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
    learner=ExecutionGuidedProgramLearnerV1(tmp_path,seed=12,hidden=24)
    out=learner.run_multi_seed(seeds=(12,),initial_epochs=1,guided_epochs=1,max_examples=12)
    assert out['runs'] and Path(out['runs'][0]['checkpoint']).exists()
    assert 'mean_paired_delta' in out and 'restart_max_abs_delta' in out


def test_scheduled_sampling_path_changes_training_contract():
    from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2
    m=NeuralProgramSynthesizerV2(vocab=128,hidden=32,latent_dim=32,max_len=8,max_b=16,layers=1,heads=4)
    code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    r=NeuralProgramTrainerV2(m,seed=55).fit([('add the first three values',code,0)],epochs=2,max_examples=1,teacher_forcing_start=.9,teacher_forcing_end=.25)
    assert r.steps==2
