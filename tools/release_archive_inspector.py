#!/usr/bin/env python3
"""Inspect a published NK1 ZIP without extracting it; report source drift separately."""
from __future__ import annotations
import argparse, hashlib, json, os, re, stat, subprocess, zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

MAX_MEMBERS = 100_000
MAX_MEMBER_BYTES = 2 * 1024 * 1024 * 1024
MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024
MAX_COMPRESSION_RATIO = 1_000
CHUNK_SIZE = 1024 * 1024
VERSION_PATHS = ("VERSION.json", "SUPER_VERSION.json", "runtime/neuro-kurisu/package.json")

def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()

def _safe_member_path(name: str) -> str:
    if not isinstance(name, str) or not name or "\x00" in name:
        raise ValueError("empty or invalid ZIP member name")
    if "\\" in name:
        raise ValueError("backslash is not allowed in ZIP member names")
    if name.startswith("/"):
        raise ValueError("absolute ZIP member path")
    normalized = name[:-1] if name.endswith("/") else name
    parts = normalized.split("/")
    if not normalized or any(part in ("", ".", "..") for part in parts):
        raise ValueError("non-canonical or traversal ZIP member path")
    if re.match(r"^[A-Za-z]:", parts[0]):
        raise ValueError("drive-qualified ZIP member path")
    return PurePosixPath(*parts).as_posix()

def _source_paths(root: Path) -> tuple[set[str], str | None]:
    try:
        result = subprocess.run(["git", "ls-files", "-z"], cwd=root, check=True, capture_output=True)
        rows = result.stdout.decode("utf-8", errors="strict").split("\0")
        paths = {row.replace(os.sep, "/") for row in rows if row and (root / row).is_file() and not (root / row).is_symlink()}
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError):
        excluded = {".git", "node_modules", ".venv", "__pycache__", "dist", ".next"}
        paths = set()
        for path in root.rglob("*"):
            if not path.is_file() or path.is_symlink():
                continue
            relative = path.relative_to(root)
            if any(part in excluded for part in relative.parts):
                continue
            paths.add(relative.as_posix())
    try:
        ref = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        ref = None
    return paths, ref

def _choose_prefix(paths: list[str], source_paths: set[str], requested: str) -> str:
    if requested != "auto":
        prefix = requested.strip("/")
        return prefix + "/" if prefix else ""
    candidates = {""}
    first_parts = {path.split("/", 1)[0] for path in paths if "/" in path}
    if paths and len(first_parts) == 1 and all("/" in path for path in paths):
        candidates.add(next(iter(first_parts)) + "/")
    scored = []
    for prefix in candidates:
        mapped = {path[len(prefix):] if prefix and path.startswith(prefix) else path for path in paths}
        scored.append((len(mapped & source_paths), prefix == "", prefix))
    return max(scored)[2]

