import tempfile
from pathlib import Path
import torch

from neurocore.v57 import (
    mobile_v57_config, IntrinsicDriveControllerV57, GoalLedgerV57,
    EndogenousGoalCoreV57, NeuroWeaveV57, OrganismRuntimeV57,
    OrganismTrainerV57, RuntimeStateStoreV57,
)


def cfg():
    c=mobile_v57_config(9)
    c.trajectory_min_pairs_v54=4
    c.trajectory_candidate_count_v54=1
    c.trajectory_train_updates_v54=1
    c.proposal_min_pairs_v55=4
    c.plan_min_pairs_v56=4
    c.goal_candidates_v57=4
    return c


def test_intrinsic_drives_are_stateful_not_labels():
    c=cfg(); d=IntrinsicDriveControllerV57(c)
    before=d.as_tensor()
    d.observe(prediction_error=.9,uncertainty=.8,confidence=.2,surprise=.85,reward=-.5,risk=.4,self_revision=.4)
    after=d.as_tensor()
    assert not torch.allclose(before,after)
    assert float(after.max())<=1.00001 and float(after.min())>=-.00001
    assert d.state.curiosity > 0.45 and d.state.novelty > 0.35


def test_goal_ledger_persists_and_repairs_failed_commitments():
    g=torch.randn(1,8)
    l=GoalLedgerV57(capacity=4,max_retries=2)
    r=l.activate(g,source='internal',score=.5,confidence=.8,step=0)
    assert l.active().goal_id==r.goal_id
    l.update_outcome(g,reward=-.8,risk=.2,progress=0.0,step=1)
    l.update_outcome(g,reward=-.8,risk=.2,progress=0.0,step=2)
    l.update_outcome(g,reward=-.8,risk=.2,progress=0.0,step=3)
    assert l.active() is None
    state=l.state_dict(); l2=GoalLedgerV57(); l2.load_state_dict(state)
    assert len(l2.records)==1 and l2.records[0].attempts==3


def test_endogenous_goal_proposals_compete_and_are_bounded():
    torch.manual_seed(4)
    m=EndogenousGoalCoreV57(20,8,8,20,3,candidates=5,hidden=16)
    out=m.propose(
        latent=torch.randn(2,20),self_state=torch.randn(2,8),memory=torch.randn(2,20),
        uncertainty=torch.full((2,1),.6),prediction_error=torch.full((2,1),.4),
        confidence=torch.full((2,1),.5),consistency=torch.full((2,1),.2),drives=torch.full((2,6),.5),
    )
    assert out['candidates'].shape==(2,5,8)
    assert out['chosen'].shape==(2,8)
    assert torch.allclose(out['probabilities'].sum(-1),torch.ones(2),atol=1e-5)
    assert float(out['confidence'].detach().min())>=0 and float(out['confidence'].detach().max())<=1


def test_v57_generates_internal_goal_without_external_command():
    torch.manual_seed(5)
    c=cfg(); model=NeuroWeaveV57(c); trainer=OrganismTrainerV57(model,lr=8e-4); rt=OrganismRuntimeV57(model,trainer)
    out=rt.step(torch.randn(1,9),goal=None)
    assert 'v57_internal_goal' in out
    assert out['v57_effective_goal'].shape==(1,8)
    assert rt.goal_decisions_v57==1
    assert rt.internal_goal_decisions_v57==1
    assert rt.goal_ledger_v57.active() is not None


def test_v57_external_goal_is_retained_with_bounded_autonomy_blend():
    torch.manual_seed(6)
    c=cfg(); c.goal_external_blend_v57=.9; c.goal_autonomy_blend_v57=.1
    model=NeuroWeaveV57(c); trainer=OrganismTrainerV57(model); rt=OrganismRuntimeV57(model,trainer)
    g=torch.randn(1,8)
    out=rt.step(torch.randn(1,9),goal=g)
    assert out['v57_effective_goal'].shape==(1,8)
    sim=float(torch.nn.functional.cosine_similarity(out['v57_effective_goal'],g,dim=-1).item())
    assert sim>0.90


def test_v57_real_outcome_updates_drive_goal_ledger_and_trains():
    torch.manual_seed(7)
    c=cfg(); c.goal_train_updates_v57=1
    model=NeuroWeaveV57(c); trainer=OrganismTrainerV57(model,lr=7e-4); rt=OrganismRuntimeV57(model,trainer)
    rt.step(torch.randn(1,9),goal=None)
    result=rt.observe_transition(torch.randn(1,9),actual_reward=.6,actual_risk=.1,goal=None,update_world_model=False)
    assert 'v57_goal_id' in result
    assert 'v57_goal_outcome_loss' in result
    assert trainer.goal_outcome_trainer_v57.update_steps>=1
    assert trainer.goal_outcome_trainer_v57.observations>=1


def test_v57_state_roundtrip():
    torch.manual_seed(8)
    c=cfg(); model=NeuroWeaveV57(c); trainer=OrganismTrainerV57(model); rt=OrganismRuntimeV57(model,trainer)
    rt.step(torch.randn(1,9),goal=None)
    rt.observe_transition(torch.randn(1,9),actual_reward=.2,actual_risk=.0,goal=None,update_world_model=False)
    with tempfile.TemporaryDirectory() as d:
        p=Path(d)/'v57.pt'; RuntimeStateStoreV57.save(p,model,trainer,rt)
        m2=NeuroWeaveV57(c); t2=OrganismTrainerV57(m2); r2=OrganismRuntimeV57(m2,t2)
        RuntimeStateStoreV57.load(p,m2,t2,r2)
        assert r2.drives_v57.state.step==rt.drives_v57.state.step
        assert len(r2.goal_ledger_v57.records)==len(rt.goal_ledger_v57.records)
        assert t2.goal_outcome_trainer_v57.update_steps==trainer.goal_outcome_trainer_v57.update_steps


def test_v57_mobile_parameter_budget():
    m=NeuroWeaveV57(cfg())
    total=sum(p.numel() for p in m.parameters() if p.requires_grad)
    assert 0 < total < 4_000_000
