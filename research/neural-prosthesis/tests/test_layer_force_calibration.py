import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import torch
from safetensors import safe_open
from safetensors.torch import save_file
from torch import nn

from neural_prosthesis.calibration import (
    CalibrationError,
    calibrate_layer_force_profile,
    capture_layer_force_pairs,
)
from neural_prosthesis.engine import _config_digest, _model_config
from neural_prosthesis.layer_force import LayerForceBank


class TinyTokenizer:
    pad_token_id = 0

    def apply_chat_template(self, messages, *, tokenize, add_generation_prompt):
        return " ".join(message["content"] for message in messages)

    def __call__(self, prompt, *, return_tensors, truncation, max_length):
        # Deliberately encode only a tiny deterministic fixture. The capture API
        # must not persist this text or the token IDs in its activation artifact.
        values = [2 if "target" in prompt else 1, 3, 4]
        values = values[-max_length:]
        return {
            "input_ids": torch.tensor([values], dtype=torch.long),
            "attention_mask": torch.ones((1, len(values)), dtype=torch.long),
        }


class TinyModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.config = SimpleNamespace(to_dict=lambda: {
            "model_type": "layer-force-calibration-fixture",
            "hidden_size": 8,
        })
        self.embedding = nn.Embedding(8, 8)
        with torch.no_grad():
            self.embedding.weight.zero_()
            self.embedding.weight[1, 0] = 1.0
            self.embedding.weight[2, 0] = 1.0
            self.embedding.weight[2, 1] = 0.35
            self.embedding.weight[3, 2] = 1.0
            self.embedding.weight[4, 3] = 1.0
        self.layers = nn.ModuleList([nn.Identity(), nn.Identity(), nn.Identity()])
        self.anchor = nn.Parameter(torch.zeros(1))

    def forward(self, input_ids, attention_mask=None, *, output_hidden_states=False, use_cache=False, return_dict=True):
        hidden = self.embedding(input_ids)
        states = [hidden]
        for layer in self.layers:
            hidden = layer(hidden)
            states.append(hidden)
        return SimpleNamespace(hidden_states=tuple(states))


