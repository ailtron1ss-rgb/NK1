import torch

from neurocore.v36 import V36Config, NeuroWeaveV36, OrganismTrainerV36, RuntimeStateStoreV36


def build(raw=0):
    return NeuroWeaveV36(V36Config(
        d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
        working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
        world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3, planner_candidates=3,
        ensemble_heads=2, refine_steps=1, replay_capacity=32, replay_batch=4,
        plan_rollout_depth=3, planning_probe_interval=2, dream_candidates=2,
        episodic_slots_v34=8, skill_count_v34=4, sr_gammas_v34=(0.8,0.93),
        sr_dim_v34=8, subgoal_horizon_v34=2, raw_observation_dim=raw,
        identity_slots_v35=4, cognitive_map_slots_v36=8, macro_horizons_v36=(1,2,4),
        macro_duration_max_v36=4,
    )).float()


def data(T=5, B=2):
    g=torch.Generator().manual_seed(731)
    x=torch.randn(B,T,8,generator=g); goal=torch.randn(B,T,8,generator=g)
    target=torch.roll(x,-1,dims=1)
    reward=torch.randn(B,T,1,generator=g).tanh(); risk=torch.rand(B,T,1,generator=g)
    return x,goal,target,reward,risk


def test_v36_forward_finite_and_map_exists():
    m=build(); x,g,t,r,k=data()
    out=m(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    assert out['chosen_action_v36'].shape==(2,5,3)
    assert out['cognitive_map_context_v36'].shape==(2,5,8)
    assert out['macro_state_v36'].shape==(2,5,8)
    assert torch.isfinite(out['chosen_action_v36']).all()


def test_v36_map_is_causally_updated_by_outcome():
    m=build(); x,g,t,r,k=data(T=2,B=1); st=m.initial_state(1)
    o,st1=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    before=st1.cognitive_map.clone()
    _,st2=m.observe_outcome(st1,o,t[:,0],torch.ones(1,1),torch.zeros(1,1))
    assert not torch.allclose(before,st2.cognitive_map)


def test_v36_skill_transfer_is_not_decorative():
    m=build(); x,g,_,_,_=data(T=2,B=1); st=m.initial_state(1)
    o1,_=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    st2=m.initial_state(1); st2.transfer_context.fill_(0.7)
    o2,_=m.step(x[:,0],st2,goal=g[:,0],commit_memory=False,force_planning=False)
    assert not torch.allclose(o1['transfer_action_v36'], o2['transfer_action_v36'])


def test_v36_cognitive_map_gradient_is_real():
    m=build(); x,g,t,r,k=data(T=4)
    out=m(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    loss=m.loss_parts(out,target_sequence=t,reward_sequence=r,risk_sequence=k)['cognitive_map']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.cognitive_map.parameters() if p.grad is not None)
    assert grad>0


def test_v36_macro_and_transfer_gradients_are_real():
    m=build(); x,g,t,r,k=data(T=4)
    out=m(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    parts=m.loss_parts(out,target_sequence=t,reward_sequence=r,risk_sequence=k)
    loss=parts['macro']+parts['skill_transfer']+parts['macro_duration']
    m.zero_grad(set_to_none=True); loss.backward()
    gm=sum(float(p.grad.abs().sum()) for p in m.macro.parameters() if p.grad is not None)
    gt=sum(float(p.grad.abs().sum()) for p in m.transfer.parameters() if p.grad is not None)
    assert gm>0 and gt>0


def test_v36_raw_observation_path():
    m=build(raw=9)
    x=torch.randn(1,3,9); goal=torch.randn(1,3,8); target=torch.randn(1,3,9)
    out=m(x,goal_sequence=goal,target_sequence=target,commit_memory=False,force_planning=False)
    assert out['chosen_action_v36'].shape==(1,3,3)
    loss=m.loss_parts(out,target_sequence=target)['cognitive_map']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.base.base.base.observation_adapter.parameters() if p.grad is not None)
    assert grad>0


def test_v36_runtime_state_roundtrip(tmp_path):
    m=build(); x,g,_,_,_=data(T=2,B=1); st=m.initial_state(1)
    _,st=m.step(x[:,0],st,goal=g[:,0],commit_memory=True,force_planning=False)
    p=tmp_path/'v36_state.pt'; RuntimeStateStoreV36.save(str(p),st)
    loaded=RuntimeStateStoreV36.load(str(p),device='cpu',dtype=torch.float32)
    assert torch.allclose(loaded.cognitive_map,st.cognitive_map)
    assert torch.allclose(loaded.macro_state,st.macro_state)


def test_v36_trainer_updates_parameters():
    torch.manual_seed(19); m=build(); tr=OrganismTrainerV36(m,lr=4e-4,warmup_steps=99)
    x,g,t,r,k=data(T=3,B=2)
    before=[p.detach().clone() for p in m.transfer.parameters()]
    loss,_=tr.step(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,force_planning=False)
    after=[p.detach().clone() for p in m.transfer.parameters()]
    assert torch.isfinite(loss)
    assert any(not torch.allclose(a,b) for a,b in zip(before,after))


def test_v36_transition_predictor_gradient_is_real():
    m=build(); x,g,t,r,k=data(T=4)
    out=m(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,commit_memory=False,force_planning=False)
    loss=m.loss_parts(out,target_sequence=t,reward_sequence=r,risk_sequence=k)['map_transition']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.cognitive_map.transition_predictor.parameters() if p.grad is not None)
    assert grad>0


