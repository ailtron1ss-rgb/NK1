import copy
import torch
import torch.nn.functional as F

from neurocore.v49 import (
    V49Config,
    mobile_v49_config,
    ComplementaryMemoryV49,
    NeuroWeaveV49,
    OrganismTrainerV49,
    OrganismRuntimeV49,
    RecurrentLatentDynamicsV49,
    WorldModelReadinessV49,
    LongHorizonLatentPlannerV49,
    WorldModelAdmissionGateV49,
    RuntimeStateStoreV49,
)
from neurocore.v40 import ExternalTaskV40, task_goal_v40


def cfg():
    c = mobile_v49_config(9)
    c.world_readiness_observations_v49 = 3
    c.world_rollout_horizon_v49 = 4
    c.world_candidate_count_v49 = 4
    return c


def test_v49_exports_and_forward_are_finite():
    torch.manual_seed(1)
    m = NeuroWeaveV49(cfg())
    x = torch.randn(1, 5, 9)
    g = torch.randn(1, 5, 8)
    out = m(x, goal_sequence=g)
    assert out["chosen_action_v49"].shape == (1, 5, 3)
    assert torch.isfinite(out["chosen_action_v49"]).all()


def test_complementary_memory_needs_recurrence_before_semantic_promotion():
    torch.manual_seed(2)
    mem = ComplementaryMemoryV49(capacity=8, recurrence_threshold=3, similarity_threshold=0.98)
    sig = torch.ones(17)
    act = torch.tensor([0.8, 0.0, 0.0])
    mem.add(sig, act, reward=0.8, step_id=1)
    assert len(mem.prototypes) == 0
    mem.add(sig, act, reward=0.8, step_id=2)
    assert len(mem.prototypes) == 0
    mem.add(sig, act, reward=0.8, step_id=3)
    assert mem.maybe_consolidate(3)
    assert len(mem.prototypes) == 1
    assert mem.prototypes[0].recurrence_count >= 3


def test_complementary_memory_rejects_conflicting_cluster():
    torch.manual_seed(3)
    mem = ComplementaryMemoryV49(capacity=8, recurrence_threshold=3, similarity_threshold=0.98, min_cluster_variance=0.05)
    sig = torch.ones(17)
    act = torch.tensor([0.8, 0.0, 0.0])
    for i, r in enumerate([1.0, -1.0, 1.0], 1):
        mem.add(sig, act, reward=r, step_id=i, factors=torch.tensor([0.,.5, r, .5,r,.9,0.]))
    assert not mem.maybe_consolidate(3)
    assert len(mem.prototypes) == 0


def test_semantic_retrieval_blends_into_action_prior_only_when_confident():
    torch.manual_seed(4)
    mem = ComplementaryMemoryV49(capacity=8, recurrence_threshold=2, similarity_threshold=0.98, semantic_blend=0.2)
    sig = torch.ones(17)
    act = torch.tensor([0.9, 0.1, -0.1])
    for i in (1, 2):
        mem.add(sig, act, reward=0.9, step_id=i)
    mem.consolidate(2)
    r = mem.retrieve(sig.unsqueeze(0))
    assert "semantic_confidence_v49" in r
    assert float(r["semantic_confidence_v49"].item()) > 0.0


def test_semantic_memory_survives_fast_episodic_lesion():
    mem = ComplementaryMemoryV49(capacity=8, recurrence_threshold=2, similarity_threshold=0.98, semantic_blend=0.2)
    sig = torch.ones(17)
    act = torch.tensor([0.9, 0.1, -0.1])
    for i in (1, 2, 3):
        mem.add(sig, act, reward=0.8, step_id=i, factors=torch.tensor([0.1,0.8,0.8,0.7,0.8,0.95,1.0]))
    assert mem.consolidate(3)
    mem.episodic.items = []
    r = mem.retrieve(sig.unsqueeze(0))
    assert r["action_prior"].shape == (1, 3)
    assert torch.allclose(r["action_prior"][0], torch.zeros(3)) is False
    assert float(r["semantic_confidence_v49"].item()) > mem.confidence_threshold


def test_semantic_memory_roundtrip():
    mem = ComplementaryMemoryV49(capacity=8, recurrence_threshold=2, similarity_threshold=0.98)
    sig = torch.ones(17)
    for i in (1, 2):
        mem.add(sig, torch.ones(3), reward=0.8, step_id=i)
    mem.consolidate(2)
    state = mem.state_dict()
    other = ComplementaryMemoryV49(capacity=8, recurrence_threshold=2, similarity_threshold=0.98)
    other.load_state_dict(state)
    assert len(other.items) == len(mem.items)
    assert len(other.prototypes) == len(mem.prototypes)
    assert other.prototypes[0].source_steps == mem.prototypes[0].source_steps


