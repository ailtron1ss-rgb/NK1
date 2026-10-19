from pathlib import Path
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2,NeuralProgramTrainerV2,ProgramAugmenterV2
from core.nomega.program_challenge_arena_v1 import ProgramChallengeArenaV1
from core.nomega.skill_consolidation_v3 import SkillConsolidatorV3
from core.nomega.mobile_program_optimizer_v7 import MobileProgramOptimizerV7
from core.nomega.development_cycle_v9 import OmegaDevelopmentCycleV9

def test_v2_model_and_train(tmp_path):
    m=NeuralProgramSynthesizerV2(vocab=128,hidden=32,latent_dim=32,max_len=8,max_b=16,layers=1,heads=4)
    code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    out=m.forward_teacher('add three inputs',code,0); assert out['op'].shape[1]==8
    r=NeuralProgramTrainerV2(m).fit([('add three inputs',code,0)],epochs=1,max_examples=1); assert r.steps>0

def test_augmenter_v2():
    c=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]; rows=ProgramAugmenterV2(1).augment(c,4); assert len(rows)==4

def test_challenge_arena():
    c=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]; a=ProgramChallengeArenaV1(2); h=a.harden(c,[([1,2,0,0,0,0,0,0],3)],4); assert h['count']>=4

def test_skill_consolidator(tmp_path):
    c=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]; out=SkillConsolidatorV3(tmp_path).consolidate('sum3',c,[([1,2,0,0,0,0,0,0],3)]); assert out['verified']

def test_mobile_optimizer():
    out=MobileProgramOptimizerV7().recommend(); assert 'recommended' in out and out['recommended']['active_params']<=350000

def test_cycle_v9_smoke(tmp_path):
    out=OmegaDevelopmentCycleV9(tmp_path,seed=4).run(families=['sum3','xor3'],epochs=1,max_examples=4,candidates=1); assert Path(out['checkpoint']).exists(); assert 'taskspec_ood' in out

def test_guided_search_smoke(tmp_path):
    from core.nomega.neural_guided_program_search_v1 import NeuralGuidedProgramSearchV1
    m=NeuralProgramSynthesizerV2(vocab=128,hidden=32,latent_dim=32,max_len=8,max_b=16,layers=1,heads=4)
    out=NeuralGuidedProgramSearchV1(tmp_path,m,seed=9).run(['sum3','xor3'],budget=8); assert 'hybrid_verified_coverage' in out

def test_skill_retrieval(tmp_path):
    from core.nomega.program_skill_retrieval_v2 import ProgramSkillRetrievalV2
    p=tmp_path/'runtime'; p.mkdir(); (p/'program_acquisition_v3_bank.json').write_text('{"items":[{"family":"sum3","code":[[1,0,0],[1,1,1],[3,0,1],[13,0,0],[14,0,0]],"verified":true}]}')
    r=ProgramSkillRetrievalV2(tmp_path).retrieve([(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)],1); assert r

def test_counterexample_curriculum(tmp_path):
    from core.nomega.counterexample_curriculum_v1 import CounterexampleCurriculumV1
    o=CounterexampleCurriculumV1(tmp_path).build([{'tape':[1,2],'expected':3,'got':4},{'tape':[1,2],'expected':3,'got':4}],8); assert o['count']==1

def test_execution_replay(tmp_path):
    from core.nomega.execution_replay_trainer_v2 import ExecutionReplayTrainerV2
    o=ExecutionReplayTrainerV2(tmp_path).build([{'tape':[1,2],'expected':3,'got':4}]); assert o['count']==1


def test_v2_generate_uses_full_prefix(monkeypatch):
    import torch
    m=NeuralProgramSynthesizerV2(vocab=128,hidden=32,latent_dim=32,max_len=5,max_b=16,layers=1,heads=4)
    seen=[]
    original_decoder=m.decoder
    def hook(_module, inputs, output):
        seen.append(int(inputs[0].shape[1]))
    h=original_decoder.register_forward_hook(hook)
    class FixedHead(torch.nn.Module):
        def __init__(self, width, idx):
            super().__init__(); self.width=width; self.idx=idx
        def forward(self, x):
            y=torch.full((x.shape[0],x.shape[1],self.width),-1000.0,device=x.device) if x.ndim==3 else torch.full((x.shape[0],self.width),-1000.0,device=x.device)
            if y.ndim==3:
                y[...,self.idx]=1000.0
            else:
                y[...,self.idx]=1000.0
            return y
    m.op_head=FixedHead(20,1); m.a_head=FixedHead(4,0); m.b_head=FixedHead(16,0)
    code=m.generate('sum three values',0,max_len=5)
    h.remove()
    assert len(code)==5
    assert seen==[1,2,3,4,5]


def test_joint_learning_checkpoint_lineage(tmp_path):
    from core.nomega.joint_learning import JointLearningHarness
    out=JointLearningHarness(tmp_path,seed=17).run(train_limit=8,holdout_limit=8,router_epochs=1,return_candidate=False)
    assert out['causal_attribution']['same_candidate_before_after']
    assert Path(out['restart']['checkpoint']).exists()
    assert 'transfer' in out and 'regression' in out


def test_ood_prompt_benchmark_runs_neural_path(tmp_path):
    m=NeuralProgramSynthesizerV2(vocab=128,hidden=32,latent_dim=32,max_len=8,max_b=16,layers=1,heads=4)
    from core.nomega.ood_prompt_benchmark_v2 import OODPromptBenchmarkV2
    out=OODPromptBenchmarkV2(tmp_path).evaluate_model(m,seed=23,max_len=8)
    assert out['track']=='PURE_NEURAL' and out['families']==len(OODPromptBenchmarkV2.PROMPTS)
