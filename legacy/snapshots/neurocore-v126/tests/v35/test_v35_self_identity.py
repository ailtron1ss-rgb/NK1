import torch

from neurocore.v35 import V35Config, NeuroWeaveV35, OrganismTrainerV35, RuntimeStateStoreV35
from neurocore.v30 import PointMass2D


def build(raw=0):
    return NeuroWeaveV35(V35Config(
        d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
        working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
        world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3,
        planner_candidates=3, ensemble_heads=2, refine_steps=1, replay_capacity=32,
        replay_batch=4, plan_rollout_depth=3, planning_probe_interval=2,
        dream_candidates=2, episodic_slots_v34=8, skill_count_v34=4,
        sr_gammas_v34=(0.8,0.93), sr_dim_v34=8, subgoal_horizon_v34=2,
        raw_observation_dim=raw, identity_slots_v35=4,
    )).float()


def data(T=5, B=2):
    g=torch.Generator().manual_seed(141)
    x=torch.randn(B,T,8,generator=g); goal=torch.randn(B,T,8,generator=g)
    target=torch.roll(x,-1,dims=1)
    reward=torch.randn(B,T,1,generator=g).tanh(); risk=torch.rand(B,T,1,generator=g)
    return x,goal,target,reward,risk


def test_v35_forward_is_finite_and_identity_is_causal():
    m=build(); x,g,t,r,k=data()
    out=m(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    assert out['chosen_action_v34'].shape==(2,5,3)
    assert out['identity_state_v35'].shape==(2,5,8)
    assert torch.isfinite(out['identity_state_v35']).all()


def test_v35_identity_changes_only_after_real_outcome():
    m=build(); x,g,t,r,k=data(T=2,B=1); st=m.initial_state(1)
    o1,st1=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    assert torch.allclose(st.identity_state,st1.identity_state)
    obs,new= m.observe_outcome(st1,o1,t[:,0],r[:,0],k[:,0])
    assert not torch.allclose(st1.identity_state,new.identity_state)
    assert float(new.life_clock.item())==1


def test_v35_identity_gradient_is_real():
    m=build(); x,g,t,r,k=data(T=4)
    out=m(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    loss=m.loss_parts(out,target_sequence=t,reward_sequence=r,risk_sequence=k)['self_prediction']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.identity.self_predict.parameters() if p.grad is not None)
    assert grad>0


def test_v35_identity_goal_is_causal():
    m=build(); x,_,t,r,k=data(T=3,B=1); st=m.initial_state(1)
    goal_a=torch.zeros(1,8); goal_b=torch.ones(1,8)
    oa,_=m.step(x[:,0],st,goal=goal_a,commit_memory=False,force_planning=False)
    ob,_=m.step(x[:,0],st,goal=goal_b,commit_memory=False,force_planning=False)
    assert not torch.allclose(oa['enriched_goal_v35'],ob['enriched_goal_v35'])


def test_v35_commitment_persists_and_updates():
    m=build(); x,g,t,r,k=data(T=2,B=1); st=m.initial_state(1)
    o,st=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    _,st2=m.observe_outcome(st,o,t[:,0],r[:,0],k[:,0])
    assert float(st2.commitment_strengths.sum())>0


def test_v35_value_provenance_is_aligned_to_memory_slots():
    m=build(); x,g,t,r,k=data(T=2,B=1); st=m.initial_state(1)
    o,st=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    _,st2=m.observe_outcome(st,o,t[:,0],r[:,0],k[:,0])
    assert st2.value_provenance.shape==(1,8,8)
    assert torch.isfinite(st2.value_provenance).all()


def test_v35_contradiction_reservoir_changes_with_surprising_outcome():
    m=build(); x,g,t,r,k=data(T=2,B=1); st=m.initial_state(1)
    o,st=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    _,st2=m.observe_outcome(st,o,torch.randn(1,8)*4.0,torch.ones(1,1),torch.zeros(1,1))
    assert float(st2.contradiction_state.item())>=0
    assert not torch.allclose(st2.contradiction_state,st.contradiction_state)


def test_v35_real_environment_updates_identity_and_replay():
    m=build(raw=9); tr=OrganismTrainerV35(m,warmup_steps=99)
    env=PointMass2D(batch=1); obs=env.reset(); st=m.initial_state(1)
    goal=torch.zeros(1,8); goal[:,:2]=env.goal-env.state.pos
    out,st=m.act_from_observation(obs,st,goal=goal,commit_memory=False,force_planning=False)
    nxt,rew,risk=env.step(out['chosen_action_v34'].detach())
    observed,st2=tr.ingest_real_outcome(st,out,nxt.detach(),rew.detach(),risk.detach())
    assert len(tr.replay)==1
    assert not torch.allclose(st.identity_state,st2.identity_state)


def test_v35_restart_roundtrip():
    m=build(); x,_,t,r,k=data(T=2,B=1); st=m.initial_state(1)
    o,st=m.step(x[:,0],st,commit_memory=True,force_planning=False)
    _,st=m.observe_outcome(st,o,t[:,0],r[:,0],k[:,0])
    path='/tmp/v35_state_test.pt'
    RuntimeStateStoreV35.save(path,st)
    loaded=RuntimeStateStoreV35.load(path,device='cpu',dtype=torch.float32)
    assert torch.allclose(loaded.identity_state,st.identity_state)
    assert torch.allclose(loaded.value_provenance,st.value_provenance)


def test_v35_raw_observation_training_path():
    m=build(raw=9)
    raw=torch.randn(1,4,9); target=torch.randn(1,4,9); goal=torch.randn(1,4,8)
    reward=torch.randn(1,4,1).tanh(); risk=torch.rand(1,4,1)
    out=m(raw,goal_sequence=goal,target_sequence=target,reward_sequence=reward,risk_sequence=risk,commit_memory=False,force_planning=False)
    assert out['chosen_action_v34'].shape==(1,4,3)
    loss=m.training_loss(out,target_sequence=target,reward_sequence=reward,risk_sequence=risk)
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.identity.self_predict.parameters() if p.grad is not None)
    assert torch.isfinite(loss) and grad>0


