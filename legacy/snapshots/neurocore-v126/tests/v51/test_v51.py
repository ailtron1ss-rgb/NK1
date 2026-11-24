import math
import torch
import torch.nn.functional as F

from neurocore.v51 import (
    V51Config, mobile_v51_config, ActionUtilityCriticV51,
    UncertaintyWeightedSensorBeliefV51, RegimeMonitorV51, OptionCommitmentV51,
    CounterfactualActionVerifierV51, SafeProbeControllerV51, NeuroWeaveV51, OrganismRuntimeV51,
    OrganismTrainerV51, RuntimeStateStoreV51,
)
from neurocore.v48.embodiment import SensorFrameV48
from neurocore.v40 import ExternalTaskV40, task_goal_v40


def cfg():
    c = mobile_v51_config(9)
    c.critic_min_observations_v51 = 2
    c.critic_action_candidates_v51 = 2
    c.critic_horizon_v51 = 2
    c.world_ready_observations_v50 = 2
    c.world_ready_horizon_v50 = 1
    c.world_rollout_horizon_v50 = 3
    return c


def test_v51_config_inherits_v50_contract():
    c = cfg()
    assert c.action_dim == 3
    assert c.raw_observation_dim == 9
    assert c.sensor_fusion_feature_dim_v50 == 11
    assert c.critic_horizon_v51 >= 1
    base = mobile_v51_config(9)
    assert base.critic_min_observations_v51 >= 24
    assert 0.0 < base.critic_compute_gate_uncertainty_v51 < 1.0


def test_critic_forward_is_finite_and_shaped():
    torch.manual_seed(1)
    m = ActionUtilityCriticV51(20, 20, 3, hidden=16)
    out = m(torch.randn(2,20), torch.randn(2,20), torch.randn(2,3),
            torch.randn(2,1), torch.rand(2,1), torch.rand(2,1), torch.rand(2,1))
    assert out["mean"].shape == (2,1)
    assert out["scale"].shape == (2,1)
    assert torch.isfinite(out["mean"]).all()
    assert torch.all(out["scale"] >= 0.03)


def test_critic_training_changes_parameters():
    torch.manual_seed(2)
    c = cfg(); m = NeuroWeaveV51(c); t = OrganismTrainerV51(m, lr=1e-3)
    before = {n:p.detach().clone() for n,p in m.action_utility_critic_v51.named_parameters()}
    t.train_action_utility(torch.randn(1,20), torch.randn(1,20), torch.randn(1,3),
                           torch.randn(1,1), torch.rand(1,1), torch.rand(1,1), torch.rand(1,1), 0.5)
    changed = sum(not torch.allclose(before[n], p.detach()) for n,p in m.action_utility_critic_v51.named_parameters())
    assert changed > 0
    assert t.critic_update_steps_v51 == 1


def test_sensor_belief_ignores_missing_channels_without_marking_valid():
    f = UncertaintyWeightedSensorBeliefV51(4)
    out = f.update(torch.tensor([1.,2.,3.,4.]), torch.tensor([1.,0.,1.,0.]), now_ms=100)
    assert out["values"].shape == (4,)
    assert float(out["freshness"][1]) == 0.0
    assert float(out["freshness"][3]) == 0.0
    assert torch.isfinite(out["values"]).all()


def test_sensor_belief_updates_valid_channels_and_state_roundtrips():
    f = UncertaintyWeightedSensorBeliefV51(3)
    out1 = f.update(torch.tensor([1.,2.,3.]), torch.ones(3), now_ms=100)
    out2 = f.update(torch.tensor([2.,4.,6.]), torch.ones(3), now_ms=200)
    assert torch.all(out2["values"] > out1["values"])
    s = f.state_dict(); g = UncertaintyWeightedSensorBeliefV51(3); g.load_state_dict(s)
    assert torch.allclose(f.estimate, g.estimate)
    assert torch.allclose(f.variance, g.variance)


