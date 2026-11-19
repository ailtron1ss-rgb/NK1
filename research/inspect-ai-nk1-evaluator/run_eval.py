#!/usr/bin/env python3
"""Run Inspect AI over NK1's privacy-reduced, immutable evidence JSONL."""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

from inspect_ai import eval as inspect_eval

from nk1_inspect_task import nk1_cognitive_evidence
from nk1_evidence import load_evidence_jsonl


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", required=True, help="NK1 evidence JSONL exported by the Node adapter")
    parser.add_argument("--log-dir", default="./logs", help="Inspect AI log output directory")
    args = parser.parse_args()
    evidence_path = Path(args.evidence).resolve()
    digest = hashlib.sha256(evidence_path.read_bytes()).hexdigest()
    sample_count = len(load_evidence_jsonl(evidence_path))
    # model=None is deliberate: the task uses a no-op solver and deterministic scorers.
    logs = inspect_eval(nk1_cognitive_evidence(str(evidence_path)), model=None,
                        log_dir=str(Path(args.log_dir).resolve()))
    print({"status": "completed", "schema": "nk1.inspect-evidence/v1",
           "evidence_file": str(evidence_path), "evidence_sha256": digest,
           "sample_count": sample_count, "inspect_log_count": len(logs),
           "log_dir": str(Path(args.log_dir).resolve()),
           "note": "Inspect AI ran structural scorers only; no model was invoked and no NK1 state was mutated."})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
