"""Fail-closed allowlist for externally reviewed NK1 memory holdouts.

A dataset's own provenance fields and content hash are self-asserted by the
producer. Promotion therefore also requires an exact entry in a reviewed
manifest whose byte-level SHA-256 is pinned out-of-band by the operator.
"""
from __future__ import annotations

from datetime import datetime
import hashlib
import json
import os
import re
from pathlib import Path
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


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def verify_trusted_memory_holdout(
    dataset: Any,
    *,
    manifest_path: str | Path | None = None,
    expected_manifest_sha256: str | None = None,
) -> dict[str, Any]:
    """Return approval only for an exact dataset/provenance match in a pinned manifest."""
    expected = (
        expected_manifest_sha256
        if expected_manifest_sha256 is not None
        else os.environ.get("NK1_TRUSTED_HOLDOUT_MANIFEST_SHA256", "")
    )
    expected = _text(expected).lower()
    if not _DIGEST_RE.fullmatch(expected):
        return {"approved": False, "reason": "trusted-manifest-digest-not-configured"}

    path = Path(manifest_path) if manifest_path is not None else _DEFAULT_MANIFEST
    try:
        raw = path.read_bytes()
    except OSError:
        return {"approved": False, "reason": "trusted-manifest-missing"}

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
    if not fingerprint or not isinstance(provenance, dict):
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
