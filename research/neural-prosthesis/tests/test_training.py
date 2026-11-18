import sys
import tempfile
import unittest
from pathlib import Path

import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from neural_prosthesis.training import (  # noqa: E402
    MAX_DATASET_BYTES,
    MIN_HOLDOUT_EXAMPLES_FOR_REVIEW,
    ValidationEarlyStopping,
    dataset_fingerprint,
    ensure_holdout_is_distinct,
    paired_bootstrap_mean_interval,
    read_jsonl,
)


class NeuralProsthesisTrainingUtilityTests(unittest.TestCase):
    def test_validation_early_stopping_restores_the_best_adapter_checkpoint(self):
        module = nn.Linear(2, 2, bias=False)
        stopping = ValidationEarlyStopping(patience=2, min_delta=0.01)
        original = module.weight.detach().clone()

        self.assertFalse(stopping.update(1, 1.0, module))
        with torch.no_grad():
            module.weight.add_(2.0)
        # Improvement smaller than min_delta is not considered progress.
        self.assertFalse(stopping.update(2, 0.995, module))
        with torch.no_grad():
            module.weight.add_(3.0)
        self.assertTrue(stopping.update(3, 0.996, module))
        self.assertEqual(stopping.best_epoch, 1)
        self.assertEqual(stopping.restore(module), 1)
        self.assertTrue(torch.equal(module.weight, original))

    def test_validation_early_stopping_resets_patience_on_material_improvement(self):
        module = nn.Linear(1, 1)
        stopping = ValidationEarlyStopping(patience=2, min_delta=0.01)
        self.assertFalse(stopping.update(1, 1.0, module))
        self.assertFalse(stopping.update(2, 0.8, module))
        self.assertFalse(stopping.update(3, 0.81, module))
        self.assertTrue(stopping.update(4, 0.82, module))
        self.assertEqual(stopping.best_epoch, 2)
        self.assertEqual(stopping.restore(module), 2)

    def test_validation_early_stopping_rejects_non_finite_validation_loss(self):
        module = nn.Linear(1, 1)
        stopping = ValidationEarlyStopping(patience=2)
        with self.assertRaisesRegex(ValueError, "validation-loss-must-be-finite"):
            stopping.update(1, float("nan"), module)

    def test_human_review_requires_a_minimum_holdout_sample_count(self):
        self.assertEqual(MIN_HOLDOUT_EXAMPLES_FOR_REVIEW, 30)

    def test_training_and_holdout_file_fingerprints_must_differ(self):
        digest = "a" * 64
        with self.assertRaisesRegex(ValueError, "holdout-dataset-matches-training-dataset"):
            ensure_holdout_is_distinct(digest, digest)
        ensure_holdout_is_distinct(digest, "b" * 64)
        ensure_holdout_is_distinct(None, "c" * 64)

    def test_paired_bootstrap_interval_is_deterministic_and_directional(self):
        improving = paired_bootstrap_mean_interval(
            [-0.4, -0.2, -0.3, -0.1, -0.5],
            bootstrap_samples=500,
            seed=17,
        )
        repeated = paired_bootstrap_mean_interval(
            [-0.4, -0.2, -0.3, -0.1, -0.5],
            bootstrap_samples=500,
            seed=17,
        )
        self.assertEqual(improving, repeated)
        self.assertLess(improving["upper"], 0)
        regressing = paired_bootstrap_mean_interval(
            [0.1, 0.2, 0.3, 0.4, 0.5],
            bootstrap_samples=500,
            seed=17,
        )
        self.assertGreater(regressing["lower"], 0)

    def test_dataset_fingerprint_rejects_oversized_sources_before_hashing(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "oversized.jsonl"
            with source.open("wb") as handle:
                handle.truncate(MAX_DATASET_BYTES + 1)
            with self.assertRaisesRegex(ValueError, "dataset-missing-or-too-large"):
                dataset_fingerprint(source)

    def test_jsonl_loader_rejects_duplicate_object_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "duplicate.jsonl"
            source.write_text(
                '{"prompt":"original","prompt":"overridden","completion":"answer"}\\n',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "dataset-json-duplicate-key"):
                read_jsonl(source)

    def test_jsonl_loader_enforces_a_caller_supplied_example_cap(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "pairs.jsonl"
            source.write_text(
                '{"prompt":"p1","completion":"c1"}\n'
                '{"prompt":"p2","completion":"c2"}\n',
                encoding="utf-8",
            )
            self.assertEqual(len(read_jsonl(source, max_examples=2)), 2)
            with self.assertRaisesRegex(ValueError, "dataset-example-limit-exceeded"):
                read_jsonl(source, max_examples=1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