def activation_fixture(path: Path, *, reverse_validation=False, overlap=False):
    generator = torch.Generator().manual_seed(17)
    hidden_size = 8
    train_count = 8
    validation_count = 8
    direction = torch.tensor([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    tensors = {}
    for split, count, reverse in (
        ("train", train_count, False),
        ("validation", validation_count, reverse_validation),
    ):
        for layer in (1, 2):
            baseline = torch.randn(count, hidden_size, generator=generator) * 0.1
            noise = torch.randn(count, hidden_size, generator=generator) * 0.004
            target = baseline + (direction if not reverse else -direction) * 0.3 + noise
            tensors[f"{split}.baseline.layer_{layer}"] = baseline.contiguous()
            tensors[f"{split}.target.layer_{layer}"] = target.contiguous()

    train_pair_ids = [f"train-case-{i}" for i in range(train_count)]
    validation_pair_ids = [f"validation-case-{i}" for i in range(validation_count)]
    train_seed_ids = [f"train-seed-{i}" for i in range(train_count)]
    validation_seed_ids = [f"validation-seed-{i}" for i in range(validation_count)]
    if overlap:
        validation_seed_ids[0] = train_seed_ids[0]

    metadata = {
        "schema": "nk1-layer-force-activation-pairs-v1",
        "model_id": "nk1/layer-force-calibration-fixture",
        "model_revision": "a" * 40,
        "config_sha256": _config_digest(_model_config(TinyModel())),
        "layer_path": "layers",
        "hidden_size": str(hidden_size),
        "layer_count": "3",
        "layer_indices_json": json.dumps([1, 2]),
        "train_pair_ids_json": json.dumps(train_pair_ids),
        "train_seed_ids_json": json.dumps(train_seed_ids),
        "validation_pair_ids_json": json.dumps(validation_pair_ids),
        "validation_seed_ids_json": json.dumps(validation_seed_ids),
        "training_source_sha256": hashlib.sha256(b"train-source").hexdigest(),
        "validation_source_sha256": hashlib.sha256(b"validation-source").hexdigest(),
    }
    save_file(tensors, str(path), metadata=metadata)
    return metadata


class LayerForceCalibrationTests(unittest.TestCase):
    def test_capture_pools_hidden_states_without_persisting_prompt_or_token_data(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "captured.safetensors"
            examples = [
                {
                    "pair_id": f"case-{split}-{i}",
                    "seed_id": f"seed-{split}-{i}",
                    "baseline_messages": [{"role": "user", "content": "private baseline prompt"}],
                    "target_messages": [{"role": "user", "content": "private target prompt"}],
                }
                for split in ("train", "validation")
                for i in range(6)
            ]
            train = examples[:6]
            validation = examples[6:]
            capture_layer_force_pairs(
                TinyModel().eval(),
                TinyTokenizer(),
                train,
                validation,
                model_id="nk1/layer-force-calibration-fixture",
                model_revision="a" * 40,
                layer_path="layers",
                layer_indices=[1, 2],
                output_path=output,
                max_length=32,
            )
            self.assertTrue(output.is_file())
            with safe_open(str(output), framework="pt", device="cpu") as handle:
                metadata = handle.metadata()
                keys = set(handle.keys())
                self.assertEqual(keys, {
                    "train.baseline.layer_1", "train.target.layer_1",
                    "train.baseline.layer_2", "train.target.layer_2",
                    "validation.baseline.layer_1", "validation.target.layer_1",
                    "validation.baseline.layer_2", "validation.target.layer_2",
                })
                serialized_metadata = json.dumps(metadata)
                self.assertNotIn("private baseline prompt", serialized_metadata)
                self.assertNotIn("private target prompt", serialized_metadata)
                self.assertNotIn("input_ids", serialized_metadata)
                self.assertNotIn("token_ids", serialized_metadata)
                self.assertEqual(metadata["schema"], "nk1-layer-force-activation-pairs-v1")

    def test_capture_rejects_train_validation_seed_or_pair_overlap(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "captured.safetensors"
            train = [{
                "pair_id": f"same-case-{i}",
                "seed_id": f"same-seed-{i}",
                "baseline_messages": [{"role": "user", "content": "baseline"}],
                "target_messages": [{"role": "user", "content": "target"}],
            } for i in range(5)]
            validation = [{
                "pair_id": f"validation-case-{i}",
                "seed_id": f"validation-seed-{i}",
                "baseline_messages": [{"role": "user", "content": "baseline"}],
                "target_messages": [{"role": "user", "content": "target"}],
            } for i in range(5)]
            validation[0]["seed_id"] = train[0]["seed_id"]
            with self.assertRaisesRegex(CalibrationError, "split-overlap"):
                capture_layer_force_pairs(
                    TinyModel().eval(), TinyTokenizer(), train, validation,
                    model_id="nk1/layer-force-calibration-fixture",
                    model_revision="a" * 40, layer_path="layers",
                    layer_indices=[1], output_path=output, max_length=32,
                )
            self.assertFalse(output.exists())

    def test_calibrator_emits_a_holdout_gated_profile_admitted_by_layer_force_bank(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            activation_path = root / "pairs.safetensors"
            profile_path = root / "profile.json"
            report_path = root / "report.json"
            activation_fixture(activation_path)
            profile, report = calibrate_layer_force_profile(
                activation_path,
                profile_id="calibrated-reasoning-v1",
                output_profile=profile_path,
                output_report=report_path,
                max_delta_ratio=0.05,
                max_layers=4,
            )
            self.assertEqual(profile["schema_version"], 2)
            self.assertEqual(profile["calibration"]["method"], "paired-activation-mean-delta-v1")
            self.assertGreaterEqual(profile["calibration"]["validation_seed_count"], 5)
            self.assertGreater(profile["calibration"]["report_sha256"], "0" * 64)
            self.assertEqual(profile["calibration"]["report_sha256"], hashlib.sha256(report_path.read_bytes()).hexdigest())
            self.assertTrue(report["promotion_eligible"])
            self.assertTrue(all(layer["validation_ci95_lower"] > 0 for layer in report["selected_layers"]))

            raw_profile = profile_path.read_bytes()
            profile_digest = hashlib.sha256(raw_profile).hexdigest()
            model = TinyModel().eval()
            bank = LayerForceBank(
                model,
                model_id="nk1/layer-force-calibration-fixture",
                model_revision="a" * 40,
                layer_path="layers",
            )
            try:
                bank.load_profile(profile_path, [profile_digest])
                sample = torch.ones((1, 2, 8))
                baseline = model.layers[1](sample)
                with torch.inference_mode(), bank.activate("calibrated-reasoning-v1"):
                    steered = model.layers[1](sample)
                self.assertFalse(torch.equal(baseline, steered))
                actual_delta = torch.linalg.vector_norm(steered.float() - baseline.float(), dim=-1)
                allowed_delta = torch.linalg.vector_norm(baseline.float(), dim=-1) * 0.05
                self.assertTrue(torch.all(actual_delta <= allowed_delta + 1e-6))
            finally:
                bank.close()

    def test_calibrator_blocks_overlapping_seed_splits_and_never_writes_candidates(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            activation_path = root / "pairs.safetensors"
            profile_path = root / "profile.json"
            report_path = root / "report.json"
            activation_fixture(activation_path, overlap=True)
            with self.assertRaisesRegex(CalibrationError, "split-overlap"):
                calibrate_layer_force_profile(
                    activation_path,
                    profile_id="blocked-profile",
                    output_profile=profile_path,
                    output_report=report_path,
                )
            self.assertFalse(profile_path.exists())
            self.assertFalse(report_path.exists())

    def test_calibrator_rejects_a_direction_that_does_not_transfer_to_holdout(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            activation_path = root / "pairs.safetensors"
            profile_path = root / "profile.json"
            report_path = root / "report.json"
            activation_fixture(activation_path, reverse_validation=True)
            with self.assertRaisesRegex(CalibrationError, "holdout"):
                calibrate_layer_force_profile(
                    activation_path,
                    profile_id="overfit-profile",
                    output_profile=profile_path,
                    output_report=report_path,
                )
            self.assertFalse(profile_path.exists())
            self.assertFalse(report_path.exists())

    def test_capture_rejects_fewer_than_five_independent_pairs_per_split(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "captured.safetensors"
            def records(prefix, count):
                return [{
                    "pair_id": f"{prefix}-case-{i}",
                    "seed_id": f"{prefix}-seed-{i}",
                    "baseline_messages": [{"role": "user", "content": "baseline"}],
                    "target_messages": [{"role": "user", "content": "target"}],
                } for i in range(count)]
            with self.assertRaisesRegex(CalibrationError, "minimum-five"):
                capture_layer_force_pairs(
                    TinyModel().eval(), TinyTokenizer(), records("train", 4), records("validation", 5),
                    model_id="nk1/layer-force-calibration-fixture",
                    model_revision="a" * 40, layer_path="layers",
                    layer_indices=[1], output_path=output, max_length=32,
                )
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
