#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "third_party" / "upstream"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_member(name: str) -> bool:
    p = Path(name)
    return not p.is_absolute() and ".." not in p.parts and "\\" not in name


def main() -> int:
    ap = argparse.ArgumentParser(description="Safely ingest an upstream source ZIP for NeuroCore research.")
    ap.add_argument("archive", type=Path)
    ap.add_argument("--name", required=True, help="stable upstream key, e.g. flash-linear-attention")
    ap.add_argument("--expected-sha256", default=None, help="optional exact SHA-256 of the source archive")
    args = ap.parse_args()
    archive = args.archive.resolve()
    if not archive.is_file():
        raise SystemExit(f"archive not found: {archive}")
    digest = sha256(archive)
    if args.expected_sha256 and digest.lower() != args.expected_sha256.lower():
        raise SystemExit(f"SHA-256 mismatch: expected {args.expected_sha256}, got {digest}")
    target = DEST / args.name
    # Validate the complete archive before touching the destination. This keeps a malformed or
    # malicious archive from being able to claim a stable destination and masks no traversal error.
    with ZipFile(archive) as zf:
        for info in zf.infolist():
            if not safe_member(info.filename):
                raise SystemExit(f"unsafe archive member: {info.filename}")
            # Reject symbolic/hard-link style ZIP entries rather than materialising filesystem links.
            unix_type = (info.external_attr >> 16) & 0o170000
            if unix_type == 0o120000:
                raise SystemExit(f"symbolic link archive member rejected: {info.filename}")
    if target.exists():
        raise SystemExit(f"destination exists; choose a new versioned name: {target}")
    target.mkdir(parents=True)
    try:
        with ZipFile(archive) as zf:
            zf.extractall(target)
    except Exception:
        shutil.rmtree(target, ignore_errors=True)
        raise

    # Remove caches; never execute imported source during intake.
    for p in target.rglob("__pycache__"):
        shutil.rmtree(p, ignore_errors=True)
    for p in target.rglob(".pytest_cache"):
        shutil.rmtree(p, ignore_errors=True)

    license_files = [
        p for p in target.rglob("*") if p.is_file() and p.name.upper().startswith(("LICENSE", "COPYING", "NOTICE"))
    ]
    license_names = {p.name.upper(): str(p.relative_to(target)) for p in license_files}
    text_blob = "\n".join(p.read_text(encoding="utf-8", errors="ignore")[:20000] for p in license_files)
    if "MIT License" in text_blob or "Permission is hereby granted, free of charge" in text_blob:
        license_family = "MIT"
    elif "Apache License" in text_blob and "Version 2.0" in text_blob:
        license_family = "Apache-2.0"
    elif "NVIDIA SOURCE CODE LICENSE" in text_blob.upper():
        license_family = "NVIDIA-Source-Code-License-NC"
    else:
        license_family = "unknown"
    manifest = {
        "archive": str(archive),
        "archive_sha256": digest,
        "upstream_key": args.name,
        "license_files": list(license_names.values()),
        "license_classification": license_family,
        "extraction_root": str(target.relative_to(ROOT)),
        "policy": "source is vendored for inspection; promotion into current requires separate qualification",
    }
    (target / "NEUROCORE_SOURCE_MANIFEST.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
