"""CPU end-to-end smoke for the real offline LoRA training/export path.

This deliberately builds a tiny local GPT-2-compatible model from random weights.
It performs no downloads and is not a quality benchmark or a substitute for
production GPU/QLoRA validation.
"""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

import torch
from peft import PeftModel
from tokenizers import Tokenizer, models, pre_tokenizers, processors
from transformers import GPT2Config, GPT2LMHeadModel, PreTrainedTokenizerFast

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "neuro_plastic_train.py"
SPEC = importlib.util.spec_from_file_location("neuro_plastic_train_smoke", MODULE_PATH)
TRAINER = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(TRAINER)


class NeuroPlasticTrainerCpuSmokeTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(1)
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.base = self.root / "base-model"
        self.base.mkdir()

        tokens = [
            "<pad>", "[UNK]", "<bos>", "<eos>", "Question", "Validation",
            "sample", "answer", "Verified", "result", "number",
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        ]
        vocab = {token: index for index, token in enumerate(tokens)}
        backend = Tokenizer(models.WordLevel(vocab=vocab, unk_token="[UNK]"))
        backend.pre_tokenizer = pre_tokenizers.WhitespaceSplit()
        backend.post_processor = processors.TemplateProcessing(
            single="<bos> $A",
            pair="<bos> $A $B",
            special_tokens=[("<bos>", vocab["<bos>"])],
        )
        tokenizer = PreTrainedTokenizerFast(
            tokenizer_object=backend,
            bos_token="<bos>",
            eos_token="<eos>",
            pad_token="<pad>",
            unk_token="[UNK]",
            clean_up_tokenization_spaces=False,
        )
        tokenizer.save_pretrained(self.base)

        config = GPT2Config(
            vocab_size=len(vocab),
            n_positions=64,
            n_ctx=64,
            n_embd=32,
            n_layer=1,
            n_head=2,
            bos_token_id=vocab["<bos>"],
            eos_token_id=vocab["<eos>"],
            pad_token_id=vocab["<pad>"],
        )
        GPT2LMHeadModel(config).save_pretrained(self.base, safe_serialization=True)

        self.training = [
            {
                "exampleId": f"train-{index}",
                "domain": "reasoning",
                "prompt": f"Question sample {index}",
                "completion": f"Verified result {index}",
            }
            for index in range(5)
        ]
        self.validation = [
            {
                "exampleId": f"validation-{index}",
                "domain": "reasoning",
                "prompt": f"Validation sample {index + 5}",
                "completion": f"Verified answer {index + 5}",
            }
            for index in range(2)
        ]
        self._write_rows(self.root / "train.jsonl", self.training)
        self._write_rows(self.root / "validation.jsonl", self.validation)

        self.manifest_path = self.root / "manifest.json"
        self.manifest = {
            "schemaVersion": 1,
            "method": "lora",
            "domain": "reasoning",
            "adapterId": "tiny-gpt2-smoke-v1",
            "baseModelId": "nk1-tiny-gpt2-smoke",
            "backendId": "llama.cpp",
            "baseModelAlias": "tiny-gpt2-base",
            "servedModelAlias": "tiny-gpt2-reasoning",
            "governance": {
                "trainingOptIn": True,
                "privacyReviewed": True,
                "licenseApproved": True,
                "piiScreening": "passed",
                "evidenceCount": 7,
                "attestedBy": "ci-smoke-reviewer",
                "attestedAt": 1_800_000_000_000,
                "licenseId": "synthetic-ci-fixture",
            },
            "baseModelDirectory": "base-model",
            "baseModelFingerprint": TRAINER.base_model_fingerprint(self.base),
            "tokenizerFingerprint": TRAINER.tokenizer_fingerprint(self.base),
            "sourceDatasetFingerprint": "a" * 64,
            "holdoutPlanFingerprint": "b" * 64,
            "trainingFile": "train.jsonl",
            "validationFile": "validation.jsonl",
            "corpusFingerprint": TRAINER.corpus_fingerprint(self.training, self.validation),
            "outputDirectory": "adapter-store/tiny-gpt2-smoke-v1",
            "seed": 41,
            "maxSequenceLength": 256,
            "epochs": 1,
            "learningRate": 0.0005,
            "lora": {"rank": 2, "alpha": 4, "dropout": 0.0},
        }
        self.manifest_path.write_text(
            json.dumps(self.manifest, ensure_ascii=False, sort_keys=True),
            encoding="utf-8",
        )

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def _write_rows(path: Path, rows: list[dict[str, str]]) -> None:
        path.write_text(
            "".join(
                json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n"
                for row in rows
            ),
            encoding="utf-8",
        )

    def test_trains_exports_and_reloads_a_real_local_lora_adapter(self):
        before = TRAINER.base_model_fingerprint(self.base)
        validated = TRAINER.validate_manifest(self.manifest_path)

        metadata = TRAINER.train_adapter(validated)

        output = self.root / "adapter-store" / "tiny-gpt2-smoke-v1"
        self.assertEqual(TRAINER.base_model_fingerprint(self.base), before)
        self.assertTrue((output / "adapter_config.json").is_file())
        self.assertTrue((output / "adapter_model.safetensors").is_file())
        self.assertTrue((output / "neuro-plastic-artifact.json").is_file())
        self.assertTrue((output / "neuro-plastic-registry-manifest.json").is_file())
        self.assertFalse((output / "model.safetensors").exists())
        self.assertFalse(metadata["automaticActivation"])
        self.assertGreater(metadata["trainingMetrics"]["globalStep"], 0)
        self.assertTrue(torch.isfinite(torch.tensor(metadata["trainingMetrics"]["train_loss"])).item())
        self.assertTrue(torch.isfinite(torch.tensor(metadata["validationMetrics"]["eval_loss"])).item())

        for filename in ("adapter_config.json", "adapter_model.safetensors"):
            expected = metadata["artifacts"][filename]["sha256"]
            self.assertEqual(TRAINER.sha256_file(output / filename), expected)

        base_model = GPT2LMHeadModel.from_pretrained(
            self.base,
            local_files_only=True,
            trust_remote_code=False,
        )
        loaded = PeftModel.from_pretrained(base_model, output, is_trainable=False)
        loaded.eval()
        tokenizer = PreTrainedTokenizerFast.from_pretrained(
            self.base,
            local_files_only=True,
            trust_remote_code=False,
        )
        inputs = tokenizer("Question sample 0", return_tensors="pt")
        with torch.inference_mode():
            logits = loaded(**inputs).logits
        self.assertEqual(logits.shape[0], 1)
        self.assertTrue(torch.isfinite(logits).all().item())


if __name__ == "__main__":
    unittest.main()
