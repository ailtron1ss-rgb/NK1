from pathlib import Path

from core.nomega.config_usage_analyzer_v1 import ConfigUsageAnalyzerV1


def test_config_usage_reports_fields(tmp_path: Path):
    root = tmp_path
    cfg = root / 'core' / 'nomega'
    cfg.mkdir(parents=True)
    (cfg / 'config.py').write_text('from dataclasses import dataclass\n@dataclass\nclass NOMEGAConfig:\n    used: int = 1\n    unused: int = 2\n', encoding='utf-8')
    (cfg / 'consumer.py').write_text('def f(c):\n    return c.used\n', encoding='utf-8')
    report = ConfigUsageAnalyzerV1(root).scan()
    rows = {row['name']: row for row in report['rows']}
    assert rows['used']['status'] == 'referenced'
    assert rows['unused']['status'] == 'unused_static'
    assert report['unused_static'] == 1
