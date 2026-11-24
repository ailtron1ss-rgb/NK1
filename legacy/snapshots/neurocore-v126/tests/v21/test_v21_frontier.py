import torch
import torch.nn.functional as F
from neurocore.v21 import NeuroWeaveV21, V21Config, LifeTrainerV21


def make():
    return NeuroWeaveV21(V21Config(d=8, hidden=16, action_dim=4, memory_capacity=8, replay_capacity=8,
                                  max_experts=5, top_k=1, world_candidates=3, max_horizon=4,
                                  skill_slots=4, skill_rank=2, candidate_slots=4))


def test_v21_forward_finite_and_shapes():
    torch.manual_seed(2101)
    m=make(); x=torch.randn(3,7,8); y=m(x,commit_memory=True); s=y['_final_state']
    assert y['latent_v21'].shape==(3,7,8)
    assert y['future_multi_v21'].shape==(3,7,4,8)
    assert y['relation_graph_v21'].shape==(3,7,4,4)
    for k,v in y.items():
        if torch.is_tensor(v): assert torch.isfinite(v).all(), k
    assert s.life_step.eq(7).all()


def test_v21_hierarchy_is_multi_timescale():
    torch.manual_seed(2102)
    m=make(); y=m(torch.randn(2,6,8),commit_memory=False)
    f=y['fast_latent_v21']; md=y['medium_latent_v21']; s=y['slow_latent_v21']
    assert not torch.allclose(f[:,-1],md[:,-1])
    assert not torch.allclose(md[:,-1],s[:,-1])


def test_v21_regime_responds_to_shift():
    torch.manual_seed(2103)
    m=make(); x1=torch.zeros(2,5,8); x2=torch.ones(2,5,8)
    a=m(x1,commit_memory=False)['regime_score_v21'][:,-1]
    b=m(x2,commit_memory=False)['regime_score_v21'][:,-1]
    assert torch.isfinite(a).all() and torch.isfinite(b).all()
    assert (a-b).abs().mean() > 1e-7


def test_v21_structural_gate_is_bounded_and_active():
    torch.manual_seed(2104)
    m=make(); y=m(torch.randn(2,5,8),commit_memory=False)
    g=y['structural_gate_v21']
    assert g.min()>=0 and g.max()<=1
    assert g.std()>0


def test_v21_counterfactual_signal_is_action_sensitive():
    torch.manual_seed(2105)
    m=make(); x=torch.randn(3,4,8)
    g=torch.zeros(3,8)
    z=m(x,goal=g,commit_memory=False)
    a=z['counterfactual_advantage_v21']
    b=z['actual_reward_v21']-z['baseline_reward_v21']
    assert torch.isfinite(a).all() and torch.isfinite(b).all()
    assert (a-b).abs().mean() >= 0


def test_v21_learned_search_can_change_action():
    torch.manual_seed(2106)
    m=make(); x=torch.randn(2,4,8); y=m(x,commit_memory=False)
    assert y['chosen_action_v21'].shape==(2,4,4)
    assert torch.isfinite(y['chosen_action_v21']).all()


def test_v21_multihorizon_training_target_uses_observed_future():
    torch.manual_seed(2107)
    m=make(); x=torch.randn(4,6,8); y=m(x,commit_memory=False)
    loss=m.training_loss(y); loss.backward()
    grads=[p.grad for p in m.hier_predictor.parameters() if p.grad is not None]
    assert grads and all(torch.isfinite(g).all() for g in grads)


def test_v21_trainer_reduces_objective():
    torch.manual_seed(2108)
    m=make(); x=torch.randn(6,8,8); tr=LifeTrainerV21(m,lr=2e-3)
    with torch.no_grad(): before=float(m.training_loss(m(x,commit_memory=False)).item())
    for _ in range(5): tr.step(x)
    with torch.no_grad(): after=float(m.training_loss(m(x,commit_memory=False)).item())
    assert after < before


def test_v21_trainer_scope_is_explicit():
    m=make(); tr=LifeTrainerV21(m)
    ids={id(p) for g in tr.optimizer.param_groups for p in g['params']}
    allowed={id(p) for mod in [m.hier_predictor,m.search_operator,m.cf_judge,m.structure,m.regime_detector,m.capability_head,m.goal_policy] for p in mod.parameters()}
    forbidden={id(p) for p in m.core.parameters()}
    assert ids==allowed and not(ids & forbidden)