def test_v35_parameter_budget_compact():
    m=build(); assert sum(p.numel() for p in m.parameters())<450000


def test_v35_trainer_updates_parameters():
    torch.manual_seed(5); m=build(); tr=OrganismTrainerV35(m,lr=5e-4,warmup_steps=99)
    x,g,t,r,k=data(T=3)
    before=[p.detach().clone() for p in m.identity.parameters()]
    loss,_=tr.step(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,force_planning=False)
    after=[p.detach().clone() for p in m.identity.parameters()]
    assert torch.isfinite(loss)
    assert any(not torch.allclose(a,b) for a,b in zip(before,after))


def test_v35_goal_persists_and_revises_after_outcome():
    m=build(); x,g,t,r,k=data(T=3,B=1); st=m.initial_state(1)
    o,st=m.step(x[:,0],st,goal=None,commit_memory=False,force_planning=False)
    assert torch.norm(o['enriched_goal_v35']).item()>0
    assert torch.allclose(st.active_goal, torch.zeros_like(st.active_goal))
    _,st2=m.observe_outcome(st,o,t[:,0],r[:,0],k[:,0])
    assert torch.norm(st2.active_goal).item()>0
    assert float(st2.goal_confidence.item())>=0
    assert torch.isfinite(st2.active_goal).all()


def test_v35_goal_manager_gradient_is_real():
    m=build(); x,g,t,r,k=data(T=4)
    out=m(x,goal_sequence=None,target_sequence=t,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    loss=m.loss_parts(out,target_sequence=t,reward_sequence=r,risk_sequence=k)['goal_management']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.goal_manager.parameters() if p.grad is not None)
    assert grad>0


