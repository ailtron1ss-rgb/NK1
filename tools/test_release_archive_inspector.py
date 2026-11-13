from __future__ import annotations
import hashlib, json, tempfile, unittest, warnings, zipfile
from pathlib import Path
from tools.release_archive_inspector import audit_release_archive

class ReleaseArchiveInspectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "README.md").write_text("NK1 source\n", encoding="utf-8")
        runtime = self.source / "runtime" / "neuro-kurisu"
        runtime.mkdir(parents=True)
        (runtime / "package.json").write_text(json.dumps({"name": "neuro-kurisu", "version": "35.90.0"}) + "\n", encoding="utf-8")
        self.archive = self.root / "release.zip"

    def tearDown(self):
        self.temp.cleanup()

    def _write_archive(self, rows):
        with zipfile.ZipFile(self.archive, "w", compression=zipfile.ZIP_DEFLATED) as zipped:
            for name, content in rows.items():
                zipped.writestr(name, content)

    def test_hashes_archive_and_compares_single_root_folder_to_source(self):
        rows = {
            "Neuro_Kurisu/README.md": b"NK1 source\n",
            "Neuro_Kurisu/runtime/neuro-kurisu/package.json": (json.dumps({"name": "neuro-kurisu", "version": "35.90.0"}) + "\n").encode(),
        }
        self._write_archive(rows)
        archive_hash = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        result = audit_release_archive(self.archive, self.source, expected_sha256=archive_hash, expected_size=self.archive.stat().st_size)
        self.assertTrue(result["ok"], result["errors"])
        self.assertTrue(result["archive"]["digestMatches"])
        self.assertEqual(result["archive"]["fileCount"], 2)
        self.assertEqual(result["archive"]["archivePrefixApplied"], "Neuro_Kurisu/")
        self.assertEqual(result["comparison"]["identicalFileCount"], 2)
        self.assertEqual(result["comparison"]["changedFileCount"], 0)
        self.assertEqual(result["comparison"]["sourceOnlyFileCount"], 0)
        self.assertEqual(result["archiveVersions"]["runtime/neuro-kurisu/package.json"]["version"], "35.90.0")

    def test_auto_prefix_maps_wrapped_files_and_keeps_root_level_members(self):
        (self.source / "LICENSE").write_text("MIT\n", encoding="utf-8")
        self._write_archive({
            "Neuro_Kurisu/README.md": b"NK1 source\n",
            "LICENSE": b"MIT\n",
        })
        result = audit_release_archive(self.archive, self.source)
        self.assertTrue(result["ok"], result["errors"])
        self.assertEqual(result["archive"]["archivePrefixApplied"], "Neuro_Kurisu/")
        self.assertEqual(result["comparison"]["identicalFileCount"], 2)

    def test_empty_zip_is_not_a_valid_release_archive(self):
        with zipfile.ZipFile(self.archive, "w"):
            pass
        result = audit_release_archive(self.archive, self.source)
        self.assertFalse(result["ok"])
        self.assertTrue(any("no file members" in error for error in result["errors"]))

    def test_reports_changed_missing_and_archive_only_files_without_calling_them_corrupt(self):
        (self.source / "README.md").write_text("new source\n", encoding="utf-8")
        (self.source / "source-only.txt").write_text("new file\n", encoding="utf-8")
        self._write_archive({"README.md": b"old release\n", "legacy-only.txt": b"legacy file\n"})
        result = audit_release_archive(self.archive, self.source)
        self.assertTrue(result["ok"], result["errors"])
        self.assertEqual(result["comparison"]["changedFileCount"], 1)
        self.assertEqual(result["comparison"]["changedFiles"][0]["path"], "README.md")
        self.assertEqual(result["comparison"]["archiveOnlyFiles"], ["legacy-only.txt"])
        self.assertIn("source-only.txt", result["comparison"]["sourceOnlyFiles"])

    def test_rejects_path_traversal_without_extracting_member(self):
        self._write_archive({"../escape.txt": b"must not be written"})
        result = audit_release_archive(self.archive, self.source)
        self.assertFalse(result["ok"])
        self.assertTrue(any("unsafe member" in error for error in result["errors"]))
        self.assertFalse((self.root / "escape.txt").exists())

    def test_rejects_duplicate_archive_members(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(self.archive, "w") as zipped:
                zipped.writestr("duplicate.txt", b"first")
                zipped.writestr("duplicate.txt", b"second")
        result = audit_release_archive(self.archive, self.source)
        self.assertFalse(result["ok"])
        self.assertTrue(any("duplicate ZIP member" in error for error in result["errors"]))

    def test_release_digest_and_size_mismatch_fail_integrity(self):
        self._write_archive({"README.md": b"NK1 source\n"})
        result = audit_release_archive(self.archive, self.source, expected_sha256="0" * 64, expected_size=self.archive.stat().st_size + 1)
        self.assertFalse(result["ok"])
        self.assertFalse(result["archive"]["digestMatches"])
        self.assertFalse(result["archive"]["sizeMatches"])
        self.assertTrue(any("SHA-256" in error for error in result["errors"]))
        self.assertTrue(any("byte size" in error for error in result["errors"]))

    def test_corrupt_zip_returns_a_failed_report_instead_of_raising(self):
        self.archive.write_bytes(b"not a zip archive")
        result = audit_release_archive(self.archive, self.source)
        self.assertFalse(result["ok"])
        self.assertTrue(any("ZIP container invalid" in error for error in result["errors"]))

if __name__ == "__main__":
    unittest.main()
