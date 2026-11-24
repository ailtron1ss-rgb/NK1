import torch
from neurocore.v25 import NeuroWeaveV25,V25Config,OrganismTrainerV25

def tiny():
    return NeuroWeaveV25(V25Config(d=8,hidden=16,action_dim=3,modalities=2,proprio_dim=3,intero_dim=2,event_capacity=8,skill_slots=5,top_k=2))

def test_contract_and_finite():
    m=tiny(); x=torch.randn(2,5,8); pr=torch.randn(2,5,3); ir=torch.randn(2,5,2)
    o=m(x,proprioception_sequence=pr,interoception_sequence=ir,commit_memory=False)
    assert o['latent_v25'].shape==(2,5,8)
    assert o['workspace_v25'].shape==(2,5,8)
    assert torch.isfinite(o['future_latents_v24']).all()
    assert torch.equal(o['_final_state'].life_clock,torch.full((2,1),5,dtype=o['_final_state'].life_clock.dtype))

def test_workspace_bottleneck_is_bounded():
    m=tiny(); o=m(torch.randn(2,6,8),commit_memory=False)
    assert torch.isfinite(o['workspace_availability_v25']).all()
    assert o['workspace_availability_v25'].min().item()>=0 and o['workspace_availability_v25'].max().item()<=1

def test_boundary_is_bounded():
    m=tiny(); o=m(torch.randn(2,6,8),commit_memory=False)
    assert o['event_boundary_v25'].min().item()>=0 and o['event_boundary_v25'].max().item()<=1

def test_sparse_skill_shape():
    m=tiny(); o=m(torch.randn(3,4,8),commit_memory=False)
    assert o['skill_indices_v25'].shape==(3,4,2)
    assert o['skill_probs_v25'].shape==(3,4,5)

def test_sparse_skill_state_changes():
    m=tiny(); st=m.initial_state(1); x=torch.randn(1,8); _,st2=m.step(x,st,commit_memory=False)
    assert not torch.equal(st.skill_prototypes,st2.skill_prototypes)

def test_mode_distribution():
    m=tiny(); o=m(torch.randn(2,5,8),commit_memory=False)
    s=o['mode_probs_v25'].sum(-1)
    assert torch.allclose(s,torch.ones_like(s),atol=1e-5)

def test_causal_credit_finite():
    m=tiny(); o=m(torch.randn(2,5,8),commit_memory=False)
    assert torch.isfinite(o['skill_credit_v25']).all()

def test_identity_trajectory_finite():
    m=tiny(); o=m(torch.randn(2,5,8),commit_memory=False)
    assert torch.isfinite(o['identity_trajectory_v25']).all()

def test_state_continuity():
    m=tiny(); st=m.initial_state(1); x=torch.randn(1,8); o1,st=m.step(x,st,commit_memory=False); o2,st=m.step(x,st,commit_memory=False)
    assert (o1['workspace_v25']-o2['workspace_v25']).abs().sum().item()>0

def test_training_new_blocks_receive_gradients():
    m=tiny(); tr=OrganismTrainerV25(m); tr.step(torch.randn(2,6,8))
    for p in tr.params:
        assert p.grad is not None and torch.isfinite(p.grad).all()

def test_optimizer_scope():
    m=tiny(); tr=OrganismTrainerV25(m); allowed={id(p) for p in tr.params}; tr.step(torch.randn(1,5,8))
    for p in m.parameters():
        if id(p) not in allowed: assert p.grad is None

def test_training_reduces_primary_prediction_loss():
    torch.manual_seed(12); m=tiny(); tr=OrganismTrainerV25(m,lr=2e-3); x=torch.randn(2,8,8)
    p0=float(m.training_loss_parts(m(x,commit_memory=False))[0].detach())
    for _ in range(5): tr.step(x)
    p1=float(m.training_loss_parts(m(x,commit_memory=False))[0].detach())
    assert p1<p0

def test_long_stream_bounded():
    m=tiny(); st=m.initial_state(1); x=torch.randn(1,8)
    for _ in range(64): _,st=m.step(x,st,commit_memory=False)
    assert st.life_clock.item()==64
    assert torch.isfinite(st.workspace).all() and torch.isfinite(st.identity_trajectory).all()
    assert torch.linalg.vector_norm(st.workspace).item()<100

def test_fp16():
    m=tiny().half(); o=m(torch.randn(1,4,8).half(),commit_memory=False); assert torch.isfinite(o['latent_v25']).all() and torch.isfinite(o['workspace_v25']).all()

def test_multimodal_presence_path():
    m=tiny(); x=torch.randn(2,4,8); mods=torch.randn(2,4,2,8); pres=torch.tensor([[[1.,0.],[0.,1.],[1.,1.],[0.,0.]],[[1.,1.],[1.,0.],[0.,1.],[1.,1.]]]); o=m(x,modality_sequence=mods,presence_sequence=pres,commit_memory=False)
    assert torch.isfinite(o['latent_v25']).all()
