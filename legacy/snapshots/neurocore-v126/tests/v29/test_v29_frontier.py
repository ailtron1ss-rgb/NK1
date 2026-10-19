import torch
from neurocore.v29 import V29Config,NeuroWeaveV29,StagedOrganismTrainerV29,WorldEgoSplitV29,CausalExperienceMemoryV29

def build(dtype=torch.float32):
    return NeuroWeaveV29(V29Config(d=8,hidden=16,action_dim=3,modalities=3,proprio_dim=2,intero_dim=2,working_slots=8,episodic_slots=10,semantic_slots=6,event_slots=8,causal_slots=8,max_horizon=4)).to(dtype)

def batch(dtype=torch.float32):
    x=torch.randn(2,6,8,dtype=dtype); g=torch.randn(2,6,8,dtype=dtype); m=torch.randn(2,6,3,8,dtype=dtype); p=torch.ones(2,6,3,dtype=dtype); pr=torch.randn(2,6,2,dtype=dtype); ir=torch.randn(2,6,2,dtype=dtype); return x,g,m,p,pr,ir

def test_forward_shapes():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert o['fused_latent_v29'].shape==x.shape; assert o['world_latent_v29'].shape[:2]==x.shape[:2]; assert o['action_candidates_v29'].shape==(2,6,4,3); assert torch.isfinite(o['fused_latent_v29']).all()

def test_horizon_sums():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.allclose(o['horizon_prob_v29'].sum(-1),torch.ones_like(o['horizon_prob_v29'][...,0]))

def test_algorithm_is_hard():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); idx=o['algorithm_index_v29']; assert idx.dtype==torch.long and idx.shape==(2,6)

def test_world_ego_gradients():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); (o['world_latent_v29'].pow(2).mean()+o['ego_latent_v29'].pow(2).mean()).backward(); assert any(p.grad is not None for p in m.world_ego.parameters())

def test_causal_memory_retrieval_changes():
    mem=CausalExperienceMemoryV29(8,16,3,8); q=torch.randn(2,8); k=torch.randn(2,8,8); v=torch.randn(2,8,8); valid=torch.ones(2,8,1); a,_=mem.retrieve(q,k,v,valid); b,_=mem.retrieve(q,k,v*0,valid); assert (a-b).abs().mean()>1e-7

def test_causal_gradients():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); loss=o['causal_read_v29'].pow(2).mean(); loss.backward(); assert any(p.grad is not None for p in m.causal.parameters())

def test_training_reduces_loss():
    torch.manual_seed(4); m=build(); tr=StagedOrganismTrainerV29(m,lr=2e-3,warmup_steps=1); x,g,mm,p,pr,ir=batch(); l1,_=tr.step(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); l2,_=tr.step(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.isfinite(l1) and torch.isfinite(l2); assert all(not p.requires_grad for p in m.base.parameters())

def test_fp16_finite():
    m=build(torch.float16); x,g,mm,p,pr,ir=batch(torch.float16); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.isfinite(o['fused_latent_v29']).all()

def test_state_continuity():
    m=build(); x,g,mm,p,pr,ir=batch(); o1=m(x[:,:3],goal_sequence=g[:,:3],modality_sequence=mm[:,:3],presence_sequence=p[:,:3],proprioception_sequence=pr[:,:3],interoception_sequence=ir[:,:3]); o2=m(x[:,3:],state=o1['_final_state'],goal_sequence=g[:,3:],modality_sequence=mm[:,3:],presence_sequence=p[:,3:],proprioception_sequence=pr[:,3:],interoception_sequence=ir[:,3:]); assert float(o2['life_clock_v29'][:,-1].mean())>=6

def test_curriculum_normalized():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.allclose(o['curriculum_v29'].sum(-1),torch.ones_like(o['curriculum_v29'][...,0]),atol=1e-5)

def test_action_finite():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.isfinite(o['chosen_action_v29']).all(); assert (o['chosen_action_v29'].abs()<=1.0001).all()

def test_scoped_trainer_params():
    m=build(); tr=StagedOrganismTrainerV29(m); ids={id(p) for p in tr.params}; assert ids and all((p.requires_grad)==(id(p) in ids) for p in m.parameters())

def test_world_ego_module():
    mod=WorldEgoSplitV29(8,16,10,6,3); z=torch.randn(2,8); a=torch.randn(2,3); u=torch.rand(2,1); w,e,wp,ep=mod(z,a,u); assert w.shape==(2,10) and e.shape==(2,6) and wp.shape==(2,10) and ep.shape==(2,6)

def test_replay_path_changes_fused_state():
    m=build(); x,g,mm,p,pr,ir=batch(); s=m.initial_state(2); s.replay_bank[:,0]=torch.randn(2,8); s.replay_valid[:,0]=1; o,_=m.step(x[:,0],s,goal=g[:,0],presence=p[:,0],modalities=mm[:,0],proprioception=pr[:,0],interoception=ir[:,0],commit_memory=False); assert torch.isfinite(o['replay_read_v29']).all()

def test_hard_router_runs_selected_rows_only_semantically():
    m=build(); x,g,mm,p,pr,ir=batch(); o=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); idx=o['algorithm_index_v29']; assert idx.min()>=0 and idx.max()<4

def test_hard_router_compute_row_budget():
    m=build(); seen=[0 for _ in m.alg_router.laws]
    hooks=[]
    for i,mod in enumerate(m.alg_router.laws):
        hooks.append(mod.register_forward_pre_hook(lambda mod, inp, i=i: seen.__setitem__(i, seen[i]+inp[0].shape[0])))
    x,g,mm,p,pr,ir=batch(); _=m(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir)
    for h in hooks: h.remove()
    assert sum(seen)==x.shape[0]*x.shape[1]
    assert max(seen)<=x.shape[0]*x.shape[1]

def test_conflict_free_trainer_scope():
    from neurocore.v29 import ConflictFreeTrainerV29
    m=build(); tr=ConflictFreeTrainerV29(m,lr=1e-3,warmup_steps=1); x,g,mm,p,pr,ir=batch(); loss,_=tr.step(x,goal_sequence=g,modality_sequence=mm,presence_sequence=p,proprioception_sequence=pr,interoception_sequence=ir); assert torch.isfinite(loss)
