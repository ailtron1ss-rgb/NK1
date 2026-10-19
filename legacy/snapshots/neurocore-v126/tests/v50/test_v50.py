import math
import torch
import torch.nn.functional as F

from neurocore.v50 import (
    V50Config,
    mobile_v50_config,
    StateAlignedLatentWorldModelV50,
    HorizonCalibratedUncertaintyV50,
    StateAlignedPlannerV50,
    WorldModelAdmissionGateV50,
    SensorFusionEncoderV50,
    NeuroWeaveV50,
    OrganismTrainerV50,
    OrganismRuntimeV50,
    RuntimeStateStoreV50,
)
from neurocore.v48.embodiment import SensorFrameV48, PhoneTelemetryAdapterV48
from neurocore.v40 import ExternalTaskV40, task_goal_v40


def cfg():
    c = mobile_v50_config(9)
    c.world_ready_observations_v50 = 3
    c.world_ready_horizon_v50 = 2
    c.world_rollout_horizon_v50 = 4
    c.world_candidate_count_v50 = 4
    c.world_horizon_train_v50 = 4
    return c


def test_v50_exports_and_forward_are_finite():
    torch.manual_seed(1)
    m = NeuroWeaveV50(cfg())
    x = torch.randn(1, 5, 9)
    g = torch.randn(1, 5, 8)
    out = m(x, goal_sequence=g)
    assert out["chosen_action_v50"].shape == (1, 5, 3)
    assert torch.isfinite(out["chosen_action_v50"]).all()


def test_world_model_outputs_grounding_and_uncertainty():
    torch.manual_seed(2)
    w = StateAlignedLatentWorldModelV50(20, 3, 20, 9, hidden=16)
    z = torch.randn(2, 20); a = torch.randn(2, 3); g = torch.randn(2, 20); h = w.initial_hidden(2)
    out = w.step(z, a, g, h, horizon=3)
    assert out["next_latent"].shape == (2, 20)
    assert out["inverse_action"].shape == (2, 3)
    assert out["state_delta"].shape == (2, 9)
    assert torch.all(out["scale"] > 0)
    assert torch.isfinite(out["horizon_uncertainty"]).all()


def test_world_model_is_action_causal():
    torch.manual_seed(3)
    w = StateAlignedLatentWorldModelV50(20, 3, 20, 9, hidden=16)
    z = torch.randn(1,20); g = torch.randn(1,20); h = w.initial_hidden(1)
    y0 = w.step(z, torch.zeros(1,3), g, h)["next_latent"]
    y1 = w.step(z, torch.ones(1,3), g, h)["next_latent"]
    assert not torch.allclose(y0, y1)


def test_uncertainty_grows_with_horizon_for_same_transition():
    torch.manual_seed(4)
    w = StateAlignedLatentWorldModelV50(20, 3, 20, 9, hidden=16)
    z = torch.randn(1,20); a = torch.randn(1,3); g = torch.randn(1,20); h = w.initial_hidden(1)
    u1 = float(w.step(z,a,g,h,horizon=1)["horizon_uncertainty"].item())
    u4 = float(w.step(z,a,g,h,horizon=4)["horizon_uncertainty"].item())
    assert u4 >= u1


def test_inverse_dynamics_changes_with_action():
    torch.manual_seed(5)
    w = StateAlignedLatentWorldModelV50(20, 3, 20, 9, hidden=16)
    z = torch.randn(1,20); g = torch.randn(1,20); h=w.initial_hidden(1)
    a0=torch.zeros(1,3); a1=torch.ones(1,3)
    y0=w.step(z,a0,g,h)["next_latent"]
    y1=w.step(z,a1,g,h)["next_latent"]
    i0=w.step(z,a0,g,h)["inverse_action"]
    i1=w.step(z,a1,g,h)["inverse_action"]
    assert not torch.allclose(i0, i1)
    assert not torch.allclose(y0, y1)


def test_planner_respects_action_support_and_returns_horizon():
    torch.manual_seed(6)
    c=cfg(); w=StateAlignedLatentWorldModelV50(20,3,20,9,hidden=16)
    p=StateAlignedPlannerV50(c); r=HorizonCalibratedUncertaintyV50(min_observations=1,max_gap=1.0)
    cur=torch.randn(1,20); goal=torch.randn(1,20); base=torch.zeros(1,3)
    a,meta=p.select(w,cur,goal,base,r)
    assert float((a-base).abs().max()) <= c.world_action_support_v50 + 1e-5
    assert float(meta["world50_horizon"].item()) >= 1


