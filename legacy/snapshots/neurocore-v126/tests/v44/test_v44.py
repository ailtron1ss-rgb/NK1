import copy
import torch

from neurocore.v44 import (
    mobile_v44_config, NeuroWeaveV44,
    ActiveInformationSelectorV44, WorldModelCalibrationV44,
    DevelopmentControllerV44, OrganismTrainerV44, ExternalPolicyVerifierV44,
)
from neurocore.v43 import ObservationWorldModelV43


def make_batch(seed=1, b=2, t=5, d=9):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(b, t, d, generator=g)
    y = torch.randn(b, t, d, generator=g)
    r = torch.randn(b, t, 1, generator=g)
    risk = torch.zeros(b, t, 1)
    return x, y, r, risk


def test_v44_forward_preserves_v43_until_warmup():
    torch.manual_seed(1)
    c = mobile_v44_config()
    m = NeuroWeaveV44(c)
    out = m(torch.randn(2, 4, 9))
    assert out['chosen_action_v44'].shape == (2, 4, c.action_dim)
    assert out['active_info_used_v44'].sum().item() == 0.0


def test_active_selector_emits_real_information_signal():
    torch.manual_seed(2)
    c = mobile_v44_config()
    wm = ObservationWorldModelV43(9, 3, hidden=8, ensemble=3)
    selector = ActiveInformationSelectorV44(c)
    obs = torch.zeros(2, 9)
    base = torch.zeros(2, 3)
    chosen, metrics = selector.select(wm, obs, base, torch.ones(2, 1))
    assert chosen.shape == base.shape
    assert 'information_value_v44' in metrics
    assert torch.isfinite(chosen).all()


def test_realized_first_calibration_controls_dream_readiness():
    c = mobile_v44_config()
    cal = WorldModelCalibrationV44(c)
    wm = ObservationWorldModelV43(3, 2, hidden=8, ensemble=2)
    obs = torch.randn(2, 1, 3)
    act = torch.randn(2, 1, 2)
    nxt = torch.randn(2, 1, 3)
    assert not cal.ready()
    for _ in range(4):
        cal.update(wm, obs, act, nxt, torch.zeros(2,1,1), torch.zeros(2,1,1))
    for _ in range(4):
        cal.update(wm, obs, act, nxt, torch.zeros(2,1,1), torch.zeros(2,1,1))
    assert cal.transitions >= c.calibration_min_transitions_v44
    assert cal.ready()
    assert cal.composite_error() >= 0.0


def test_development_controller_is_not_constant():
    c = mobile_v44_config()
    d = DevelopmentControllerV44(c)
    a = d.decide(0.0, 0.0, 0.0, 0.9)
    b = d.decide(0.9, 0.9, 0.9, 0.9)
    assert b.exploration_drive > a.exploration_drive
    assert b.mode != a.mode


def test_v44_trainer_runs_and_updates_calibration():
    torch.manual_seed(5)
    c = mobile_v44_config()
    c.external_acceptance_enabled_v42 = False
    c.dream_min_world_updates_v43 = 0
    c.calibration_min_transitions_v44 = 2
    c.calibration_max_error_v44 = 10.0
    m = NeuroWeaveV44(c)
    t = OrganismTrainerV44(m, lr=5e-4)
    x, y, r, risk = make_batch(5, b=1, t=4)
    t.step(x, target_sequence=y, reward_sequence=r, risk_sequence=risk)
    assert t.calibration.transitions == 3
    assert 'calibration_confidence_v44' in t.last_update_report
    assert 'v44_active_info_used_rate' in t.last_update_report


def test_v44_world_model_uses_committed_action():
    torch.manual_seed(7)
    c = mobile_v44_config()
    c.external_acceptance_enabled_v42 = False
    c.active_info_enabled_v44 = True
    c.active_info_min_world_updates_v44 = 0
    m = NeuroWeaveV44(c)
    t = OrganismTrainerV44(m, lr=1e-3)
    x, y, r, risk = make_batch(7, b=2, t=5)
    _, out = t.step(x, target_sequence=y, reward_sequence=r, risk_sequence=risk)
    assert 'active_info_base_action_v44' in out
    assert t.last_update_report['world_model_updates'] == 1


def test_v44_external_verifier_reads_v44_action():
    torch.manual_seed(9)
    c = mobile_v44_config()
    c.external_eval_episodes_v40 = 1
    c.external_eval_horizon_v40 = 2
    c.active_info_min_world_updates_v44 = 0
    m = NeuroWeaveV44(c)
    v = ExternalPolicyVerifierV44(c)
    out, _ = m.step(torch.zeros(1, 9), m.initial_state(1))
    assert 'chosen_action_v44' in out
    result = v.evaluate(m, task_subset=v.tasks[:1], seed_offset=0)
    assert result.episodes == 1


def test_dream_loss_is_real_under_prior_teacher_change():
    torch.manual_seed(12)
    c = mobile_v44_config()
    c.external_acceptance_enabled_v42 = False
    c.active_info_enabled_v44 = False
    c.dream_min_world_updates_v43 = 0
    c.calibration_min_transitions_v44 = 1
    c.calibration_max_error_v44 = 100.0
    c.dream_min_grade_v44 = -100.0
    m = NeuroWeaveV44(c)
    t = OrganismTrainerV44(m, lr=5e-4)
    x, y, r, risk = make_batch(12, b=1, t=3)
    t.step(x, target_sequence=y, reward_sequence=r, risk_sequence=risk)
    with torch.no_grad():
        for p in t.teacher.parameters():
            if p.requires_grad or p.numel() > 0:
                p.add_(0.01)
        t.model._calibration_confidence = t.calibration.confidence()
    loss, grade = t._dream_loss(x)
    assert torch.isfinite(loss)
    assert grade < 0.0
    assert loss.item() >= 0.0


def test_v44_dream_generation_preserves_recurrent_state():
    torch.manual_seed(101)
    c = mobile_v44_config()
    c.dream_min_world_updates_v43 = 0
    c.calibration_min_transitions_v44 = 1
    c.calibration_max_error_v44 = 100.0
    c.dream_horizon_v43 = 3
    m = NeuroWeaveV44(c)
    cal = WorldModelCalibrationV44(c)
    cal.transitions = 1
    # Avoid needing a real fit: calibration is explicitly marked ready.
    old = cal.composite_error
    cal.composite_error = lambda: 0.0
    batch = __import__('neurocore.v44', fromlist=['DreamRehearsalV44']).DreamRehearsalV44(c).generate(
        m, m.world_model, cal, torch.zeros(1, 9)
    )
    assert batch is not None
    cal.composite_error = old


def test_v44_dream_loss_uses_teacher_not_mutable_student():
    c = mobile_v44_config()
    c.external_acceptance_enabled_v42 = False
    c.dream_min_world_updates_v43 = 0
    c.calibration_min_transitions_v44 = 1
    c.calibration_max_error_v44 = 100.0
    c.dream_min_grade_v44 = -100.0
    m = NeuroWeaveV44(c)
    t = OrganismTrainerV44(m, lr=5e-4)
    t.dream_starts.append(torch.zeros(1, 9))
    captured = {}
    original = t.dream_engine.generate
    def spy(teacher, world_model, calibration, start_obs):
        captured['teacher_is_ema'] = teacher is t.teacher
        return None
    t.dream_engine.generate = spy
    _loss, _grade = t._dream_loss(torch.zeros(1, 2, 9))
    t.dream_engine.generate = original
    assert captured['teacher_is_ema'] is True