def test_sensor_belief_staleness_increases_variance():
    f = UncertaintyWeightedSensorBeliefV51(2, max_staleness_ms=50)
    f.update(torch.tensor([1.,1.]), torch.ones(2), now_ms=0)
    v0 = f.variance.clone()
    out = f.update(torch.tensor([0.,0.]), torch.zeros(2), now_ms=200)
    assert torch.all(f.variance >= v0)
    assert float(out["freshness"].sum()) == 0.0


def test_regime_monitor_responds_to_large_residual():
    r = RegimeMonitorV51(window=6, threshold=1.8)
    for _ in range(6): r.update(0.1, 0.5, 1.0)
    base = r.severity
    for _ in range(3): r.update(2.5, 0.1, 1.0)
    assert r.severity > base
    assert 0.0 <= r.severity <= 1.0


def test_regime_monitor_recovers_after_stable_period():
    r = RegimeMonitorV51(window=6, threshold=1.8, recovery_rate=0.7)
    for _ in range(6): r.update(0.1, 0.5, 1.0)
    for _ in range(4): r.update(2.5, 0.1, 1.0)
    peak = r.severity
    for _ in range(20): r.update(0.05, 0.5, 1.0)
    assert r.severity < peak


def test_option_commitment_lifecycle():
    o = OptionCommitmentV51(2)
    assert not o.can_commit(0.1, 0.1, 0.5, 0.5)
    o.start(torch.tensor([[0.2,0.1,0.0]]), 3, 2)
    assert o.can_commit(0.1,0.1,0.5,0.5)
    assert torch.allclose(o.consume(), torch.tensor([[0.2,0.1,0.0]]))
    assert o.remaining == 1
    assert torch.allclose(o.consume(), torch.tensor([[0.2,0.1,0.0]]))
    assert o.remaining == 0
    assert not o.can_commit(0.1,0.1,0.5,0.5)


def test_option_commitment_invalidates_on_risk():
    o = OptionCommitmentV51(2); o.start(torch.zeros(1,3), 1, 2)
    assert not o.can_commit(0.9, 0.1, 0.5, 0.5)
    o.clear(); o.start(torch.zeros(1,3), 1, 2)
    assert not o.can_commit(0.1, 0.9, 0.5, 0.5)


def test_counterfactual_candidates_respect_support():
    torch.manual_seed(3)
    c=cfg(); v=CounterfactualActionVerifierV51(c, ActionUtilityCriticV51(20,20,3))
    b=torch.zeros(1,3); p=torch.tensor([[0.4,-0.2,0.1]])
    xs=v.candidates(b,p)
    assert xs.shape[0] >= 2
    assert float((xs-b).abs().max()) <= c.critic_action_support_v51 + 1e-5


def test_counterfactual_selector_falls_back_until_critic_ready():
    torch.manual_seed(4)
    c=cfg(); v=CounterfactualActionVerifierV51(c, ActionUtilityCriticV51(20,20,3))
    wm=NeuroWeaveV51(c).world_model_v50
    base=torch.zeros(1,3); prop=torch.full((1,3),0.1)
    got,meta=v.select(wm,torch.randn(1,20),torch.randn(1,20),base,prop,2,0.0,False)
    assert torch.allclose(got,prop)
    assert float(meta["critic51_ready"].item()) == 0.0


def test_neuro_v51_exposes_actionable_modules():
    m=NeuroWeaveV51(cfg())
    assert hasattr(m,"world_model_v50")
    assert hasattr(m,"action_utility_critic_v51")
    n=sum(p.numel() for p in m.action_utility_critic_v51.parameters() if p.requires_grad)
    assert n > 1000


def test_runtime_critic_activates_after_grounded_observations():
    torch.manual_seed(5)
    c=cfg(); m=NeuroWeaveV51(c); t=OrganismTrainerV51(m,lr=1e-3); rt=OrganismRuntimeV51(m,t)
    env=ExternalTaskV40(target=(0.7,0.7), seed=51); obs=env.reset(); goal=task_goal_v40((0.7,0.7),c.goal_dim,dtype=obs.dtype)
    for _ in range(3):
        out=rt.step(obs,goal); nxt,rew,risk=env.step(out["chosen_action_v51"]); rt.observe_transition(nxt,actual_reward=float(rew.item()),actual_risk=float(risk.item()),goal=goal); obs=nxt
    assert rt.critic_observations_v51 >= 3
    out=rt.step(obs,goal)
    assert "critic51_ready" in out and "critic51_compute_gate" in out


