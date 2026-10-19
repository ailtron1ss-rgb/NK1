from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile


def test_admit_upstream_rejects_path_traversal(tmp_path: Path) -> None:
    archive = tmp_path / "bad.zip"
    with ZipFile(archive, "w") as zf:
        zf.writestr("../escape.txt", "nope")
    root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [sys.executable, "scripts/admit_upstream_source.py", str(archive), "--name", f"malicious-{tmp_path.name}"],
        cwd=root,
        text=True,
        capture_output=True,
    )
    assert result.returncode != 0
    assert "unsafe archive member" in (result.stdout + result.stderr)


def test_admit_upstream_creates_manifest_and_license_record(tmp_path: Path) -> None:
    archive = tmp_path / "good.zip"
    with ZipFile(archive, "w") as zf:
        zf.writestr("demo/LICENSE", "MIT License")
        zf.writestr("demo/module.py", "x = 1\n")
    root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [sys.executable, "scripts/admit_upstream_source.py", str(archive), "--name", "intake-test"],
        cwd=root,
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    manifest = root / "third_party" / "upstream" / "intake-test" / "NEUROCORE_SOURCE_MANIFEST.json"
    assert manifest.exists()
    data = json.loads(manifest.read_text())
    assert data["archive_sha256"]
    assert data["license_files"] == ["demo/LICENSE"]
    # Keep tests idempotent and do not pollute the release.
    import shutil
    shutil.rmtree(manifest.parent)


def test_admit_upstream_rejects_sha_mismatch(tmp_path: Path) -> None:
    archive = tmp_path / "good.zip"
    with ZipFile(archive, "w") as zf:
        zf.writestr("LICENSE", "MIT License")
    root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [sys.executable, "scripts/admit_upstream_source.py", str(archive), "--name", f"sha-test-{tmp_path.name}", "--expected-sha256", "0" * 64],
        cwd=root, text=True, capture_output=True,
    )
    assert result.returncode != 0
    assert "SHA-256 mismatch" in (result.stdout + result.stderr)
