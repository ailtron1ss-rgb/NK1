import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from neural_prosthesis.engine import ArtifactError, NeuralProsthesisBank  # noqa: E402


class TinyBlock(nn.Module):
    def __init__(self, hidden_size: int, seed: int):
        super().__init__()
        torch.manual_seed(seed)
        self.projection = nn.Linear(hidden_size, hidden_size)
        self.norm = nn.LayerNorm(hidden_size)

    def forward(self, hidden):
        projected = self.norm(self.projection(hidden))
        return projected, hidden.mean(dim=-1, keepdim=True)


class TinyModel(nn.Module):
    def __init__(self, hidden_size: int = 8):
        super().__init__()
        self.config = SimpleNamespace(
            model_type="tiny-test-transformer",
            hidden_size=hidden_size,
            architectures=["TinyModel"],
            to_dict=lambda: {
                "model_type": "tiny-test-transformer",
                "hidden_size": hidden_size,
                "architectures": ["TinyModel"],
            },
        )
        self.layers = nn.ModuleList([TinyBlock(hidden_size, i + 1) for i in range(3)])

    def forward(self, hidden):
        auxiliaries = []
        for layer in self.layers:
            hidden, auxiliary = layer(hidden)
            auxiliaries.append(auxiliary)
        return hidden, auxiliaries


class NeuralProsthesisEngineTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(21)
        self.model = TinyModel()
        self.bank = NeuralProsthesisBank(
            self.model,
            model_id="nk1/tiny-test",
            model_revision="a" * 40,
            layer_path="layers",
        )
        self.bank.add_adapter("kurisu-reasoning-v1", layer_indices=[1], bottleneck_size=4)

    def tearDown(self):
        self.bank.close()

    def test_zero_initialized_residual_is_exact_identity_and_can_be_disabled(self):
        sample = torch.randn(2, 5, 8)
        baseline, _ = self.model(sample)
        with self.bank.activate("kurisu-reasoning-v1"):
            initial, _ = self.model(sample)
        self.assertTrue(torch.equal(baseline, initial))

        branch = self.bank.adapters["kurisu-reasoning-v1"]["layer_1"]
        with torch.no_grad():
            branch.up.weight.fill_(0.025)
            branch.up.bias.fill_(0.01)
        with self.bank.activate("kurisu-reasoning-v1"):
            adapted, adapted_aux = self.model(sample)
        disabled, disabled_aux = self.model(sample)
        self.assertFalse(torch.allclose(baseline, adapted))
        self.assertTrue(torch.equal(baseline, disabled))
        self.assertEqual(len(adapted_aux), 3)
        self.assertEqual(len(disabled_aux), 3)

    def test_residual_is_bounded_and_adapter_contexts_are_isolated(self):
        self.bank.add_adapter("kurisu-style-v1", layer_indices=[0, 2], bottleneck_size=3)
        sample = torch.randn(2, 4, 8)
        base, _ = self.model(sample)
        for adapter_id in ("kurisu-reasoning-v1", "kurisu-style-v1"):
            with torch.no_grad():
                for branch in self.bank.adapters[adapter_id].values():
                    branch.up.weight.fill_(4.0)
                    branch.up.bias.fill_(4.0)
        with self.bank.activate("kurisu-reasoning-v1"):
            first, _ = self.model(sample)
        with self.bank.activate("kurisu-style-v1"):
            second, _ = self.model(sample)
        self.assertFalse(torch.allclose(first, second))
        self.assertTrue(torch.equal(base, self.model(sample)[0]))
        branch = self.bank.adapters["kurisu-reasoning-v1"]["layer_1"]
        probe = torch.randn(2, 4, 8)
        residual_output = branch(probe)
        delta = (residual_output - probe).float().norm(dim=-1)
        base_norm = probe.float().norm(dim=-1).clamp_min(1e-6)
        self.assertTrue(torch.all(delta <= base_norm * 0.251))

    def test_adapter_artifact_round_trip_is_bound_to_exact_model_revision(self):
        with tempfile.TemporaryDirectory() as tmp:
            artifact = Path(tmp) / "adapter"
            branch = self.bank.adapters["kurisu-reasoning-v1"]["layer_1"]
            with torch.no_grad():
                branch.up.weight.normal_(mean=0.0, std=0.01)
                branch.up.bias.normal_(mean=0.0, std=0.01)
            manifest = self.bank.save_adapter("kurisu-reasoning-v1", artifact)
            self.assertEqual(manifest["status"], "candidate")
            self.assertEqual(len(manifest["manifest_sha256"]), 64)

            second_model = TinyModel()
            second_bank = NeuralProsthesisBank(
                second_model,
                model_id="nk1/tiny-test",
                model_revision="a" * 40,
                layer_path="layers",
            )
            try:
                loaded = second_bank.load_adapter(artifact)
                self.assertEqual(loaded, "kurisu-reasoning-v1")
                sample = torch.randn(1, 3, 8)
                with self.bank.activate("kurisu-reasoning-v1"):
                    expected, _ = self.model(sample)
                with second_bank.activate(loaded):
                    actual, _ = second_model(sample)
                self.assertTrue(torch.allclose(expected, actual, atol=1e-6))
            finally:
                second_bank.close()

            mismatched = NeuralProsthesisBank(
                TinyModel(),
                model_id="nk1/tiny-test",
                model_revision="b" * 40,
                layer_path="layers",
            )
            try:
                with self.assertRaises(ArtifactError):
                    mismatched.load_adapter(artifact)
            finally:
                mismatched.close()

    def test_corrupt_weights_and_invalid_layer_targets_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            artifact = Path(tmp) / "adapter"
            self.bank.save_adapter("kurisu-reasoning-v1", artifact)
            weights = artifact / "adapter.safetensors"
            weights.write_bytes(weights.read_bytes() + b"tamper")
            bad_bank = NeuralProsthesisBank(
                TinyModel(),
                model_id="nk1/tiny-test",
                model_revision="a" * 40,
                layer_path="layers",
            )
            try:
                with self.assertRaises(ArtifactError):
                    bad_bank.load_adapter(artifact)
            finally:
                bad_bank.close()

        other = NeuralProsthesisBank(
            TinyModel(),
            model_id="nk1/tiny-test",
            model_revision="a" * 40,
            layer_path="layers",
        )
        try:
            with self.assertRaises(ArtifactError):
                other.add_adapter("invalid", layer_indices=[99], bottleneck_size=4)
            with self.assertRaises(ArtifactError):
                other.add_adapter("../escape", layer_indices=[0], bottleneck_size=4)
        finally:
            other.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
