import math
import torch

from neurocore.v54 import (
    V54Config, mobile_v54_config, TrajectoryPairV54, TrajectoryPairReplayV54,
    TrajectoryValueModelV54, PairedTrajectoryAdvantageV54, TrajectoryTrainerV54, PlanEnergyScorerV54, CEMTrajectoryPlannerV54, RobustAdvantageCalibratorV54,
    PlanRealRankMonitorV54, LongHorizonAdmissionGateV54, LongHorizonTrajectoryControllerV54,
    NeuroWeaveV54, OrganismTrainerV54, OrganismRuntimeV54, RuntimeStateStoreV54,
)


def cfg():
    c = mobile_v54_config(9)
    c.trajectory_min_pairs_v54 = 4
    c.trajectory_candidate_count_v54 = 1
    c.trajectory_train_updates_v54 = 2
    return c


def pair(latent_dim=8, goal_dim=8, action_dim=2, horizon=4, advantage=0.2, step=0):
    base = [[0.0, 0.0] for _ in range(horizon)]
    cand = [[0.12, -0.04] for _ in range(horizon)]
    return TrajectoryPairV54(
        pair_id=f'p{step}', latent=[0.1] * latent_dim, goal=[0.2] * goal_dim,
        baseline_actions=base, candidate_actions=cand,
        baseline_return=0.0, candidate_return=advantage,
        baseline_terminal=0.0, candidate_terminal=0.0,
        uncertainty=0.1, regime=0.05, sensor_health=0.95,
        horizon=horizon, step=step,
    )


def test_v54_config_preserves_v53_and_horizons():
    c = cfg()
    assert c.action_dim == 3
    assert c.trajectory_horizons_v54 == (1, 2, 4, 8)
    assert c.trajectory_max_horizon_v54 >= 8


def test_trajectory_replay_roundtrip_and_mask():
    r = TrajectoryPairReplayV54(8, 8, 2, max_horizon=4, capacity=4)
    r.add(pair(step=1)); r.add(pair(step=2, advantage=-0.2))
    b = r.sample(2)
    assert b['baseline_actions'].shape == (2, 4, 2)
    assert b['mask'].shape == (2, 4, 1)
    assert torch.isfinite(b['target_advantage']).all()
    state = r.state_dict(); r2 = TrajectoryPairReplayV54(8, 8, 2); r2.load_state_dict(state)
    assert r2.count == r.count and r2.true_pair_count == 2


def test_trajectory_models_are_finite():
    v = TrajectoryValueModelV54(8, 8, 2, hidden=16)
    a = PairedTrajectoryAdvantageV54(8, 8, 2, hidden=16)
    z = torch.randn(3, 8); g = torch.randn(3, 8); acts = torch.randn(3, 4, 2); m = torch.ones(3, 4, 1)
    ctx = torch.ones(3, 1) * 0.1
    vo = v(z, g, acts, m); ao = a(z, g, acts, acts + 0.05, m, ctx, ctx, torch.ones_like(ctx))
    assert vo['value'].shape == (3, 1) and ao['mean'].shape == (3, 1)
    assert all(torch.isfinite(x).all() for x in [vo['value'], vo['scale'], vo['terminal_value'], ao['mean'], ao['scale']])


def test_trainer_reduces_trajectory_advantage_error():
    torch.manual_seed(10)
    v = TrajectoryValueModelV54(8, 8, 2, hidden=20)
    a = PairedTrajectoryAdvantageV54(8, 8, 2, hidden=20)
    r = TrajectoryPairReplayV54(8, 8, 2, max_horizon=4)
    for i in range(48):
        z = torch.randn(8); g = torch.randn(8)
        delta = float(0.3 * z[0] - 0.2 * g[0] + 0.8 * (i % 5 - 2) / 10.0)
        p = pair(advantage=delta, step=i)
        p.latent = z.tolist(); p.goal = g.tolist(); r.add(p)
    t = TrajectoryTrainerV54(a, v, lr=3e-3)
    with torch.no_grad():
        b = r.sample(32)
        before = (a(b['latent'], b['goal'], b['baseline_actions'], b['candidate_actions'], b['mask'], b['uncertainty'], b['regime'], b['sensor_health'])['mean'] - b['target_advantage']).abs().mean().item()
    for _ in range(8):
        t.train_store(r, batch_size=32, updates=2)
    with torch.no_grad():
        c = r.sample(32)
        after = (a(c['latent'], c['goal'], c['baseline_actions'], c['candidate_actions'], c['mask'], c['uncertainty'], c['regime'], c['sensor_health'])['mean'] - c['target_advantage']).abs().mean().item()
    assert after < before