def _read_json_from_zip(archive: zipfile.ZipFile, name_map: dict[str, str]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for source_name in VERSION_PATHS:
        archive_name = name_map.get(source_name)
        if not archive_name:
            continue
        try:
            info = archive.getinfo(archive_name)
            if info.file_size > 4 * 1024 * 1024:
                result[source_name] = {"error": "metadata file exceeds 4 MiB"}
                continue
            value = json.loads(archive.read(info).decode("utf-8"))
            result[source_name] = value if isinstance(value, dict) else {"error": "JSON root is not an object"}
        except Exception as error:
            result[source_name] = {"error": str(error)[:240]}
    return result

def _read_source_versions(root: Path) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for name in VERSION_PATHS:
        path = root / name
        if not path.is_file() or path.is_symlink():
            continue
        try:
            if path.stat().st_size > 4 * 1024 * 1024:
                result[name] = {"error": "metadata file exceeds 4 MiB"}
                continue
            value = json.loads(path.read_text(encoding="utf-8"))
            result[name] = value if isinstance(value, dict) else {"error": "JSON root is not an object"}
        except Exception as error:
            result[name] = {"error": str(error)[:240]}
    return result

def audit_release_archive(archive_path: str | Path, source_root: str | Path, expected_sha256: str | None = None, expected_size: int | None = None, archive_prefix: str = "auto", release_tag: str | None = None) -> dict[str, Any]:
    archive = Path(archive_path)
    root = Path(source_root).resolve()
    errors: list[str] = []
    entries: list[dict[str, Any]] = []
    archive_paths: list[str] = []
    source_path_set, source_ref = _source_paths(root)
    archive_sha = None
    archive_size = archive.stat().st_size if archive.is_file() else None
    if not archive.is_file():
        errors.append("archive file does not exist")
    else:
        archive_sha = _sha256_file(archive)
    if expected_sha256:
        expected = expected_sha256.removeprefix("sha256:").lower()
        if not re.fullmatch(r"[0-9a-f]{64}", expected):
            errors.append("expected SHA-256 metadata is malformed")
        elif archive_sha != expected:
            errors.append("downloaded archive SHA-256 does not match GitHub release metadata")
    if expected_size is not None and archive_size != expected_size:
        errors.append("downloaded archive byte size does not match GitHub release metadata")

    if archive.is_file():
        try:
            with zipfile.ZipFile(archive, "r") as zipped:
                infos = zipped.infolist()
                if len(infos) > MAX_MEMBERS:
                    errors.append("archive exceeds the maximum member count")
                seen: set[str] = set()
                total_size = 0
                valid_infos: list[tuple[zipfile.ZipInfo, str]] = []
                for info in infos:
                    try:
                        member_path = _safe_member_path(info.filename)
                    except ValueError as error:
                        errors.append(f"unsafe member {info.filename!r}: {error}")
                        continue
                    mode = (info.external_attr >> 16) & 0xFFFF
                    if stat.S_ISLNK(mode):
                        errors.append(f"symbolic-link member is not accepted: {member_path}")
                        continue
                    if info.is_dir():
                        continue
                    if member_path in seen:
                        errors.append(f"duplicate ZIP member: {member_path}")
                        continue
                    seen.add(member_path)
                    if info.file_size > MAX_MEMBER_BYTES:
                        errors.append(f"member exceeds the size limit: {member_path}")
                        continue
                    total_size += info.file_size
                    if total_size > MAX_TOTAL_BYTES:
                        errors.append("archive exceeds the total uncompressed size limit")
                        break
                    if info.file_size and info.compress_size == 0:
                        errors.append(f"member has an invalid zero compressed size: {member_path}")
                        continue
                    if info.compress_size and info.file_size / info.compress_size > MAX_COMPRESSION_RATIO:
                        errors.append(f"member exceeds the compression-ratio limit: {member_path}")
                        continue
                    valid_infos.append((info, member_path))
                for info, member_path in valid_infos:
                    digest = hashlib.sha256()
                    bytes_read = 0
                    try:
                        with zipped.open(info, "r") as stream:
                            for chunk in iter(lambda: stream.read(CHUNK_SIZE), b""):
                                digest.update(chunk)
                                bytes_read += len(chunk)
                        if bytes_read != info.file_size:
                            errors.append(f"member size mismatch after read: {member_path}")
                            continue
                    except Exception as error:
                        errors.append(f"member read/CRC failure for {member_path}: {str(error)[:220]}")
                        continue
                    archive_paths.append(member_path)
                    entries.append({"path": member_path, "sizeBytes": info.file_size, "compressedBytes": info.compress_size, "crc32": f"{info.CRC:08x}", "sha256": digest.hexdigest()})
        except (OSError, zipfile.BadZipFile, RuntimeError, ValueError) as error:
            errors.append(f"ZIP container invalid: {str(error)[:300]}")

    prefix = _choose_prefix(archive_paths, source_path_set, archive_prefix)
    name_map: dict[str, str] = {}
    mapped_entries: dict[str, dict[str, Any]] = {}
    for entry in entries:
        path = entry["path"]
        if prefix:
            if not path.startswith(prefix):
                errors.append(f"archive member is outside selected root prefix {prefix!r}: {path}")
                continue
            source_name = path[len(prefix):]
        else:
            source_name = path
        if not source_name or source_name in mapped_entries:
            errors.append(f"archive path collision after prefix mapping: {source_name!r}")
            continue
        entry["sourcePath"] = source_name
        name_map[source_name] = path
        mapped_entries[source_name] = entry

    identical: list[str] = []
    changed: list[dict[str, str]] = []
    archive_only: list[str] = []
    source_hash_cache: dict[str, str] = {}
    for source_name, entry in sorted(mapped_entries.items()):
        if source_name not in source_path_set:
            archive_only.append(source_name)
            continue
        source_file = root / source_name
        if source_name not in source_hash_cache:
            source_hash_cache[source_name] = _sha256_file(source_file)
        source_hash = source_hash_cache[source_name]
        if source_hash == entry["sha256"]:
            identical.append(source_name)
        else:
            changed.append({"path": source_name, "archiveSha256": entry["sha256"], "sourceSha256": source_hash})
    source_only = sorted(source_path_set - set(mapped_entries))
    comparison = {
        "identicalFileCount": len(identical), "identicalFiles": identical,
        "changedFileCount": len(changed), "changedFiles": changed,
        "archiveOnlyFileCount": len(archive_only), "archiveOnlyFiles": archive_only,
        "sourceOnlyFileCount": len(source_only), "sourceOnlyFiles": source_only,
    }
    archive_versions: dict[str, Any] = {}
    if archive.is_file():
        try:
            with zipfile.ZipFile(archive, "r") as zipped:
                archive_versions = _read_json_from_zip(zipped, name_map)
        except (OSError, zipfile.BadZipFile, RuntimeError):
            pass
    integrity_ok = not errors
    return {
        "schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "releaseTag": release_tag,
        "archive": {
            "fileName": archive.name, "sizeBytes": archive_size, "sha256": archive_sha,
            "expectedSha256": expected_sha256, "expectedSizeBytes": expected_size,
            "digestMatches": None if not expected_sha256 else archive_sha == expected_sha256.removeprefix("sha256:").lower(),
            "sizeMatches": None if expected_size is None else archive_size == expected_size,
            "integrityOk": integrity_ok, "fileCount": len(entries),
            "uncompressedBytes": sum(entry["sizeBytes"] for entry in entries),
            "archivePrefixApplied": prefix, "files": sorted(entries, key=lambda entry: entry["path"]),
        },
        "source": {"ref": source_ref, "trackedFileCount": len(source_path_set), "versions": _read_source_versions(root)},
        "archiveVersions": archive_versions, "comparison": comparison, "errors": errors, "ok": integrity_ok,
    }

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True)
    parser.add_argument("--source-root", default=".")
    parser.add_argument("--expected-sha256")
    parser.add_argument("--expected-size", type=int)
    parser.add_argument("--archive-prefix", default="auto")
    parser.add_argument("--release-tag")
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    report = audit_release_archive(args.archive, args.source_root, args.expected_sha256, args.expected_size, args.archive_prefix, args.release_tag)
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    comparison, archive = report["comparison"], report["archive"]
    print(json.dumps({
        "ok": report["ok"], "releaseTag": report["releaseTag"], "archiveSha256": archive["sha256"],
        "archiveBytes": archive["sizeBytes"], "archiveFiles": archive["fileCount"],
        "identicalFiles": comparison["identicalFileCount"], "changedFiles": comparison["changedFileCount"],
        "archiveOnlyFiles": comparison["archiveOnlyFileCount"], "sourceOnlyFiles": comparison["sourceOnlyFileCount"],
        "errors": report["errors"], "report": str(output),
    }, indent=2))
    return 0 if report["ok"] else 2

if __name__ == "__main__":
    raise SystemExit(main())
