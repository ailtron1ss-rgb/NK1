from pathlib import Path

from core.nomega.task_spec_v1 import parse_task_spec, validate_task_spec, typed_model_condition
from core.nomega.adaptive_program_curriculum_v1 import AdaptiveProgramCurriculumV1
from core.nomega.task_spec_ood_benchmark_v1 import TaskSpecOodBenchmarkV1
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2


def test_typed_taskspec_contains_nontrivial_semantic_structure():
    spec=parse_task_spec('first add the pair and then apply xor with the remaining value')
    validate_task_spec(spec)
    assert spec.semantic_valid
    assert spec.operators == ('ADD','XOR')
    assert spec.operand_refs == ('x0','x1','x2')
    assert 'ADD x0 x1' in spec.program_sketch and 'XOR x2' in spec.program_sketch
    assert typed_model_condition(spec) != spec.canonical_prompt


def test_typed_ood_track_is_distinct_and_executable(tmp_path):
    model=NeuralProgramSynthesizerV2(vocab=256,hidden=32,latent_dim=32,max_len=10,max_b=16,layers=1,heads=4)
    out=TaskSpecOodBenchmarkV1(tmp_path).evaluate_model(model,seed=51,max_len=10,condition_mode='typed')
    assert out['track']=='TASKSPEC_TYPED_PLUS_PURE_NEURAL'
    assert out['condition_mode']=='typed'
    assert out['families']==5


def test_adaptive_curriculum_persists_evidence_and_keeps_anchors(tmp_path):
    ctl=AdaptiveProgramCurriculumV1(tmp_path,seed=44,anchor_count=2)
    families=('sum3','xor3','mul2','minmax3','compose_sum_xor','nested3')
    ctl.observe([
        {'family':'sum3','before':1.0,'after':1.0,'delta':0.0,'verified':True,'counterexamples':0},
        {'family':'xor3','before':1.0,'after':0.5,'delta':-0.5,'verified':False,'counterexamples':2},
        {'family':'nested3','before':0.0,'after':0.0,'delta':0.0,'verified':False,'counterexamples':3},
    ],cycle_id='test')
    choice=ctl.select(families,budget=4,anchors=('sum3','xor3'))
    assert 'sum3' in choice['families'] and 'xor3' in choice['families']
    assert (tmp_path/'runtime/nomega_adaptive_program_curriculum_v1.json').exists()


def test_execution_guided_typed_smoke(tmp_path):
    from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
    out=ExecutionGuidedProgramLearnerV1(tmp_path,seed=33,hidden=24).run_multi_seed(
        seeds=(33,),initial_epochs=1,guided_epochs=1,max_examples=10,condition_mode='typed',adaptive_families=True,family_budget=4
    )
    run=out['runs'][0]
    assert run['condition_mode']=='typed'
    assert run['adaptive_families'] is True
    assert len(run['train_families'])==4
    assert run['next_curriculum']['families']
    assert Path(run['checkpoint']).exists()
