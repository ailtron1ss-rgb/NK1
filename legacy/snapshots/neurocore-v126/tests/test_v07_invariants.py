import torch
from neurocore.model_v07 import NeuroWeaveCore
from neurocore.trace_memory import DifferentiableTraceMemory
from neurocore.compute_controller import ComputeHomeostat

def make(): return NeuroWeaveCore(d_model=16,fast_state=20,slow_state=20,memory_capacity=8,n_experts=2,top_k=1,attention_heads=2)

def test_hard_deep_route_is_only_route_that_calls_attention():
    m=make(); calls={'n':0}; original=m.attn.forward
    def spy(*args,**kwargs): calls['n']+=1; return original(*args,**kwargs)
    m.attn.forward=spy
    with torch.no_grad(): m.compute.net[-1].bias.copy_(torch.tensor([20.,-20.,-20.])); _=m(torch.randn(2,4,16))
    assert calls['n']==0
    calls['n']=0
    with torch.no_grad(): m.compute.net[-1].bias.copy_(torch.tensor([-20.,-20.,20.])); _=m(torch.randn(2,4,16))
    assert calls['n']==4

def test_slow_state_commit_gate_changes_state():
    torch.manual_seed(31); m=make(); x=torch.randn(1,3,16); out0,s0=m.forward_sequence(x)
    z_old=s0[0][1].clone(); candidate=torch.ones_like(z_old); half=torch.full((1,1),0.5)
    z_new=m.weave.commit_slow(z_old,candidate,half)
    assert not torch.allclose(z_old,z_new)

def test_trace_memory_fills_one_new_slot_per_step():
    torch.manual_seed(32); mem=DifferentiableTraceMemory(8,slots=5); s=mem.initial_state(1); counts=[]
    for i in range(8):
        _,s=mem.step(torch.randn(1,8),s); counts.append(int(s[2].sum()))
    assert counts[:5]==[1,2,3,4,5] and counts[-1]==5

def test_compute_homeostat_shape_contract():
    torch.manual_seed(33); h=ComputeHomeostat(12); one=torch.ones(2,1); zero=torch.zeros(2,1); d=h(torch.randn(2,12),one,one,one,one,one,zero,zero)
    assert d.level.shape==(2,1) and d.probability.shape==(2,3) and d.budget_spend.shape==(2,1)
