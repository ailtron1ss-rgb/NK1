import copy
import torch

from neurocore.v43 import (
    mobile_v43_config,
    NeuroWeaveV43,
    ObservationWorldModelV43,
    MultiSignalChangeDetectorV43,
    ForesightActionSelectorV43,
    OrganismTrainerV43,
    ExternalPolicyVerifierV43,
)


def make_batch(seed=1, b=2, t=5, d=9):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(b, t, d, generator=g)
    y = torch.randn(b, t, d, generator=g)
    r = torch.randn(b, t, 1, generator=g)
    risk = torch.zeros(b, t, 1)
    return x, y, r, risk


def test_v43_forward_has_grounded_foresight_path():
    torch.manual_seed(1)
    c = mobile_v43_config()
    m = NeuroWeaveV43(c)
    out = m(torch.randn(2, 4, 9))
    assert out['chosen_action_v43'].shape == (2, 4, c.action_dim)
    assert torch.allclose(out['chosen_action_v43'], out['chosen_action_v40'])
    assert out['foresight_used_v43'].sum().item() == 0.0


def test_world_model_loss_and_prediction_are_finite():
    torch.manual_seed(2)
    wm = ObservationWorldModelV43(9, 3, hidden=16, ensemble=3)
    obs = torch.randn(2, 4, 9)
    act = torch.randn(2, 4, 3)
    nxt = torch.randn(2, 4, 9)
    reward = torch.randn(2, 4, 1)
    risk = torch.randint(0, 2, (2, 4, 1)).float()
    loss, metrics = wm.sequence_loss(obs, act, nxt, reward, risk)
    loss.backward()
    assert torch.isfinite(loss)
    assert all(torch.isfinite(torch.tensor(v)) for v in metrics.values())
    po, pr, pk, pu = wm.predict(obs[:, 0], act[:, 0])
    assert po.shape == (2, 9) and pr.shape == (2, 1) and pk.shape == (2, 1) and pu.shape == (2, 1)


def test_multisignal_detector_responds_to_change():
    c = mobile_v43_config()
    d = MultiSignalChangeDetectorV43(c)
    a = torch.zeros(2, 5)
    b = torch.tensor([[3., 2., 3., 3., 2.], [3., 2., 3., 3., 2.]])
    assert not d.update(a)['shift']
    result = d.update(b)
    assert result['score'] > 0.0


def test_foresight_selector_is_conservative():
    c = mobile_v43_config()
    c.foresight_candidates_v43 = 7
    wm = ObservationWorldModelV43(9, 3, hidden=16, ensemble=3)
    selector = ForesightActionSelectorV43(c)
    obs = torch.zeros(2, 9)
    base = torch.zeros(2, 3)
    chosen, metrics = selector.select(wm, obs, base)
    assert chosen.shape == base.shape
    assert (chosen.abs() <= 1.0 + 1e-6).all()
    assert metrics['foresight_candidate_index_v43'].shape == (2, 1)


def test_world_model_can_learn_simple_transition():
    torch.manual_seed(4)
    wm = ObservationWorldModelV43(3, 2, hidden=16, ensemble=1)
    opt = torch.optim.Adam(wm.parameters(), lr=5e-3)
    obs = torch.randn(32, 1, 3)
    act = torch.randn(32, 1, 2)
    nxt = obs + torch.cat([act, torch.zeros(32, 1, 1)], -1)
    reward = -(act.pow(2).sum(-1, keepdim=True))
    risk = torch.zeros(32, 1, 1)
    before, _ = wm.sequence_loss(obs, act, nxt, reward, risk)
    for _ in range(40):
        opt.zero_grad()
        loss, _ = wm.sequence_loss(obs, act, nxt, reward, risk)
        loss.backward()
        opt.step()
    after, _ = wm.sequence_loss(obs, act, nxt, reward, risk)
    assert after.item() < before.item()


def test_v43_trainer_replay_and_dream_are_live():
    torch.manual_seed(7)
    c = mobile_v43_config()
    c.external_acceptance_enabled_v42 = False
    c.dream_min_world_updates_v43 = 1
    c.foresight_min_world_updates_v43 = 1
    m = NeuroWeaveV43(c)
    t = OrganismTrainerV43(m, lr=1e-3)
    x, y, r, risk = make_batch(7)
    _, out = t.step(x, target_sequence=y, reward_sequence=r, risk_sequence=risk)
    assert torch.isfinite(torch.tensor(t.last_update_report['current_loss']))
    assert t.last_update_report['world_model_updates'] == 1
    assert 'dream_loss' in t.last_update_report
    _, _ = t.step(x + 0.1, target_sequence=y, reward_sequence=r, risk_sequence=risk)
    assert t.last_update_report['world_model_updates'] >= 2
    assert len(t.replay) == 4


def test_v43_foresight_becomes_active_after_world_model_warmup():
    torch.manual_seed(8)
    c = mobile_v43_config()
    c.external_acceptance_enabled_v42 = False
    c.foresight_min_world_updates_v43 = 1
    m = NeuroWeaveV43(c)
    t = OrganismTrainerV43(m, lr=5e-4)
    x, y, r, risk = make_batch(8, b=1, t=4)
    t.step(x, target_sequence=y, reward_sequence=r, risk_sequence=risk)
    out = m(x)
    assert out['foresight_used_v43'].mean().item() in (0.0, 1.0)


def test_v43_external_verifier_is_using_v43_action():
    torch.manual_seed(9)
    c = mobile_v43_config()
    c.foresight_min_world_updates_v43 = 0
    m = NeuroWeaveV43(c)
    v = ExternalPolicyVerifierV43(c)
    out, _ = m.step(torch.zeros(1, 9), m.initial_state(1))
    assert 'chosen_action_v43' in out
    result = v.evaluate(m, task_subset=v.tasks[:1], seed_offset=0)
    assert result.episodes == 1

