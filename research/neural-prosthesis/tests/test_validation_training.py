import sys
import unittest
from pathlib import Path

import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from neural_prosthesis import training  # noqa: E402


class ValidationEarlyStoppingTests(unittest.TestCase):
    def test_best_adapter_checkpoint_is_restored_after_patience_is_exhausted(self):
        controller_type = getattr(training, "ValidationEarlyStopping", None)
        self.assertTrue(
            callable(controller_type),
            "training must expose ValidationEarlyStopping for validation-driven checkpoint recovery",
        )
        if controller_type is None:
            return

        adapter = nn.Linear(2, 1, bias=False)
        with torch.no_grad():
            adapter.weight.copy_(torch.tensor([[1.0, 2.0]]))
        stopping = controller_type(patience=2, min_delta=0.01)

        self.assertFalse(stopping.update(1, 0.50, adapter))
        with torch.no_grad():
            adapter.weight.fill_(3.0)
        self.assertFalse(stopping.update(2, 0.48, adapter))
        best_state = {name: value.detach().clone() for name, value in adapter.state_dict().items()}

        with torch.no_grad():
            adapter.weight.fill_(4.0)
        self.assertFalse(stopping.update(3, 0.50, adapter))
        with torch.no_grad():
            adapter.weight.fill_(5.0)
        self.assertTrue(stopping.update(4, 0.51, adapter))

        stopping.restore(adapter)
        for name, value in adapter.state_dict().items():
            self.assertTrue(torch.equal(value, best_state[name]))
        self.assertEqual(stopping.best_epoch, 2)
        self.assertEqual(stopping.bad_epochs, 2)

    def test_early_stopping_rejects_non_finite_validation_loss(self):
        controller_type = getattr(training, "ValidationEarlyStopping", None)
        self.assertTrue(callable(controller_type), "validation checkpoint controller is required")
        if controller_type is None:
            return
        stopping = controller_type(patience=2, min_delta=0.0)
        with self.assertRaisesRegex(ValueError, "validation-loss-must-be-finite"):
            stopping.update(1, float("nan"), nn.Linear(1, 1))

    def test_holdout_must_be_distinct_from_both_training_and_validation(self):
        checker = getattr(training, "ensure_holdout_is_distinct", None)
        self.assertTrue(callable(checker), "holdout separation guard is required")
        if checker is None:
            return
        train_digest = "a" * 64
        validation_digest = "b" * 64
        holdout_digest = "c" * 64
        checker(train_digest, holdout_digest, validation_digest=validation_digest)
        with self.assertRaisesRegex(ValueError, "holdout-dataset-matches-validation-dataset"):
            checker(train_digest, validation_digest, validation_digest=validation_digest)


if __name__ == "__main__":
    unittest.main(verbosity=2)
