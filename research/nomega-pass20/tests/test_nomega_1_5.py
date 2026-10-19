from pathlib import Path
from core.nomega.program_acquisition_v1 import ProgramAcquisitionCoreV1
from core.nomega.task_generator_v4 import make_tasks_v4, split_v4
from core.nomega.program_learning_v1 import ProgramSelectorV1, ProgramSelectorTrainerV1, program_hist
from core.nomega.development_cycle_v5 import OmegaDevelopmentCycleV5
from core.nomega.runtime import NOmegaRuntime
from core.nomega.config import NOMEGAConfig

def test_program_acquisition_sum3(tmp_path):
    tasks=make_tasks_v4(3,2,2,1); _,ho,_=split_v4(tasks)
    r=ProgramAcquisitionCoreV1(tmp_path,7).acquire(ho,max_families=2)
    assert r['families_synthesized']>=1
    assert any(x.get('best') for x in r['results'])

def test_program_acquisition_hvm_agreement(tmp_path):
    tasks=make_tasks_v4(5,2,2,1); _,ho,_=split_v4(tasks)
    r=ProgramAcquisitionCoreV1(tmp_path,9).acquire([x for x in ho if x.family=='sum3'],max_families=1)
    b=r['results'][0]['best']; assert b and b['hvm_agreement']>=0.99 and b['holdout_fitness']>=0.99

def test_program_selector_forward():
    m=ProgramSelectorV1(128,32,20); out=m(__import__('torch').tensor([[1,2,3]]),program_hist([(1,0,0),(3,0,1)]).unsqueeze(0)); assert out.shape==(1,)

def test_program_selector_training_runs():
    rows=[{'family':'sum3','best':{'score':.9,'code':[[1,0,0],[1,1,1],[3,0,1],[13,0,0],[14,0,0]]}}]
    rep=ProgramSelectorTrainerV1(seed=2).fit(rows,steps=2); assert rep.steps>0 and 0<=rep.train_score<=1

def test_program_cycle_writes_checkpoint(tmp_path):
    rep=OmegaDevelopmentCycleV5(tmp_path,seed=11).run(train_per=2,holdout_per=2,adv_per=1,program_families=3,selector_steps=2)
    assert Path(rep['candidate_checkpoint']).exists() and 'program_acquisition' in rep

def test_runtime_omega15(tmp_path):
    r=NOmegaRuntime(tmp_path,NOMEGAConfig.mobile()); rep=r.omega15_cycle(train_per=2,holdout_per=2,adversarial_per=1,families=2,selector_steps=1); assert rep['version']=='1.5.0'