def test_world_dynamics_is_action_causal_and_recurrent():
    torch.manual_seed(5)
    w = RecurrentLatentDynamicsV49(20, 3, 20, hidden=16)
    z = torch.randn(2, 20); g = torch.randn(2, 20)
    h = w.initial_hidden(2)
    a0 = torch.zeros(2, 3); a1 = torch.ones(2, 3)
    y0 = w.step(z, a0, g, h)["next_latent"]
    y1 = w.step(z, a1, g, h)["next_latent"]
    assert not torch.allclose(y0, y1)
    y2 = w.step(y0, a1, g, h)["next_latent"]
    assert not torch.allclose(y0, y2)


def test_world_rollout_preserves_sequence_length():
    w = RecurrentLatentDynamicsV49(20, 3, 20, hidden=16)
    out = w.rollout(torch.randn(2,20), torch.randn(2,5,3), torch.randn(2,20))
    assert out["latents"].shape == (2,6,20)
    assert out["rewards"].shape == (2,5,1)


def test_world_readiness_requires_grounding_and_low_error():
    r = WorldModelReadinessV49(threshold=0.2, observations_needed=3, decay=0.5)
    assert not r.ready
    for _ in range(3):
        r.update(0.1, 0.2, 0.2)
    assert r.ready
    assert r.score > 0


def test_world_gate_falls_back_when_not_ready():
    gate = WorldModelAdmissionGateV49(0.01)
    r = WorldModelReadinessV49(threshold=0.2, observations_needed=10)
    base = torch.zeros(1,3); prop = torch.ones(1,3)
    out, accepted = gate.select(prop, torch.tensor([[2.0]]), base, torch.tensor([[0.0]]), r)
    assert torch.allclose(out, base)
    assert float(accepted.item()) == 0.0


def test_world_planner_respects_action_support():
    torch.manual_seed(6)
    c = cfg(); planner = LongHorizonLatentPlannerV49(c); w = RecurrentLatentDynamicsV49(20,3,20,hidden=16)
    current = torch.randn(1,20); sub = torch.randn(1,20); base = torch.zeros(1,3)
    a,_ = planner.select(w,current,sub,base,torch.zeros(1,1))
    assert float((a-base).abs().max()) <= c.world_action_support_v49 + 1e-5


def test_v49_training_changes_world_parameters():
    torch.manual_seed(7)
    m = NeuroWeaveV49(cfg())
    t = OrganismTrainerV49(m, lr=1e-3)
    x = torch.randn(1, 6, 9); g = torch.randn(1,6,8); y = torch.randn(1,6,9)
    before = {n:p.detach().clone() for n,p in m.world_model_v49.named_parameters()}
    t.step(x, goal_sequence=g, target_sequence=y)
    changed = sum(not torch.allclose(before[n], p.detach()) for n,p in m.world_model_v49.named_parameters())
    assert changed > 0


def test_online_world_update_reduces_or_preserves_local_loss():
    torch.manual_seed(8)
    m = NeuroWeaveV49(cfg()); t = OrganismTrainerV49(m, lr=2e-3)
    cur = torch.randn(1,20); act = torch.randn(1,3); sub = torch.randn(1,20); target = torch.randn(1,20); target = target / target.norm(dim=-1, keepdim=True)
    h = m.world_model_v49.initial_hidden(1)
    with torch.no_grad():
        b = m.world_model_v49.step(cur,act,sub,h)
        before = float((1-F.cosine_similarity(b["next_latent"],target,dim=-1)).item())
    for _ in range(16):
        t.online_world_update(cur,act,sub,target,0.4,0.1)
    with torch.no_grad():
        a = m.world_model_v49.step(cur,act,sub,h)
        after = float((1-F.cosine_similarity(a["next_latent"],target,dim=-1)).item())
    assert after <= before + 0.05


def test_grounded_runtime_observe_transition_trains_and_updates_readiness():
    torch.manual_seed(9)
    c = cfg(); c.world_readiness_observations_v49=1
    m = NeuroWeaveV49(c); tr = OrganismTrainerV49(m, lr=2e-3); rt = OrganismRuntimeV49(m,tr)
    env = ExternalTaskV40(target=(0.8,0.8), seed=77)
    obs = env.reset(); goal = task_goal_v40((0.8,0.8), c.goal_dim, dtype=obs.dtype)
    rt.step(obs, goal=goal)
    nxt, reward, risk = env.step(torch.zeros(3))
    result = rt.observe_transition(nxt, actual_reward=float(reward), actual_risk=float(risk), goal=goal)
    assert result["semantic_items"] >= 0
    assert rt.world_readiness.observations == 1
    assert len(rt.transition_evidence) == 1


def test_grounded_runtime_memory_consolidates_repeated_reliable_transitions():
    torch.manual_seed(10)
    c = cfg(); m = NeuroWeaveV49(c); rt = OrganismRuntimeV49(m)
    sig = torch.cat([torch.ones(c.raw_observation_dim), torch.ones(c.goal_dim)])
    action = torch.tensor([0.8, 0.0, 0.0])
    factors = torch.tensor([0.1, 0.8, 0.8, 0.7, 0.8, 0.95, 1.0])
    for step in (1, 2, 3):
        rt.memory.add(sig, action, reward=0.8, factors=factors, step_id=step, risk=0.1, prediction_error=0.1)
    assert rt.memory.maybe_consolidate(3)
    assert len(rt.memory.prototypes) >= 1


