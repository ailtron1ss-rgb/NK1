import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from neural_prosthesis.training import (  # noqa: E402
    ensure_holdout_is_distinct,
    paired_bootstrap_mean_interval,
    read_jsonl,
)


class NeuralProsthesisTrainingUtilityTests(unittest.TestCase):
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