def test_runtime_feedback_updates_regime_and_critic():
    torch.manual_seed(6)
    c=cfg(); c.online_world_updates_per_feedback_v50=1; m=NeuroWeaveV51(c); t=OrganismTrainerV51(m,lr=1e-3); rt=OrganismRuntimeV51(m,t)
    obs=torch.randn(1,9); goal=torch.randn(1,8)
    out=rt.step(obs,goal)
    res=rt.observe_transition(obs+0.1,actual_reward=0.3,actual_risk=0.1,goal=goal)
    assert "regime_severity" in res
    assert rt.critic_observations_v51 == 1


def test_runtime_sensor_frame_uses_belief_and_reports_health():
    torch.manual_seed(7)
    c=cfg(); m=NeuroWeaveV51(c); rt=OrganismRuntimeV51(m)
    frame=SensorFrameV48(timestamp_ms=1000,sequence_id=1,channels={
        "imu":[0,0,0,0,0,0], "battery":[0.8], "thermal":[0.2], "cpu_load":[0.3], "memory_pressure":[0.1], "ambient_light":[0.5],
    })
    out=rt.step_sensor_frame(frame,goal=torch.randn(1,8),now_ms=1000)
    assert "sensor51_mean_confidence" in out
    assert "chosen_action_v51" in out
    assert torch.isfinite(out["chosen_action_v51"]).all()


def test_runtime_state_roundtrip_preserves_v51_state(tmp_path):
    torch.manual_seed(8)
    c=cfg(); m=NeuroWeaveV51(c); t=OrganismTrainerV51(m,lr=1e-3); rt=OrganismRuntimeV51(m,t)
    rt.step(torch.randn(1,9),torch.randn(1,8)); rt.regime_v51.update(1.0,0.2,0.8); rt.option_v51.start(torch.ones(1,3),2,2)
    p=tmp_path/"v51.pt"; RuntimeStateStoreV51.save(p,m,t,rt)
    m2=NeuroWeaveV51(c); t2=OrganismTrainerV51(m2,lr=1e-3); rt2=OrganismRuntimeV51(m2,t2); RuntimeStateStoreV51.load(p,m2,t2,rt2)
    assert rt2.critic_observations_v51 == rt.critic_observations_v51
    assert abs(rt2.regime_v51.severity-rt.regime_v51.severity) < 1e-9
    assert rt2.option_v51.remaining == rt.option_v51.remaining


def test_runtime_state_roundtrip_preserves_critic_weights(tmp_path):
    torch.manual_seed(9)
    c=cfg(); m=NeuroWeaveV51(c); t=OrganismTrainerV51(m,lr=1e-3); rt=OrganismRuntimeV51(m,t)
    t.train_action_utility(torch.randn(1,20),torch.randn(1,20),torch.randn(1,3),torch.randn(1,1),torch.rand(1,1),torch.rand(1,1),torch.rand(1,1),0.4)
    p=tmp_path/"v51.pt"; RuntimeStateStoreV51.save(p,m,t,rt)
    m2=NeuroWeaveV51(c); t2=OrganismTrainerV51(m2,lr=1e-3); rt2=OrganismRuntimeV51(m2,t2); RuntimeStateStoreV51.load(p,m2,t2,rt2)
    for (n,p1),(n2,p2) in zip(m.action_utility_critic_v51.state_dict().items(),m2.action_utility_critic_v51.state_dict().items()):
        assert torch.allclose(p1,p2)
    assert t2.critic_update_steps_v51 == t.critic_update_steps_v51


