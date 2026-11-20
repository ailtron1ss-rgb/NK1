"""Fail-closed trust gate for externally reviewed NK1 memory holdouts.

Dataset provenance fields are self-asserted by the producer. Promotion also
requires an exact entry in a reviewed manifest whose bytes are pinned out of
band by the repository operator. The checked-in manifest starts empty.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import stat
from typing import Any
from urllib.parse import urlparse

_DIGEST_RE = re.compile(r"^[a-f0-9]{64}$")
_DEFAULT_MANIFEST = Path(__file__).with_name("trusted_memory_holdouts.json")
_MATCH_FIELDS = (
    "datasetId",
    "datasetVersion",
    "sourceRef",
    "labelingProtocol",
    "licenseId",
    "contentSha256",
)
_MAX_MANIFEST_BYTES = 1_048_576


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _read_manifest(path: Path) -> tuple[bytes | None, str | None]:
    """Read a bounded regular file without following symlinks."""
    try:
        if path.is_symlink():
            return None, "trusted-manifest-symlink"
        flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
        descriptor = os.open(path, flags)
    except FileNotFoundError:
        return None, "trusted-manifest-missing"
    except OSError:
        return None, "trusted-manifest-unreadable"

    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            return None, "trusted-manifest-not-regular-file"
        if metadata.st_size > _MAX_MANIFEST_BYTES:
            return None, "trusted-manifest-too-large"
        chunks: list[bytes] = []
        remaining = _MAX_MANIFEST_BYTES + 1
        while remaining > 0:
            chunk = os.read(descriptor, min(65_536, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        raw = b"".join(chunks)
        if len(raw) > _MAX_MANIFEST_BYTES:
            return None, "trusted-manifest-too-large"
        return raw, None
    except OSError:
        return None, "trusted-manifest-unreadable"
    finally:
        os.close(descriptor)


def verify_trusted_memory_holdout(
    dataset: Any,
    *,
    manifest_path: str | Path | None = None,
    expected_manifest_sha256: str | None = None,
) -> dict[str, Any]:
    """Approve only an exact dataset/provenance match in an out-of-band-pinned manifest."""
    expected = (
        expected_manifest_sha256
        if expected_manifest_sha256 is not None
        else os.environ.get("NK1_TRUSTED_HOLDOUT_MANIFEST_SHA256", "")
    )
    expected = _text(expected).lower()
    if not _DIGEST_RE.fullmatch(expected):
        return {"approved": False, "reason": "trusted-manifest-digest-not-configured"}

    path = Path(manifest_path) if manifest_path is not None else _DEFAULT_MANIFEST
    raw, read_error = _read_manifest(path)
    if raw is None:
        return {"approved": False, "reason": read_error or "trusted-manifest-unreadable"}

    actual = hashlib.sha256(raw).hexdigest()
    if actual != expected:
        return {
            "approved": False,
            "reason": "trusted-manifest-digest-mismatch",
            "manifestSha256": actual,
        }

    try:
        manifest = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {
            "approved": False,
            "reason": "trusted-manifest-json-invalid",
            "manifestSha256": actual,
        }

    if (
        not isinstance(manifest, dict)
        or type(manifest.get("schemaVersion")) is not int
        or manifest.get("schemaVersion") != 1
        or manifest.get("policy") != "fail-closed"
        or not isinstance(manifest.get("approvedDatasets"), list)
    ):
        return {
            "approved": False,
            "reason": "trusted-manifest-schema-invalid",
            "manifestSha256": actual,
        }

    if not isinstance(dataset, dict):
        return {"approved": False, "reason": "dataset-metadata-invalid", "manifestSha256": actual}
    fingerprint = _text(dataset.get("fingerprint"))
    provenance = dataset.get("provenance")
    if not _DIGEST_RE.fullmatch(fingerprint) or not isinstance(provenance, dict):
        return {"approved": False, "reason": "dataset-provenance-missing", "manifestSha256": actual}

    for entry in manifest["approvedDatasets"]:
        if not isinstance(entry, dict) or _text(entry.get("datasetFingerprint")) != fingerprint:
            continue
        if any(_text(entry.get(field)) != _text(provenance.get(field)) for field in _MATCH_FIELDS):
            continue
        if _text(entry.get("contentSha256")) != fingerprint:
            continue

        review = entry.get("review")
        if not isinstance(review, dict):
            continue
        reviewed_at = _text(review.get("reviewedAt"))
        reviewed_by = _text(review.get("reviewedBy"))
        approval_ref = _text(review.get("approvalRef"))
        try:
            parsed_time = datetime.fromisoformat(reviewed_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        parsed_ref = urlparse(approval_ref)
        if (
            parsed_time.tzinfo is None
            or parsed_time > datetime.now(timezone.utc)
            or not reviewed_by
            or parsed_ref.scheme != "https"
            or not parsed_ref.netloc
            or parsed_ref.username is not None
            or parsed_ref.password is not None
        ):
            continue
        return {
            "approved": True,
            "reason": "approved-manifest-match",
            "datasetFingerprint": fingerprint,
            "manifestSha256": actual,
            "reviewedAt": reviewed_at,
            "reviewedBy": reviewed_by,
            "approvalRef": approval_ref,
        }

    return {
        "approved": False,
        "reason": "dataset-not-in-trusted-manifest",
        "manifestSha256": actual,
        "datasetFingerprint": fingerprint,
    }
