from pathlib import Path
import tempfile

from core.nomega.experience_wiki_v1 import ExperienceWikiV1
from core.nomega.skill_composition_v1 import SkillCompositionEngineV1
from core.nomega.adaptive_evidence_scheduler_v1 import AdaptiveEvidenceSchedulerV1
from core.nomega.adversarial_evolution_arena_v1 import AdversarialEvolutionArenaV1
from core.nomega.skill_bank import SkillBank


def test_experience_wiki_deduplicates_and_links():
    with tempfile.TemporaryDirectory() as td:
        w = ExperienceWikiV1(Path(td))
        e1 = w.record_experience(task_family='sum3', outcome='verified', evidence={'holdout': 1.0}, trajectory_hash='t1')
        e2 = w.record_experience(task_family='sum3', outcome='verified', evidence={'holdout': 1.0}, trajectory_hash='t1')
        assert e1 == e2
        k = w.consolidate(topic='sum3', statement='verified arithmetic program', confidence=1.0, source_experience_ids=[e1, e2])
        w.link_skill(skill_id='s1', knowledge_ids=[k], experience_ids=[e1])
        assert w.stats()['experiences'] == 1
        assert w.stats()['knowledge'] == 1
        assert w.stats()['skill_links'] == 1


def test_adaptive_scheduler_reduces_population():
    seen = []
    scores = {'a': .95, 'b': .80, 'c': .20, 'd': .10}
    def ev(cid, stage):
        seen.append((cid, stage))
        v = scores[cid]
        return {'holdout': v, 'ood': v, 'adversarial': v, 'hvm': v, 'verified': v}
    r = AdaptiveEvidenceSchedulerV1().schedule(list(scores), ev)
    assert r.survivors == ('a',)
    assert len(seen) < len(scores) * 3


def test_arena_generates_novel_failure_variants():
    arena = AdversarialEvolutionArenaV1(seed=5)
    rows = arena.seed_from_failures([{'tape': [0, 127, 255], 'expected': 1, 'got': 0}], budget=8)
    assert len(rows) == 8
    assert len({x.test_id for x in rows}) == 8
    assert any(x.novelty > 0 for x in rows)


def test_skill_composition_uses_active_programs():
    bank = SkillBank(16)
    a = bank.promote('a', [(1,0,1)], 'sum3', .95, {'composable': True}, status='active')
    b = bank.promote('b', [(3,0,1)], 'sum3', .96, {'composable': True}, status='active')
    engine = SkillCompositionEngineV1(bank)
    plan = engine.plan('sum3', max_skills=2)
    assert plan is not None
    assert plan.skill_ids
    assert all(isinstance(x, tuple) and len(x) == 3 for x in plan.program)


def test_skill_composition_is_wired_into_executable_spine():
    from core.nomega.executable_spine_v2 import ExecutableSpineV2
    bank = SkillBank(16)
    bank.promote('a', [(1,0,1)], 'sum3', .95, {'composable': True}, status='active')
    bank.promote('b', [(3,0,1)], 'sum3', .96, {'composable': True}, status='active')
    with tempfile.TemporaryDirectory() as td:
        spine = ExecutableSpineV2(Path(td), seed=7, max_candidates=8, skill_bank=bank)
        candidates = spine._portfolio_candidates('sum3')
        assert any(src == 'skill_composed_v1' for src, _ in candidates)
