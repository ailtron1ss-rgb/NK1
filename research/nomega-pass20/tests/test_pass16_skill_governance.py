from pathlib import Path


def _complete_evidence():
    return {
        'benchmark_id': 'program-family-holdout-v1',
        'verified_rate': 1.0,
        'holdout': 1.0,
        'ood': 1.0,
        'adversarial': 1.0,
        'restart_delta': 0.0,
        'multi_seed_count': 3,
        'independent_runs': 2,
        'equal_budget': True,
        'trajectory_hashes': ['a', 'b', 'c'],
        'provenance_sources': 2,
    }


def test_skill_governance_keeps_instance_only_skill_in_probation(tmp_path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    bank = SkillBank(governance=SkillGovernanceV1(tmp_path))
    out = bank.admit('one-shot', [(1, 0, 0)], 'program', 1.0, {
        'benchmark_id': 'request-instance', 'verified_rate': 1.0, 'equal_budget': True
    })
    assert out['status'] == 'probation'
    assert not bank.match('program', 0.0)


def test_skill_governance_allows_only_complete_reusable_evidence(tmp_path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    gate = SkillGovernanceV1(tmp_path)
    bank = SkillBank(governance=gate)
    out = bank.admit('family-skill', [(1, 0, 0), (14, 0, 0)], 'sum3', 1.0, _complete_evidence())
    assert out['status'] == 'active'
    assert bank.match('sum3', 0.0)
    assert out['decision']['active_eligible'] is True


def test_quarantine_requires_repeated_failures_or_negative_transfer(tmp_path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    gate = SkillGovernanceV1(tmp_path)
    bank = SkillBank(governance=gate)
    sid = bank.promote('stable-test', [(1, 0, 0)], 'program', 0.9)
    for i in range(5):
        assert bank.record(sid, False, transfer_delta=-0.10, evaluation_id=f'e{i}')
    assert bank.skills[sid].status == 'quarantined'
    assert not bank.match('program', 0.0)


def test_quarantine_cannot_be_reactivated_without_fresh_full_evidence(tmp_path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    gate = SkillGovernanceV1(tmp_path)
    bank = SkillBank(governance=gate)
    sid = bank.promote('quarantine-me', [(1, 0, 0)], 'program', 0.9)
    bank.quarantine(sid, 'test')
    assert not bank.reactivate(sid)
    assert bank.reactivate(sid, evidence=_complete_evidence())
    assert bank.skills[sid].status == 'active'


def test_memory_replay_excludes_probation_and_preserves_validated(tmp_path):
    from core.nomega.adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3
    m = AdaptiveExperienceMemoryV3(tmp_path)
    m.store_verified(family='sum3', text='probation', code=[(1,0,0),(14,0,0)], reward=.9,
                     source='test', cycle_id='p', status='probation', confidence=.95)
    good = m.store_verified(family='sum3', text='validated', code=[(1,0,0),(14,0,0),(14,0,0)], reward=.9,
                             source='test', cycle_id='v', status='validated', confidence=.95)
    chosen = m.retrieve_replay(['sum3'], max_items=8)
    keys = {x['record']['key'] for x in chosen}
    assert good in keys
    probation = [r['key'] for r in m.snapshot()['records'] if r['text'] == 'probation'][0]
    assert probation not in keys


def test_versioned_registry_hides_quarantined_version(tmp_path):
    from core.nomega.skill_versioning import VersionedSkillRegistry
    reg = VersionedSkillRegistry()
    v = reg.publish('sum3', [(1,0,0)], 1.0, True, 3, 3)
    assert reg.best('sum3') is not None
    assert reg.quarantine(v.skill_id, v.version, 'negative_transfer')
    assert reg.best('sum3') is None
    assert reg.stats()['quarantined'] == 1


def test_compiled_skill_requires_explicit_active_status(tmp_path):
    from core.nomega.skill_compiler import SkillCompiler
    compiler = SkillCompiler()
    provisional = compiler.compile([(1,0,0)], 'sum3', 1.0, {'evidence_gate':'missing'})
    assert provisional.status == 'probation'
    assert compiler.best('sum3') == []
    active = compiler.compile([(1,0,0)], 'sum3', 1.0, {'evidence_gate':'passed'}, status='active')
    assert active.status == 'active'
    assert compiler.best('sum3')


def test_canonical_registry_contains_skill_governance():
    from core.nomega.canonical_registry_v1 import CanonicalModuleRegistryV1
    assert 'skill_governance' in CanonicalModuleRegistryV1.CANONICAL_TARGETS


def test_canonical_skill_lifecycle_links_all_three_skill_backends(tmp_path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_versioning import VersionedSkillRegistry
    from core.nomega.skill_compiler import SkillCompiler
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    from core.nomega.canonical_skill_lifecycle_v1 import CanonicalSkillLifecycleV1
    gate = SkillGovernanceV1(tmp_path)
    bank = SkillBank(governance=gate)
    registry = VersionedSkillRegistry()
    compiler = SkillCompiler()
    life = CanonicalSkillLifecycleV1(bank, registry, compiler, gate)
    out = life.admit(description='full-evidence', program=[(1,0,0)], family='sum3', quality=1.0, evidence=_complete_evidence())
    assert out['status'] == 'active'
    assert registry.best('sum3') is not None
    assert compiler.best('sum3')
    assert registry.best('sum3').metadata['canonical_skill_id'] == out['skill_id']


def test_core_instance_verified_skill_does_not_become_reusable_by_one_example(tmp_path):
    from core.nomega.config import NOMEGAConfig
    from core.nomega.core import NOmegaCore
    cfg = NOMEGAConfig(latent_dim=24, memory_dim=24, router_hidden=24, world_model_hidden=24, max_reason_steps=1,
                       enable_generalist=False) if False else NOMEGAConfig(latent_dim=24, memory_dim=24, router_hidden=24, world_model_hidden=24, max_reason_steps=1,
                       generalist_influence=0.0, hybrid_reasoner_influence=0.0, sparse_moe_influence=0.0,
                       enable_executable_spine_v2=False)
    core = NOmegaCore(cfg)
    out = core.run('sum 2 and 3', {'op':'sum','a':2,'b':3,'expected':5,'use_executable_spine':False})
    assert out['verified']
    assert core.skill_bank.stats()['active'] == 0


def test_canonical_lifecycle_quarantine_propagates_to_all_backends(tmp_path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_versioning import VersionedSkillRegistry
    from core.nomega.skill_compiler import SkillCompiler
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    from core.nomega.canonical_skill_lifecycle_v1 import CanonicalSkillLifecycleV1
    gate = SkillGovernanceV1(tmp_path)
    bank = SkillBank(governance=gate)
    registry = VersionedSkillRegistry()
    compiler = SkillCompiler()
    life = CanonicalSkillLifecycleV1(bank, registry, compiler, gate)
    out = life.admit(description='full-evidence', program=[(1,0,0)], family='sum3', quality=1.0, evidence=_complete_evidence())
    sid = out['skill_id']
    for i in range(5):
        life.observe(sid, success=False, transfer_delta=-0.10, evaluation_id=f'q{i}')
    assert bank.skills[sid].status == 'quarantined'
    assert registry.best('sum3') is None
    assert compiler.best('sum3') == []


def test_versioned_registry_round_trip_preserves_lifecycle_status(tmp_path):
    from core.nomega.skill_versioning import VersionedSkillRegistry
    reg = VersionedSkillRegistry()
    v = reg.publish('sum3', [(1,0,0)], 1.0, True, 3, 3, metadata={'canonical_skill_id':'abc'})
    reg.quarantine(v.skill_id, v.version, 'test')
    blob = reg.export()
    restored = VersionedSkillRegistry()
    restored.load(blob)
    row = next(vv for hist in restored.skills.values() for vv in hist)
    assert row.status == 'quarantined'
    assert row.retire_reason == 'test'
    assert restored.best('sum3') is None


def test_runtime_root_isolation_and_multiseed_skill_admission(tmp_path):
    from core.nomega.config import NOMEGAConfig
    from core.nomega.runtime import NOmegaRuntime
    from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
    cfg = NOMEGAConfig(latent_dim=24, memory_dim=24, router_hidden=24, world_model_hidden=24,
                       max_reason_steps=1, generalist_influence=0.0, hybrid_reasoner_influence=0.0,
                       sparse_moe_influence=0.0, enable_executable_spine_v2=True, executable_spine_candidates=3)
    runtime = NOmegaRuntime(tmp_path, cfg)
    program = ProgramAcquisitionCoreV2(tmp_path, seed=1).templates('sum3')[0]
    out = runtime.admit_program_skill('sum3', program, seeds=(1,2,3), equal_budget=True, restart_delta=0.0)
    assert out['evidence']['multi_seed_count'] == 3
    assert len(out['evidence']['trajectory_hashes']) == 3
    assert out['admission']['status'] in {'active','probation'}
    assert str(tmp_path) in str(runtime.core.root)
    if out['status'] == 'active':
        assert runtime.core.skill_bank.match('sum3', 0.0)


def test_direct_legacy_promotion_cannot_bypass_quarantine(tmp_path):
    from core.nomega.skill_bank import SkillBank
    from core.nomega.skill_governance_v1 import SkillGovernanceV1
    bank = SkillBank(governance=SkillGovernanceV1(tmp_path))
    sid = bank.promote('legacy', [(1,0,0)], 'sum3', .9)
    bank.quarantine(sid, 'negative_transfer')
    bank.promote('legacy', [(1,0,0)], 'sum3', 1.0)
    assert bank.skills[sid].status == 'quarantined'


def test_direct_compiler_update_cannot_bypass_quarantine(tmp_path):
    from core.nomega.skill_compiler import SkillCompiler
    c = SkillCompiler()
    a = c.compile([(1,0,0)], 'sum3', .9, status='active')
    a.status = 'quarantined'
    b = c.compile([(1,0,0)], 'sum3', 1.0, status='active')
    assert b.status == 'quarantined'


def test_runtime_skill_admission_measures_process_restart_instead_of_accepting_caller_claim(tmp_path):
    from core.nomega.config import NOMEGAConfig
    from core.nomega.runtime import NOmegaRuntime
    from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
    cfg = NOMEGAConfig(latent_dim=16, memory_dim=16, router_hidden=16, world_model_hidden=16,
                       max_reason_steps=1, generalist_influence=0.0, hybrid_reasoner_influence=0.0,
                       sparse_moe_influence=0.0, enable_executable_spine_v2=True, executable_spine_candidates=2)
    runtime = NOmegaRuntime(tmp_path, cfg)
    program = ProgramAcquisitionCoreV2(tmp_path, seed=7).templates('sum3')[0]
    out = runtime.admit_program_skill('sum3', program, seeds=(7, 8, 9), equal_budget=False, restart_delta=999.0)
    ev = out['evidence']
    assert ev['restart_process_restarted'] is True
    assert ev['restart_delta'] is not None
    assert ev['restart_delta'] != 999.0
    assert ev['equal_budget'] is True
    assert ev['caller_restart_delta_ignored'] == 999.0
