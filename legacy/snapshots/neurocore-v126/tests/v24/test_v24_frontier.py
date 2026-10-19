import torch
from neurocore.v24 import NeuroWeaveV24,V24Config,OrganismTrainerV24

def tiny(): return NeuroWeaveV24(V24Config(d=8,hidden=16,action_dim=3,modalities=2,proprio_dim=3,intero_dim=2,event_capacity=8,horizon_count=3,max_horizon=3))

def test_contract_and_finite():
    m=tiny(); x=torch.randn(2,5,8); pr=torch.randn(2,5,3); ir=torch.randn(2,5,2)
    o=m(x,proprioception_sequence=pr,interoception_sequence=ir,commit_memory=False)
    assert o['latent_v24'].shape==(2,5,8); assert torch.isfinite(o['future_latents_v24']).all(); assert torch.equal(o['_final_state'].life_clock, torch.full((2,1),5,dtype=o['_final_state'].life_clock.dtype))

def test_new_blocks_receive_gradients():
    m=tiny(); tr=OrganismTrainerV24(m); x=torch.randn(2,5,8); loss,_=tr.step(x)
    assert torch.isfinite(loss)
    assert all(p.grad is not None and torch.isfinite(p.grad).all() for p in tr.params)

def test_training_reduces_primary_prediction_loss():
    torch.manual_seed(7); m=tiny(); tr=OrganismTrainerV24(m,lr=2e-3); x=torch.randn(2,7,8)
    p0=float(m.training_loss_parts(m(x,commit_memory=False))[0].detach())
    for _ in range(4): tr.step(x)
    p1=float(m.training_loss_parts(m(x,commit_memory=False))[0].detach()); assert p1<p0

def test_event_ledger_bounded():
    m=tiny(); st=m.initial_state(1); x=torch.randn(1,8)
    for _ in range(40): _,st=m.step(x,st,commit_memory=False)
    assert st.event_keys.shape==(1,8,8); assert st.event_active.max().item()<=1 and st.event_active.min().item()>=0

def test_skill_topk_is_sparse():
    m=tiny(); o=m(torch.randn(2,4,8),commit_memory=False); idx=o['skill_indices_v24']; assert idx.shape[-1]==2
    assert (o['skill_probs_v24']>0).all()

def test_continuity_bounded():
    m=tiny(); o=m(torch.randn(2,4,8),commit_memory=False)
    assert o['continuity_v24'].min().item()>=0 and o['continuity_v24'].max().item()<=1

def test_long_horizon_shape():
    m=tiny(); o=m(torch.randn(1,3,8),commit_memory=False)
    assert o['future_latents_v24'].shape==(1,3,3,8)

def test_fp16():
    m=tiny().half(); o=m(torch.randn(1,3,8).half(),commit_memory=False); assert torch.isfinite(o['latent_v24']).all()

def test_state_continuity():
    m=tiny(); st=m.initial_state(1); x=torch.randn(1,8); o1,st=m.step(x,st,commit_memory=False); o2,st=m.step(x,st,commit_memory=False); assert (o1['identity_anchor_v24']-o2['identity_anchor_v24']).abs().sum().item()>0

def test_optimizer_scope():
    m=tiny(); tr=OrganismTrainerV24(m); allowed={id(p) for p in tr.params}; x=torch.randn(1,4,8); tr.step(x)
    for p in m.parameters():
        if id(p) not in allowed: assert p.grad is None

def test_memory_retrieval_participates_in_cognition():
    m=tiny(); o=m(torch.randn(1,5,8),commit_memory=False)
    assert o['memory_weights_v24'].shape==(1,5,8); assert o['memory_key_bank_v24'].shape==(1,5,8,8); assert torch.isfinite(o['memory_context_v24']).all(); assert torch.isfinite(o['cognitive_latent_v24']).all()

def test_retriever_gradients():
    m=tiny(); tr=OrganismTrainerV24(m); tr.step(torch.randn(2,5,8))
    assert all(p.grad is not None and torch.isfinite(p.grad).all() for p in tr.model.retriever.parameters())
