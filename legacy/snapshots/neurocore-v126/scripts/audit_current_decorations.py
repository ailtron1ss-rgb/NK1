from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path

from neurocore.current import NeuroCoreCurrent, runtime_liveness_probe, validate_no_inert_enabled_features, validate_registry_truthfulness
from neurocore.frontier import CURRENT_FRONTIER


def source_stub_scan(root: Path) -> list[str]:
    """Find executable stub constructs, not words appearing in documentation."""
    suspects: list[str] = []
    for path in sorted(root.rglob("*.py")):
        try:
            tree = ast.parse(path.read_text(errors="ignore"))
        except SyntaxError as exc:
            suspects.append(f"{path}:syntax:{exc}")
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Pass):
                suspects.append(f"{path}:{node.lineno}:executable pass")
            elif isinstance(node, ast.Raise) and isinstance(node.exc, ast.Call):
                func = node.exc.func
                name = func.id if isinstance(func, ast.Name) else getattr(func, "attr", "")
                if name == "NotImplementedError":
                    suspects.append(f"{path}:{node.lineno}:NotImplementedError")
    return suspects


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()

    validate_no_inert_enabled_features()
    registry_truth = validate_registry_truthfulness(NeuroCoreCurrent().registry)
    report = runtime_liveness_probe()
    suspects = source_stub_scan(Path(__file__).resolve().parents[1] / "src/neurocore/current")
    payload = {
        "version": CURRENT_FRONTIER,
        "inert_enabled_config_checks": "PASS",
        "registry_truthfulness": registry_truth,
        "runtime_liveness": report,
        "executable_stub_suspects": suspects,
        "status": "PASS" if not suspects else "REVIEW",
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    return 0 if not suspects else 2


if __name__ == "__main__":
    raise SystemExit(main())
