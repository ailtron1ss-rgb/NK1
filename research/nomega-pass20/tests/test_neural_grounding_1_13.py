from pathlib import Path
from core.nomega.ood_prompt_benchmark_v2 import OODPromptBenchmarkV2
from core.nomega.neural_grounding_self_training_v1 import NeuralGroundingSelfTrainingV1
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
from core.nomega.task_spec_v1 import FAMILY_TO_ID


def test_ood_benchmark_uses_global_family_ids(tmp_path):
    class Stub:
        def __init__(self): self.ids=[]
        def generate(self,text,family_id,max_len=None):
            self.ids.append(int(family_id)); return [(14,0,0)]
    s=Stub(); out=OODPromptBenchmarkV2(Path(tmp_path)).evaluate_model(s,seed=5,max_len=2)
    assert s.ids[0] == FAMILY_TO_ID['sum3']
    assert s.ids[9] == FAMILY_TO_ID['minmax3']
    assert s.ids[12] == FAMILY_TO_ID['compose_sum_xor']


def test_grounding_builder_has_verified_semantic_views(tmp_path):
    g=NeuralGroundingSelfTrainingV1(Path(tmp_path),seed=13)
    rows=g.build_verified_rows(('sum3','xor3','minmax3'))
    assert rows
    assert any(r.view=='paraphrase' for r in rows)
    assert all(r.verified_source=='baseline_verified' for r in rows)


def test_grounding_cycle_has_persistent_evidence(tmp_path):
    g=NeuralGroundingSelfTrainingV1(Path(tmp_path),seed=17)
    out=g.run(('sum3','xor3'),warmup_epochs=1,self_training_rounds=0)
    assert Path(out['checkpoint']).exists()
    assert (Path(tmp_path)/'runtime'/f"neural_grounding_self_training_{17}.json").exists()

def test_ood_benchmark_supports_true_end_to_end_family_inference(tmp_path):
    class Stub:
        def __init__(self): self.ids=[]
        def generate(self,text,family_id,max_len=None):
            self.ids.append(family_id); return [(14,0,0)]
    s=Stub(); out=OODPromptBenchmarkV2(Path(tmp_path)).evaluate_model(s,seed=6,max_len=2,oracle_family=False)
    assert all(x is None for x in s.ids)
    assert out['track']=='PURE_NEURAL_END_TO_END'


def test_taskspec_benchmark_supports_end_to_end_mode(tmp_path):
    class Stub:
        def __init__(self): self.ids=[]; self.texts=[]
        def generate(self,text,family_id,max_len=None):
            self.ids.append(family_id); self.texts.append(text); return [(14,0,0)]
    b=__import__('core.nomega.task_spec_ood_benchmark_v1',fromlist=['TaskSpecOodBenchmarkV1']).TaskSpecOodBenchmarkV1(Path(tmp_path))
    s=Stub(); out=b.evaluate_model(s,seed=9,max_len=2,condition_mode='end_to_end')
    assert all(x is None for x in s.ids)
    assert out['track']=='TASKSPEC_END_TO_END_PURE_NEURAL'


def test_execution_guided_learner_end_to_end_mode_runs(tmp_path):
    from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
    learner=ExecutionGuidedProgramLearnerV1(tmp_path,seed=101,hidden=12)
    out=learner.run_once(
        eval_seed=101, initial_epochs=1, guided_epochs=1, max_examples=4,
        family_budget=2, forced_families=('sum3','xor3'), condition_mode='end_to_end',
        training_engine='v3'
    )
    assert out['condition_mode']=='end_to_end'
    assert out['training_engine']=='v3'