def test_runtime_world_hidden_is_recurrent_and_roundtrippable(tmp_path):
    torch.manual_seed(12)
    c=cfg(); m=NeuroWeaveV49(c); tr=OrganismTrainerV49(m,lr=1e-3); rt=OrganismRuntimeV49(m,tr)
    x=torch.randn(1,9); g=torch.randn(1,c.goal_dim)
    h0=rt._world_hidden.clone()
    rt.step(x,g)
    h1=rt._world_hidden.clone()
    assert not torch.allclose(h0,h1)
    from neurocore.v49 import RuntimeStateStoreV49
    p=tmp_path/'hidden.pt'; RuntimeStateStoreV49.save(p,m,tr,rt)
    m2=NeuroWeaveV49(c); tr2=OrganismTrainerV49(m2,lr=1e-3); rt2=OrganismRuntimeV49(m2,tr2)
    RuntimeStateStoreV49.load(p,m2,tr2,rt2)
    assert torch.allclose(rt._world_hidden,rt2._world_hidden)


def test_runtime_roundtrip_preserves_world_memory_and_evidence(tmp_path):
    torch.manual_seed(11)
    c=cfg(); m=NeuroWeaveV49(c); tr=OrganismTrainerV49(m,lr=1e-3); rt=OrganismRuntimeV49(m,tr)
    rt._pending_observation=torch.zeros(1,9); rt._pending_action=torch.ones(3); rt._pending_subgoal=torch.zeros(20); rt._pending_latent=torch.zeros(20); rt._pending_step=1
    rt.observe_transition(torch.zeros(1,9), actual_reward=0.5, actual_risk=0.1, update_world_model=False)
    p=tmp_path/'v49.pt'; RuntimeStateStoreV49.save(p,m,tr,rt)
    m2=NeuroWeaveV49(c); tr2=OrganismTrainerV49(m2,lr=1e-3); rt2=OrganismRuntimeV49(m2,tr2)
    RuntimeStateStoreV49.load(p,m2,tr2,rt2)
    assert tr2.world_update_steps_v49==tr.world_update_steps_v49
    assert rt2.world_readiness.observations==rt.world_readiness.observations
    assert len(rt2.memory.items)==len(rt.memory.items)


def test_semantic_key_clusters_varying_raw_observations_by_shared_goal():
    torch.manual_seed(13)
    mem = ComplementaryMemoryV49(capacity=8, recurrence_threshold=3, similarity_threshold=0.86, action_coherence_threshold=0.60)
    goal = torch.randn(8); goal = goal / goal.norm()
    act = torch.tensor([0.8, 0.0, 0.0])
    for i in range(3):
        sig = torch.randn(17)
        lat = torch.randn(20); lat = lat / lat.norm()
        key = torch.cat([0.15 * lat, goal])
        mem.add(sig, act, reward=-0.8 - 0.05 * i, factors=torch.tensor([0.2,0.8,0.1,0.7,0.8,1.0,1.0]), step_id=i+1, semantic_key=key)
    assert mem.consolidate(10, force=True)
    assert len(mem.prototypes) == 1
    assert mem.prototypes[0].recurrence_count == 3


def test_semantic_recurrence_does_not_double_count_old_sources():
    mem = ComplementaryMemoryV49(capacity=8, recurrence_threshold=2, similarity_threshold=0.90, action_coherence_threshold=0.60)
    sig = torch.ones(17); act = torch.tensor([0.8,0.0,0.0]); goal = torch.ones(8)
    for i in range(2):
        mem.add(sig + 0.001*i, act, reward=-0.5, factors=torch.tensor([0.1,0.8,0.2,0.7,0.8,1.0,1.0]), step_id=i+1, semantic_key=torch.cat([torch.zeros(20),goal]))
    assert mem.consolidate(2, force=True)
    assert mem.prototypes[0].recurrence_count == 2
    assert not mem.consolidate(2)
    assert mem.prototypes[0].recurrence_count == 2


def test_online_world_update_accepts_runtime_hidden_state():
    torch.manual_seed(14)
    m = NeuroWeaveV49(cfg()); tr = OrganismTrainerV49(m, lr=1e-3)
    cur = torch.randn(1,20); act=torch.randn(1,3); sub=torch.randn(1,20); target=torch.randn(1,20); target=target/target.norm(dim=-1,keepdim=True)
    hidden = m.world_model_v49.initial_hidden(1)
    tr.online_world_update(cur, act, sub, target, 0.2, 0.1, hidden=hidden)
    assert tr.world_update_steps_v49 == 1


def test_mobile_v49_defaults_to_two_grounded_world_updates():
    assert mobile_v49_config(9).online_world_updates_per_feedback_v49 == 2
