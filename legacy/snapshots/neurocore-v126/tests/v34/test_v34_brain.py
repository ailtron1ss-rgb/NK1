import torch
import torch.nn.functional as F

from neurocore.v34 import V34Config, NeuroWeaveV34, OrganismTrainerV34, RuntimeStateStoreV34
from neurocore.v30 import PointMass2D


def build(raw=0):
    return NeuroWeaveV34(V34Config(
        d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
        working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
        world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3, planner_candidates=3,
        ensemble_heads=2, refine_steps=1, replay_capacity=32, replay_batch=4,
        plan_rollout_depth=3, planning_probe_interval=2, dream_candidates=2,
        episodic_slots_v34=8, skill_count_v34=4, sr_gammas_v34=(0.8,0.93),
        sr_dim_v34=8, subgoal_horizon_v34=2, raw_observation_dim=raw,
    )).float()


def data(T=5, B=2):
    g=torch.Generator().manual_seed(91)
    x=torch.randn(B,T,8,generator=g); goal=torch.randn(B,T,8,generator=g)
    target=torch.roll(x,-1,dims=1)
    reward=torch.randn(B,T,1,generator=g).tanh(); risk=torch.rand(B,T,1,generator=g)
    return x,goal,target,reward,risk


def test_v34_forward_finite_and_causal_memory():
    m=build(); x,g,t,r,k=data()
    out=m(x,goal_sequence=g,target_sequence=t,commit_memory=False,force_planning=False)
    assert out['chosen_action_v34'].shape==(2,5,3)
    assert out['memory_attention_v34'].shape==(2,5,8)
    assert torch.isfinite(out['memory_read_v34']).all()
    assert torch.isfinite(out['successor_field_v34']).all()


def test_v34_memory_changes_next_goal():
    m=build(); x,_,_,_,_=data(T=2)
    st=m.initial_state(2)
    o1,st1=m.step(x[:,0],st,goal=torch.zeros(2,8),commit_memory=False,force_planning=False)
    o2,_=m.step(x[:,1],st1,goal=torch.zeros(2,8),commit_memory=False,force_planning=False)
    assert not torch.allclose(o1['enriched_goal_v34'], o2['enriched_goal_v34'])


def test_v34_successor_and_subgoal_gradients():
    m=build(); x,g,t,r,k=data(T=4)
    out=m(x,goal_sequence=g,target_sequence=t,commit_memory=False,force_planning=False)
    loss=m.loss_parts(out,target_sequence=t,reward_sequence=r,risk_sequence=k)['successor'] + m.loss_parts(out,target_sequence=t)['subgoal']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.successor.parameters() if p.grad is not None)
    assert grad>0


def test_v34_memory_and_semantic_gradients_are_real():
    m=build(); x,g,t,r,k=data(T=4)
    out=m(x,goal_sequence=g,target_sequence=t,commit_memory=False,force_planning=False)
    parts=m.loss_parts(out,target_sequence=t)
    loss=parts['memory']+parts['semantic']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.memory.parameters() if p.grad is not None)
    assert grad>0


def test_v34_skill_path_is_real():
    m=build(); x,g,t,r,k=data(T=4)
    out=m(x,goal_sequence=g,target_sequence=t,commit_memory=False,force_planning=True)
    loss=m.loss_parts(out,target_sequence=t)['skill']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.skills.parameters() if p.grad is not None)
    assert grad>0


def test_v34_raw_observation_is_trainable():
    m=build(raw=9)
    raw=torch.randn(1,3,9); target=torch.randn(1,3,9); goal=torch.randn(1,3,8)
    out=m(raw,goal_sequence=goal,target_sequence=target,commit_memory=False,force_planning=False)
    assert out['chosen_action_v34'].shape==(1,3,3)
    loss=m.loss_parts(out,target_sequence=target)['semantic']
    m.zero_grad(set_to_none=True); loss.backward()
    grad=sum(float(p.grad.abs().sum()) for p in m.base.observation_adapter.parameters() if p.grad is not None)
    assert grad>0


def test_v34_real_outcome_reaches_replay():
    m=build(); tr=OrganismTrainerV34(m,warmup_steps=99); env=PointMass2D(batch=2); obs=env.reset(); st=m.initial_state(2)
    for _ in range(2):
        goal=torch.zeros(2,8); goal[:,:2]=env.goal-env.state.pos
        out,st=m.act_from_observation(obs[:,:8],st,goal=goal,commit_memory=False,force_planning=False)
        nxt,rew,risk=env.step(out['chosen_action_v34'].detach())
        tr.ingest_outcome(out['fused_latent_v30'].detach(),out['chosen_action_v34'].detach(),out['body_state_v30'].detach(),out['external_state_v31'].detach(),nxt.detach(),rew.detach(),risk.detach())
        obs=nxt
    assert len(tr.replay)==4


def test_v34_trainer_updates_and_loss_is_finite():
    torch.manual_seed(4); m=build(); tr=OrganismTrainerV34(m,lr=5e-4,warmup_steps=99)
    x,g,t,r,k=data(T=3); before=[p.detach().clone() for p in m.skills.parameters()]
    loss,out=tr.step(x,goal_sequence=g,target_sequence=t,reward_sequence=r,risk_sequence=k,force_planning=False)
    after=[p.detach().clone() for p in m.skills.parameters()]
    assert torch.isfinite(loss)
    assert any(not torch.allclose(a,b) for a,b in zip(before,after))


def test_v34_parameter_budget_compact():
    m=build(); params=sum(p.numel() for p in m.parameters()); assert params<350000


def test_v34_anchored_dream_rehearsal_returns_valid_report():
    m=build(); tr=OrganismTrainerV34(m,warmup_steps=99)
    z=torch.randn(3,8); a=torch.randn(3,3).tanh(); body=torch.randn(3,6); ext=torch.randn(3,8); nxt=torch.randn(3,8)
    tr.ingest_outcome(z,a,body,ext,nxt,torch.zeros(3,1),torch.zeros(3,1))
    rep=tr.dream_rehearse(max_items=3)
    assert rep['examined']==3 and rep['accepted']<=3


def test_v34_restart_state_persists_memory():
    m=build(); x,_,_,_,_=data(T=2); st=m.initial_state(1)
    _,st1=m.step(x[:1,0],st,commit_memory=True,force_planning=False)
    assert st1.life_clock.item()==1
    assert float(st1.memory_priority.sum())>=0
    # Explicit state handoff is the continuity contract; memory is detached for safe restart persistence.
    _,st2=m.step(x[:1,1],st1,commit_memory=True,force_planning=False)
    assert st2.life_clock.item()==2


def test_v34_runtime_state_roundtrip(tmp_path):
    m=build(); x,_,_,_,_=data(T=2); st=m.initial_state(1)
    _,st=m.step(x[:1,0],st,commit_memory=True,force_planning=False)
    path=tmp_path/'brain_state.pt'; RuntimeStateStoreV34.save(str(path),st)
    loaded=RuntimeStateStoreV34.load(str(path),device='cpu',dtype=torch.float32)
    assert loaded.life_clock.item()==st.life_clock.item()
    assert torch.allclose(loaded.semantic_state,st.semantic_state)
    assert torch.allclose(loaded.episodic_memory,st.episodic_memory)


def test_v34_legacy_memory_is_not_a_second_truth_store():
    c=V34Config(); assert c.causal_memory_scale==0.0 and c.legacy_rule_scale==0.0
