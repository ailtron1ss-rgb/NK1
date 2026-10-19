from pathlib import Path
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
from core.nomega.program_runtime_v2 import compile_tiny_to_hvm_v2, run_tiny_v2, run_hvm_compiled_v2
from core.nomega.development_cycle_v7 import OmegaDevelopmentCycleV7
from core.nomega.runtime import NOmegaRuntime
from core.nomega.config import NOMEGAConfig

def test_v2_templates_cover_all_families():
    a=ProgramAcquisitionCoreV2(Path('.'),seed=1)
    missing=[f for f in a.FAMILIES if not a.templates(f)]
    assert not missing, missing

def test_v2_sum_and_hvm_agree():
    a=ProgramAcquisitionCoreV2(Path('.'),seed=2)
    rep=a.synthesize_family('sum3',seed=2,max_candidates=4)
    assert rep['verified'] and rep['holdout_fitness']>=1.0 and rep['hvm_agreement']>=1.0

def test_v2_parity_program_executes():
    a=ProgramAcquisitionCoreV2(Path('.'),seed=3); p=a.templates('parity_mix')[0]
    t=[7,11,19,0,7,0,255,0]
    y=(7^11^19).bit_count()&1
    tt=run_tiny_v2(p,t); hh=run_hvm_compiled_v2(p,t)
    assert tt['ok'] and tt['result']==y and hh['ok'] and hh['result']==y

def test_v2_mod_loop_agrees():
    a=ProgramAcquisitionCoreV2(Path('.'),seed=4); p=a.templates('compose_mod_chain')[0]
    t=[9,8,5,0,11,0,255,0]; y=((9+8)%11)^5
    tt=run_tiny_v2(p,t); hh=run_hvm_compiled_v2(p,t,max_steps=512)
    assert tt['ok'] and tt['result']==y and hh['ok'] and hh['result']==y

def test_v2_cycle_checkpoint(tmp_path):
    rep=OmegaDevelopmentCycleV7(tmp_path,seed=5).run(families=['sum3','xor3','mul2'],max_candidates=4)
    assert rep['version']=='1.7.0' and Path(rep['candidate_checkpoint']).exists() and rep['program_acquisition']['verified_families']>=3

def test_runtime_omega17(tmp_path):
    r=NOmegaRuntime(tmp_path,NOMEGAConfig.mobile()); out=r.omega17_program_acquire(['sum3','xor3'],max_candidates=4); assert out['families_seen']==2

def test_v2_invariant_zero():
    a=ProgramAcquisitionCoreV2(Path('.'),seed=6); p=a.templates('invariant_xor')[0]
    rep=a.synthesize_family('invariant_xor',seed=6,max_candidates=4)
    assert rep['verified']

def test_v2_generalization_multiseed(tmp_path):
    from core.nomega.program_generalization_v1 import ProgramGeneralizationV1
    rep=ProgramGeneralizationV1(tmp_path,seeds=(7,8),max_candidates=4).run(['sum3','xor3','minmax3'])
    assert rep['min_coverage']>=1.0 and rep['verified_families_intersection']==3

def test_v2_abstraction_stable():
    from core.nomega.program_abstraction_v1 import ProgramAbstractionV1
    a=ProgramAbstractionV1().canonical([(1,0,0),(1,1,1),(3,0,1),(13,0,0)])
    b=ProgramAbstractionV1().canonical([(1,1,0),(1,0,1),(3,1,0),(13,1,0)])
    assert a['fingerprint']==b['fingerprint']

def test_v2_cycle_promotes_bounded_all(tmp_path):
    rep=OmegaDevelopmentCycleV7(tmp_path,seed=8).run(families=['sum3','xor3','mul2'],max_candidates=4)
    assert rep['generalization']['min_coverage']>=1.0 and rep['promotion']['promote'] is False
