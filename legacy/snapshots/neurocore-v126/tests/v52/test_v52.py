import json
import math
import torch

from neurocore.v52 import (
    V52Config, mobile_v52_config, StochasticLatentDynamicsV52, StochasticLatentTrainerV52,
    RiskSensitiveStochasticSelectorV52, StochasticParticleRolloutV52, EpisodeFrameV52, EpisodeStoreV52,
    NeuroWeaveV52, OrganismTrainerV52, OrganismRuntimeV52, RuntimeStateStoreV52,
)
from neurocore.v40 import ExternalTaskV40, task_goal_v40


def cfg():
    c = mobile_v52_config(9)
    c.stochastic_min_observations_v52 = 2
    c.stochastic_candidate_count_v52 = 2
    c.stochastic_modes_v52 = 3
    return c


def test_v52_config_inherits_v51_contract():
    c = cfg()
    assert c.action_dim == 3
    assert c.latent_dim_v46 == 20
    assert c.stochastic_modes_v52 >= 2


def test_stochastic_forward_is_multimodal_and_finite():
    torch.manual_seed(1)
    m = StochasticLatentDynamicsV52(20, 3, 20, modes=3, hidden=16)
    out = m(torch.randn(2,20), torch.randn(2,3), torch.randn(2,20), horizon=4)
    assert out['modes'].shape == (2,3,20)
    assert out['mode_probs'].shape == (2,3)
    assert torch.allclose(out['mode_probs'].sum(-1), torch.ones(2), atol=1e-5)
    assert torch.isfinite(out['uncertainty']).all()


def test_stochastic_trainer_changes_parameters():
    torch.manual_seed(2)
    m = StochasticLatentDynamicsV52(8,2,8,modes=3,hidden=12)
    t = StochasticLatentTrainerV52(m, lr=1e-3)
    before = {k:v.detach().clone() for k,v in m.state_dict().items()}
    stats = t.train_batch(torch.randn(6,8), torch.randn(6,2), torch.randn(6,8), torch.randn(6,8), horizon=2)
    changed = sum(not torch.allclose(before[k], v.detach()) for k,v in m.state_dict().items())
    assert changed > 0
    assert stats.observations == 6
    assert math.isfinite(stats.loss)


def test_stochastic_selector_falls_back_when_not_trained():
    torch.manual_seed(3)
    c=cfg(); m=StochasticLatentDynamicsV52(20,3,20,modes=3,hidden=12); s=RiskSensitiveStochasticSelectorV52(c,m)
    base=torch.zeros(1,3)
    got,meta=s.select(torch.randn(1,20),torch.randn(1,20),base,2,trained=False)
    assert torch.allclose(got,base)
    assert float(meta['stochastic52_ready']) == 0.0


def test_stochastic_selector_support_and_admission():
    torch.manual_seed(4)
    c=cfg(); c.stochastic_admission_margin_v52=-1.0; m=StochasticLatentDynamicsV52(20,3,20,modes=3,hidden=12); s=RiskSensitiveStochasticSelectorV52(c,m)
    base=torch.zeros(1,3); got,meta=s.select(torch.randn(1,20),torch.randn(1,20),base,2,trained=True)
    assert torch.isfinite(got).all()
    assert float((got-base).abs().max()) <= c.stochastic_action_support_v52 + 1e-5 or torch.allclose(got,base)
    assert torch.isfinite(meta['stochastic52_spread']).all()


def test_episode_store_preserves_schema_and_roundtrip(tmp_path):
    p=tmp_path/'episodes.jsonl'; s=EpisodeStoreV52(p,flush_every=1)
    s.append(EpisodeFrameV52(0,0,1.0,2,[1,2],[1,0],[1,0,1,0],[0.1,0.2],0.4,0.1,False,0.9,0.8)); s.flush()
    loaded=EpisodeStoreV52.from_jsonl(p)
    frames=list(loaded.iter_frames())
    assert len(frames)==1
    assert frames[0].episode_index==0 and frames[0].task_index==2
    meta=loaded.metadata(20,{'observation':{'shape':[2]}})
    assert meta['schema_version']=='v52.1'
    assert meta['frame_count']==1


def test_neuro_v52_has_real_trainable_stochastic_branch():
    c=cfg(); m=NeuroWeaveV52(c)
    params=sum(p.numel() for p in m.stochastic_world_v52.parameters() if p.requires_grad)
    assert params > 0
    assert m.stochastic_world_v52.modes == 3


