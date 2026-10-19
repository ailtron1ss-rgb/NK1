#!/usr/bin/env python3
from __future__ import annotations

"""Fetch an upstream repository archive and pass it through NeuroCore's safe intake.

This script is intentionally network-only at execution time; downloaded source is never executed.
"""

import argparse
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = ROOT / "third_party" / "downloads"

KNOWN = {
    "fla": "https://github.com/fla-org/flash-linear-attention/archive/refs/heads/main.zip",
    "pgdn": "https://github.com/ntumm120/preconditioned-deltanet/archive/refs/heads/main.zip",
    "mamba": "https://github.com/state-spaces/mamba/archive/refs/heads/main.zip",
    "mamba3_portable": "https://github.com/Aiyoniganmaaiya/mamba3-ssm/archive/refs/heads/main.zip",
    "delta_product": "https://github.com/automl/DeltaProduct/archive/refs/heads/main.zip",
    "hnet": "https://github.com/goombalab/hnet/archive/refs/heads/main.zip",
    "atlas_torch": "https://github.com/danielquintas8/atlas-torch/archive/refs/heads/main.zip",
    "titans_pytorch": "https://github.com/lucidrains/titans-pytorch/archive/refs/heads/main.zip",
    "nvidia_gdn2": "https://github.com/NVlabs/GatedDeltaNet-2/archive/refs/heads/main.zip",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("name", choices=sorted(KNOWN))
    ap.add_argument("--url", default=None)
    args = ap.parse_args()
    url = args.url or KNOWN[args.name]
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    archive = DOWNLOADS / f"{args.name}.zip"
    print(f"downloading {url} -> {archive}")
    with urllib.request.urlopen(url, timeout=120) as src, archive.open("wb") as dst:
        while True:
            chunk = src.read(1024 * 1024)
            if not chunk:
                break
            dst.write(chunk)
    proc = subprocess.run(
        [sys.executable, "scripts/admit_upstream_source.py", str(archive), "--name", args.name],
        cwd=ROOT, text=True
    )
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
