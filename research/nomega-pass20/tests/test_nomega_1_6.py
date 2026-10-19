from pathlib import Path
from core.nomega.program_runtime import compile_tiny_to_hvm, run_tiny, run_hvm_compiled
from core.nomega.counterexample_replay_v1 import CounterexampleReplayV1
from core.nomega.skill_induction_v1 import SkillInducerV1
from core.nomega.development_cycle_v6 import OmegaDevelopmentCycleV6
from core.nomega.runtime import NOmegaRuntime
from core.nomega.config import NOMEGAConfig

def test_hvm_min_max_bridge():
    code=[(1,0,0),(1,1,1),(17,0,1),(13,0,0),(14,0,0)]
    tape=[12,7,0,0,0,0,0,0]; tiny=run_tiny(code,tape); h=run_hvm_compiled(code,tape)
    assert tiny['result']==7 and h['ok'] and h['result']==tiny['result']

def test_counterexample_replay_runs():
    ce=CounterexampleReplayV1(2); item=ce.add('sum3',[(1,0,0),(13,0,0),(14,0,0)],[3,4],7,3); rep=ce.replay(item,ce.mutate(item,4)); assert 'resolved' in rep and ce.stats()['counterexamples']==1

def test_skill_induction_and_composition():
    s=SkillInducerV1(); a=s.induce('a',[(1,0,0)],.9,True); b=s.induce('b',[(1,1,1)],.8,True); c=s.compose([a.name,b.name]); assert c and c.verified and c.quality<.9

def test_program_cycle_v6(tmp_path):
    rep=OmegaDevelopmentCycleV6(tmp_path,seed=3).run(train_per=2,holdout_per=2,adversarial_per=1,families=3,selector_steps=2); assert rep['version']=='1.6.0' and Path(rep['candidate_checkpoint']).exists()

def test_runtime_omega16(tmp_path):
    r=NOmegaRuntime(tmp_path,NOMEGAConfig.mobile()); out=r.omega16_program_acquire(2); assert 'program_acquisition' not in out and 'families_seen' in out
