import torch
from neurocore.v22 import NeuroWeaveV22, V22Config, LifeTrainerV22


def make():
    return NeuroWeaveV22(V22Config(d=8, hidden=16, action_dim=4, modalities=3))


def test_v22_forward_and_finite():
    torch.manual_seed(2201)
    m=make(); y=m(torch.randn(2,7,8),commit_memory=False); s=y['_final_state']
    assert y['latent_v22'].shape==(2,7,8)
    assert y['homeostasis_v22'].shape==(2,7,4)
    assert y['chosen_action_v22'].shape==(2,7,4)
    assert s.life_step.eq(7).all()
    for k,v in y.items():
        if torch.is_tensor(v): assert torch.isfinite(v).all(), k


def test_v22_multimodal_missing_presence():
    torch.manual_seed(2202)
    m=make(); x=torch.randn(2,5,8); mm=torch.randn(2,5,3,8); p=torch.tensor([[[1,1,0]]*5, [[1,0,0]]*5],dtype=x.dtype)
    y=m(x,modality_sequence=mm,presence_sequence=p,commit_memory=False)
    assert y['modality_gates_v22'].shape==(2,5,3)
    assert torch.isfinite(y['bound_input_v22']).all()


def test_v22_invalid_modality_contract():
    m=make(); x=torch.randn(2,4,8); bad=torch.randn(2,4,2,7)
    try:
        m(x,modality_sequence=bad)
        assert False
    except ValueError:
        pass


def test_v22_homeostasis_bounds_and_budget():
    torch.manual_seed(2204)
    m=make(); y=m(torch.randn(2,6,8),commit_memory=False)
    assert y['compute_budget_v22'].min()>=0 and y['compute_budget_v22'].max()<=1
    assert y['need_state_v22'].min()>=0 and y['need_state_v22'].max()<=1
    assert y['homeostasis_v22'].min()>=0 and y['homeostasis_v22'].max()<=1


def test_v22_memory_utility_varies_with_signal():
    torch.manual_seed(2205)
    m=make(); x=torch.randn(3,5,8); y=m(x,commit_memory=False)
    assert torch.isfinite(y['memory_utility_v22']).all()
    assert y['memory_utility_v22'].std()>0


def test_v22_counterfactual_real_path():
    torch.manual_seed(2206)
    m=make(); y=m(torch.randn(2,5,8),commit_memory=False)
    assert torch.isfinite(y['counterfactual_delta_v22']).all()
    assert torch.isfinite(y['causal_probe_v22']).all()


def test_v22_goal_changes_subgoal():
    torch.manual_seed(2207)
    m=make(); x=torch.randn(2,4,8); g0=torch.zeros(2,8); g1=torch.ones(2,8)
    a=m(x,goal=g0,commit_memory=False)['subgoal_v22']
    b=m(x,goal=g1,commit_memory=False)['subgoal_v22']
    assert (a-b).abs().mean()>1e-7


def test_v22_training_has_gradients():
    torch.manual_seed(2208)
    m=make(); y=m(torch.randn(4,6,8),commit_memory=False); loss=m.training_loss(y); loss.backward()
    mods=[m.binder,m.memory_utility,m.identity,m.homeostasis_head,m.subgoal_head,m.active_inference,m.causal_probe,m.sleep,m.action_head]
    for mod in mods:
        grads=[p.grad for p in mod.parameters() if p.grad is not None]
        assert grads and all(torch.isfinite(g).all() for g in grads)


def test_v22_trainer_reduces_objective():
    torch.manual_seed(2209)
    m=make(); tr=LifeTrainerV22(m,lr=2e-3); x=torch.randn(5,7,8)
    with torch.no_grad(): before=float(m.training_loss(m(x,commit_memory=False)).item())
    for _ in range(5): tr.step(x)
    with torch.no_grad(): after=float(m.training_loss(m(x,commit_memory=False)).item())
    assert after<before


def test_v22_optimizer_scope_excludes_v21_core():
    m=make(); tr=LifeTrainerV22(m)
    ids={id(p) for p in tr.params}; core={id(p) for p in m.core.parameters()}
    assert not ids & core


def test_v22_long_stream_bounded():
    torch.manual_seed(2211)
    m=make(); s=m.initial_state(2)
    for _ in range(64): _,s=m.step(torch.randn(2,8),s,commit_memory=True)
    for t in [s.identity_fast,s.identity_slow,s.homeostasis,s.need_state,s.memory_trace,s.memory_value,s.subgoal,s.episode_return,s.sleep_score]:
        assert torch.isfinite(t).all()
        assert t.abs().max()<20


def test_v22_fp16():
    torch.manual_seed(2212)
    m=make().half(); y=m(torch.randn(2,4,8).half(),commit_memory=False)
    assert torch.isfinite(y['latent_v22']).all()


def test_v22_state_continuity():
    torch.manual_seed(2213)
    m1=make(); m2=make(); m2.load_state_dict(m1.state_dict()); x=torch.randn(2,6,8)
    a=m1(x,commit_memory=False)['latent_v22'][:,-1]
    s=m2.initial_state(2); last=None
    for t in range(6): last,s=m2.step(x[:,t],s,commit_memory=False)
    assert torch.allclose(a,last['latent_v22'],atol=1e-5,rtol=1e-4)