def test_admission_falls_back_without_horizon_calibration():
    c=cfg(); gate=WorldModelAdmissionGateV50(0.01); r=HorizonCalibratedUncertaintyV50(min_observations=2,max_gap=0.2)
    base=torch.zeros(1,3); proposed=torch.ones(1,3)
    out,acc=gate.select(proposed,torch.tensor([[2.0]]),base,torch.tensor([[0.0]]),r,horizon=2)
    assert torch.allclose(out,base)
    assert float(acc.item()) == 0.0


def test_horizon_calibrator_is_roundtrippable():
    r=HorizonCalibratedUncertaintyV50(min_observations=2,max_gap=0.3)
    r.update(1,0.1,0.1); r.update(1,0.12,0.11)
    r.update(2,0.2,0.21); r.update(2,0.19,0.2)
    state=r.state_dict(); other=HorizonCalibratedUncertaintyV50()
    other.load_state_dict(state)
    assert other.max_calibrated_horizon() == r.max_calibrated_horizon()
    assert other.summary() == r.summary()


def test_sensor_fusion_respects_mask_and_reconstructs_shape():
    torch.manual_seed(7)
    s=SensorFusionEncoderV50(11,output_dim=9,hidden=16)
    values=torch.randn(2,11)
    full=torch.ones(2,11)
    empty=torch.zeros(2,11)
    o1=s(values,full)["observation"]
    o2=s(values,empty)["observation"]
    assert o1.shape==(2,9)
    assert s(values,full)["reconstruction"].shape==(2,11)
    assert not torch.allclose(o1,o2)


def test_sensor_adapter_real_contract_never_fills_missing_as_valid():
    a=PhoneTelemetryAdapterV48()
    frame=SensorFrameV48(timestamp_ms=1000,sequence_id=1,channels={"imu":[1,2,3,4,5,6],"battery":[0.7]})
    h=a.ingest(frame)
    v,m=a.vector_and_mask(now_ms=1000)
    assert h.received_channels==2
    assert float(m.sum().item())==7.0
    assert torch.isfinite(v).all()


def test_v50_sensor_runtime_path_records_health():
    torch.manual_seed(8)
    c=cfg(); m=NeuroWeaveV50(c); rt=OrganismRuntimeV50(m)
    frame=SensorFrameV48(timestamp_ms=1000,sequence_id=1,channels={
        "imu":[0,0,0,0,0,0], "battery":[0.8], "thermal":[0.2], "cpu_load":[0.3], "memory_pressure":[0.1], "ambient_light":[0.5],
    })
    out=rt.step_sensor_frame(frame, now_ms=1000)
    assert "sensor_health_fraction" in out
    assert float(out["sensor_health_fraction"].item()) == 1.0


def test_v50_training_changes_world_and_sensor_parameters():
    torch.manual_seed(9)
    c=cfg(); m=NeuroWeaveV50(c); t=OrganismTrainerV50(m,lr=1e-3)
    x=torch.randn(2,6,9); g=torch.randn(2,6,8); y=torch.randn(2,6,9)
    before={n:p.detach().clone() for n,p in m.world_model_v50.named_parameters()}
    t.step(x,goal_sequence=g,target_sequence=y)
    changed=sum(not torch.allclose(before[n],p.detach()) for n,p in m.world_model_v50.named_parameters())
    assert changed>0
    sb={n:p.detach().clone() for n,p in m.sensor_fusion_v50.named_parameters()}
    values=torch.randn(4,11); mask=torch.ones(4,11)
    t.train_sensor_batch(values,mask)
    schanged=sum(not torch.allclose(sb[n],p.detach()) for n,p in m.sensor_fusion_v50.named_parameters())
    assert schanged>0


def test_online_world_update_state_alignment_uses_observation_delta():
    torch.manual_seed(10)
    c=cfg(); m=NeuroWeaveV50(c); t=OrganismTrainerV50(m,lr=1e-3)
    cur=torch.randn(1,20); act=torch.randn(1,3); sub=torch.randn(1,20); target=F.normalize(torch.randn(1,20),dim=-1)
    obs0=torch.randn(1,9); obs1=obs0+0.2
    before={n:p.detach().clone() for n,p in m.world_model_v50.named_parameters()}
    t.online_world_update(cur,act,sub,target,actual_next_observation=obs1,current_observation=obs0,next_reward=0.2,next_risk=0.1)
    changed=sum(not torch.allclose(before[n],p.detach()) for n,p in m.world_model_v50.named_parameters())
    assert changed>0