def test_counterfactual_selector_is_finite_when_ready():
    torch.manual_seed(10)
    c=cfg(); v=CounterfactualActionVerifierV51(c,ActionUtilityCriticV51(20,20,3)); wm=NeuroWeaveV51(c).world_model_v50
    base=torch.zeros(1,3); prop=torch.full((1,3),0.05)
    got,meta=v.select(wm,torch.randn(1,20),torch.randn(1,20),base,prop,2,0.0,True,0.9)
    assert torch.isfinite(got).all()
    assert torch.isfinite(meta["critic51_margin"]).all()


def test_regime_sensor_penalty_changes_severity():
    r=RegimeMonitorV51(window=6,threshold=2.0,sensor_weight=1.0)
    for _ in range(8): r.update(0.2,0.5,1.0)
    good=r.severity
    for _ in range(3): r.update(0.2,0.5,0.0)
    assert r.severity >= good


def test_action_utility_critic_monotonic_training_signal_direction():
    torch.manual_seed(12)
    c=cfg(); m=NeuroWeaveV51(c); t=OrganismTrainerV51(m,lr=2e-3)
    latent=torch.randn(16,20); goal=torch.randn(16,20); action=torch.randn(16,3)
    rr=torch.zeros(16,1); rk=torch.zeros(16,1); u=torch.ones(16,1)*0.2; sh=torch.ones(16,1)
    before=float(m.action_utility_critic_v51(latent,goal,action,rr,rk,u,sh)["mean"].mean().detach())
    for _ in range(10): t.train_action_utility(latent,goal,action,rr,rk,u,sh,0.8)
    after=float(m.action_utility_critic_v51(latent,goal,action,rr,rk,u,sh)["mean"].mean().detach())
    assert after > before


def test_v51_uses_v50_as_safe_base_action_when_not_accepted():
    torch.manual_seed(13)
    c=cfg(); c.critic_min_observations_v51=999; m=NeuroWeaveV51(c); rt=OrganismRuntimeV51(m)
    obs=torch.randn(1,9); goal=torch.randn(1,8); out=rt.step(obs,goal)
    assert torch.allclose(out["chosen_action_v51"], out["chosen_action_v50"])


def test_sensor_missing_does_not_force_critic_acceptance():
    torch.manual_seed(14)
    c=cfg(); c.critic_min_observations_v51=0; m=NeuroWeaveV51(c); t=OrganismTrainerV51(m,lr=1e-3); rt=OrganismRuntimeV51(m,t)
    rt._sensor_health_v51=0.0
    out=rt.step(torch.randn(1,9),torch.randn(1,8))
    assert float(out["sensor51_health"].item()) == 0.0
    assert float(out["critic51_regime"].item()) <= 1.0


def test_world_model_and_critic_parameters_are_distinct():
    c=cfg(); m=NeuroWeaveV51(c)
    wn={id(p) for p in m.world_model_v50.parameters()}
    cn={id(p) for p in m.action_utility_critic_v51.parameters()}
    assert wn.isdisjoint(cn)


def test_v51_compiles_real_external_feedback_cycle():
    torch.manual_seed(15)
    c=cfg(); c.online_world_updates_per_feedback_v50=1; m=NeuroWeaveV51(c); t=OrganismTrainerV51(m,lr=1e-3); rt=OrganismRuntimeV51(m,t)
    env=ExternalTaskV40(target=(0.6,-0.6),seed=66); obs=env.reset(); goal=task_goal_v40((0.6,-0.6),c.goal_dim,dtype=obs.dtype)
    initial_distance=float(obs[0,-2].item()); last=initial_distance
    for _ in range(3):
        out=rt.step(obs,goal); obs2,rew,risk=env.step(out["chosen_action_v51"]); rt.observe_transition(obs2,actual_reward=float(rew.item()),actual_risk=float(risk.item()),goal=goal); obs=obs2; last=float(obs[0,-2].item())
    assert math.isfinite(last)
    assert math.isfinite(initial_distance)


