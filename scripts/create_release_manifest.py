#!/usr/bin/env python3
"""Create a machine-readable provenance manifest for a validated NK1 release."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import zipfile
from datetime import date, datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Mapping, Sequence


SCHEMA_VERSION = "nk1.release-manifest/v1"
REQUIRED_CHECK_NAMES = ("targeted-and-regression", "source-lineage-contract")
REQUIRED_ARTIFACT_ROLES = ("zip", "report")
REQUIRED_GATES = (
    "exact_source_checks",
    "source_freshness",
    "provenance_and_license",
    "archive_integrity",
)


class ManifestError(ValueError):
    """Raised when release provenance is incomplete or inconsistent."""


def _mapping(value: object, field: str) -> Mapping[str, object]:
    if not isinstance(value, dict):
        raise ManifestError(f"{field} must be a JSON object")
    return value


def _nonempty(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ManifestError(f"{field} must be a non-empty string")
    return value.strip()


def _positive_int(value: object, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ManifestError(f"{field} must be a positive integer")
    return value


def _https_url(value: object, field: str) -> str:
    url = _nonempty(value, field)
    if not url.startswith("https://"):
        raise ManifestError(f"{field} must be an HTTPS URL")
    return url


def _sha(value: object, field: str) -> str:
    result = _nonempty(value, field)
    if re.fullmatch(r"[0-9a-f]{40}", result) is None:
        raise ManifestError(f"{field} must be a 40-character lowercase Git SHA")
    return result


def _safe_archive_path(value: object) -> str:
    raw = _nonempty(value, "embedded evidence archive path")
    path = PurePosixPath(raw)
    raw_parts = raw.split("/")
    if (
        path.is_absolute()
        or raw.startswith("/")
        or "\\" in raw
        or re.match(r"^[A-Za-z]:", raw) is not None
        or any(part in ("", ".", "..") for part in raw_parts)
        or any(ord(character) < 32 or ord(character) == 127 for character in raw)
    ):
        raise ManifestError(f"embedded evidence must use a safe relative archive path: {raw}")
    return path.as_posix()


def _file_digest(path_value: Path, field: str) -> tuple[int, str]:
    path = Path(path_value)
    if path.is_symlink() or not path.is_file():
        raise ManifestError(f"{field} must be a regular non-symlink file: {path}")
    size = path.stat().st_size
    if size <= 0:
        raise ManifestError(f"{field} must not be empty: {path}")
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return size, digest.hexdigest()


def _verify_embedded_evidence_in_zip(
    archive_path: Path,
    evidence_records: Sequence[Mapping[str, object]],
) -> None:
    try:
        with zipfile.ZipFile(archive_path, "r") as archive:
            names = archive.namelist()
            for record in evidence_records:
                member = str(record["archive_path"])
                if names.count(member) != 1:
                    raise ManifestError(
                        f"embedded evidence {member} must be present exactly once in ZIP"
                    )
                info = archive.getinfo(member)
                if info.is_dir() or info.file_size != record["size_bytes"]:
                    raise ManifestError(
                        f"embedded evidence {member} size does not match the local evidence file"
                    )
                digest = hashlib.sha256()
                actual_size = 0
                with archive.open(info, "r") as handle:
                    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                        actual_size += len(chunk)
                        digest.update(chunk)
                if actual_size != record["size_bytes"] or digest.hexdigest() != record["sha256"]:
                    raise ManifestError(
                        f"embedded evidence {member} bytes do not match the local evidence file"
                    )
    except zipfile.BadZipFile as error:
        raise ManifestError(f"release ZIP is invalid: {error}") from error
    except (OSError, RuntimeError, zipfile.LargeZipFile) as error:
        raise ManifestError(f"could not verify embedded evidence in release ZIP: {error}") from error


def _parse_pairs(values: Sequence[str], field: str) -> dict[str, Path]:
    parsed: dict[str, Path] = {}
    for value in values:
        key, separator, raw_path = value.partition("=")
        if not separator or not key.strip() or not raw_path.strip():
            raise ManifestError(f"{field} entries must use NAME=PATH: {value}")
        key = key.strip()
        if key in parsed:
            raise ManifestError(f"duplicate {field} entry: {key}")
        parsed[key] = Path(raw_path)
    return parsed


def _parse_evidence(values: Sequence[str]) -> dict[str, Path]:
    parsed: dict[str, Path] = {}
    for value in values:
        archive_path, separator, raw_path = value.partition("=")
        if not separator:
            raise ManifestError(
                f"embedded evidence entries must use ARCHIVE_PATH=LOCAL_PATH: {value}"
            )
        archive_path = _safe_archive_path(archive_path)
        if archive_path in parsed:
            raise ManifestError(f"duplicate embedded evidence path: {archive_path}")
        parsed[archive_path] = Path(raw_path)
    return parsed


def build_release_manifest(
    metadata: Mapping[str, object],
    artifacts: Mapping[str, Path],
    embedded_evidence: Mapping[str, Path],
    generated_at: datetime | None = None,
) -> dict[str, object]:
    repository = _nonempty(metadata.get("repository"), "repository")
    if repository.count("/") != 1 or any(not part for part in repository.split("/")):
        raise ManifestError("repository must use owner/name format")

    release = _mapping(metadata.get("release"), "release")
    tag = _nonempty(release.get("tag"), "release.tag")
    if re.fullmatch(r"[A-Za-z0-9._-]+", tag) is None:
        raise ManifestError("release.tag contains unsupported characters")
    release_date = _nonempty(release.get("date"), "release.date")
    try:
        date.fromisoformat(release_date)
    except ValueError as error:
        raise ManifestError("release.date must use YYYY-MM-DD") from error
    if release.get("prerelease") is not True:
        raise ManifestError("release.prerelease must be true for this technical release pipeline")

    source = _mapping(metadata.get("source"), "source")
    source_branch = _nonempty(source.get("branch"), "source.branch")
    source_sha = _sha(source.get("commit_sha"), "source.commit_sha")

    validation = _mapping(metadata.get("validation"), "validation")
    workflow_run = _mapping(validation.get("workflow_run"), "validation.workflow_run")
    validation_sha = _sha(workflow_run.get("head_sha"), "validation.workflow_run.head_sha")
    if validation_sha != source_sha:
        raise ManifestError("validation workflow head SHA does not match source commit SHA")
    validation_branch = _nonempty(
        workflow_run.get("head_branch"), "validation.workflow_run.head_branch"
    )
    if validation_branch != source_branch:
        raise ManifestError("validation workflow head branch does not match source branch")
    if _nonempty(workflow_run.get("conclusion"), "validation.workflow_run.conclusion") != "success":
        raise ManifestError("validation workflow run must have conclusion=success")

    required_checks_raw = validation.get("required_checks")
    if not isinstance(required_checks_raw, list):
        raise ManifestError("validation.required_checks must be an array")
    checks_by_name: dict[str, dict[str, object]] = {}
    for index, item in enumerate(required_checks_raw):
        check = _mapping(item, f"validation.required_checks[{index}]")
        name = _nonempty(check.get("name"), f"required_checks[{index}].name")
        if name in checks_by_name:
            raise ManifestError(f"duplicate required check: {name}")
        if name not in REQUIRED_CHECK_NAMES:
            continue
        if _nonempty(check.get("status"), f"{name}.status") != "completed":
            raise ManifestError(f"required check {name} is not completed")
        if _nonempty(check.get("conclusion"), f"{name}.conclusion") != "success":
            raise ManifestError(f"required check {name} did not succeed")
        record: dict[str, object] = {
            "id": _positive_int(check.get("id"), f"{name}.id"),
            "name": name,
            "status": "completed",
            "conclusion": "success",
        }
        details_url = check.get("details_url")
        if details_url:
            record["details_url"] = _https_url(details_url, f"{name}.details_url")
        for time_key in ("started_at", "completed_at"):
            if check.get(time_key):
                record[time_key] = _nonempty(check[time_key], f"{name}.{time_key}")
        checks_by_name[name] = record
    missing_checks = [name for name in REQUIRED_CHECK_NAMES if name not in checks_by_name]
    if missing_checks:
        raise ManifestError(f"missing successful required checks: {', '.join(missing_checks)}")

    build = _mapping(metadata.get("build"), "build")
    gates = _mapping(metadata.get("gates"), "gates")
    for gate_name in REQUIRED_GATES:
        if _nonempty(gates.get(gate_name), f"gates.{gate_name}") != "passed":
            raise ManifestError(f"release gate {gate_name} has not passed")

    if set(artifacts) != set(REQUIRED_ARTIFACT_ROLES):
        raise ManifestError("artifacts must contain exactly the zip and report roles")
    artifact_records = []
    for role in REQUIRED_ARTIFACT_ROLES:
        path = Path(artifacts[role])
        size, digest = _file_digest(path, f"artifact {role}")
        artifact_records.append(
            {
                "role": role,
                "name": path.name,
                "size_bytes": size,
                "sha256": digest,
            }
        )

    evidence_records = []
    for raw_archive_path, local_path in sorted(embedded_evidence.items()):
        archive_path = _safe_archive_path(raw_archive_path)
        size, digest = _file_digest(Path(local_path), f"embedded evidence {archive_path}")
        evidence_records.append(
            {
                "archive_path": archive_path,
                "size_bytes": size,
                "sha256": digest,
            }
        )
    if not evidence_records:
        raise ManifestError("at least one embedded SBOM/provenance evidence file is required")
    _verify_embedded_evidence_in_zip(Path(artifacts["zip"]), evidence_records)

    timestamp = generated_at or datetime.now(timezone.utc)
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise ManifestError("generated_at must be timezone-aware")
    timestamp = timestamp.astimezone(timezone.utc).replace(microsecond=0)

    validation_record = {
        "workflow_run": {
            "id": _positive_int(workflow_run.get("id"), "validation.workflow_run.id"),
            "run_number": _positive_int(
                workflow_run.get("run_number"), "validation.workflow_run.run_number"
            ),
            "run_attempt": _positive_int(
                workflow_run.get("run_attempt"), "validation.workflow_run.run_attempt"
            ),
            "name": _nonempty(workflow_run.get("name"), "validation.workflow_run.name"),
            "event": _nonempty(workflow_run.get("event"), "validation.workflow_run.event"),
            "conclusion": "success",
            "url": _https_url(workflow_run.get("url"), "validation.workflow_run.url"),
            "head_branch": source_branch,
            "head_sha": source_sha,
        },
        "required_checks": [checks_by_name[name] for name in REQUIRED_CHECK_NAMES],
    }
    build_record = {
        "workflow_name": _nonempty(build.get("workflow_name"), "build.workflow_name"),
        "run_id": _positive_int(build.get("run_id"), "build.run_id"),
        "run_attempt": _positive_int(build.get("run_attempt"), "build.run_attempt"),
        "run_url": _https_url(build.get("run_url"), "build.run_url"),
        "node_version": _nonempty(build.get("node_version"), "build.node_version"),
        "python_version": _nonempty(build.get("python_version"), "build.python_version"),
    }

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": timestamp.isoformat().replace("+00:00", "Z"),
        "repository": repository,
        "release": {
            "tag": tag,
            "date": release_date,
            "prerelease": True,
        },
        "source": {
            "branch": source_branch,
            "commit_sha": source_sha,
            "short_sha": source_sha[:12],
        },
        "validation": validation_record,
        "build": build_record,
        "gates": {name: "passed" for name in REQUIRED_GATES},
        "artifacts": artifact_records,
        "embedded_evidence": evidence_records,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata", required=True, type=Path)
    parser.add_argument("--artifact", action="append", default=[], metavar="ROLE=PATH")
    parser.add_argument(
        "--embedded-evidence",
        action="append",
        default=[],
        metavar="ARCHIVE_PATH=LOCAL_PATH",
    )
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)

    try:
        metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
        if not isinstance(metadata, dict):
            raise ManifestError("metadata root must be a JSON object")
        artifacts = _parse_pairs(args.artifact, "artifact")
        evidence = _parse_evidence(args.embedded_evidence)
        manifest = build_release_manifest(metadata, artifacts, evidence)
        output = args.output
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_name(output.name + ".tmp")
        temporary.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary, output)
    except (OSError, json.JSONDecodeError, ManifestError) as error:
        print(f"release manifest: {error}", file=sys.stderr)
        return 2

    print(f"RELEASE_MANIFEST={output}")
    print(f"RELEASE_MANIFEST_SOURCE_SHA={manifest['source']['commit_sha']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
