import torch
from neurocore.v23 import NeuroWeaveV23, V23Config, LifeTrainerV23, ConflictAwareLifeTrainerV23


def tiny():
    return NeuroWeaveV23(V23Config(d=8, hidden=16, action_dim=3, modalities=2))


def test_forward_state_contract_and_finite():
    m=tiny(); x=torch.randn(2,5,8)
    mods=torch.randn(2,5,2,8); pres=torch.tensor([[[1,1],[1,0],[1,1],[0,1],[1,1]],[[1,0],[1,1],[1,1],[1,0],[1,1]]],dtype=x.dtype)
    out=m(x,modality_sequence=mods,presence_sequence=pres)
    assert out['latent_v23'].shape==(2,5,8)
    assert torch.isfinite(out['persistent_goal_v23']).all()
    assert out['_final_state'].life_age.shape==(2,1)


def test_each_new_trainable_block_gets_gradient():
    m=tiny(); tr=LifeTrainerV23(m)
    x=torch.randn(2,6,8)
    loss,_=tr.step(x)
    assert torch.isfinite(loss)
    grads=[p.grad for p in tr.params if p.requires_grad]
    assert grads and all(g is not None and torch.isfinite(g).all() for g in grads)


def test_training_reduces_loss():
    torch.manual_seed(4); m=tiny(); tr=LifeTrainerV23(m,lr=2e-3)
    x=torch.randn(2,8,8)
    l0=float(m.training_loss(m(x,commit_memory=False)).detach())
    for _ in range(4): tr.step(x)
    l1=float(m.training_loss(m(x,commit_memory=False)).detach())
    assert l1 < l0


def test_goal_changes_action():
    m=tiny(); x=torch.randn(1,3,8)
    g1=torch.zeros(1,8); g2=torch.ones(1,8)
    o1=m(x,goal_sequence=g1.unsqueeze(1).repeat(1,3,1),commit_memory=False)
    o2=m(x,goal_sequence=g2.unsqueeze(1).repeat(1,3,1),commit_memory=False)
    assert (o1['chosen_action_v23']-o2['chosen_action_v23']).abs().max().item()>1e-6


def test_long_stream_bounded():
    m=tiny(); st=m.initial_state(1)
    x=torch.randn(1,8)
    for _ in range(64):
        o,st=m.step(x,st,commit_memory=False)
        for key in ('latent_v23','needs_v23','persistent_goal_v23','retention_gate_v23','autobiographical_v23'):
            assert torch.isfinite(o[key]).all()
    assert st.life_age.item()==64


def test_state_continuity_differs():
    m=tiny(); st=m.initial_state(1); x=torch.randn(1,8)
    o1,st=m.step(x,st,commit_memory=False); o2,st=m.step(x,st,commit_memory=False)
    assert not torch.allclose(o1['latent_v23'],o2['attention_trace_v23'])


def test_fp16_finite():
    m=tiny().half(); x=torch.randn(1,4,8).half()
    with torch.no_grad(): out=m(x,commit_memory=False)
    assert torch.isfinite(out['latent_v23']).all()


def test_retention_bounded():
    m=tiny(); out=m(torch.randn(2,4,8),commit_memory=False)
    for k in ('retention_gate_v23','consolidation_gate_v23','developmental_stage_v23'):
        assert out[k].min().item()>=0 and out[k].max().item()<=1


def test_no_optimizer_outside_scope():
    m=tiny(); tr=LifeTrainerV23(m)
    allowed={id(p) for p in tr.params}
    for p in m.parameters():
        if id(p) not in allowed:
            assert p.grad is None


def test_conflict_projection_removes_negative_alignment():
    gp=[torch.tensor([1.0,0.0])]
    ga=[torch.tensor([-1.0,1.0])]
    projected, conflict = ConflictAwareLifeTrainerV23._project_conflicts(gp, ga)
    assert conflict
    assert float((gp[0]*projected[0]).sum()) >= -1e-6