def test_safe_probe_is_bounded_and_gated():
    torch.manual_seed(20)
    p=SafeProbeControllerV51(probability=1.0,noise=0.2,support=0.1,max_risk=0.25,max_regime=0.3)
    base=torch.tensor([[0.2,-0.2,0.0]])
    a,used=p.maybe_probe(base,0.1,0.1,1.0,enabled=True)
    assert used
    assert float((a-base).abs().max()) <= 0.100001
    b,used2=p.maybe_probe(base,0.9,0.1,1.0,enabled=True)
    assert not used2 and torch.allclose(b,base)


def test_runtime_probe_roundtrips():
    c=cfg(); m=NeuroWeaveV51(c); rt=OrganismRuntimeV51(m)
    rt.probe_v51.probes=7
    state=rt.state_dict(); other=OrganismRuntimeV51(NeuroWeaveV51(c)); other.load_state_dict(state)
    assert other.probe_v51.probes==7


def test_action_outcome_memory_learns_local_action_utility():
    from neurocore.v51 import ActionOutcomeMemoryV51
    m=ActionOutcomeMemoryV51(4,4,2,min_items=3,top_k=3,bandwidth=0.18)
    z=torch.tensor([[1.,0.,0.,0.]])
    g=torch.tensor([[0.,1.,0.,0.]])
    actions=[torch.tensor([[0.,0.]]),torch.tensor([[0.05,0.02]]),torch.tensor([[0.8,-0.7]])]
    utils=[0.9,0.8,-0.9]
    for a,u in zip(actions,utils): m.add(z,g,a,u)
    q=m.query(z,g,torch.cat(actions,0))
    assert q["mean"].shape==(3,)
    assert q["mean"][0] > q["mean"][2]
    assert q["scale"].min() >= 0.05


def test_action_outcome_memory_roundtrip_and_capacity():
    from neurocore.v51 import ActionOutcomeMemoryV51
    m=ActionOutcomeMemoryV51(2,2,1,capacity=3,min_items=1)
    for i in range(5): m.add(torch.ones(1,2)*i,torch.zeros(1,2),torch.tensor([[0.1*i]]),float(i),step=i)
    assert m.count==3
    s=m.state_dict(); g=ActionOutcomeMemoryV51(2,2,1); g.load_state_dict(s)
    assert g.count==3 and g.next_step==5


def test_v51_memory_path_is_actionable_only_after_grounded_evidence():
    from neurocore.v51 import ActionOutcomeMemoryV51
    c=cfg(); c.outcome_memory_blend_v51=0.42; mem=ActionOutcomeMemoryV51(20,20,3,min_items=2); v=CounterfactualActionVerifierV51(c,ActionUtilityCriticV51(20,20,3),mem)
    wm=NeuroWeaveV51(c).world_model_v50; z=torch.randn(1,20); g=torch.randn(1,20); b=torch.zeros(1,3); p=torch.full((1,3),0.05)
    got,meta=v.select(wm,z,g,b,p,1,0.0,False)
    assert torch.allclose(got,p) and float(meta["critic51_memory_ready"].item())==0.0
    for i in range(2): mem.add(z,g,b,float(i))
    got2,meta2=v.select(wm,z,g,b,p,1,0.0,False)
    assert "critic51_memory_utility" in meta2 and float(meta2["critic51_memory_ready"].item())==1.0


def test_v51_runtime_persists_action_outcome_memory(tmp_path):
    c=cfg(); m=NeuroWeaveV51(c); t=OrganismTrainerV51(m,lr=1e-3); rt=OrganismRuntimeV51(m,t)
    out=rt.step(torch.randn(1,9),torch.randn(1,8)); rt.observe_transition(torch.randn(1,9),actual_reward=0.4,actual_risk=0.1)
    assert rt.utility_memory_v51.count==1
    p=tmp_path/"v51-memory.pt"; RuntimeStateStoreV51.save(p,m,t,rt)
    m2=NeuroWeaveV51(c); t2=OrganismTrainerV51(m2,lr=1e-3); rt2=OrganismRuntimeV51(m2,t2); RuntimeStateStoreV51.load(p,m2,t2,rt2)
    assert rt2.utility_memory_v51.count==rt.utility_memory_v51.count
