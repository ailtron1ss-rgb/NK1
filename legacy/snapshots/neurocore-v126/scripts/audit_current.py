from __future__ import annotations

import ast
import json
from pathlib import Path
import sys

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))

from neurocore.current import ExecutionProfiler, NeuroCoreCurrent, gradient_coverage


def legacy_imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text())
    found: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.startswith('neurocore.v'):
                    found.append(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module and node.module.startswith('neurocore.v'):
            found.append(node.module)
    return sorted(set(found))


def main() -> int:
    torch.manual_seed(110)
    model = NeuroCoreCurrent().train()
    x = torch.randn(2, 8, 9)
    goals = torch.randn(2, 8, 8)
    target = torch.randn(2, 7, 20)
    with ExecutionProfiler(model) as profiler:
        out = model.forward_learning(x, goals, target_latent_sequence=target)
    model.zero_grad(set_to_none=True)
    out['loss'].backward()
    report = profiler.report()
    grad = gradient_coverage(model)
    current_files = sorted((ROOT / 'src/neurocore/current').glob('*.py'))
    report = {
        'current_neural_version': model.CURRENT_NEURAL_VERSION,
        'architecture': model.current_manifest()['architecture'],
        'historical_engine_instantiated': model.current_manifest()['historical_engine_instantiated'],
        'total_parameters': sum(p.numel() for p in model.parameters()),
        'trainable_parameters': sum(p.numel() for p in model.parameters() if p.requires_grad),
        'gradient_coverage': grad,
        'execution': report,
        'legacy_imports_in_current': {str(p.relative_to(ROOT)): legacy_imports(p) for p in current_files},
        'legacy_imports_any_current': any(legacy_imports(p) for p in current_files),
        'legacy_core_preserved_outside_current': (ROOT / 'history/current_legacy/core_v106_legacy.py').exists(),
        'stale_vxx_symbols_in_active_current': sorted({
            tok for p in current_files for tok in legacy_imports(p)
        }),
        'loss': float(out['loss'].detach().item()),
    }
    out_path = ROOT / 'evidence' / 'V110_CURRENT_AUDIT.json'
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({
        'version': model.CURRENT_NEURAL_VERSION,
        'total_parameters': report['total_parameters'],
        'trainable_parameters': report['trainable_parameters'],
        'gradient_parameter_fraction': report['gradient_coverage']['gradient_parameter_fraction'],
        'called_module_fraction': report['execution']['called_module_fraction'],
        'legacy_imports': {k: v for k, v in report['legacy_imports_in_current'].items() if v},
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
