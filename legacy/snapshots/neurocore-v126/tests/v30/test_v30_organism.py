import torch
from neurocore.v30 import V30Config,NeuroWeaveV30,OrganismTrainerV30

def build(dtype=torch.float32):
    return NeuroWeaveV30(V30Config(d=8,hidden=16,action_dim=3,modalities=3,proprio_dim=2,intero_dim=2,working_slots=8,episodic_slots=10,semantic_slots=6,event_slots=8,causal_slots=8,world_dim=6,ego_dim=5,body_dim=6,goal_dim=8,max_horizon=3,planner_candidates=3)).to(dtype)

def batch(dtype=torch.float32):
    g=torch.Generator().manual_seed(7); x=torch.randn(2,6,8,generator=g,dtype=dtype); goal=torch.randn(2,6,8,generator=g,dtype=dtype); mods=torch.randn(2,6,3,8,generator=g,dtype=dtype); pres=torch.ones(2,6,3,dtype=dtype); pr=torch.randn(2,6,2,generator=g,dtype=dtype); ir=torch.randn(2,6,2,generator=g,dtype=dtype); return x,goal,mods,pres,pr,ir

def call(m):
    x,g,mm,p,pr,ir=batch(); return m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir)

def test_forward():
    o=call(build()); assert o['fused_latent_v30'].shape==(2,6,8); assert o['action_candidates_v30'].shape==(2,6,3,3,3); assert torch.isfinite(o['transition_pred_v30']).all()

def test_planner_changes_action_path():
    m=build(); o=call(m); a=o['chosen_action_v30']; b=o['planned_action_v30']; assert (a-b).abs().mean()>1e-7

def test_causal_memory_is_populated_by_next_observation():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x[:,:1],goal_sequence=g[:,:1],modality_sequence=mm[:,:1],presence_sequence=p[:,:1],proprioception_sequence=pr[:,:1],interoception_sequence=ir[:,:1]); s=o['_final_state']; assert float(s.causal_valid.sum())==0.0
    o2=m(x[:,1:3],state=s,goal_sequence=g[:,1:3],modality_sequence=mm[:,1:3],presence_sequence=p[:,1:3],proprioception_sequence=pr[:,1:3],interoception_sequence=ir[:,1:3]); assert float(o2['_final_state'].causal_valid.sum())>0.0

def test_identity_is_causally_used():
    m=build(); x,g,mm,p,pr,ir=batch(); s=m.initial_state(2); o,_=m.step(x[:,0],s,goal=g[:,0],presence=p[:,0],modalities=mm[:,0],proprioception=pr[:,0],interoception=ir[:,0],commit_memory=False); base=o['fused_latent_v30'].detach(); s2=o['_final_state']; s2.self_state=s2.self_state+3.0; o2,_=m.step(x[:,1],s2,goal=g[:,1],presence=p[:,1],modalities=mm[:,1],proprioception=pr[:,1],interoception=ir[:,1],commit_memory=False); assert (base-o2['fused_latent_v30']).abs().mean()>1e-7

def test_algorithm_output_is_causally_used():
    m=build(); x,g,mm,p,pr,ir=batch();
    o=call(m); orig=m.algorithm_bank
    for p in m.algorithm_bank.parameters(): p.data.zero_()
    o2=call(m)
    assert (o['fused_latent_v30']-o2['fused_latent_v30']).abs().mean()>1e-8

def test_world_ego_body_predicts_observed_dimensions():
    o=call(build()); assert o['world_pred_v30'].shape[-1]==6; assert o['ego_pred_v30'].shape[-1]==5; assert o['body_pred_v30'].shape[-1]==6

def test_metacognition_finite():
    o=call(build()); assert torch.isfinite(o['metacognitive_confidence_v30']).all(); assert ((o['metacognitive_confidence_v30']>=0)&(o['metacognitive_confidence_v30']<=1)).all()

def test_training():
    torch.manual_seed(4); m=build(); tr=OrganismTrainerV30(m,lr=1e-3,warmup_steps=1); x,g,mm,p,pr,ir=batch(); l1,_,_=tr.step(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); l2,_,_=tr.step(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.isfinite(l1) and torch.isfinite(l2)

def test_state_continuity():
    m=build(); x,g,mm,p,pr,ir=batch(); o1=m(x[:,:2],goal_sequence=g[:,:2],modality_sequence=mm[:,:2],presence_sequence=p[:,:2],proprioception_sequence=pr[:,:2],interoception_sequence=ir[:,:2]); o2=m(x[:,2:],state=o1['_final_state'],goal_sequence=g[:,2:],modality_sequence=mm[:,2:],presence_sequence=p[:,2:],proprioception_sequence=pr[:,2:],interoception_sequence=ir[:,2:]); assert float(o2['life_clock_v30'][:,-1].mean())>=6

def test_cpu_forward_is_finite():
    o=call(build()); assert torch.isfinite(o['fused_latent_v30']).all()

def test_memory_empty_path_is_zero():
    from neurocore.v30 import CausalTransitionMemoryV30
    m=CausalTransitionMemoryV30(8,3,16,8,6); q=torch.randn(2,8); a=torch.randn(2,3); k=torch.randn(2,8,8); v=torch.randn(2,8,8); valid=torch.zeros(2,8,1); r,w=m.retrieve(q,a,k,v,valid); assert torch.allclose(r,torch.zeros_like(r)); assert torch.allclose(w,torch.zeros_like(w))

def test_body_state_stays_batched():
    o=call(build()); assert o['body_state_v30'].ndim==3 and o['body_state_v30'].shape[-1]==6

def test_action_intervention_changes_predicted_consequence():
    from neurocore.v30 import PointMass2D
    env=PointMass2D(batch=2); obs=env.reset(); x=torch.zeros(2,8); x[:,:8]=obs; m=build(); s=m.initial_state(2); g=torch.ones(2,8); base,_=m.step(x,s,goal=g,commit_memory=False); s2=base['_final_state']; # use same state and observation, change external causal world action via model transition directly
    z=base['fused_latent_v30']; body=s2.body; gap=torch.ones(2,1)
    a0=torch.zeros(2,3); a1=torch.ones(2,3); p0=m.transition(z,a0,body,gap)[0]; p1=m.transition(z,a1,body,gap)[0]; assert (p0-p1).abs().mean()>1e-7

def test_target_sequence_is_used_for_training_loss():
    m=build(); x,g,mm,p,pr,ir=batch(); out=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir,commit_memory=False); target=torch.roll(x,shifts=-1,dims=1); parts_self=m.loss_parts(out); parts_real=m.loss_parts(out,target_sequence=target); assert not torch.allclose(parts_self['primary'],parts_real['primary'])
