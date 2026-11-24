import copy
import torch

from neurocore.v45 import (
    V45Config, mobile_v45_config, UnifiedBrainCoreV45, NeuroWeaveV45,
    OrganismTrainerV45, EventSpineV45, OrganismEventV45, RuntimeStateStoreV45,
)


def make_batch(seed=3, b=2, t=5, d=9):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(b, t, d, generator=g)
    y = torch.randn(b, t, 9, generator=g)
    r = torch.randn(b, t, 1, generator=g)
    k = torch.zeros(b, t, 1)
    return x, y, r, k


def test_v45_has_real_new_trainable_parameters():
    c = mobile_v45_config()
    m = NeuroWeaveV45(c)
    names = [n for n, p in m.named_parameters() if p.requires_grad and n.startswith('brain.')]
    assert names
    assert sum(p.numel() for n, p in m.named_parameters() if p.requires_grad and n.startswith('brain.')) > 0


def test_v45_recurrent_state_is_path_dependent():
    torch.manual_seed(4)
    c = mobile_v45_config()
    m = NeuroWeaveV45(c)
    s0 = m.initial_state(1)
    o1, s1 = m.step(torch.zeros(1, 9), s0, commit_memory=False, force_planning=False)
    o2, s2 = m.step(torch.ones(1, 9), s1, commit_memory=False, force_planning=False)
    assert not torch.allclose(s1.recurrent, s2.recurrent)
    assert o2['brain_recurrent_v45'].shape[-1] == c.brain_hidden_v45


def test_v45_next_prediction_uses_real_next_observation_loss():
    torch.manual_seed(5)
    c = mobile_v45_config()
    c.external_acceptance_enabled_v42 = False
    c.dream_min_world_updates_v43 = 0
    c.active_info_min_world_updates_v44 = 0
    m = NeuroWeaveV45(c)
    x, y, r, risk = make_batch(5, b=1, t=5)
    out = m(x, target_sequence=y, reward_sequence=r, risk_sequence=risk,
            commit_memory=False, force_planning=False)
    loss = m.training_loss(out, target_sequence=y, reward_sequence=r, risk_sequence=risk)
    assert torch.isfinite(loss)
    assert out['brain_predicted_next_v45'].shape == x.shape
    loss.backward()
    grad = sum((p.grad.abs().sum().item() if p.grad is not None else 0.0) for p in m.brain.parameters())
    assert grad > 0.0


def test_v45_action_path_has_measurable_neural_causal_delta():
    torch.manual_seed(6)
    c = mobile_v45_config()
    m = NeuroWeaveV45(c)
    with torch.no_grad():
        for p in m.brain.action_head[-2].parameters():
            p.fill_(0.5)
    s = m.initial_state(1)
    out, _ = m.step(torch.randn(1, 9), s, commit_memory=False, force_planning=False)
    delta = (out['chosen_action_v45'] - out['brain_base_action_v45']).abs().mean().item()
    assert delta > 0.0


def test_v45_event_spine_roundtrip():
    spine = EventSpineV45(4)
    spine.append(OrganismEventV45(1,[0.0],[0.1],[0.2],0.3,0.4,None,None,None,None))
    spine.observe_outcome(torch.tensor([[0.4]]), torch.tensor([[0.2]]), torch.tensor([[0.1]]))
    state = spine.state_dict()
    other = EventSpineV45(1)
    other.load_state_dict(state)
    assert len(other.events) == 1
    assert other.events[0].prediction_error is not None


def test_v45_runtime_store_preserves_model_and_trainer_context(tmp_path):
    c = mobile_v45_config()
    c.external_acceptance_enabled_v42 = False
    m = NeuroWeaveV45(c)
    t = OrganismTrainerV45(m, lr=1e-4)
    t.steps = 7
    t.accepted_updates = 5
    t.rejected_updates = 2
    t.event_spine.append(OrganismEventV45(7,[0.0]*9,[0.0]*3,[0.0]*9,0.0,0.0,None,None,None,None))
    path = tmp_path / 'v45.pt'
    RuntimeStateStoreV45.save(path, m, t)
    m2 = NeuroWeaveV45(copy.deepcopy(c))
    t2 = OrganismTrainerV45(m2, lr=1e-4)
    RuntimeStateStoreV45.load(path, m2, t2)
    assert t2.steps == 7
    assert t2.accepted_updates == 5
    assert len(t2.event_spine.events) == 1


def test_v45_prediction_is_action_conditioned():
    torch.manual_seed(22)
    c = mobile_v45_config()
    m = NeuroWeaveV45(c)
    h = m.brain.initial(1)
    obs = torch.randn(1, 9)
    base = torch.zeros(1, 3)
    z = m.brain(obs, h, base, torch.zeros(1, c.goal_dim))
    p0 = m.brain.predict_outcomes(z['recurrent'], base)['predicted_next']
    p1 = m.brain.predict_outcomes(z['recurrent'], torch.ones_like(base))['predicted_next']
    assert not torch.allclose(p0, p1)
