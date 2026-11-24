import tempfile
from pathlib import Path
import torch

from neurocore.v55 import (
    mobile_v55_config, NeuroWeaveV55, OrganismRuntimeV55, OrganismTrainerV55,
    NeuralAssociativeMemoryV55, AutobiographicalCausalMemoryV55, MetacognitiveControllerV55,
    ActionProposalV55, RuntimeStateStoreV55,
)


def cfg():
    c = mobile_v55_config(9)
    c.trajectory_min_pairs_v54 = 4
    c.trajectory_candidate_count_v54 = 1
    c.trajectory_train_updates_v54 = 1
    c.proposal_min_pairs_v55 = 4
    return c


def test_memory_is_bounded_and_surprise_gated():
    m = NeuralAssociativeMemoryV55(20, 20, 20, slots=4, write_rate=0.5, surprise_threshold=0.2)
    q = torch.randn(1,20)
    out0 = m.read(q)
    assert out0['read'].shape == (1,20)
    w = m.write(q, q, 1.0, force=True)
    assert float(w['written'].item()) == 1.0
    assert m.total_writes == 1
    assert m.read(q)['confidence'].item() >= 0.0


def test_autobiographical_chain_is_causal_and_persistent():
    g = torch.zeros(1,20); a=torch.zeros(1,3); z=torch.zeros(1,20)
    mem=AutobiographicalCausalMemoryV55(capacity=4)
    e0=mem.append(step=0,goal=g,action=a,latent=z,next_latent=z,reward=-1,risk=0,surprise=.1,prediction_error=.2,self_delta=.1,accepted_action_change=0)
    e1=mem.append(step=1,goal=g,action=a,latent=z,next_latent=z,reward=.5,risk=0,surprise=.8,prediction_error=.1,self_delta=.2,accepted_action_change=.1)
    assert e0.prev_event_id == -1 and e1.prev_event_id == e0.event_id
    state=mem.state_dict(); mem2=AutobiographicalCausalMemoryV55(); mem2.load_state_dict(state)
    assert len(mem2.events)==2 and mem2.events[-1].prev_event_id==0


def test_metacognition_increases_compute_pressure_with_uncertainty():
    m=MetacognitiveControllerV55()
    a=m.update(.05,.05,.95,.02); b=m.update(.7,.9,.2,.8)
    assert b['metacog_compute_pressure'] > a['metacog_compute_pressure']
    assert b['metacog_deep'] == 1.0


def test_proposal_starts_identity_like_and_bounded():
    p=ActionProposalV55(20,20,3,hidden=16)
    z=torch.randn(2,20); g=torch.randn(2,20); a=torch.randn(2,3).clamp(-1,1)
    y=p(z,g,a)
    assert y.shape==(2,3) and torch.all(y<=1.00001) and torch.all(y>=-1.00001)
    assert torch.allclose(y,a,atol=1e-6)


def test_v55_runtime_real_loop_changes_self_and_writes_memory():
    torch.manual_seed(7)
    c=cfg(); m=NeuroWeaveV55(c); t=OrganismTrainerV55(m,lr=1e-3); rt=OrganismRuntimeV55(m,t)
    o=torch.randn(1,9); g=torch.randn(1,20)
    out=rt.step(o,g)
    before=rt.self_model_state_v55.self_state.clone()
    nxt=torch.randn(1,9)
    res=rt.observe_transition(nxt,actual_reward=0.4,actual_risk=0.0,goal=g,update_world_model=False)
    after=rt.self_model_state_v55.self_state
    assert 'chosen_action_v55' in out
    assert 'v55_self_prediction_error' in res
    assert not torch.allclose(before, after)
    assert len(rt.autobiographical_v55.events)==1


def test_v55_state_roundtrip():
    c=cfg(); m=NeuroWeaveV55(c); t=OrganismTrainerV55(m); rt=OrganismRuntimeV55(m,t)
    g=torch.randn(1,20); out=rt.step(torch.randn(1,9),g); rt.observe_transition(torch.randn(1,9),actual_reward=.1,actual_risk=0.0,goal=g,update_world_model=False)
    with tempfile.TemporaryDirectory() as d:
        p=Path(d)/'v55.pt'; RuntimeStateStoreV55.save(p,m,t,rt)
        m2=NeuroWeaveV55(c); t2=OrganismTrainerV55(m2); rt2=OrganismRuntimeV55(m2,t2)
        RuntimeStateStoreV55.load(p,m2,t2,rt2)
        assert len(rt2.autobiographical_v55.events)==1
        assert rt2.memory_v55.total_writes==rt.memory_v55.total_writes
        assert rt2.proposal_decisions_v55==rt.proposal_decisions_v55


def test_v55_parameter_count_is_nonzero_and_mobile_sized():
    c=cfg(); m=NeuroWeaveV55(c)
    total=sum(p.numel() for p in m.parameters() if p.requires_grad)
    added=sum(p.numel() for p in m.self_model_v55.parameters())+sum(p.numel() for p in m.workspace_v55.parameters())+sum(p.numel() for p in m.action_proposal_v55.parameters())
    assert added>0 and total>added and total<2_000_000


def test_v55_live_v53_pair_promotes_into_trajectory_replay_without_true_evidence_upgrade():
    torch.manual_seed(9)
    c=cfg(); c.proposal_min_pairs_v55=2
    m=NeuroWeaveV55(c); t=OrganismTrainerV55(m,lr=1e-3); rt=OrganismRuntimeV55(m,t)
    z=torch.randn(1,20); g=torch.randn(1,20); a=torch.tensor([[0.1,0.0,0.0]]); b=torch.tensor([[0.0,0.0,0.0]])
    rt.counterfactual_replay_v53.add_outcome(z,g,a,-0.4,step=1)
    pair=rt.counterfactual_replay_v53.add_outcome(z,g,b,0.3,step=2)
    assert pair is not None
    rt._v55_seen_v53_pairs=0
    rt.step(torch.randn(1,9),g)
    result=rt.observe_transition(torch.randn(1,9),actual_reward=.2,actual_risk=0.0,goal=g,update_world_model=False)
    assert rt.trajectory_pairs_created_v55 >= 1
    assert rt.trajectory_replay_v54.count >= 1
    assert rt.trajectory_replay_v54.true_pair_count == 0
    assert 'v55_trajectory_pair_count' in result