def test_v36_macro_and_transfer_change_planning_goal():
    m=build(); x,g,_,_,_=data(T=2,B=1); st=m.initial_state(1)
    o1,_=m.step(x[:,0],st,goal=g[:,0],commit_memory=False,force_planning=False)
    st2=m.initial_state(1); st2.macro_state.fill_(0.6); st2.transfer_context.fill_(-0.6)
    o2,_=m.step(x[:,0],st2,goal=g[:,0],commit_memory=False,force_planning=False)
    assert not torch.allclose(o1['planning_goal_v36'], o2['planning_goal_v36'])


def test_v36_live_runtime_real_outcome_updates_map(tmp_path):
    from neurocore.v36 import LiveOrganismV36
    rt=LiveOrganismV36.create(build().cfg, device='cpu', dtype=torch.float32, with_trainer=True)
    rt.reset(1)
    obs=torch.randn(1,8)
    out=rt.act(obs, force_planning=False)
    before=rt.state.cognitive_map.clone()
    observed,state=rt.observe_outcome(torch.randn(1,8), torch.ones(1,1), torch.zeros(1,1))
    assert not torch.allclose(before,state.cognitive_map)
    p=tmp_path/'live.pt'; rt.save(str(p))
    rt2=LiveOrganismV36.create(rt.model.cfg,device='cpu',dtype=torch.float32,with_trainer=False)
    loaded=rt2.load(str(p),device='cpu',dtype=torch.float32)
    assert torch.allclose(loaded.cognitive_map,state.cognitive_map)


def test_v36_trainer_replay_uses_v36_action():
    torch.manual_seed(33); m=build(); tr=OrganismTrainerV36(m,lr=3e-4,warmup_steps=0)
    x,g,t,r,k=data(T=3,B=1)
    loss,out=tr.step(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,force_planning=False)
    assert torch.isfinite(loss)
    assert len(tr.replay)>0
    replay_action=tr.replay.data[-1]['action']
    all_actions=out['chosen_action_v36'][:, :-1].reshape(-1,3)
    assert replay_action.shape[-1]==3 and any(torch.allclose(replay_action,a,atol=1e-5) for a in all_actions)


def test_v36_dream_rehearsal_runs_from_real_replay():
    m=build(); tr=OrganismTrainerV36(m,warmup_steps=99); x=torch.randn(2,8); st=m.initial_state(2)
    out,st=m.step(x,st,goal=torch.randn(2,8),commit_memory=False,force_planning=False)
    tr.ingest_outcome(out['fused_latent_v30'].detach(),out['chosen_action_v36'].detach(),out['body_state_v30'].detach(),out['external_state_v31'].detach(),torch.randn(2,8),torch.zeros(2,1),torch.zeros(2,1))
    rep=tr.dream_rehearse(max_items=2)
    assert rep['examined']==2 and rep['accepted']<=2