def test_runtime_feedback_updates_memory_and_h1_calibration_only():
    torch.manual_seed(11)
    c=cfg(); c.world_ready_observations_v50=2; m=NeuroWeaveV50(c); t=OrganismTrainerV50(m,lr=1e-3); rt=OrganismRuntimeV50(m,t)
    env=ExternalTaskV40(target=(0.8,0.8),seed=123)
    obs=env.reset(); goal=task_goal_v40((0.8,0.8),c.goal_dim,dtype=obs.dtype)
    out=rt.step(obs,goal)
    nxt,risk_reward,risk=env.step(torch.zeros(3))
    res=rt.observe_transition(nxt,actual_reward=float(risk_reward.item()),actual_risk=float(risk.item()),goal=goal)
    assert len(rt.memory.items)==1
    assert 1 in rt.horizon_calibration.bins
    assert res["world50_ready"] in (0.0,1.0)
    assert 4 not in rt.horizon_calibration.bins


def test_runtime_world_hidden_roundtrip(tmp_path):
    torch.manual_seed(12)
    c=cfg(); m=NeuroWeaveV50(c); t=OrganismTrainerV50(m,lr=1e-3); rt=OrganismRuntimeV50(m,t)
    obs=torch.randn(1,9); goal=torch.randn(1,8)
    rt.step(obs,goal); h=rt._world_hidden.clone()
    p=tmp_path/'v50.pt'; RuntimeStateStoreV50.save(p,m,t,rt)
    m2=NeuroWeaveV50(c); t2=OrganismTrainerV50(m2,lr=1e-3); rt2=OrganismRuntimeV50(m2,t2)
    RuntimeStateStoreV50.load(p,m2,t2,rt2)
    assert torch.allclose(h,rt2._world_hidden)
    assert t2.world_update_steps_v50==t.world_update_steps_v50


def test_grounded_external_life_reduces_latent_error():
    torch.manual_seed(13)
    c=cfg(); c.world_ready_observations_v50=1; c.online_world_updates_per_feedback_v50=1; m=NeuroWeaveV50(c); t=OrganismTrainerV50(m,lr=1e-3); rt=OrganismRuntimeV50(m,t)
    env=ExternalTaskV40(target=(0.8,0.8),seed=44)
    obs=env.reset(); goal=task_goal_v40((0.8,0.8),c.goal_dim,dtype=obs.dtype)
    errors=[]
    for _ in range(4):
        rt.step(obs,goal)
        nxt,rew,risk=env.step(torch.zeros(3))
        result=rt.observe_transition(nxt,actual_reward=float(rew.item()),actual_risk=float(risk.item()),goal=goal)
        errors.append(result["latent_error"])
        obs=nxt
    assert math.isfinite(errors[-1])
    assert errors[-1] <= errors[0] + 0.5


def test_world_model_rollout_has_monotonic_length_and_finite_outputs():
    w=StateAlignedLatentWorldModelV50(20,3,20,9,hidden=16)
    out=w.rollout(torch.randn(2,20),torch.randn(2,5,3),torch.randn(2,20))
    assert out["latents"].shape==(2,6,20)
    assert out["horizon_uncertainty"].shape==(2,5,1)
    assert torch.isfinite(out["latents"]).all()


def test_model_parameter_count_is_nontrivial():
    c=cfg(); m=NeuroWeaveV50(c)
    trainable=sum(p.numel() for p in m.parameters() if p.requires_grad)
    assert trainable > 10000


def test_world_model_single_update_reduces_local_nll_or_preserves():
    torch.manual_seed(15)
    c=cfg(); m=NeuroWeaveV50(c); t=OrganismTrainerV50(m,lr=2e-3)
    cur=torch.randn(1,20); act=torch.randn(1,3); sub=torch.randn(1,20); target=F.normalize(torch.randn(1,20),dim=-1)
    h=m.world_model_v50.initial_hidden(1)
    with torch.no_grad():
        p=m.world_model_v50.step(cur,act,sub,h)
        b=((p["next_latent"]-target)**2/(p["scale"].pow(2).clamp_min(1e-4))+torch.log(p["scale"].pow(2).clamp_min(1e-4))).mean().item()
    for _ in range(12):
        t.online_world_update(cur,act,sub,target,actual_next_observation=None,next_reward=0.2,next_risk=0.1,hidden=h)
    with torch.no_grad():
        p=m.world_model_v50.step(cur,act,sub,h)
        a=((p["next_latent"]-target)**2/(p["scale"].pow(2).clamp_min(1e-4))+torch.log(p["scale"].pow(2).clamp_min(1e-4))).mean().item()
    assert a <= b + 0.75


