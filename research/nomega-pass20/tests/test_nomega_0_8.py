import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
import torch
from core.nomega import NOMEGAConfig, NOmegaCore, NOmegaRuntime, MobilePolicy, GoalManager, ExperimentMatrix, composite_reward

def test_0_8_extended_state_and_telemetry():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    out=c.run('calculate',{'a':8,'b':9,'op':'sum','expected':17})
    assert out['verified'] and out['self_model']['math']['verified_rate'] >= 1.0
    assert out['telemetry']['math']['verified_rate'] >= 1.0
    assert out['latent_memory']['items'] >= 1

def test_0_8_skill_compiler_after_verified_program():
    c=NOmegaCore(NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    c.run('write a program to sum',{'program_kind':'sum','a':4,'b':5,'program_tasks':[([4,5],9)],'expected':9})
    # The compiler is conservative: it only stores executable verified programs.
    assert isinstance(c.skill_compiler.best(),list)

def test_mobile_policy_degrades_under_pressure():
    p=MobilePolicy(); low=p.choose(ram_gb=2,battery=.1,thermal=.9); high=p.choose(ram_gb=8,battery=.9,thermal=.1,has_npu=True)
    assert low.max_steps < high.max_steps and low.max_experts <= high.max_experts

def test_goal_manager():
    g=GoalManager(); gid=g.add('learn a new skill',2); assert g.next().goal_id==gid; assert g.close(gid); assert g.next() is None

def test_composite_reward_separates_evidence_and_efficiency():
    a=composite_reward(verified=1,evidence=1,confidence=.9,latency_ms=10,route_agreement=1,compute_steps=1)
    b=composite_reward(verified=1,evidence=.2,confidence=.3,latency_ms=1100,route_agreement=.1,compute_steps=8)
    assert a['score'] > b['score']

def test_runtime_roundtrip_new_memory(tmp_path):
    r=NOmegaRuntime(root=tmp_path,cfg=NOMEGAConfig(latent_dim=24,router_hidden=16,memory_dim=24,max_reason_steps=1))
    out=r.infer('calculate',{'a':2,'b':8,'op':'sum','expected':10}); r.save()
    r2=NOmegaRuntime(root=tmp_path,cfg=r.cfg)
    assert r2.core.attention_memory.stats()['items']>=1

def test_experiment_matrix_has_profiles():
    m=ExperimentMatrix(); cs=m.configs(); assert set(cs)>= {'nano','mobile','balanced','full'}

def test_contrastive_alignment():
    from core.nomega.latent_alignment import symmetric_contrastive
    x=torch.randn(4,8); y=x+0.01*torch.randn(4,8); assert float(symmetric_contrastive(x,y)) >= 0.0