def test_cem_planner_returns_bounded_sequence():
    from neurocore.v50 import StateAlignedLatentWorldModelV50
    c=cfg()
    wm=StateAlignedLatentWorldModelV50(20,3,20,9,hidden=16)
    planner=CEMTrajectoryPlannerV54(wm,c)
    out=planner.plan(torch.randn(1,20),torch.randn(1,20),torch.zeros(1,3),horizon=4)
    assert out['sequence'].shape == (1,4,3)
    assert out['first_action'].shape == (1,3)
    assert torch.isfinite(out['sequence']).all()
    assert float(out['sequence'].abs().max()) <= 1.00001


def test_robust_advantage_calibrator_removes_systematic_bias():
    c = RobustAdvantageCalibratorV54(min_points=4, clip=0.8)
    for x, y in [(0.5,0.2),(0.7,0.4),(0.3,0.0),(0.9,0.6)]: c.update(x,y)
    assert c.ready
    z = torch.tensor([[0.65]])
    assert abs(float(c.correct(z).item()) - 0.35) < 0.05


def test_rank_monitor_tracks_order():
    m = PlanRealRankMonitorV54(window=16)
    for i in range(8):
        m.update(i, 2 * i + 1)
    assert m.rank() > 0.99


def test_admission_gate_requires_rank_pairs_and_uncertainty():
    c = cfg(); gate = LongHorizonAdmissionGateV54(c)
    assert not gate.accept(0.1, 0.1, 0.5, 1.0, 0.0, 3)
    assert gate.accept(0.1, 0.1, 0.5, 1.0, 0.0, 4)
    assert not gate.accept(0.1, 0.9, 0.5, 1.0, 0.0, 4)


def test_controller_falls_back_without_ranked_evidence():
    c = cfg(); critic = PairedTrajectoryAdvantageV54(20, 20, 3, hidden=12)
    replay = TrajectoryPairReplayV54(20, 20, 3, max_horizon=8)
    monitor = PlanRealRankMonitorV54(); ctl = LongHorizonTrajectoryControllerV54(c, critic, TrajectoryValueModelV54(20,20,3,hidden=12), replay, monitor)
    chosen, meta = ctl.select(torch.randn(1,20), torch.randn(1,20), torch.zeros(1,3), horizon=4, uncertainty=0.1, regime=0.0, sensor_health=1.0)
    assert torch.allclose(chosen, torch.zeros(1,3))
    assert float(meta['trajectory54_ready']) == 0.0


def test_neuro_weave_v54_has_new_trainable_parameters():
    m = NeuroWeaveV54(cfg())
    n = sum(p.numel() for p in m.trajectory_advantage_v54.parameters() if p.requires_grad)
    q = sum(p.numel() for p in m.trajectory_value_v54.parameters() if p.requires_grad)
    assert n > 0 and q > 0


def test_runtime_state_roundtrip_preserves_trajectory_replay(tmp_path):
    torch.manual_seed(22)
    c = cfg(); m = NeuroWeaveV54(c); t = OrganismTrainerV54(m, lr=1e-3); rt = OrganismRuntimeV54(m, t)
    p = pair(latent_dim=20, goal_dim=20, action_dim=2, step=1)
    p.baseline_actions = [[0.0,0.0,0.0] for _ in range(4)]
    p.candidate_actions = [[0.12,-0.04,0.0] for _ in range(4)]
    rt.trajectory_replay_v54.add(p)
    p = tmp_path / 'v54.pt'; RuntimeStateStoreV54.save(p, m, t, rt)
    m2 = NeuroWeaveV54(c); t2 = OrganismTrainerV54(m2, lr=1e-3); rt2 = OrganismRuntimeV54(m2, t2)
    RuntimeStateStoreV54.load(p, m2, t2, rt2)
    assert rt2.trajectory_replay_v54.count == 1
    assert len(rt2.rank_monitor_v54.predicted) == len(rt.rank_monitor_v54.predicted)


def test_v54_runtime_step_returns_v54_action():
    c=cfg(); m=NeuroWeaveV54(c); t=OrganismTrainerV54(m, lr=1e-3); rt=OrganismRuntimeV54(m,t)
    out=rt.step(torch.randn(1,9), torch.randn(1,8))
    assert 'chosen_action_v54' in out
    assert out['chosen_action_v54'].shape == (1,3)

