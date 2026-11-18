import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "neuro_plastic_train.py"
SPEC = importlib.util.spec_from_file_location("neuro_plastic_train", MODULE_PATH)
TRAINER = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(TRAINER)


class NeuroPlasticTrainerPreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.base = self.root / "base-model"
        self.base.mkdir()
        (self.base / "config.json").write_text('{"model_type":"llama"}', encoding="utf-8")
        (self.base / "tokenizer.json").write_text('{"version":"1.0"}', encoding="utf-8")
        (self.base / "tokenizer_config.json").write_text('{"eos_token":"</s>"}', encoding="utf-8")
        self.training = [
            {"exampleId": "train-" + str(i), "domain": "reasoning",
             "prompt": "Question " + str(i), "completion": "Verified answer " + str(i)}
            for i in range(5)
        ]
        self.validation = [
            {"exampleId": "validation-" + str(i), "domain": "reasoning",
             "prompt": "Validation question " + str(i), "completion": "Validation answer " + str(i)}
            for i in range(2)
        ]
        self.train_file = self.root / "train.jsonl"
        self.validation_file = self.root / "validation.jsonl"
        self._write_rows(self.train_file, self.training)
        self._write_rows(self.validation_file, self.validation)
        self.manifest_path = self.root / "manifest.json"
        self.manifest = {
            "schemaVersion": 1,
            "method": "lora",
            "domain": "reasoning",
            "adapterId": "reasoning-v1",
            "baseModelId": "kurisu-7b",
            "backendId": "llama.cpp",
            "baseModelAlias": "kurisu-base",
            "servedModelAlias": "kurisu-reasoning-v1",
            "governance": {
                "trainingOptIn": True,
                "privacyReviewed": True,
                "licenseApproved": True,
                "piiScreening": "passed",
                "evidenceCount": 7,
                "attestedBy": "reviewer",
                "attestedAt": 1_800_000_000_000,
                "licenseId": "test-fixture-license",
            },
            "baseModelDirectory": str(self.base),
            "baseModelFingerprint": TRAINER.base_model_fingerprint(self.base),
            "tokenizerFingerprint": TRAINER.tokenizer_fingerprint(self.base),
            "sourceDatasetFingerprint": "c" * 64,
            "holdoutPlanFingerprint": "d" * 64,
            "trainingFile": "train.jsonl",
            "validationFile": "validation.jsonl",
            "corpusFingerprint": TRAINER.corpus_fingerprint(self.training, self.validation),
            "outputDirectory": "adapter-store/reasoning-v1",
            "seed": 41,
            "maxSequenceLength": 1024,
            "epochs": 1,
            "learningRate": 0.0002,
            "lora": {"rank": 16, "alpha": 32, "dropout": 0.05},
        }
        self._write_manifest()

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def _write_rows(path, rows):
        path.write_text(
            "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows),
            encoding="utf-8",
        )

    def _write_manifest(self):
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")

    def test_json_safe_converts_nonfinite_training_metrics_for_strict_json(self):
        payload = {
            "loss": float("nan"),
            "eval_loss": float("inf"),
            "nested": [1.5, float("-inf"), {"score": 0.8}],
        }
        safe = TRAINER.json_safe(payload)
        self.assertIsNone(safe["loss"])
        self.assertIsNone(safe["eval_loss"])
        self.assertIsNone(safe["nested"][1])
        self.assertEqual(safe["nested"][2]["score"], 0.8)
        json.dumps(safe, allow_nan=False)

    def test_preflight_accepts_local_lora_corpus_and_keeps_holdout_out(self):
        result = TRAINER.validate_manifest(self.manifest_path)
        self.assertEqual(result["method"], "lora")
        self.assertEqual(result["domain"], "reasoning")
        self.assertEqual(len(result["training"]), 5)
        self.assertEqual(len(result["validation"]), 2)
        self.assertFalse(result["output"].exists())
        self.assertEqual(result["baseFingerprint"], self.manifest["baseModelFingerprint"])

    def test_preflight_rejects_changed_base_model_fingerprint(self):
        self.manifest["baseModelFingerprint"] = "0" * 64
        self._write_manifest()
        with self.assertRaisesRegex(TRAINER.PreflightError, "base-model-fingerprint-mismatch"):
            TRAINER.validate_manifest(self.manifest_path)

    def test_preflight_rejects_path_traversal(self):
        self.manifest["trainingFile"] = "../../outside.jsonl"
        self._write_manifest()
        with self.assertRaisesRegex(TRAINER.PreflightError, "path-traversal"):
            TRAINER.validate_manifest(self.manifest_path)

    def test_preflight_rejects_holdout_fields_in_manifest(self):
        self.manifest["holdoutLabels"] = [{"passed": True}]
        self._write_manifest()
        with self.assertRaisesRegex(TRAINER.PreflightError, "manifest-schema-invalid"):
            TRAINER.validate_manifest(self.manifest_path)

    def test_preflight_rejects_holdout_fields_in_training_examples(self):
        contaminated = [dict(self.training[0], split="holdout")] + self.training[1:]
        self._write_rows(self.train_file, contaminated)
        self._write_manifest()
        with self.assertRaisesRegex(TRAINER.PreflightError, "row-schema-invalid-or-holdout"):
            TRAINER.validate_manifest(self.manifest_path)

    def test_preflight_rejects_unredacted_email_content(self):
        contaminated = [dict(self.training[0], prompt="Contact admin@example.com")] + self.training[1:]
        self._write_rows(self.train_file, contaminated)
        self.manifest["corpusFingerprint"] = TRAINER.corpus_fingerprint(contaminated, self.validation)
        self._write_manifest()
        with self.assertRaisesRegex(TRAINER.PreflightError, "potential-pii-or-secret"):
            TRAINER.validate_manifest(self.manifest_path)

    def test_preflight_rejects_corpus_fingerprint_mismatch(self):
        self.manifest["corpusFingerprint"] = "f" * 64
        self._write_manifest()
        with self.assertRaisesRegex(TRAINER.PreflightError, "corpus-fingerprint-mismatch"):
            TRAINER.validate_manifest(self.manifest_path)

    def test_qlora_is_preflightable_without_gpu_but_training_stays_offline(self):
        self.manifest["method"] = "qlora"
        self._write_manifest()
        result = TRAINER.validate_manifest(self.manifest_path)
        self.assertEqual(result["method"], "qlora")
        self.assertEqual(TRAINER.base_model_fingerprint(self.base), self.manifest["baseModelFingerprint"])

    def test_preflight_rejects_symlinked_corpus_input(self):
        linked = self.root / "train-linked.jsonl"
        linked.symlink_to(self.train_file)
        self.manifest["trainingFile"] = "train-linked.jsonl"
        self._write_manifest()
        with self.assertRaisesRegex(TRAINER.PreflightError, "symlink-path-component-rejected"):
            TRAINER.validate_manifest(self.manifest_path)

    def test_preflight_rejects_adapter_directory_identity_mismatch(self):
        self.manifest["adapterId"] = "different-adapter-id"
        self._write_manifest()
        with self.assertRaisesRegex(TRAINER.PreflightError, "adapter-output-directory-must-match-adapter-id"):
            TRAINER.validate_manifest(self.manifest_path)

    def test_preflight_rejects_symlinked_base_model_root(self):
        linked = self.root / "base-model-link"
        linked.symlink_to(self.base, target_is_directory=True)
        self.manifest["baseModelDirectory"] = str(linked)
        self._write_manifest()
        with self.assertRaisesRegex(TRAINER.PreflightError, "symlink-path-component-rejected"):
            TRAINER.validate_manifest(self.manifest_path)

    def test_model_fingerprint_rejects_symlinked_snapshot_directory(self):
        linked = self.base / "external-weights"
        linked.symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(TRAINER.PreflightError, "directory-symlink-rejected"):
            TRAINER.base_model_fingerprint(self.base)


if __name__ == "__main__":
    unittest.main()