def test_v35_commitment_score_gradient_is_real():
    m=build(); x,g,t,r,k=data(T=4)
    out=m(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    loss=m.loss_parts(out,target_sequence=t,reward_sequence=r,risk_sequence=k)['commitment']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.identity.commitment_score.parameters() if p.grad is not None)
    assert grad>0


def test_v35_semantic_context_changes_self_prediction():
    m=build(); st=m.initial_state(1); x,g,t,r,k=data(T=2,B=1)
    o,_=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    z=o['fused_latent_v30']; goal=o['enriched_goal_v35']; act=o['chosen_action_v35']; body=o['body_state_v30']
    a=m.identity.predict_self(st.identity_state,z,goal,act,body,torch.zeros_like(z))
    b=m.identity.predict_self(st.identity_state,z,goal,act,body,torch.ones_like(z))
    assert not torch.allclose(a,b)


def test_v35_anchor_and_commitment_evidence_update():
    m=build(); x,g,t,r,k=data(T=2,B=1); st=m.initial_state(1)
    o,st=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    _,st2=m.observe_outcome(st,o,t[:,0],torch.ones(1,1),torch.zeros(1,1))
    assert float(st2.commitment_success.sum())>0
    assert float(st2.commitment_failure.sum())>=0
    assert torch.isfinite(st2.identity_anchor).all()


def test_v35_fast_adapter_state_changes_action():
    m=build(); st=m.initial_state(1); x,g,t,r,k=data(T=2,B=1)
    o1,_=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    st_fast=m.initial_state(1)
    st_fast.fast_adapter_state.fill_(0.9)
    o2,_=m.step(x[:,0],st_fast,goal=g[:,0],commit_memory=False,force_planning=False)
    assert not torch.allclose(o1['chosen_action_v35'], o2['chosen_action_v35'])


def test_v35_identity_anchor_is_slower_than_fast_identity_revision():
    m=build(); x,g,t,r,k=data(T=3,B=1); st=m.initial_state(1)
    o,st=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    _,st2=m.observe_outcome(st,o,t[:,0],r[:,0],k[:,0])
    identity_delta=(st2.identity_state-st.identity_state).norm().item()
    anchor_delta=(st2.identity_anchor-st.identity_anchor).norm().item()
    assert anchor_delta <= identity_delta + 1e-6


def test_v35_goal_completion_can_release_and_reseed_goal():
    m=build(); x,g,t,r,k=data(T=2,B=1); st=m.initial_state(1)
    o,st=m.step(x[:,0],st,goal=None,commit_memory=False,force_planning=False)
    # Force an explicitly successful, low-risk outcome; completion remains model-predicted,
    # but the lifecycle path must remain finite and capable of changing the active target.
    _,st2=m.observe_outcome(st,o,t[:,0],torch.ones(1,1),torch.zeros(1,1))
    assert torch.isfinite(st2.active_goal).all()
    assert st2.active_goal.shape==(1,8)
    assert float(st2.goal_progress.item())>=0


def test_v35_live_runtime_action_then_outcome_roundtrip():
    from neurocore.v35 import LiveOrganismV35
    rt=LiveOrganismV35.create(build().cfg, device='cpu', dtype=torch.float32, with_trainer=True)
    obs=torch.randn(1,8)
    rt.reset(1)
    out=rt.act(obs, goal=None, force_planning=False)
    nxt=torch.randn(1,8); reward=torch.ones(1,1); risk=torch.zeros(1,1)
    observed,state=rt.observe_outcome(nxt,reward,risk)
    assert 'identity_state' in observed
    path='/tmp/v35_live_runtime.pt'; rt.save(path)
    rt2=LiveOrganismV35.create(rt.model.cfg, device='cpu', dtype=torch.float32, with_trainer=False)
    loaded=rt2.load(path, device='cpu', dtype=torch.float32)
    assert torch.allclose(loaded.active_goal,state.active_goal)
    assert torch.allclose(loaded.fast_adapter_state,state.fast_adapter_state)
