import torch
from neurocore.v31 import V31Config,NeuroWeaveV31,OrganismTrainerV31
from neurocore.v30 import PointMass2D

def build():
    return NeuroWeaveV31(V31Config(d=8,hidden=16,action_dim=3,modalities=3,proprio_dim=2,intero_dim=2,working_slots=8,episodic_slots=10,semantic_slots=6,event_slots=8,causal_slots=8,world_dim=6,ego_dim=5,body_dim=6,goal_dim=8,max_horizon=3,planner_candidates=3)).to(torch.float32)

def batch(T=8,B=3):
    g=torch.Generator().manual_seed(11); x=torch.randn(B,T,8,generator=g); goal=torch.randn(B,T,8,generator=g); reward=torch.randn(B,T,1,generator=g).tanh(); risk=torch.rand(B,T,1,generator=g); target=torch.roll(x,shifts=-1,dims=1); return x,goal,target,reward,risk

def test_forward_and_state():
    m=build(); x,g,t,r,k=batch(); o=m(x,goal_sequence=g,target_sequence=t,commit_memory=False); assert o['chosen_action_v31'].shape==(3,8,3); assert torch.isfinite(o['next_observation_pred_v31']).all(); assert o['_final_state'].identity.shape==(3,8)

def test_external_outcome_path_is_trainable():
    m=build(); x,g,t,r,k=batch(); o=m(x,goal_sequence=g,commit_memory=False); loss=torch.nn.functional.mse_loss(o['next_observation_pred_v31'][:,:-1],t[:,1:]); loss.backward(); grad=sum(float(p.grad.abs().sum()) for p in m.external.next_obs.parameters() if p.grad is not None); assert grad>0

def test_router_has_gradient_from_probe_loss():
    m=build(); x,g,t,r,k=batch(); o=m(x,goal_sequence=g,commit_memory=False); loss=torch.nn.functional.mse_loss(m.fusion_probe(torch.cat([o['fused_latent_v30'],o['reasoning_state_v31']],-1))[:,:-1],t[:,1:]); loss.backward(); grad=sum(float(p.grad.abs().sum()) for p in m.base.algorithm_router.parameters() if p.grad is not None); assert grad>0

def test_identity_changes_effective_goal_and_action():
    m=build(); x,g,t,r,k=batch(T=3,B=2); s=m.initial_state(2); o,s2=m.step(x[:,0],s,goal=g[:,0],commit_memory=False); s2.identity=s2.identity+2.0; o2,_=m.step(x[:,1],s2,goal=g[:,1],commit_memory=False); assert (o['chosen_action_v31']-o2['chosen_action_v31']).abs().mean()>1e-7

def test_actor_residual_changes_emitted_action_and_transition():
    m=build(); x,g,t,r,k=batch(T=3,B=2); o=m(x,goal_sequence=g,commit_memory=False); a0=o['chosen_action_v31']; m.actor_critic.actor[-1].weight.data.zero_(); m.actor_critic.actor[-1].bias.data.fill_(0.7); o2=m(x,goal_sequence=g,commit_memory=False); assert (a0-o2['chosen_action_v31']).abs().mean()>1e-7; assert (o['transition_pred_v31']-o2['transition_pred_v31']).abs().mean()>1e-7

def test_causal_memory_objective_trains_encoder():
    m=build(); x,g,t,r,k=batch(); o=m(x,goal_sequence=g,commit_memory=False); loss=m._causal_memory_loss(o,t,r,k); loss.backward(); grad=sum(float(p.grad.abs().sum()) for p in m.base.memory.parameters() if p.grad is not None); assert grad>0




def test_ingest_outcome_commits_real_transition_and_identity():
    m=build(); x,g,t,r,k=batch(T=3,B=2); s=m.initial_state(2); o,s2=m.step(x[:,0],s,goal=g[:,0],commit_memory=False); ns=m.ingest_outcome(s2,o,x[:,1],r[:,0],k[:,0]); assert float(ns.base.causal_valid.sum())>0; assert torch.isfinite(ns.identity).all()

def test_planner_value_has_real_gradient_path():
    m=build(); x,g,t,r,k=batch(); o=m(x,goal_sequence=g,commit_memory=False); returns=(r.cumsum(dim=1)*0.0) + r
    loss=m.loss_parts(o,target_sequence=t,reward_sequence=r,risk_sequence=k)['planner_value']; loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.base.planner.value.parameters() if p.grad is not None); assert grad>0

def test_real_outcome_training_decreases_loss_on_fixed_batch():
    torch.manual_seed(2); m=build(); tr=OrganismTrainerV31(m,lr=2e-3,warmup_steps=0); x,g,t,r,k=batch();
    vals=[]
    for _ in range(12):
        l,_,_=tr.step(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k)
        vals.append(float(l))
    assert vals[-1] < vals[0] or min(vals[1:]) < vals[0]

def test_pointmass_has_real_external_outcomes():
    env=PointMass2D(batch=2); obs=env.reset(); act=torch.tensor([[1.,1.,0.],[0.5,0.2,0.]])
    nxt,rew,risk=env.step(act); assert not torch.allclose(obs,nxt); assert torch.isfinite(rew).all() and torch.isfinite(risk).all()
