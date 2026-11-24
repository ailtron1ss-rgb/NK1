from pathlib import Path


def _record(memory, family, reward, text=None):
    return memory.store_verified(
        family=family,
        text=text or family,
        code=[(1, 0, 0), (14, 0, 0)],
        reward=reward,
        source='test',
        cycle_id='unit',
        status='validated',
        confidence=0.9,
    )


def test_transfer_selective_prefers_semantic_compatibility_and_negative_guard(tmp_path):
    from core.nomega.adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3
    m = AdaptiveExperienceMemoryV3(tmp_path)
    add = _record(m, 'sum3', .9)
    xor = _record(m, 'xor3', .9)
    mul = _record(m, 'mul2', .9)
    m.observe_transfer('xor3', 'sum3', -0.8, cycle_id='n1')
    m.observe_transfer('xor3', 'sum3', -0.7, cycle_id='n2')
    chosen = m.retrieve_replay_transfer_selective('sum3', max_items=2, anchor_families=('sum3',))
    keys = [r['record']['key'] for r in chosen]
    assert add in keys
    assert xor not in keys or any(r['replay_decision']['negative_risk'] > 0 for r in chosen if r['record']['key'] == xor)
    if mul in keys:
        mul_score = next(r['replay_decision']['compatibility'] for r in chosen if r['record']['key'] == mul)
        add_score = next(r['replay_decision']['compatibility'] for r in chosen if r['record']['key'] == add)
        assert add_score >= mul_score


def test_selective_unlearning_requires_repeated_negative_transfer(tmp_path):
    from core.nomega.selective_memory_unlearning_v1 import SelectiveMemoryUnlearningV1
    u = SelectiveMemoryUnlearningV1(tmp_path, min_attempts=3)
    r1 = u.observe('mem', 'target', -0.2, cycle_id='1')
    assert not r1['quarantine']
    r2 = u.observe('mem', 'target', -0.2, cycle_id='2')
    assert not r2['quarantine']
    r3 = u.observe('mem', 'target', -0.2, cycle_id='3')
    assert r3['quarantine']
    assert 'mem' in u.candidates_for_quarantine()


def test_model_time_replay_triggers_from_parameter_change_and_records_errors(tmp_path):
    import torch
    from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2
    from core.nomega.model_time_replay_v1 import ModelTimeReplayControllerV1
    model = NeuralProgramSynthesizerV2(hidden=12, latent_dim=12, max_len=8, max_b=16, layers=1, heads=2)
    trainer = NeuralProgramTrainerV2(model, seed=7)
    controller = ModelTimeReplayControllerV1(tmp_path, threshold=0.0, cooldown_steps=0)
    rows = [('task=sum3 ops=ADD>ADD refs=x0,x1,x2', [(1,0,0),(14,0,0)], 0)]
    report = trainer.fit(rows, epochs=2, max_examples=1, replay_controller=controller, replay_provider=lambda n: rows, replay_max_items=1)
    assert report.replay_events >= 1
    assert report.replay_hook_errors == 0
    assert any(e.get('trigger') for e in controller.snapshot()['events'] if 'trigger' in e)


def test_causal_self_model_learns_intervention_effect(tmp_path):
    from core.nomega.causal_self_model_v1 import CausalSelfModelV1
    model = CausalSelfModelV1(tmp_path)
    model.record(bottleneck='neural_grounding', intervention='selective_replay', target='ood_coverage', baseline=.20, outcome=.50, cycle_id='1')
    model.record(bottleneck='neural_grounding', intervention='selective_replay', target='ood_coverage', baseline=.30, outcome=.40, cycle_id='2')
    ranked = model.rank_interventions('neural_grounding', 'ood_coverage')
    assert ranked
    assert ranked[0]['intervention'] == 'selective_replay'
    assert ranked[0]['attempts'] == 2


def test_model_time_replay_is_same_budget_composition_change(tmp_path):
    from core.nomega.model_time_replay_v1 import ModelTimeReplayControllerV1
    c = ModelTimeReplayControllerV1(tmp_path, threshold=0.0, cooldown_steps=0)
    assert c.decide(step=1, parameter_delta=.5, loss=1.0).trigger
    snap = c.snapshot()
    assert snap['last_replay_step'] == 1


def test_memory_integrated_unlearning_quarantines_replayed_item(tmp_path):
    from core.nomega.adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3
    m = AdaptiveExperienceMemoryV3(tmp_path)
    key = _record(m, 'xor3', .9)
    for i in range(3):
        m.observe_transfer('xor3', 'sum3', -0.4, cycle_id=f'x{i}', memory_key=key)
    row = next(r for r in m.snapshot()['records'] if r['key'] == key)
    assert row['status'] == 'quarantined'


def test_model_time_default_scale_triggers_at_observed_micro_update(tmp_path):
    from core.nomega.model_time_replay_v1 import ModelTimeReplayControllerV1
    c = ModelTimeReplayControllerV1(tmp_path, cooldown_steps=0)
    d = c.decide(step=1, parameter_delta=.0005, loss=1.0)
    assert d.trigger
    assert d.surprise >= .15
