#!/usr/bin/env python3
"""NΩ governance contract checker.

This checker enforces the non-decorative engineering rules that can be validated
mechanically. Research claims, benchmark quality, and causal learning evidence
remain human/research review responsibilities.
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROMPT = ROOT / "docs/nomega/governance/NOMEGA_MASTER_DEVELOPMENT_PROTOCOL.md"
GOV = ROOT / "NOMEGA_GOVERNANCE.json"
MANIFEST = None
README = ROOT / "README.md"


def fail(msg: str, failures: list[str]) -> None:
    failures.append(msg)


def scan_python(root: Path, failures: list[str], warnings: list[str]) -> None:
    for path in sorted(root.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        try:
            source = path.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=str(path))
        except SyntaxError as exc:
            fail(f"SYNTAX {path}: {exc}", failures)
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                fail(f"BARE_EXCEPT {path}:{node.lineno}", failures)
            if isinstance(node, ast.ExceptHandler):
                body = [n for n in node.body if not isinstance(n, ast.Pass)]
                if not body:
                    fail(f"EXCEPT_PASS {path}:{node.lineno}", failures)
                elif any(isinstance(n, ast.Pass) for n in node.body):
                    warnings.append(f"EXCEPT_CONTAINS_PASS {path}:{node.lineno}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true", help="fail on governance warnings")
    args = parser.parse_args()

    failures: list[str] = []
    warnings: list[str] = []

    manifest_version = None
    if GOV.exists():
        try:
            manifest_version = json.loads(GOV.read_text(encoding='utf-8')).get('current_release')
        except Exception as exc:
            fail(f'GOVERNANCE_JSON_PARSE {type(exc).__name__}', failures)
    manifest_path = ROOT / f'NOMEGA_{manifest_version}_BUILD_MANIFEST.json' if manifest_version else ROOT / 'NOMEGA_BUILD_MANIFEST.json'

    for required in (PROMPT, GOV, manifest_path, README):
        if not required.exists():
            fail(f"MISSING {required.relative_to(ROOT)}", failures)

    if failures:
        print("GOVERNANCE: FAIL")
        for item in failures:
            print(f"- {item}")
        return 1

    gov = json.loads(GOV.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    prompt_text = PROMPT.read_text(encoding="utf-8")
    readme_text = README.read_text(encoding="utf-8")

    if not gov.get("effective_for_future_work"):
        fail("effective_for_future_work is not true", failures)
    if not gov.get("protocol") or not prompt_text.strip():
        fail("governance protocol is empty or not configured", failures)
    if manifest_version is None or manifest.get("version") != str(manifest_version):
        fail(f"current release manifest has unexpected version: {manifest.get('version')!r} != {manifest_version!r}", failures)
    if "master development protocol" not in readme_text.lower():
        fail("README does not reference the master development protocol", failures)

    required_evidence = set(gov.get("required_learning_evidence", []))
    manifest_fields = set(manifest.get("governance", {}).get("mandatory_learning_evidence", []))
    for required_key in ("causal_intervention_effect", "memory_unlearning_evidence", "transfer_selective_signature", "model_time_replay_evidence"):
        if required_key not in manifest_fields:
            fail(f"manifest missing new evidence field: {required_key}", failures)
    missing = sorted(required_evidence - manifest_fields)
    if missing:
        fail(f"manifest missing governance evidence fields: {missing}", failures)

    required_tests = set(gov.get("required_test_layers", []))
    declared_tests = set(manifest.get("governance", {}).get("mandatory_test_layers", []))
    missing_tests = sorted(required_tests - declared_tests)
    if missing_tests:
        fail(f"manifest missing test layers: {missing_tests}", failures)

    scan_python(ROOT / "core/nomega", failures, warnings)
    # Historical non-canonical modules are reported but do not block the governed baseline.
    legacy_failures: list[str] = []
    scan_python(ROOT / "core", legacy_failures, warnings)
    canonical_prefix = str((ROOT / "core/nomega").resolve())
    for item in legacy_failures:
        if item.startswith(("BARE_EXCEPT " + canonical_prefix, "EXCEPT_PASS " + canonical_prefix)):
            continue
        warnings.append("LEGACY_" + item)

    print("GOVERNANCE: PASS" if not failures and not (args.strict and warnings) else "GOVERNANCE: FAIL")
    print(f"protocol={PROMPT.relative_to(ROOT)}")
    print(f"warnings={len(warnings)} failures={len(failures)}")
    for item in warnings:
        print(f"WARN - {item}")
    for item in failures:
        print(f"FAIL - {item}")
    return 0 if not failures and not (args.strict and warnings) else 1


if __name__ == "__main__":
    raise SystemExit(main())
