from __future__ import annotations

"""Isolated source-level self-modification harness.

A candidate is described by exact file edits.  The harness copies the current
source tree into an isolated workspace, applies edits only when the expected
source matches exactly once, compiles the candidate, optionally runs an allowlisted
pytest set, and returns content hashes for provenance.  It never mutates the
canonical source tree; promotion remains a separate governed action.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable, Sequence
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time


@dataclass(frozen=True)
class SourceEditV1:
    path: str
    old_text: str
    new_text: str
    create_if_missing: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SourceCandidateResultV1:
    candidate_id: str
    status: str
    source_root: str
    candidate_root: str | None
    changed_files: tuple[str, ...]
    before_hash: str
    after_hash: str
    compile_ok: bool
    tests_ok: bool | None
    test_nodes: tuple[str, ...]
    elapsed_s: float
    error: str = ""

    def to_dict(self) -> dict[str, Any]:
        out = asdict(self)
        out["changed_files"] = list(self.changed_files)
        out["test_nodes"] = list(self.test_nodes)
        return out


class SourcePatchSandboxV1:
    VERSION = "source-patch-sandbox-v1"

    def __init__(self, root: Path, *, workspace: Path | None = None):
        self.root = Path(root).resolve()
        self.workspace = Path(workspace or (self.root.parent / f".{self.root.name}_source_candidates")).resolve()
        self.workspace.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _file_hash(path: Path) -> str:
        h = hashlib.sha256()
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()

    @classmethod
    def _tree_hash(cls, root: Path) -> str:
        h = hashlib.sha256()
        for path in sorted(p for p in root.rglob("*") if p.is_file()):
            rel = path.relative_to(root).as_posix()
            if any(part in {".git", "__pycache__", ".pytest_cache", ".mypy_cache", "runtime"} for part in path.parts):
                continue
            h.update(rel.encode("utf-8"))
            h.update(cls._file_hash(path).encode("ascii"))
        return h.hexdigest()

    def _validate_edit(self, edit: SourceEditV1, *, allow_missing: bool = False) -> Path:
        rel = Path(edit.path)
        if rel.is_absolute() or ".." in rel.parts:
            raise ValueError(f"edit path must stay inside source root: {edit.path}")
        target = (self.root / rel).resolve()
        if target != self.root and self.root not in target.parents:
            raise ValueError(f"edit escapes source root: {edit.path}")
        if not target.is_file():
            if allow_missing and edit.create_if_missing:
                return target
            raise FileNotFoundError(target)
        return target

    def _copy_source(self, destination: Path) -> None:
        ignore_names = {".git", "__pycache__", ".pytest_cache", ".mypy_cache"}
        shutil.copytree(
            self.root,
            destination,
            ignore=shutil.ignore_patterns(*ignore_names),
            dirs_exist_ok=False,
        )

    def prepare(
        self,
        edits: Sequence[SourceEditV1],
        *,
        candidate_id: str | None = None,
        test_nodes: Iterable[str] = (),
        timeout_s: int = 120,
    ) -> SourceCandidateResultV1:
        started = time.perf_counter()
        edits = tuple(edits)
        test_nodes = tuple(str(x) for x in test_nodes)
        before_hash = self._tree_hash(self.root)
        payload = {
            "version": self.VERSION,
            "baseline_hash": before_hash,
            "edits": [e.to_dict() for e in edits],
            "tests": list(test_nodes),
        }
        candidate_id = candidate_id or hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()[:20]
        destination = self.workspace / candidate_id
        if destination.exists():
            shutil.rmtree(destination)
        try:
            # Copy through a temporary directory, then publish atomically by rename.
            stage = Path(tempfile.mkdtemp(prefix=f"{candidate_id}.stage.", dir=str(self.workspace)))
            shutil.rmtree(stage)
            self._copy_source(stage)
            changed: list[str] = []
            for edit in edits:
                source_path = self._validate_edit(edit, allow_missing=True)
                target = stage / edit.path
                if edit.create_if_missing and not source_path.exists():
                    if edit.old_text:
                        raise ValueError(f"new file {edit.path} requires empty old_text")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(edit.new_text, encoding="utf-8")
                else:
                    current = target.read_text(encoding="utf-8")
                    count = current.count(edit.old_text)
                    if count != 1:
                        raise ValueError(f"edit for {edit.path} matched {count} times; expected exactly once")
                    target.write_text(current.replace(edit.old_text, edit.new_text, 1), encoding="utf-8")
                changed.append(Path(edit.path).as_posix())

            compile_proc = subprocess.run(
                [sys.executable, "-m", "compileall", "-q", "core"],
                cwd=str(stage), capture_output=True, text=True, timeout=max(5, int(timeout_s)), check=False,
            )
            compile_ok = compile_proc.returncode == 0
            tests_ok: bool | None = None
            error_parts = []
            if not compile_ok:
                error_parts.append((compile_proc.stderr or compile_proc.stdout or "compileall failed")[-4000:])
            if compile_ok and test_nodes:
                tests = []
                for node in test_nodes:
                    if node.startswith("-") or "\x00" in node:
                        raise ValueError("unsafe test node")
                    tests.append(node)
                test_proc = subprocess.run(
                    [sys.executable, "-m", "pytest", *tests, "--disable-warnings", "--maxfail=1", "-q"],
                    cwd=str(stage), capture_output=True, text=True, timeout=max(10, int(timeout_s)), check=False,
                )
                tests_ok = test_proc.returncode == 0
                if not tests_ok:
                    error_parts.append((test_proc.stderr or test_proc.stdout or "pytest failed")[-6000:])

            status = "validated" if compile_ok and tests_ok is not False else "rejected"
            after_hash = self._tree_hash(stage)
            manifest = {
                "version": self.VERSION,
                "candidate_id": candidate_id,
                "status": status,
                "source_root": str(self.root),
                "changed_files": changed,
                "before_hash": before_hash,
                "after_hash": after_hash,
                "compile_ok": compile_ok,
                "tests_ok": tests_ok,
                "test_nodes": list(test_nodes),
                "edits": [e.to_dict() for e in edits],
            }
            stage.joinpath("runtime").mkdir(parents=True, exist_ok=True)
            stage.joinpath("runtime", f"source_candidate_{candidate_id}.json").write_text(
                json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8"
            )
            os.replace(stage, destination)
            return SourceCandidateResultV1(
                candidate_id, status, str(self.root), str(destination), tuple(sorted(set(changed))),
                before_hash, after_hash, compile_ok, tests_ok, tuple(test_nodes), time.perf_counter() - started,
                "\n".join(error_parts)[-8000:],
            )
        except Exception as exc:
            if destination.exists():
                shutil.rmtree(destination, ignore_errors=True)
            return SourceCandidateResultV1(
                candidate_id, "error", str(self.root), None, tuple(), before_hash, "",
                False, False if test_nodes else None, tuple(test_nodes), time.perf_counter() - started,
                f"{type(exc).__name__}: {exc}",
            )