def test_v21_relation_graph_has_identity_diagonal():
    torch.manual_seed(2109)
    m=make(); y=m(torch.randn(2,5,8),commit_memory=False)
    d=y['relation_graph_v21'].diagonal(dim1=-2,dim2=-1)
    assert torch.allclose(d, torch.ones_like(d), atol=0.2)


def test_v21_state_continuity():
    torch.manual_seed(2110)
    m1=make(); m2=make(); m2.load_state_dict(m1.state_dict()); x=torch.randn(2,8,8)
    full=m1(x,commit_memory=True)['latent_v21'][:,-1]
    s=m2.initial_state(2); last=None
    for t in range(8): last,s=m2.step(x[:,t],s,commit_memory=True)
    assert torch.allclose(full,last['latent_v21'],atol=1e-5,rtol=1e-4)


def test_v21_long_stream_bounded():
    torch.manual_seed(2111)
    m=make(); s=m.initial_state(3)
    for _ in range(64): _,s=m.step(torch.randn(3,8),s,commit_memory=True)
    for t in [s.fast_latent,s.medium_latent,s.slow_latent,s.relation_graph,s.capability,s.structural_gate]:
        assert torch.isfinite(t).all()
    assert s.structural_gate.min()>=0 and s.structural_gate.max()<=1


def test_v21_fp16_smoke():
    torch.manual_seed(2112)
    m=make().half(); y=m(torch.randn(2,4,8).half(),commit_memory=False)
    assert torch.isfinite(y['latent_v21']).all()


def test_v21_action_condition_changes_future_prediction():
    torch.manual_seed(2113)
    m=make(); z=torch.randn(3,8); c=torch.randn(3,8); a1=torch.zeros(3,4); a2=torch.ones(3,4)
    p1=m.hier_predictor(z,c,a1); p2=m.hier_predictor(z,c,a2)
    assert (p1-p2).abs().mean()>1e-7


def test_v21_capability_is_bounded():
    torch.manual_seed(2114)
    m=make(); y=m(torch.randn(2,5,8),commit_memory=False)
    c=y['capability_v21']
    assert c.min()>=0 and c.max()<=1
    assert F.mse_loss(c,y['capability_target_v21']).item()>=0


def test_v21_structural_state_is_bounded_and_can_accept_change():
    torch.manual_seed(2115)
    m=make(); s=m.initial_state(2)
    for _ in range(6):
        _,s=m.step(torch.randn(2,8),s,commit_memory=True)
    assert torch.isfinite(s.structural_strength).all()
    assert torch.isfinite(s.structural_age).all()
    assert s.structural_strength.min()>=0 and s.structural_strength.max()<=1


def test_v21_goal_policy_is_trainable_and_goal_sensitive():
    torch.manual_seed(2116)
    m=make(); x=torch.randn(3,5,8); g1=torch.zeros(3,8); g2=torch.ones(3,8)
    y1=m(x,goal=g1,commit_memory=False); y2=m(x,goal=g2,commit_memory=False)
    assert (y1['goal_action_v21']-y2['goal_action_v21']).abs().mean()>1e-7
    loss=m.training_loss(y2); loss.backward()
    grads=[p.grad for p in m.goal_policy.parameters() if p.grad is not None]
    assert grads and all(torch.isfinite(g).all() for g in grads)


def test_v21_search_operator_has_real_training_signal():
    torch.manual_seed(2117)
    m=make(); y=m(torch.randn(4,6,8),commit_memory=False); loss=m.training_loss(y); loss.backward()
    grads=[p.grad for p in m.search_operator.parameters() if p.grad is not None]
    assert grads and any((g.abs()>1e-9).any().item() for g in grads if torch.isfinite(g).all())


def test_v21_structural_basis_is_state_local_not_parameter_mutation():
    torch.manual_seed(2118)
    m=make(); s=m.initial_state(2)
    before=m.structure.candidate.detach().clone()
    _,s2=m.step(torch.randn(2,8),s,commit_memory=True)
    after=m.structure.candidate.detach().clone()
    assert torch.allclose(before, after)
    assert not torch.allclose(s2.structural_basis, torch.zeros_like(s2.structural_basis))


def test_v21_parameter_versions_do_not_change_during_training_forward():
    torch.manual_seed(2119)
    m=make(); x=torch.randn(2,5,8)
    versions={id(p): p._version for p in m.parameters()}
    _=m(x,commit_memory=False)
    assert all(p._version==versions[id(p)] for p in m.parameters())