def test_v52_runtime_grounds_transition_and_trains_stochastic_branch():
    torch.manual_seed(6)
    c=cfg(); m=NeuroWeaveV52(c); t=OrganismTrainerV52(m,lr=1e-3); rt=OrganismRuntimeV52(m,t)
    obs=torch.randn(1,9); goal=torch.randn(1,8)
    out=rt.step(obs,goal); nxt=obs+0.05
    res=rt.observe_transition(nxt,actual_reward=0.3,actual_risk=0.1,goal=goal)
    assert math.isfinite(float(res['stochastic52_loss']))
    assert t.stochastic_update_steps_v52 > 0
    assert rt.episode_frame_index_v52 == 1


def test_v52_runtime_state_roundtrip(tmp_path):
    torch.manual_seed(7)
    c=cfg(); m=NeuroWeaveV52(c); t=OrganismTrainerV52(m,lr=1e-3); rt=OrganismRuntimeV52(m,t)
    rt.step(torch.randn(1,9),torch.randn(1,8))
    p=tmp_path/'v52.pt'; RuntimeStateStoreV52.save(p,m,t,rt)
    m2=NeuroWeaveV52(c); t2=OrganismTrainerV52(m2,lr=1e-3); rt2=OrganismRuntimeV52(m2,t2); RuntimeStateStoreV52.load(p,m2,t2,rt2)
    assert t2.stochastic_update_steps_v52 == t.stochastic_update_steps_v52
    for a,b in zip(m.stochastic_world_v52.state_dict().values(),m2.stochastic_world_v52.state_dict().values()):
        assert torch.allclose(a,b)


def test_v52_external_closed_loop_is_finite():
    torch.manual_seed(8)
    c=cfg(); c.stochastic_min_observations_v52=999; m=NeuroWeaveV52(c); rt=OrganismRuntimeV52(m)
    env=ExternalTaskV40(target=(0.4,-0.4),seed=12); obs=env.reset(); goal=task_goal_v40((0.4,-0.4),c.goal_dim,dtype=obs.dtype)
    for _ in range(3):
        out=rt.step(obs,goal); obs2,rew,risk=env.step(out['chosen_action_v52']); rt.observe_transition(obs2,actual_reward=float(rew.item()),actual_risk=float(risk.item()),goal=goal); obs=obs2
    assert torch.isfinite(obs).all()


def test_stochastic_particle_rollout_is_bounded_and_multistep():
    torch.manual_seed(21)
    m=StochasticLatentDynamicsV52(8,2,8,modes=3,hidden=12)
    r=StochasticParticleRolloutV52(m,particle_count=4,resample_top_k=3)
    out=r.rollout(torch.randn(2,8),torch.randn(2,5,2),torch.randn(2,8))
    assert out["particles"].shape == (2,6,4,8)
    assert out["spread"].shape == (2,5)
    assert torch.isfinite(out["particles"]).all()
    assert torch.isfinite(out["entropy"]).all()


def test_stochastic_particle_rollout_is_action_conditioned():
    torch.manual_seed(22)
    m=StochasticLatentDynamicsV52(8,2,8,modes=3,hidden=12)
    r=StochasticParticleRolloutV52(m,particle_count=4,resample_top_k=4)
    z=torch.randn(1,8); g=torch.randn(1,8)
    a1=torch.zeros(1,4,2); a2=torch.ones(1,4,2)*0.6
    x=r.rollout(z,a1,g)["final_particles"]; y=r.rollout(z,a2,g)["final_particles"]
    assert not torch.allclose(x,y)


def test_v52_root_export_is_live():
    import neurocore
    assert neurocore.V52Config is V52Config
    assert neurocore.StochasticParticleRolloutV52 is StochasticParticleRolloutV52


def test_v52_episode_store_keeps_real_sensor_mask(tmp_path):
    from neurocore.v48.embodiment import SensorFrameV48
    c=cfg(); m=NeuroWeaveV52(c); rt=OrganismRuntimeV52(m)
    frame=SensorFrameV48(timestamp_ms=1000,sequence_id=42,channels={"imu":[0,0,0,0,0,0],"battery":[0.8]})
    rt.step_sensor_frame(frame,goal=torch.randn(1,8),now_ms=1000)
    rt.observe_transition(torch.randn(1,9),actual_reward=0.1,actual_risk=0.1,goal=torch.randn(1,8),update_world_model=False)
    stored=list(rt.episode_store_v52.iter_frames(include_buffer=True))[-1]
    assert len(stored.observation)==len(stored.observation_mask)
    assert sum(stored.observation_mask) == len(stored.observation_mask)
    assert sum(stored.sensor_mask) > 0
    assert sum(stored.sensor_mask) < len(stored.sensor_mask)
