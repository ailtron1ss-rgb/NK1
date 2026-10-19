import tempfile
from pathlib import Path

import torch
import torch.nn.functional as F

from neurocore.v58 import (
    mobile_v58_config,
    AdaptiveDelayKernelV58,
    PlasticDeltaFieldV58,
    NeuroWeaveV58,
    OrganismRuntimeV58,
    OrganismTrainerV58,
    RuntimeStateStoreV58,
)


def cfg():
    c = mobile_v58_config(9)
    c.trajectory_min_pairs_v54 = 4
    c.trajectory_candidate_count_v54 = 1
    c.trajectory_train_updates_v54 = 1
    c.proposal_min_pairs_v55 = 4
    c.plan_min_pairs_v56 = 4
    c.goal_candidates_v57 = 4
    c.plastic_train_updates_v58 = 1
    c.delay_max_v58 = 3
    return c


def test_dynamic_synaptic_state_changes_effective_weights_and_output():
    torch.manual_seed(1)
    f = PlasticDeltaFieldV58(18, 12, rank=5, hidden=16, decay=0.90, state_lr=0.40)
    x = torch.randn(1, 18)
    target = torch.randn(1, 12) * 2.0
    before_w = f.effective_weight().detach().clone()
    before_y = f.predict(x).detach().clone()
    out = f.adapt(x, target, min_error=0.0)
    after_w = f.effective_weight().detach().clone()
    after_y = f.predict(x).detach().clone()
    assert not torch.allclose(before_w, after_w)
    assert not torch.allclose(before_y, after_y)
    assert float(out['updated']) == 1.0
    assert float(out['effective_delta_norm']) > 0.0
    assert float(out['uncertainty_mean']) < 1.0
    assert float(out['kalman_gain_mean']) > 0.0


def test_plastic_field_has_real_trainable_static_parameters_and_online_state():
    f = PlasticDeltaFieldV58(10, 7, rank=4)
    trainable = sum(p.numel() for p in f.parameters() if p.requires_grad)
    assert trainable > 500
    assert 'plastic_state' in dict(f.named_buffers())
    assert f.plastic_state.shape == (7, 10)


def test_delay_kernel_is_trainable_and_nonuniform_after_update():
    torch.manual_seed(2)
    d = AdaptiveDelayKernelV58(6, max_delay=3)
    h = torch.randn(1, 4, 6)
    before = d.delay_logits.detach().clone()
    out = d(h)
    loss = -out['mixed'].mean()
    loss.backward()
    with torch.no_grad():
        d.delay_logits.add_(0.2 * d.delay_logits.grad)
    assert d.delay_logits.grad is not None
    assert not torch.allclose(before, d.delay_logits.detach())


def test_v58_live_loop_uses_plastic_prediction():
    torch.manual_seed(3)
    c = cfg(); c.plastic_blend_v58 = 0.25
    model = NeuroWeaveV58(c)
    trainer = OrganismTrainerV58(model)
    rt = OrganismRuntimeV58(model, trainer)
    out = rt.step(torch.randn(1, 9))
    assert 'v58_plastic_prediction' in out
    assert out['v58_plastic_prediction'].shape[-1] == c.latent_dim_v46
    result = rt.observe_transition(torch.randn(1, 9), actual_reward=0.8, actual_risk=0.1, update_world_model=False)
    assert 'v58_plastic_rmse_before' in result
    assert 'v58_plastic_rmse_after' in result
    assert rt.plastic_updates_v58 == 1


def test_v58_plastic_training_updates_parameters_and_delay_logits():
    torch.manual_seed(4)
    c = cfg()
    model = NeuroWeaveV58(c)
    trainer = OrganismTrainerV58(model)
    history = torch.randn(1, c.delay_max_v58 + 1, c.latent_dim_v46)
    self_state = torch.randn(1, c.d)
    memory = torch.randn(1, c.memory_value_dim_v55)
    drives = torch.rand(1, c.drive_dim_v57)
    target = torch.randn(1, c.latent_dim_v46)
    w_before = model.plastic_field_v58.base_weight.detach().clone()
    d_before = model.temporal_delay_v58.delay_logits.detach().clone()
    stats = trainer.train_plastic_transition(
        history=history, self_state=self_state, memory=memory,
        drives=drives, target_latent=target, updates=1,
    )
    assert stats.updates == 1
    assert not torch.allclose(w_before, model.plastic_field_v58.base_weight.detach())
    assert not torch.allclose(d_before, model.temporal_delay_v58.delay_logits.detach())


def test_v58_adaptation_is_causal_under_state_ablation():
    torch.manual_seed(5)
    c = cfg(); c.plastic_blend_v58 = 0.30
    model = NeuroWeaveV58(c)
    field = model.plastic_field_v58
    ctx = torch.randn(1, c.latent_dim_v46 + c.d + c.memory_value_dim_v55 + c.drive_dim_v57)
    target = torch.randn(1, c.latent_dim_v46) * 1.8
    before_state = field.plastic_state.detach().clone()
    _ = field.adapt(ctx, target, min_error=0.0)
    adapted_state = field.plastic_state.detach().clone()
    y_adapted = field.predict(ctx).detach()
    with torch.no_grad():
        field.plastic_state.zero_()
    y_ablated = field.predict(ctx).detach()
    assert not torch.allclose(before_state, adapted_state)
    assert not torch.allclose(y_adapted, y_ablated)


def test_v58_state_roundtrip_persists_dynamic_synapses_and_history():
    torch.manual_seed(6)
    c = cfg()
    model = NeuroWeaveV58(c); trainer = OrganismTrainerV58(model); rt = OrganismRuntimeV58(model, trainer)
    rt.step(torch.randn(1, 9))
    rt.observe_transition(torch.randn(1, 9), actual_reward=.6, actual_risk=.0, update_world_model=False)
    state_before = model.plastic_field_v58.plastic_state.detach().clone()
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / 'v58.pt'
        RuntimeStateStoreV58.save(p, model, trainer, rt)
        m2 = NeuroWeaveV58(c); t2 = OrganismTrainerV58(m2); r2 = OrganismRuntimeV58(m2, t2)
        RuntimeStateStoreV58.load(p, m2, t2, r2)
        assert torch.allclose(state_before, m2.plastic_field_v58.plastic_state)
        assert len(r2.latent_history_v58) == len(rt.latent_history_v58)
        assert t2.plastic_field_trainer_v58.update_steps == trainer.plastic_field_trainer_v58.update_steps


def test_v58_mobile_parameter_budget():
    m = NeuroWeaveV58(cfg())
    total = sum(p.numel() for p in m.parameters() if p.requires_grad)
    assert 0 < total < 4_000_000
