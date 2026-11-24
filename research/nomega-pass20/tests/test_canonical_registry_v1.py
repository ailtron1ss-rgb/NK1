from core.nomega.canonical_registry_v1 import CanonicalModuleRegistryV1


def test_registry_emits_canonicalization_report(tmp_path):
    root = tmp_path
    core = root / 'core' / 'nomega'
    core.mkdir(parents=True)
    (core / 'foo_v1.py').write_text('class Foo: pass\n', encoding='utf-8')
    (core / 'foo_v2.py').write_text('class Foo: pass\n', encoding='utf-8')
    (core / 'benchmark_x_v1.py').write_text('class Bench: pass\n', encoding='utf-8')
    (core / 'custom.py').write_text('class Custom: pass\n', encoding='utf-8')
    report = CanonicalModuleRegistryV1(root).scan()
    assert report.total_modules == 4
    assert report.consolidation_candidates >= 2
    assert (root / 'runtime' / 'canonical_module_registry_v1.json').exists()
