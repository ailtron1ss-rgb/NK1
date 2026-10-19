import time
from types import SimpleNamespace

import torch

from core.nomega.neural_substrate_v1 import ModernNeuralSubstrateV1
from core.nomega.skill_bank import SkillBank
from core.nomega.skill_compiler import SkillCompiler
from core.nomega.experts import SkillExpert


def test_fast_plasticity_preserves_source_population_signs():
    s = ModernNeuralSubstrateV1(4, exc_neurons=5, inh_neurons=3, seed=41)
    # Force a large mixed local update.
    s.eligibility.fill_(1.0)
    s.pre_trace.fill_(1.0)
    s.post_trace.fill_(1.0)
    s.last_spikes.fill_(1.0)
    s.apply_local_plasticity(1.0, torch.ones(8), torch.ones(8))
    eff = s._effective_recurrent()
    assert torch.all(eff[:, :5] >= -1e-7)
    assert torch.all(eff[:, 5:] <= 1e-7)


def test_structural_plasticity_keeps_exc_and_inh_reachability():
    s = ModernNeuralSubstrateV1(4, exc_neurons=5, inh_neurons=3, seed=43)
    s.synapse_utility.zero_()
    s.apply_structural_plasticity(prune_quantile=1.0)
    active = s.synapse_mask > 0
    assert torch.all(active[:, :5].any(dim=1))
    assert torch.all(active[:, 5:].any(dim=1))


def test_state_digest_changes_with_learning_state_and_round_trips():
    s = ModernNeuralSubstrateV1(4, exc_neurons=5, inh_neurons=3, seed=47)
    a = s.state_digest()
    s.fast_weight[0, 0] = 0.25
    b = s.state_digest()
    assert a != b
    t = ModernNeuralSubstrateV1(4, exc_neurons=5, inh_neurons=3, seed=47)
    t.load_state_dict(s.state_dict())
    assert t.state_digest() == b


def test_skill_promotion_is_not_usage_and_timestamps_are_per_instance():
    bank = SkillBank()
    sid = bank.promote('x', [(1, 0, 0)], 'program', 1.0)
    assert bank.skills[sid].uses == 0
    bank.record(sid, True, evidence={'runtime': 'tiny+hvm'})
    assert bank.skills[sid].uses == 1 and bank.skills[sid].successes == 1
    first = bank.skills[sid].created_at
    time.sleep(0.002)
    sid2 = bank.promote('y', [(2, 0, 0)], 'program', 1.0)
    assert sid != sid2
    assert bank.skills[sid2].created_at >= first


def test_compiler_timestamps_are_per_instance_and_provenance_updates():
    compiler = SkillCompiler()
    a = compiler.compile([(1, 0, 0)], 'program', 1.0, {'source': 'test-a'})
    time.sleep(0.002)
    b = compiler.compile([(2, 0, 0)], 'program', 1.0, {'source': 'test-b'})
    assert b.created_at >= a.created_at
    compiler.compile([(1, 0, 0)], 'program', 1.1, {'execution_digest': 'abc'})
    item = compiler.items[a.skill_id]
    assert item.quality == 1.1
    assert item.provenance['execution_digest'] == 'abc'


def test_skill_expert_requires_expected_result_when_provided():
    program = [(1, 0, 0), (13, 0, 0), (14, 0, 0)]
    bank = SkillBank()
    sid = bank.promote('pass-through', program, 'program', 1.0)
    state = SimpleNamespace(vector=torch.zeros(96))
    expert = SkillExpert()
    out = expert.run(state, {'skill_hits': bank.match('program', 0.0), 'inputs': [7], 'expected': 7})
    assert out['verified_candidate']
    out_bad = expert.run(state, {'skill_hits': bank.match('program', 0.0), 'inputs': [7], 'expected': 8})
    assert not out_bad['verified_candidate']
