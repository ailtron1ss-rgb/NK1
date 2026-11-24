from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_governance_contract_is_present_and_machine_checked() -> None:
    protocol = ROOT / "docs/nomega/governance/NOMEGA_MASTER_DEVELOPMENT_PROTOCOL.md"
    config = ROOT / "NOMEGA_GOVERNANCE.json"
    gov = json.loads((ROOT / "NOMEGA_GOVERNANCE.json").read_text(encoding="utf-8"))
    manifest = ROOT / f"NOMEGA_{gov['current_release']}_BUILD_MANIFEST.json"
    assert protocol.exists() and protocol.stat().st_size > 1000
    assert config.exists()
    assert manifest.exists()
    data = gov
    assert data["effective_for_future_work"] is True
    assert len(data["required_learning_evidence"]) >= 8

    proc = subprocess.run(
        [sys.executable, str(ROOT / "tools/nomega_governance_check.py")],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
        timeout=30,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
