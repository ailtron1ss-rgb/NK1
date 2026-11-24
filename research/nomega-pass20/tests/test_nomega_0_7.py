import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from core.nomega import NOMEGAConfig, NOmegaCore, NOmegaRuntime, make_tasks, architecture_search, inspect_program


def test_verified_cache_reuses_verified_answer():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    a=c.run('calculate',{'a':2,'b':3,'op':'sum','expected':5})
    b=c.run('calculate',{'a':2,'b':3,'op':'sum','expected':5})
    assert a['verified'] and b['verified'] and b.get('cache_hit') is True


def test_extended_symbolic_families():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    cases=[
        ('calculate sum of three numbers',{'a':1,'b':2,'c':3,'op':'sum3','expected':6}),
        ('calculate xor of three numbers',{'a':1,'b':2,'c':3,'op':'xor3','expected':0}),
        ('calculate dot product of two pairs',{'a':2,'b':3,'c':4,'d':5,'op':'dot2','expected':26}),
        ('calculate parity',{'a':7,'op':'parity','expected':1}),
        ('clamp value to range',{'a':20,'b':10,'c':30,'op':'clamp','expected':20}),
    ]
    outs=[c.run(t,dict(x)) for t,x in cases]
    assert all(o['verified'] for o in outs), [o['answer'] for o in outs]


def test_skill_bank_persists_and_is_usable():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    c.skill_bank.promote('sum skill',[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)],'program',1.0)
    assert c.skill_bank.match('program')
    state=c.encode('write a program to sum')
    out=c.expert_bank.get('skill').run(state,{'skill_hits':c.skill_bank.match('program'),'a':4,'b':5})
    assert out['verified_candidate'] and out['result']==9


def test_working_memory_bounded():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,working_memory_slots=3,max_reason_steps=4))
    c.run('calculate',{'a':3,'b':4,'op':'sum','expected':7})
    assert len(c.working_memory.slots)<=3


def test_runtime_persists_cache_and_skills(tmp_path):
    r=NOmegaRuntime(root=tmp_path,cfg=NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    r.infer('calculate',{'a':3,'b':4,'op':'sum','expected':7})
    r.save()
    r2=NOmegaRuntime(root=tmp_path,cfg=r.cfg)
    assert len(r2.core.memory.items)>=1


def test_task_generator_expanded():
    tasks=make_tasks(3,2)
    families={t.family for t in tasks}
    assert len(tasks)>=24 and 'dot2' in families and 'program_mul' in families


def test_architecture_search_has_candidates():
    r=architecture_search(3)
    assert len(r['candidates'])==3 and r['best'] is not None


def test_program_safety():
    assert inspect_program([(1,0,0)])['safe']
    assert not inspect_program('exec(1)')['safe']


def test_skill_aware_program_routing():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=2))
    code=[(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    c.skill_bank.promote('sum skill',code,'program',1.0)
    state=c.encode('write a program to sum')
    state.metadata['skill_available']=True
    d=c.router.decide(state)
    assert d.expert_ids[0]=='skill'


def test_capability_registry_records():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    out=c.run('calculate',{'a':4,'b':5,'op':'sum','expected':9})
    assert out['capabilities']['math']['verified_rate'] >= 1.0


def test_evidence_ensemble_prefers_verified_program():
    from core.nomega.ensemble import EvidenceEnsemble
    e=EvidenceEnsemble({'symbolic':.2,'neural_invent':.1})
    r=e.choose({'symbolic':{'result':5,'verified_candidate':False,'candidate_score':.9},'neural_invent':{'result':5,'verified_candidate':True,'candidate_score':.9,'dual_runtime':{'semantic_agreement':1.0}}})
    assert r['expert']=='neural_invent'


def test_mobile_and_balanced_presets_are_smaller_and_valid():
    from core.nomega import NOMEGAConfig
    m=NOMEGAConfig.mobile(); b=NOMEGAConfig.balanced()
    assert m.latent_dim < b.latent_dim and m.top_k == 1 and m.max_reason_steps <= b.max_reason_steps
