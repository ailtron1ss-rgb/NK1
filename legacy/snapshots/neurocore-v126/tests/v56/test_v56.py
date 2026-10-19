import tempfile
from pathlib import Path
import torch

from neurocore.v56 import (
    mobile_v56_config, MultiTimescalePredictorV56, ConsolidatingMemoryV56,
    LatentPlanOptimizerV56, CognitiveBudgetControllerV56, NeuroWeaveV56,
    OrganismRuntimeV56, OrganismTrainerV56, RuntimeStateStoreV56,
)


def cfg():
    c=mobile_v56_config(9)
    c.trajectory_min_pairs_v54=4
    c.trajectory_candidate_count_v54=1
    c.trajectory_train_updates_v54=1
    c.plan_min_pairs_v56=2
    c.plan_train_updates_v56=1
    return c


def test_multiscale_state_updates_and_predicts():
    torch.manual_seed(1)
    m=MultiTimescalePredictorV56(20,20,8,20,3,6,hidden=12)
    st=m.initial_state(1,dtype=torch.float32)
    z=torch.randn(1,20); g=torch.randn(1,20); s=torch.randn(1,8); mem=torch.randn(1,20); a=torch.randn(1,3); b=torch.randn(1,6)
    out=m.step(st,latent=z,goal=g,self_state=s,memory=mem,action=a,body=b,uncertainty=torch.ones(1,1)*.4,prediction_error=torch.ones(1,1)*.2,confidence=torch.ones(1,1)*.7)
    assert out['predicted_latent'].shape==(1,20)
    assert out['state'].step_index==1
    assert not torch.allclose(st.fast,out['state'].fast)


def test_consolidating_memory_has_fast_and_slow_without_unbounded_growth():
    from neurocore.v55 import NeuralAssociativeMemoryV55
    f=NeuralAssociativeMemoryV55(20,20,20,slots=4,write_rate=.5)
    m=ConsolidatingMemoryV56(f,slow_slots=3,threshold=.1)
    q=torch.randn(1,20)
    r=m.write(q,q,importance=1.0,surprise=1.0)
    assert float(r['written'].item())==1.0 and float(r['slow_written'].item())==1.0
    assert m.consolidations==1
    out=m.read(q)
    assert out['combined_read'].shape==(1,20)


def test_plan_optimizer_is_bounded_and_trainable():
    p=LatentPlanOptimizerV56(20,20,3,horizon=4,hidden=12,delta_limit=.08)
    z=torch.randn(2,20); g=torch.randn(2,20); base=torch.randn(2,4,3).clamp(-1,1)
    out=p(z,g,base)
    assert out['plan'].shape==(2,4,3)
    assert float(out['plan'].detach().max())<=1.00001 and float(out['plan'].detach().min())>=-1.00001
    loss=out['plan'].pow(2).mean(); loss.backward()
    assert any(x.grad is not None for x in p.parameters() if x.requires_grad)


def test_budget_deepens_with_disagreement():
    b=CognitiveBudgetControllerV56(max_depth=3,planner_min_depth=2)
    stable=b.decide(.05,.03,.95,.02); stressed=b.decide(.7,.8,.2,.9)
    assert stressed.depth>=stable.depth
    assert stressed.planner_allowed


def test_v56_runtime_real_loop_trains_and_consolidates():
    torch.manual_seed(3)
    c=cfg(); model=NeuroWeaveV56(c); trainer=OrganismTrainerV56(model,lr=1e-3); rt=OrganismRuntimeV56(model,trainer)
    g=torch.randn(1,20)
    before=rt.multiscale_state_v56.fast.clone()
    out=rt.step(torch.randn(1,9),g)
    result=rt.observe_transition(torch.randn(1,9),actual_reward=.8,actual_risk=.0,goal=g,update_world_model=False)
    assert not torch.allclose(before,rt.multiscale_state_v56.fast)
    assert 'v56_multiscale_loss' in result
    assert 'v56_slow_memory_written' in result
    assert rt.multiscale_update_steps_v56==1
    assert len(rt.autobiographical_v55.events)==1
    assert 'v56_budget_depth' in out


def test_v56_state_roundtrip():
    c=cfg(); model=NeuroWeaveV56(c); trainer=OrganismTrainerV56(model); rt=OrganismRuntimeV56(model,trainer)
    g=torch.randn(1,20); rt.step(torch.randn(1,9),g); rt.observe_transition(torch.randn(1,9),actual_reward=.2,actual_risk=.0,goal=g,update_world_model=False)
    with tempfile.TemporaryDirectory() as d:
        path=Path(d)/'v56.pt'; RuntimeStateStoreV56.save(path,model,trainer,rt)
        m2=NeuroWeaveV56(c); t2=OrganismTrainerV56(m2); r2=OrganismRuntimeV56(m2,t2)
        RuntimeStateStoreV56.load(path,m2,t2,r2)
        assert r2.multiscale_state_v56.step_index==rt.multiscale_state_v56.step_index
        assert r2.memory_v56.consolidations==rt.memory_v56.consolidations
        assert t2.latent_plan_trainer_v56.update_steps==trainer.latent_plan_trainer_v56.update_steps


def test_v56_mobile_parameter_count_reasonable():
    m=NeuroWeaveV56(cfg()); total=sum(p.numel() for p in m.parameters() if p.requires_grad)
    added=sum(p.numel() for p in m.multiscale_v56.parameters())+sum(p.numel() for p in m.latent_planner_v56.parameters())
    assert total>added>0 and total<3_000_000
