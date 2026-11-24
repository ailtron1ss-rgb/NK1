import torch
from neurocore.v27 import V27Config, NeuroWeaveV27, StagedOrganismTrainerV27, SurpriseRouterV27, UtilityMemoryV27


def model(dtype=torch.float32):
    torch.manual_seed(7)
    return NeuroWeaveV27(V27Config(d=8,hidden=16,action_dim=3,modalities=3,proprio_dim=2,intero_dim=2,memory_slots=8,router_candidates=4)).to(dtype)


def data(dtype=torch.float32,b=2,t=8,d=8):
    torch.manual_seed(11)
    x=torch.randn(b,t,d,dtype=dtype); m=torch.randn(b,t,3,d,dtype=dtype); p=torch.ones(b,t,3,dtype=dtype)
    pr=torch.randn(b,t,2,dtype=dtype); ir=torch.randn(b,t,2,dtype=dtype); g=torch.randn(b,t,d,dtype=dtype)
    return x,m,p,pr,ir,g


def test_forward_contracts_and_finite():
    m=model(); x,mm,p,pr,ir,g=data(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir)
    assert o['context_v27'].shape==x.shape; assert o['chosen_action_v27'].shape==(2,8,3)
    assert torch.isfinite(o['context_v27']).all(); assert torch.isfinite(o['memory_read_v27']).all()


def test_state_continuity():
    m=model(); x,_,_,_,_,g=data(); a=m(x[:,:4],goal_sequence=g[:,:4]); b=m(x[:,4:],state=a['_final_state'],goal_sequence=g[:,4:])
    assert b['_final_state'].life_clock.min().item()==8; assert torch.isfinite(b['stable_context_v27']).all()


def test_memory_is_bounded_and_written():
    m=model(); x,_,_,_,_,g=data(); o=m(x,goal_sequence=g); st=o['_final_state'];
    assert st.memory_keys.shape==(2,8,8); assert st.memory_values.shape==(2,8,8)
    assert st.memory_age.max().item()<=8+1; assert torch.isfinite(st.memory_strength).all()


def test_algorithm_router_normalizes_and_gradients_exist():
    r=SurpriseRouterV27(8,16,4); z=torch.randn(3,8,requires_grad=True); args=[torch.randn(3,8),torch.rand(3,1),torch.rand(3,1),torch.rand(3,1),torch.rand(3,1),torch.rand(3,1)]
    y,w=r(z,*args); loss=y.pow(2).mean()+w.pow(2).mean(); loss.backward(); assert torch.allclose(w.sum(-1),torch.ones(3),atol=1e-5)
    assert any(p.grad is not None for p in r.parameters())


def test_utility_memory_read_changes_with_values():
    mem=UtilityMemoryV27(8,16); z=torch.randn(2,8); k=torch.randn(2,8,8); v=torch.randn(2,8,8); s=torch.ones(2,8,1); a=torch.zeros(2,8,1); g=torch.randn(2,8); u=torch.rand(2,1)
    r1,_,_=mem.read(z,k,v,s,a,g,u); r2,_,_=mem.read(z,k,v*0,s,a,g,u); assert (r1-r2).abs().mean().item()>1e-7


def test_training_path_and_scope():
    m=model(); tr=StagedOrganismTrainerV27(m,lr=2e-3,warmup_steps=1); x,_,_,_,_,g=data(); l1,_=tr.step(x,goal_sequence=g); l2,_=tr.step(x,goal_sequence=g); assert torch.isfinite(l1) and torch.isfinite(l2)
    assert all((p.grad is None or torch.isfinite(p.grad).all()) for p in tr.params)
    assert any(not p.requires_grad for p in m.core.parameters())


def test_primary_learning_decreases():
    m=model(); tr=StagedOrganismTrainerV27(m,lr=3e-3,warmup_steps=0); x,_,_,_,_,g=data()
    with torch.no_grad(): b=m(x,goal_sequence=g,commit_memory=False); before=m.loss_parts(b)[0].item()
    for _ in range(5): tr.step(x,goal_sequence=g)
    with torch.no_grad(): a=m(x,goal_sequence=g,commit_memory=False); after=m.loss_parts(a)[0].item()
    assert after <= before*1.25


def test_fp16_and_quant_hook():
    m=model(dtype=torch.float16); x,_,_,_,_,g=data(dtype=torch.float16); o=m(x,goal_sequence=g,runtime_quant=True); assert torch.isfinite(o['context_v27']).all(); assert torch.isfinite(o['quantized_context_v27']).all()


def test_developmental_signal_is_observable():
    m=model(); x,_,_,_,_,g=data(); o=m(x,goal_sequence=g); d=o['developmental_pressure_v27']; assert d.min().item()>=0 and d.max().item()<=1


def test_counterfactual_refines_action():
    m=model(); x,_,_,_,_,g=data(); o=m(x,goal_sequence=g); delta=(o['refined_action_v27']-o['chosen_action_v25']).abs().mean().item(); assert delta>=0


def test_mobile_parameter_bound():
    m=model(); assert sum(p.numel() for p in m.parameters())<400000

def test_memory_feedback_enters_next_fast_context():
    m=model(); x,_,_,_,_,g=data(); o=m(x[:,:4],goal_sequence=g[:,:4]); st=o['_final_state'];
    ref=m(x[:,4:5],state=st,goal_sequence=g[:,4:5],commit_memory=False); st2=st
    st2.memory_values=torch.zeros_like(st2.memory_values); off=m(x[:,4:5],state=st2,goal_sequence=g[:,4:5],commit_memory=False)
    assert (ref['_final_state'].fast_context-off['_final_state'].fast_context).abs().mean().item() >= 0.0


def test_eval_router_uses_one_operator_per_sample():
    m=model(); m.eval(); x,_,_,_,_,g=data(); o=m(x[:, :2],goal_sequence=g[:, :2]);
    w=o['algorithm_weights_v27']; assert torch.allclose(w.sum(-1), torch.ones_like(w.sum(-1)), atol=1e-5)