def test_offline_horizon_calibration_uses_only_multistep_ground_truth():
    torch.manual_seed(16)
    c = cfg(); c.horizon_calibration_max_starts_v50 = 2
    m = NeuroWeaveV50(c); t = OrganismTrainerV50(m, lr=1e-3)
    B,T = 2,4
    current = F.normalize(torch.randn(B,T,20),dim=-1)
    actions = torch.randn(B,T,3).clamp(-1,1)
    subgoals = F.normalize(torch.randn(B,T,20),dim=-1)
    targets = F.normalize(torch.randn(B,T,20),dim=-1)
    r = HorizonCalibratedUncertaintyV50(min_observations=1,max_gap=10.0)
    summary = t.calibrate_horizons(current,actions,subgoals,targets,r,max_horizon=3)
    assert summary["max_calibrated_horizon"] == 3.0
    assert summary["calibration_updates"] >= 3.0


def test_v50_state_aligned_heads_have_independent_causal_paths():
    torch.manual_seed(17)
    w = StateAlignedLatentWorldModelV50(20,3,20,9,hidden=16)
    z = torch.randn(1,20); g=torch.randn(1,20); h=w.initial_hidden(1)
    p0=w.step(z,torch.zeros(1,3),g,h); p1=w.step(z,torch.ones(1,3),g,h)
    assert not torch.allclose(p0["inverse_action"],p1["inverse_action"])
    assert not torch.allclose(p0["state_delta"],p1["state_delta"])


def test_horizon_uncertainty_empirical_envelope_is_learned_and_roundtrips():
    r = HorizonCalibratedUncertaintyV50(min_observations=4, max_gap=10.0, ratio_quantile=0.90)
    for i in range(6):
        r.update(4, error=0.40 + 0.02 * i, uncertainty=0.10)
    raw = 0.20
    bound = r.uncertainty_bound(4, raw)
    assert math.isfinite(bound)
    assert bound >= raw
    state = r.state_dict()
    other = HorizonCalibratedUncertaintyV50()
    other.load_state_dict(state)
    assert math.isclose(other.uncertainty_bound(4, raw), bound, rel_tol=1e-6, abs_tol=1e-6)


def test_grounded_transition_evidence_preserves_planned_horizon_field():
    torch.manual_seed(18)
    c = cfg(); c.world_ready_observations_v50 = 1
    m = NeuroWeaveV50(c); rt = OrganismRuntimeV50(m)
    obs = torch.randn(1, 9); goal = torch.randn(1, 8)
    rt.step(obs, goal)
    nxt = obs + 0.1
    rt.events[-1]["horizon"] = 4.0
    rt.observe_transition(nxt, actual_reward=0.2, actual_risk=0.1, goal=goal, update_world_model=False)
    ev = rt.transition_evidence[-1]
    assert ev.planned_horizon == 4
    assert ev.horizon == 1
    assert ev.reward_error >= 0.0


def test_world_model_uncertainty_bounds_follow_configured_limits():
    low = StateAlignedLatentWorldModelV50(20, 3, 20, 9, hidden=8, uncertainty_min=0.10, uncertainty_max=0.12)
    z = torch.randn(1,20); a=torch.randn(1,3); g=torch.randn(1,20); h=low.initial_hidden(1)
    out = low.step(z,a,g,h)
    assert float(out["scale"].min()) >= 0.10 - 1e-6
    assert float(out["scale"].max()) <= 0.12 + 1e-6


def test_sensor_training_tolerates_missing_channel_augmentation():
    torch.manual_seed(19)
    c = cfg(); c.sensor_fusion_mask_dropout_v50 = 0.50
    m = NeuroWeaveV50(c); t = OrganismTrainerV50(m, lr=1e-3)
    values = torch.randn(8, 11); mask = torch.ones(8, 11)
    loss = t.train_sensor_batch(values, mask)
    assert math.isfinite(loss)
    assert t.sensor_update_steps_v50 == 1
