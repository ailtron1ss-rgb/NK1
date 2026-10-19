import torch
from neurocore.v28 import V28Config,NeuroWeaveV28,StagedOrganismTrainerV28,HierarchicalMemoryV28

def build(dtype=torch.float32):
    torch.manual_seed(28)
    return NeuroWeaveV28(V28Config(d=8,hidden=16,action_dim=3,modalities=3,proprio_dim=2,intero_dim=2,working_slots=8,episodic_slots=10,semantic_slots=6,event_slots=8,chunk_horizon=3)).to(dtype)

def batch(dtype=torch.float32,b=2,t=8,d=8):
    torch.manual_seed(29); x=torch.randn(b,t,d,dtype=dtype); g=torch.randn(b,t,d,dtype=dtype); mm=torch.randn(b,t,3,d,dtype=dtype); p=torch.ones(b,t,3,dtype=dtype); pr=torch.randn(b,t,2,dtype=dtype); ir=torch.randn(b,t,2,dtype=dtype); return x,g,mm,p,pr,ir

def test_forward_and_finite():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert o['fused_latent_v28'].shape==x.shape; assert o['action_chunk_v28'].shape==(2,8,3,3); assert torch.isfinite(o['fused_latent_v28']).all()

def test_state_continuity():
    m=build(); x,g,mm,p,pr,ir=batch(); a=m(x[:,:4],goal_sequence=g[:,:4],modality_sequence=mm[:,:4],presence_sequence=p[:,:4],proprioception_sequence=pr[:,:4],interoception_sequence=ir[:,:4]); b=m(x[:,4:],state=a['_final_state'],goal_sequence=g[:,4:],modality_sequence=mm[:,4:],presence_sequence=p[:,4:],proprioception_sequence=pr[:,4:],interoception_sequence=ir[:,4:]); assert b['_final_state'].sleep_clock.min().item()==8

def test_hierarchical_memory_retrieval_is_sensitive():
    mem=HierarchicalMemoryV28(8,16,10,6); z=torch.randn(2,8); ek=torch.randn(2,10,8); ev=torch.randn(2,10,8); es=torch.ones(2,10,1); sk=torch.randn(2,6,8); sv=torch.randn(2,6,8); g=torch.randn(2,8); u=torch.rand(2,1); a,_,_=mem.read(z,ek,ev,es,sk,sv,g,u); b,_,_=mem.read(z,ek,ev*0,es,sk,sv,g,u); assert (a-b).abs().mean().item()>1e-7

def test_event_boundary_and_write_are_bounded():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); st=o['_final_state']; assert st.event_bank.shape==(2,8,8); assert st.event_strength.min().item()>=0 and st.event_strength.max().item()<=1

def test_chunk_planner_gradients():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir,commit_memory=False); loss=o['chunk_value_v28'].pow(2).mean()+o['action_chunk_v28'].pow(2).mean(); loss.backward(); assert any(p.grad is not None for p in m.chunk_planner.parameters())

def test_precision_policy_normalized():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); w=o['precision_policy_v28']; assert torch.allclose(w.sum(-1),torch.ones_like(w.sum(-1)),atol=1e-5)

def test_identity_trajectory_has_signal():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); loss=o['identity_trajectory_v28'].pow(2).mean(); loss.backward(); assert any(p.grad is not None for p in m.identity_proj.parameters())

def test_staged_training_scope():
    m=build(); tr=StagedOrganismTrainerV28(m,lr=2e-3,warmup_steps=1); x,g,mm,p,pr,ir=batch(); l1,_=tr.step(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); l2,_=tr.step(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.isfinite(l1) and torch.isfinite(l2); assert all(not p.requires_grad for p in m.base.parameters())

def test_primary_learning_decreases():
    m=build(); tr=StagedOrganismTrainerV28(m,lr=3e-3,warmup_steps=0); x,g,mm,p,pr,ir=batch();
    with torch.no_grad(): before=m.loss_parts(m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir,commit_memory=False))[0].item()
    for _ in range(5): tr.step(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir)
    with torch.no_grad(): after=m.loss_parts(m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir,commit_memory=False))[0].item()
    assert after <= before*1.25

def test_fp16_finite():
    m=build(torch.float16); x,g,mm,p,pr,ir=batch(torch.float16); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.isfinite(o['fused_latent_v28']).all()

def test_consolidation_is_bounded():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); st=o['_final_state']; before=st.semantic_values.clone(); m.consolidate(st,rate=0.05); assert torch.isfinite(st.semantic_values).all(); assert (st.semantic_values-before).abs().mean().item()>=0

def test_mobile_bound():
    m=build(); assert sum(p.numel() for p in m.parameters())<500000

def test_dream_state_finite():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.isfinite(o['dream_state_v28']).all()

def test_event_retrieval_changes_with_bank():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); q=o['fused_latent_v28'][:,-1]; st=o['_final_state']; r1=m.event_graph.retrieve_relation(q,st.event_bank,st.event_relation*st.event_strength); r2=m.event_graph.retrieve_relation(q,st.event_bank*0,st.event_relation*st.event_strength); assert (r1-r2).abs().mean().item()>=0
