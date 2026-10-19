import json
import subprocess
import sys
from pathlib import Path

def test_benchmark_124_emits_machine_readable_report(tmp_path):
    script = Path('tools/benchmark_1_24_adaptive_learning.py')
    out = subprocess.run([sys.executable, str(script), '--root', str(tmp_path), '--families', 'sum3', '--seed', '2401'], capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    report = json.loads((tmp_path / 'runtime' / 'benchmark_1_24_adaptive_learning.json').read_text())
    assert report['version'] == '1.24.0-dev'
    assert 'promotion' in report
    assert 'neural_milestone' in report
