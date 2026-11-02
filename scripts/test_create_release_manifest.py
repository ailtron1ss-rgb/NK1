import hashlib
import json
import re
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


def make_metadata():
    source_sha = "a" * 40
    return {
        "repository": "ailtron1ss-rgb/NK1",
        "release": {
            "tag": "workpass70-main-sync-2026-11-02-aaaaaaaaaaaa",
            "date": "2026-11-02",
            "prerelease": True,
        },
        "source": {
            "branch": "workpass70-source",
            "commit_sha": source_sha,
        },
        "validation": {
            "workflow_run": {
                "id": 41331728115,
                "run_number": 640,
                "run_attempt": 1,
                "name": "NeuroCore core regression validation",
                "event": "push",
                "conclusion": "success",
                "url": "https://github.com/ailtron1ss-rgb/NK1/actions/runs/41331728115",
                "head_sha": source_sha,
                "head_branch": "workpass70-source",
            },
            "required_checks": [
                {
                    "id": 124923079245,
                    "name": "targeted-and-regression",
                    "status": "completed",
                    "conclusion": "success",
                    "details_url": "https://github.com/ailtron1ss-rgb/NK1/actions/runs/41331728115",
                },
                {
                    "id": 124923079098,
                    "name": "source-lineage-contract",
                    "status": "completed",
                    "conclusion": "success",
                    "details_url": "https://github.com/ailtron1ss-rgb/NK1/actions/runs/41331728121",
                },
            ],
        },
        "build": {
            "workflow_name": "Publish validated WorkPass70 source release",
            "run_id": 700,
            "run_attempt": 2,
            "run_url": "https://github.com/ailtron1ss/NK1/actions/runs/700",
            "node_version": "v24.0.0",
            "python_version": "Python 3.12.3",
        },
        "gates": {
            "exact_source_checks": "passed",
            "source_freshness": "passed",
            "provenance_and_license": "passed",
            "archive_integrity": "passed",
        },
    }


class ReleaseManifestCliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.metadata_path = self.root / "metadata.json"
        self.output_path = self.root / "release-manifest.json"
        self.zip_path = self.root / "release.zip"
        self.report_path = self.root / "report.md"
        self.sbom_path = self.root / "sbom.json"
        self.report_path.write_text("# NK1 release report\n", encoding="utf-8")
        self.sbom_path.write_text('{"name":"NK1"}\n', encoding="utf-8")
        with zipfile.ZipFile(self.zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("contracts/SBOM.final.json", self.sbom_path.read_bytes())
        self.metadata = make_metadata()
        self.write_metadata()

    def tearDown(self):
        self.temp.cleanup()

    def write_metadata(self):
        self.metadata_path.write_text(json.dumps(self.metadata), encoding="utf-8")

    def run_cli(self, evidence_path="contracts/SBOM.final.json"):
        return subprocess.run(
            [
                sys.executable,
                str(Path(__file__).with_name("create_release_manifest.py")),
                "--metadata",
                str(self.metadata_path),
                "--artifact",
                f"zip={self.zip_path}",
                "--artifact",
                f"report={self.report_path}",
                "--embedded-evidence",
                f"{evidence_path}={self.sbom_path}",
                "--output",
                str(self.output_path),
            ],
            text=True,
            capture_output=True,
        )

    def test_cli_pins_source_checks_and_exact_artifact_digests(self):
        result = self.run_cli()
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads(self.output_path.read_text(encoding="utf-8"))

        self.assertEqual(manifest["schema_version"], "nk1.release-manifest/v1")
        self.assertEqual(manifest["source"]["commit_sha"], "a" * 40)
        self.assertEqual(manifest["validation"]["workflow_run"]["head_sha"], "a" * 40)
        self.assertEqual(
            [item["name"] for item in manifest["validation"]["required_checks"]],
            ["targeted-and-regression", "source-lineage-contract"],
        )
        zip_record = next(item for item in manifest["artifacts"] if item["role"] == "zip")
        self.assertEqual(zip_record["sha256"], hashlib.sha256(self.zip_path.read_bytes()).hexdigest())
        self.assertEqual(zip_record["size_bytes"], len(self.zip_path.read_bytes()))
        self.assertEqual(
            manifest["embedded_evidence"][0]["sha256"],
            hashlib.sha256(self.sbom_path.read_bytes()).hexdigest(),
        )
        self.assertRegex(manifest["generated_at"], r"^\d{4}-\d\d-\d\dT.*Z$")

    def test_cli_rejects_a_required_check_that_did_not_succeed(self):
        self.metadata["validation"]["required_checks"][1]["conclusion"] = "failure"
        self.write_metadata()
        result = self.run_cli()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("source-lineage-contract", result.stderr)

    def test_cli_rejects_embedded_evidence_missing_from_the_zip(self):
        result = self.run_cli("contracts/not-in-archive.json")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("present exactly once in ZIP", result.stderr)

    def test_cli_rejects_embedded_evidence_as_a_symlink_member(self):
        info = zipfile.ZipInfo("contracts/SBOM.final.json")
        info.create_system = 3
        info.external_attr = 0o120777 << 16
        with zipfile.ZipFile(self.zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(info, self.sbom_path.read_bytes())
        result = self.run_cli()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be a regular file", result.stderr)

    def test_cli_rejects_embedded_evidence_with_different_bytes(self):
        with zipfile.ZipFile(self.zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("contracts/SBOM.final.json", b'{"name":"OLD"}\n')
        result = self.run_cli()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("bytes do not match", result.stderr)

    def test_cli_rejects_a_non_zip_artifact(self):
        self.zip_path.write_bytes(b"not a zip archive")
        result = self.run_cli()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("release ZIP is invalid", result.stderr)

    def test_cli_rejects_validation_for_a_different_source_sha(self):
        self.metadata["validation"]["workflow_run"]["head_sha"] = "b" * 40
        self.write_metadata()
        result = self.run_cli()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("head SHA", result.stderr)

    def test_cli_rejects_unsafe_embedded_archive_paths(self):
        for unsafe_path in (
            "../outside.json",
            "/absolute.json",
            ".",
            "a//b.json",
            "a/./b.json",
            "a/../b.json",
            "a\\\\b.json",
        ):
            with self.subTest(path=unsafe_path):
                result = self.run_cli(unsafe_path)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("safe relative archive path", result.stderr)


if __name__ == "__main__":
    unittest.main()
