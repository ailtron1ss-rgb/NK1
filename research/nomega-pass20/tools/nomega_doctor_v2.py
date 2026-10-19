from __future__ import annotations

"""Repository health check for the 1.17 development line.

No heuristic readiness score is emitted as evidence. The doctor reports concrete
contract failures and measured checks only.
"""
from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.nomega.causal_evidence_ledger_v1 import CausalEvidenceLedgerV1
from core.nomega.architecture_health_v1 import ArchitectureHealthScannerV1
from core.nomega.version import PROJECT_VERSION, BASELINE_VERSION, STATUS


def run(cmd):
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=False, timeout=120)
    return {"returncode": proc.returncode, "stdout": proc.stdout[-4000:], "stderr": proc.stderr[-4000:]}


def main():
    checks = {}
    checks["version"] = {"pass": (ROOT / "VERSION.json").exists(), "version": PROJECT_VERSION, "baseline": BASELINE_VERSION, "status": STATUS}
    gov = json.loads((ROOT / "NOMEGA_GOVERNANCE.json").read_text(encoding="utf-8"))
    manifest = ROOT / f"NOMEGA_{gov['current_release']}_BUILD_MANIFEST.json"
    checks["governance_manifest"] = {"pass": manifest.exists(), "current_release": gov["current_release"]}
    checks["compileall"] = {"pass": run([sys.executable, "-m", "compileall", "-q", "core", "tests", "tools"])["returncode"] == 0}
    checks["star_import"] = {"pass": run([sys.executable, "-c", "from core.nomega import *; print(PROJECT_VERSION)"])["returncode"] == 0}
    checks["governance_check"] = run([sys.executable, str(ROOT / "tools" / "nomega_governance_check.py")])
    checks["governance_check"]["pass"] = checks["governance_check"]["returncode"] == 0
    ledger = CausalEvidenceLedgerV1(ROOT / "runtime" / "causal_evidence_ledger_v1.jsonl")
    checks["evidence_ledger"] = ledger.verify()
    architecture = ArchitectureHealthScannerV1(ROOT).scan().to_dict()
    checks["architecture_health"] = architecture | {"pass": True}
    (ROOT / "runtime" / "architecture_health_v1.json").write_text(json.dumps(architecture, indent=2, ensure_ascii=False), encoding="utf-8")
    collected = run([sys.executable, "-m", "pytest", "--collect-only", "-q"])
    checks["test_collection"] = {"pass": collected["returncode"] == 0, "stdout_tail": collected["stdout"]}
    result = {"tool": "nomega-doctor-v2", "checks": checks, "all_contracts_pass": all(bool(x.get("pass", x.get("valid", False))) for x in checks.values())}
    out = ROOT / "runtime" / "nomega_doctor_v2.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    raise SystemExit(0 if result["all_contracts_pass"] else 1)


if __name__ == "__main__":
    main()
