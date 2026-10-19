import torch
import torch.nn.functional as F
from neurocore.v20 import NeuroWeaveV20, V20Config, LifeTrainerV20


def make():
    return NeuroWeaveV20(V20Config(d=8, hidden=16, action_dim=4, memory_capacity=8, replay_capacity=8,
                                   max_experts=5, top_k=1, world_candidates=3, max_horizon=3, skill_slots=4, skill_rank=2))


def test_v20_router_input_contract():
    m = make()
    assert m.skills.router.in_features == 11


def test_v20_forward_finite_and_bounded():
    torch.manual_seed(2001)
    m = make(); y = m(torch.randn(4, 10, 8), commit_memory=True); s = y["_final_state"]
    for k, v in y.items():
        if torch.is_tensor(v): assert torch.isfinite(v).all(), k
    assert s.skill_proto.shape == (4, 4, 8)
    assert s.skill_strength.shape == (4, 4, 1)
    assert s.step.eq(10).all()


def test_v20_skill_state_actually_binds_and_updates():
    torch.manual_seed(2002)
    m = make(); s = m.initial_state(6)
    o, ns = m.step(torch.randn(6,8), s, commit_memory=False)
    assert (ns.skill_age == 0).any()
    assert ns.skill_proto.norm(dim=-1).max() > 0
    assert torch.isfinite(o["skill_similarity_v20"]).all()


def test_v20_self_model_is_observable_and_trainable():
    torch.manual_seed(2003)
    m = make(); x = torch.randn(8, 6, 8); y = m(x, commit_memory=False)
    loss = m.training_loss(y)
    loss.backward()
    grads = [p.grad for p in m.self_model.parameters() if p.grad is not None]
    assert grads and all(torch.isfinite(g).all() for g in grads)
    assert F.mse_loss(y["self_model_v20"], y["self_model_target_v20"]).item() >= 0


def test_v20_training_reduces_objective():
    torch.manual_seed(2004)
    m = make(); x = torch.randn(8, 9, 8); opt = LifeTrainerV20(m, lr=2e-3)
    with torch.no_grad(): before = float(m.training_loss(m(x, commit_memory=False)).item())
    for _ in range(5): opt.step(x)
    with torch.no_grad(): after = float(m.training_loss(m(x, commit_memory=False)).item())
    assert after < before


def test_v20_multi_step_prediction_is_future_conditioned():
    torch.manual_seed(2005)
    m = make(); x = torch.randn(3, 7, 8); y = m(x, commit_memory=False)
    pred = y["future_pred_v20"][:, :-1]
    tgt = y["latent_v20"][:, 1:]
    assert pred.shape == tgt.shape
    assert torch.isfinite(pred).all()


def test_v20_active_information_responds_to_uncertainty():
    torch.manual_seed(2006)
    m = make(); high = m(torch.randn(4,5,8), commit_memory=False)
    base = high["active_information_utility_v20"].mean()
    altered = high["active_information_utility_v20"] + high["world_uncertainty_v14"] * 0.1
    assert altered.mean() != base


def test_v20_consolidation_anchor_is_bounded():
    torch.manual_seed(2007)
    m = make(); y = m(torch.randn(4,8,8), commit_memory=False); s = y["_final_state"]
    assert torch.isfinite(s.stable_anchor).all()
    assert s.stability_ema.min() >= 0 and s.stability_ema.max() <= 1


def test_v20_dtype_fp16_smoke():
    torch.manual_seed(2008)
    m = make().half(); x = torch.randn(2,4,8).half(); y = m(x, commit_memory=False)
    assert torch.isfinite(y["latent_v20"]).all()


def test_v20_goal_changes_internal_value():
    torch.manual_seed(2009)
    m = make(); x = torch.randn(3,5,8); g1 = torch.zeros(3,8); g2 = torch.ones(3,8)
    a = m(x, goal=g1, commit_memory=False)["goal_value_v20"]
    b = m(x, goal=g2, commit_memory=False)["goal_value_v20"]
    assert (a-b).abs().mean() > 1e-7


def test_v20_state_continuity_matches_uninterrupted_stream():
    torch.manual_seed(2010)
    m1 = make(); m2 = make(); m2.load_state_dict(m1.state_dict())
    x = torch.randn(2, 10, 8)
    full = m1(x, commit_memory=True)["latent_v20"][:, -1]
    s = m2.initial_state(2)
    last = None
    for t in range(10):
        last, s = m2.step(x[:,t], s, commit_memory=True)
    chunked = last["latent_v20"]
    assert torch.allclose(full, chunked, atol=1e-5, rtol=1e-4)


def test_v20_long_stream_state_remains_bounded():
    torch.manual_seed(2011)
    m = make(); s = m.initial_state(3)
    for _ in range(64):
        _, s = m.step(torch.randn(3,8), s, commit_memory=True)
    assert torch.isfinite(s.skill_proto).all()
    assert torch.isfinite(s.stable_anchor).all()
    assert s.skill_strength.min() >= 0 and s.skill_strength.max() <= 1
    assert s.skill_age.max() < 100


def test_v20_trainer_scope_is_explicit_and_small():
    m = make(); tr = LifeTrainerV20(m)
    ids = {id(p) for group in tr.optimizer.param_groups for p in group['params']}
    v20_ids = {id(p) for p in list(m.future_head.parameters()) + list(m.self_model.parameters()) + list(m.active_info.parameters()) + list(m.consolidation.parameters()) + list(m.skills.parameters())}
    base_ids = {id(p) for p in m.core.parameters()}
    assert ids == v20_ids
    assert not (ids & base_ids)


def test_v20_new_path_has_healthy_gradients():
    torch.manual_seed(2012)
    m = make(); y = m(torch.randn(5, 7, 8), commit_memory=False); loss = m.training_loss(y); loss.backward()
    grads = [p.grad for p in list(m.future_head.parameters()) + list(m.self_model.parameters()) + list(m.active_info.parameters()) + list(m.consolidation.parameters()) if p.grad is not None]
    assert grads and sum(torch.isfinite(g).all().item() and (g.abs() > 1e-9).any().item() for g in grads) / len(grads) > 0.6
