import copy
import torch

from neurocore.v40 import ExternalPolicyVerifierV40
from neurocore.v42 import (
    mobile_v42_config,
    NeuroWeaveV42,
    AdaptiveExperienceReplayV42,
    GradientConflictResolverV42,
    TaskFreeDriftDetectorV42,
    OrganismTrainerV42,
    side_effect_free_forward_v42,
    external_acceptance_v42,
)


def test_v42_forward_and_outputs():
    torch.manual_seed(3)
    c = mobile_v42_config()
    m = NeuroWeaveV42(c)
    x = torch.randn(2, 4, 9)
    y = torch.randn(2, 4, 9)
    out = m(x, target_sequence=y)
    assert out['task_signature_v42'].shape == (2, 4, c.d)
    assert out['drift_score_v42'].shape == (2, 4, 1)
    assert out['_final_state'].plasticity_gate.shape == (2, 1)


def test_v42_side_effect_free_forward_restores_mutable_state():
    torch.manual_seed(5)
    m = NeuroWeaveV42(mobile_v42_config())
    x = torch.randn(2, 4, 9)
    y = torch.randn(2, 4, 9)
    before_sd = {k: v.detach().clone() for k, v in m.state_dict().items()}
    before_q = m.base.base.skill_bank.skill_quality.detach().clone()
    before_l = m.base.composer.transition_logits.detach().clone()
    _ = side_effect_free_forward_v42(m, x, target_sequence=y)
    assert torch.equal(before_q, m.base.base.skill_bank.skill_quality.detach())
    assert torch.equal(before_l, m.base.composer.transition_logits.detach())
    after_sd = m.state_dict()
    assert all(torch.equal(before_sd[k], after_sd[k]) for k in before_sd)


def test_replay_priority_and_sampling():
    r = AdaptiveExperienceReplayV42(3)
    x = torch.randn(1, 4, 9)
    for i, p in enumerate([0.1, 0.5, 0.9, 1.2]):
        r.add(x + i, None, x + i, None, None, torch.randn(8), p)
    assert len(r) == 3
    b = r.sample(2)
    assert b is not None
    assert b['x'].shape == (2, 4, 9)


def test_gradient_conflict_projection():
    p = [torch.nn.Parameter(torch.tensor([1.0, 1.0]))]
    gcur = [torch.tensor([1.0, 0.0])]
    grep = [torch.tensor([-1.0, 1.0])]
    resolver = GradientConflictResolverV42()
    combined, m = resolver.combine(gcur, grep, p, replay_scale=1.0, plasticity_gate=1.0)
    assert m['gradient_conflict_v42'] == 1.0
    assert torch.allclose(combined[0], torch.tensor([1.0, 1.0]), atol=1e-5)


def test_drift_detector_and_plasticity_gate():
    d = TaskFreeDriftDetectorV42(4, ema=0.5, threshold=0.1)
    a = torch.tensor([[1., 0, 0, 0]])
    b = torch.tensor([[0., 1., 0, 0]])
    assert not d.update(a)['shift']
    assert d.update(b)['score'] > 0.5


def test_v42_trainer_real_update_and_replay():
    torch.manual_seed(7)
    c = mobile_v42_config()
    c.external_acceptance_enabled_v42 = False
    m = NeuroWeaveV42(c)
    trainer = OrganismTrainerV42(m, lr=1e-3)
    x = torch.randn(2, 4, 9)
    y = torch.randn(2, 4, 9)
    r = torch.randn(2, 4, 1)
    loss, out = trainer.step(x, target_sequence=y, reward_sequence=r)
    assert torch.isfinite(loss)
    assert len(trainer.replay) == 2
    loss2, _ = trainer.step(x + 0.2, target_sequence=y, reward_sequence=r)
    assert torch.isfinite(loss2)
    assert trainer.last_update_report['gradient_conflict_rate_v42'] >= 0.0


def test_v42_teacher_is_frozen_and_initialized_from_student():
    torch.manual_seed(13)
    m = NeuroWeaveV42(mobile_v42_config())
    t = OrganismTrainerV42(m, lr=1e-3)
    assert all(not p.requires_grad for p in t.teacher.parameters())
    for (_, p), (_, tp) in zip(m.named_parameters(), t.teacher.named_parameters()):
        assert torch.equal(p.detach(), tp.detach())


def test_v42_external_rejection_rolls_back_exactly():
    class RejectVerifier:
        tasks = [('retain_0', (0.0, 0.0))]
        def evaluate(self, model, tasks, seed_offset=0):
            from neurocore.v40 import ExternalEvalResultV40
            return ExternalEvalResultV40(0.0, 0.0, 0.0, 1, {'retain_0': 0.0}, 1.0)
        def acceptance(self, before, after):
            return {'accepted': False, 'reason': 'unit_test'}

    torch.manual_seed(17)
    c = mobile_v42_config()
    c.acceptance_eval_interval_v42 = 1
    c.external_acceptance_enabled_v42 = True
    m = NeuroWeaveV42(c)
    t = OrganismTrainerV42(m, lr=1e-3, external_verifier=RejectVerifier())
    before = {k: v.detach().clone() for k, v in m.state_dict().items()}
    x = torch.randn(1, 2, 9)
    y = torch.randn(1, 2, 9)
    r = torch.randn(1, 2, 1)
    t.step(x, target_sequence=y, reward_sequence=r)
    after = m.state_dict()
    assert t.last_update_report['accepted'] is False
    assert t.last_update_report['rolled_back'] is True
    assert all(torch.equal(before[k], after[k]) for k in before)


def test_v42_external_acceptance_handles_negative_rewards():
    from neurocore.v40 import ExternalEvalResultV40
    c = mobile_v42_config()
    before = ExternalEvalResultV40(-5.0, 0.5, 0.0, 2, {'retain_0': -5.0, 'new_0': -5.0}, 1.0)
    after = ExternalEvalResultV40(-4.2, 0.5, 0.0, 2, {'retain_0': -5.05, 'new_0': -4.95}, 1.0)
    decision = external_acceptance_v42(before, after, c)
    assert decision['accepted'] is True
    assert decision['retention_allowed_drop'] > 0.0
    assert decision['retention_ratio_legacy_safe_v42'] > 0.0
