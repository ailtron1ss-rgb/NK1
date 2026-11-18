#!/usr/bin/env python3
"""Offline LoRA/QLoRA trainer for NK1 Neuro-Plastic Core.

The trainer consumes a consent-reviewed JSONL corpus and a local base-model
snapshot. It never downloads models, never receives holdout examples, and
writes only a PEFT adapter into a separate adapter-store directory.
"""
from __future__ import annotations

import argparse
import hashlib
import inspect
import importlib.metadata
import math
import platform
import json
import os
import re
import shutil
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("WANDB_DISABLED", "true")

HASH_RE = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
SECRET_RE = re.compile(
    r"\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|"
    r"github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|"
    r"Bearer\s+[A-Za-z0-9._~+/-]{16,})\b",
    re.IGNORECASE,
)
TOKENIZER_NAMES = {
    "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json",
    "tokenizer.model", "spiece.model", "vocab.json", "merges.txt",
    "added_tokens.json", "chat_template.jinja",
}
MANIFEST_KEYS = {
    "schemaVersion", "method", "domain", "adapterId",
    "baseModelId", "backendId", "baseModelAlias", "servedModelAlias", "governance",
    "baseModelDirectory", "baseModelFingerprint", "tokenizerFingerprint",
    "sourceDatasetFingerprint", "holdoutPlanFingerprint",
    "trainingFile", "validationFile", "corpusFingerprint", "outputDirectory",
    "seed", "maxSequenceLength", "epochs", "learningRate", "lora",
}


class PreflightError(ValueError):
    """A rejected local training input."""


def json_safe(value: Any) -> Any:
    """Convert training metrics to strict JSON without NaN/Infinity values."""
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if value is None or isinstance(value, (str, int, bool)):
        return value
    scalar = getattr(value, "item", None)
    if callable(scalar):
        try:
            return json_safe(scalar())
        except (TypeError, ValueError):
            pass
    return str(value)


def package_version(name: str) -> str:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return "not-installed"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _reject_symlink_ancestors(path: Path) -> None:
    absolute = path.absolute()
    cursor = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        cursor = cursor / part
        try:
            info = cursor.lstat()
        except FileNotFoundError:
            raise PreflightError("path-component-missing")
        if cursor.is_symlink():
            raise PreflightError("symlink-path-component-rejected")


def fingerprint_files(root: Path, predicate=lambda _relative: True) -> str:
    _reject_symlink_ancestors(root)
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise PreflightError("base-model-directory-invalid")
    entries: list[tuple[str, Path]] = []
    for current, directories, filenames in os.walk(root, followlinks=False):
        for name in directories:
            if (Path(current) / name).is_symlink():
                raise PreflightError("model-snapshot-directory-symlink-rejected")
        directories[:] = sorted(name for name in directories if name not in {".cache", "__pycache__"})
        for filename in sorted(filenames):
            path = Path(current) / filename
            if path.is_symlink():
                raise PreflightError("model-snapshot-symlink-rejected")
            relative = path.relative_to(root).as_posix()
            if filename.endswith((".lock", ".tmp", ".partial")):
                continue
            if predicate(relative):
                entries.append((relative, path))
    if not entries:
        raise PreflightError("model-snapshot-has-no-fingerprintable-files")
    digest = hashlib.sha256()
    for relative, path in sorted(entries):
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(sha256_file(path).encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def base_model_fingerprint(root: Path) -> str:
    return fingerprint_files(root)


def tokenizer_fingerprint(root: Path) -> str:
    return fingerprint_files(root, lambda relative: Path(relative).name in TOKENIZER_NAMES)


def _safe_child(root: Path, relative: Any, label: str, must_exist: bool) -> Path:
    if not isinstance(relative, str) or not relative or relative.strip() != relative:
        raise PreflightError(label + "-path-invalid")
    candidate = Path(relative)
    if candidate.is_absolute() or any(part in {"", ".", ".."} for part in candidate.parts):
        raise PreflightError(label + "-path-traversal-rejected")
    root_resolved = root.resolve(strict=True)
    cursor = root_resolved
    parts = candidate.parts
    for index, part in enumerate(parts):
        cursor = cursor / part
        try:
            cursor_info = cursor.lstat()
        except FileNotFoundError:
            if must_exist:
                raise PreflightError(label + "-path-component-missing")
            break
        if cursor.is_symlink():
            raise PreflightError(label + "-symlink-path-component-rejected")
        if index < len(parts) - 1 and not cursor.is_dir():
            raise PreflightError(label + "-path-parent-not-directory")
    result = (root_resolved / candidate).resolve(strict=must_exist)
    if not result.is_relative_to(root_resolved):
        raise PreflightError(label + "-path-escapes-manifest-root")
    if must_exist and (not result.is_file() or result.is_symlink()):
        raise PreflightError(label + "-file-invalid")
    return result


def _safe_hash(value: Any, label: str) -> str:
    if not isinstance(value, str) or not HASH_RE.fullmatch(value):
        raise PreflightError(label + "-sha256-invalid")
    return value.lower()


def _read_jsonl(path: Path, label: str, domain: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    with path.open("r", encoding="utf-8") as stream:
        for line_number, raw in enumerate(stream, 1):
            if not raw.strip():
                continue
            try:
                row = json.loads(raw)
            except json.JSONDecodeError as error:
                raise PreflightError(f"{label}-jsonl-invalid-line-{line_number}") from error
            if not isinstance(row, dict):
                raise PreflightError(label + "-row-must-be-object")
            if set(row) != {"exampleId", "domain", "prompt", "completion"}:
                raise PreflightError(label + "-row-schema-invalid-or-holdout-field-present")
            if row["domain"] != domain:
                raise PreflightError(label + "-row-domain-mismatch")
            for key in ("exampleId", "prompt", "completion"):
                value = row[key]
                if not isinstance(value, str) or not value or value.strip() != value:
                    raise PreflightError(label + "-row-" + key + "-invalid")
            if len(row["prompt"]) + len(row["completion"]) > 20_000:
                raise PreflightError(label + "-row-too-large")
            if EMAIL_RE.search(row["prompt"]) or EMAIL_RE.search(row["completion"]) or \
                    SECRET_RE.search(row["prompt"]) or SECRET_RE.search(row["completion"]):
                raise PreflightError(label + "-potential-pii-or-secret-detected")
            if row["exampleId"] in seen:
                raise PreflightError(label + "-duplicate-example-id")
            seen.add(row["exampleId"])
            rows.append({
                "exampleId": row["exampleId"],
                "domain": row["domain"],
                "prompt": row["prompt"],
                "completion": row["completion"],
            })
    return rows


def corpus_fingerprint(training: list[dict[str, str]], validation: list[dict[str, str]]) -> str:
    def serialize(rows: list[dict[str, str]]) -> str:
        return "".join(
            json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
            for row in rows
        )
    payload = serialize(training) + "\n--validation--\n" + serialize(validation)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def validate_governance(raw: Any, minimum_evidence: int) -> dict[str, Any]:
    required = {
        "trainingOptIn", "privacyReviewed", "licenseApproved", "piiScreening",
        "evidenceCount", "attestedBy", "attestedAt", "licenseId",
    }
    if not isinstance(raw, dict) or set(raw) != required:
        raise PreflightError("governance-attestation-schema-invalid")
    if raw["trainingOptIn"] is not True or raw["privacyReviewed"] is not True or \
            raw["licenseApproved"] is not True or raw["piiScreening"] != "passed":
        raise PreflightError("governance-explicit-consent-and-review-required")
    evidence_count = raw["evidenceCount"]
    if not isinstance(evidence_count, int) or isinstance(evidence_count, bool) or evidence_count < minimum_evidence:
        raise PreflightError("governance-evidence-count-insufficient")
    attested_at = raw["attestedAt"]
    if not isinstance(attested_at, int) or isinstance(attested_at, bool) or attested_at <= 0:
        raise PreflightError("governance-attestation-time-invalid")
    attested_by = raw["attestedBy"]
    license_id = raw["licenseId"]
    if not isinstance(attested_by, str) or not attested_by.strip() or len(attested_by) > 160 or \
            not isinstance(license_id, str) or not license_id.strip() or len(license_id) > 240:
        raise PreflightError("governance-attestor-or-license-invalid")
    return {
        "trainingOptIn": True,
        "privacyReviewed": True,
        "licenseApproved": True,
        "piiScreening": "passed",
        "evidenceCount": evidence_count,
        "attestedBy": attested_by,
        "attestedAt": attested_at,
        "licenseId": license_id,
    }


def validate_identifier(value: Any, label: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,159}", value):
        raise PreflightError(label + "-identifier-invalid")
    return value


def validate_manifest(manifest_path: Path) -> dict[str, Any]:
    manifest_path = manifest_path.resolve(strict=True)
    if not manifest_path.is_file():
        raise PreflightError("manifest-file-invalid")
    root = manifest_path.parent
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PreflightError("manifest-json-invalid") from error
    if not isinstance(manifest, dict) or set(manifest) != MANIFEST_KEYS:
        raise PreflightError("manifest-schema-invalid-or-unexpected-holdout-field")
    if manifest.get("schemaVersion") != 1 or manifest.get("method") not in {"lora", "qlora"}:
        raise PreflightError("manifest-version-or-method-invalid")

    base_raw = manifest.get("baseModelDirectory")
    if not isinstance(base_raw, str) or not base_raw:
        raise PreflightError("base-model-directory-required")
    base_candidate = Path(base_raw)
    if not base_candidate.is_absolute():
        base_candidate = root / base_candidate
    _reject_symlink_ancestors(base_candidate)
    base = base_candidate.resolve(strict=True)
    if not base.is_dir():
        raise PreflightError("base-model-directory-invalid")
    expected_base = _safe_hash(manifest.get("baseModelFingerprint"), "base-model")
    actual_base = base_model_fingerprint(base)
    if actual_base != expected_base:
        raise PreflightError("base-model-fingerprint-mismatch")
    expected_tokenizer = _safe_hash(manifest.get("tokenizerFingerprint"), "tokenizer")
    actual_tokenizer = tokenizer_fingerprint(base)
    if actual_tokenizer != expected_tokenizer:
        raise PreflightError("tokenizer-fingerprint-mismatch")
    source_dataset_fingerprint = _safe_hash(manifest.get("sourceDatasetFingerprint"), "source-dataset")
    holdout_plan_fingerprint = _safe_hash(manifest.get("holdoutPlanFingerprint"), "holdout-plan")
    governance = validate_governance(manifest.get("governance"), len(training) + len(validation))

    train_path = _safe_child(root, manifest.get("trainingFile"), "training", True)
    validation_path = _safe_child(root, manifest.get("validationFile"), "validation", True)
    if train_path == validation_path:
        raise PreflightError("train-validation-file-alias-rejected")
    output_raw = manifest.get("outputDirectory")
    if not isinstance(output_raw, str) or not output_raw.startswith("adapter-store/"):
        raise PreflightError("adapter-output-must-use-adapter-store")
    output_path = _safe_child(root, output_raw, "adapter-output", False)
    adapter_id = manifest.get("adapterId")
    if not isinstance(adapter_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{2,79}", adapter_id):
        raise PreflightError("adapter-id-invalid")
    if output_path.name != adapter_id:
        raise PreflightError("adapter-output-directory-must-match-adapter-id")
    base_model_id = validate_identifier(manifest.get("baseModelId"), "base-model")
    backend_id = validate_identifier(manifest.get("backendId"), "backend")
    base_model_alias = validate_identifier(manifest.get("baseModelAlias"), "base-model-alias")
    served_model_alias = validate_identifier(manifest.get("servedModelAlias"), "served-model-alias")
    if output_path.exists():
        raise PreflightError("adapter-output-already-exists")
    if output_path.is_relative_to(base) or base.is_relative_to(output_path):
        raise PreflightError("adapter-output-must-be-separate-from-base-model")

    domain = manifest.get("domain")
    if not isinstance(domain, str) or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,63}", domain):
        raise PreflightError("training-domain-invalid")
    training = _read_jsonl(train_path, "training", domain)
    validation = _read_jsonl(validation_path, "validation", manifest.get("domain", ""))
    if len(training) < 5 or len(validation) < 2:
        raise PreflightError("minimum-training-or-validation-example-count-not-met")
    all_ids = [row["exampleId"] for row in training + validation]
    if len(set(all_ids)) != len(all_ids):
        raise PreflightError("train-validation-example-overlap")
    expected_corpus = _safe_hash(manifest.get("corpusFingerprint"), "corpus")
    actual_corpus = corpus_fingerprint(training, validation)
    if actual_corpus != expected_corpus:
        raise PreflightError("corpus-fingerprint-mismatch")

    seed = manifest.get("seed")
    if not isinstance(seed, int) or isinstance(seed, bool) or seed < 0:
        raise PreflightError("training-seed-invalid")
    sequence = manifest.get("maxSequenceLength")
    if not isinstance(sequence, int) or isinstance(sequence, bool) or not 256 <= sequence <= 8192:
        raise PreflightError("max-sequence-length-out-of-range")
    epochs = manifest.get("epochs")
    learning_rate = manifest.get("learningRate")
    if not isinstance(epochs, (int, float)) or isinstance(epochs, bool) or not 0.25 <= epochs <= 10:
        raise PreflightError("training-epochs-out-of-range")
    if not isinstance(learning_rate, (int, float)) or isinstance(learning_rate, bool) or \
            not 1e-6 <= learning_rate <= 5e-3:
        raise PreflightError("learning-rate-out-of-range")
    lora = manifest.get("lora")
    if not isinstance(lora, dict) or set(lora) != {"rank", "alpha", "dropout"}:
        raise PreflightError("lora-config-invalid")
    if not isinstance(lora["rank"], int) or isinstance(lora["rank"], bool) or not 1 <= lora["rank"] <= 128:
        raise PreflightError("lora-rank-out-of-range")
    if not isinstance(lora["alpha"], int) or isinstance(lora["alpha"], bool) or not 1 <= lora["alpha"] <= 256:
        raise PreflightError("lora-alpha-out-of-range")
    if not isinstance(lora["dropout"], (int, float)) or isinstance(lora["dropout"], bool) or \
            not 0 <= lora["dropout"] <= 0.3:
        raise PreflightError("lora-dropout-out-of-range")

    return {
        "manifest": manifest,
        "root": root,
        "base": base,
        "training": training,
        "validation": validation,
        "output": output_path,
        "adapterId": adapter_id,
        "baseModelId": base_model_id,
        "backendId": backend_id,
        "baseModelAlias": base_model_alias,
        "servedModelAlias": served_model_alias,
        "governance": governance,
        "baseFingerprint": actual_base,
        "tokenizerFingerprint": actual_tokenizer,
        "sourceDatasetFingerprint": source_dataset_fingerprint,
        "holdoutPlanFingerprint": holdout_plan_fingerprint,
        "corpusFingerprint": actual_corpus,
        "domain": training[0]["domain"],
        "method": manifest["method"],
    }


def _tokenize_rows(rows: list[dict[str, str]], tokenizer: Any, max_length: int) -> Any:
    from datasets import Dataset

    encoded: list[dict[str, list[int]]] = []
    for row in rows:
        prompt_ids = tokenizer(row["prompt"], add_special_tokens=True, truncation=False)["input_ids"]
        completion_ids = tokenizer(
            row["completion"] + (tokenizer.eos_token or ""),
            add_special_tokens=False,
            truncation=False,
        )["input_ids"]
        if not completion_ids:
            raise PreflightError("empty-completion-after-tokenization")
        if len(completion_ids) >= max_length:
            completion_ids = completion_ids[: max_length - 1]
        prompt_budget = max_length - len(completion_ids)
        if prompt_budget < 1:
            raise PreflightError("completion-exceeds-context-window")
        prompt_ids = prompt_ids[-prompt_budget:]
        input_ids = prompt_ids + completion_ids
        encoded.append({
            "input_ids": input_ids,
            "attention_mask": [1] * len(input_ids),
            "labels": ([-100] * len(prompt_ids)) + completion_ids,
        })
    return Dataset.from_list(encoded)


def train_adapter(validated: dict[str, Any]) -> dict[str, Any]:
    try:
        import torch
        from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            DataCollatorForSeq2Seq,
            Trainer,
            TrainingArguments,
        )
    except ImportError as error:
        raise RuntimeError(
            "training-dependencies-missing; install the optional Neuro-Plastic requirements"
        ) from error

    manifest = validated["manifest"]
    method = validated["method"]
    quantization_config = None
    if method == "qlora":
        if not torch.cuda.is_available():
            raise RuntimeError("qlora-requires-cuda-and-bitsandbytes")
        try:
            from transformers import BitsAndBytesConfig
            import bitsandbytes  # noqa: F401
        except ImportError as error:
            raise RuntimeError("qlora-requires-bitsandbytes") from error
        compute_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=compute_dtype,
        )

    tokenizer = AutoTokenizer.from_pretrained(
        str(validated["base"]),
        local_files_only=True,
        trust_remote_code=False,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model_kwargs: dict[str, Any] = {
        "local_files_only": True,
        "trust_remote_code": False,
    }
    if quantization_config is not None:
        model_kwargs["quantization_config"] = quantization_config
        model_kwargs["device_map"] = "auto"
    model = AutoModelForCausalLM.from_pretrained(str(validated["base"]), **model_kwargs)
    if method == "qlora":
        model = prepare_model_for_kbit_training(model)
        model.gradient_checkpointing_enable()
        if hasattr(model, "enable_input_require_grads"):
            model.enable_input_require_grads()

    target_candidates = {
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
        "query_key_value", "c_attn",
    }
    available_modules = {name.rsplit(".", 1)[-1] for name, _module in model.named_modules()}
    if method == "qlora":
        # QLoRA targets every linear layer; PEFT resolves this architecture-independently.
        target_modules = "all-linear"
    else:
        target_modules = sorted(target_candidates.intersection(available_modules))
        if not target_modules:
            raise RuntimeError("no-supported-lora-target-modules-found")
    if getattr(model, "config", None) is not None:
        model.config.use_cache = False
    lora = manifest["lora"]
    model = get_peft_model(model, LoraConfig(
        r=lora["rank"],
        lora_alpha=lora["alpha"],
        lora_dropout=float(lora["dropout"]),
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        target_modules=target_modules,
        inference_mode=False,
    ))

    training_data = _tokenize_rows(validated["training"], tokenizer, manifest["maxSequenceLength"])
    validation_data = _tokenize_rows(validated["validation"], tokenizer, manifest["maxSequenceLength"])
    collator = DataCollatorForSeq2Seq(
        tokenizer=tokenizer,
        model=model,
        padding=True,
        pad_to_multiple_of=8 if torch.cuda.is_available() else None,
        label_pad_token_id=-100,
    )
    training_parameters = inspect.signature(TrainingArguments.__init__).parameters
    evaluation_key = "eval_strategy" if "eval_strategy" in training_parameters else "evaluation_strategy"
    kwargs: dict[str, Any] = {
        "output_dir": str(validated["root"] / (".neuro-plastic-trainer-" + uuid.uuid4().hex)),
        "per_device_train_batch_size": 1,
        "per_device_eval_batch_size": 1,
        "gradient_accumulation_steps": 8,
        "learning_rate": float(manifest["learningRate"]),
        "num_train_epochs": float(manifest["epochs"]),
        "logging_steps": 5,
        "save_strategy": "no",
        "report_to": [],
        "seed": manifest["seed"],
        "data_seed": manifest["seed"],
        "remove_unused_columns": False,
        "fp16": bool(torch.cuda.is_available() and not torch.cuda.is_bf16_supported()),
        "bf16": bool(torch.cuda.is_available() and torch.cuda.is_bf16_supported()),
    }
    kwargs[evaluation_key] = "epoch"
    args = TrainingArguments(**kwargs)

    staging = validated["output"].with_name(validated["output"].name + ".staging-" + uuid.uuid4().hex)
    staging.mkdir(parents=True, exist_ok=False)
    trainer_work_dir = Path(args.output_dir)
    try:
        trainer = Trainer(
            model=model,
            args=args,
            train_dataset=training_data,
            eval_dataset=validation_data,
            data_collator=collator,
        )
        train_result = trainer.train()
        evaluation = trainer.evaluate()
        trainer.model.save_pretrained(staging, safe_serialization=True)
        required_config = staging / "adapter_config.json"
        weight_file = staging / "adapter_model.safetensors"
        if not required_config.is_file() or not weight_file.is_file():
            raise RuntimeError("peft-adapter-artifact-incomplete")
        # Verify that the immutable base snapshot did not change while training.
        if base_model_fingerprint(validated["base"]) != validated["baseFingerprint"]:
            raise RuntimeError("base-model-was-modified-during-adapter-training")
        artifact_files = sorted(path for path in staging.iterdir() if path.is_file())
        artifact_hashes = {
            path.name: {"sha256": sha256_file(path), "bytes": path.stat().st_size}
            for path in artifact_files
        }
        cuda_devices = []
        if torch.cuda.is_available():
            for device_index in range(torch.cuda.device_count()):
                try:
                    props = torch.cuda.get_device_properties(device_index)
                    cuda_devices.append({
                        "index": device_index,
                        "name": str(props.name),
                        "totalMemoryBytes": int(props.total_memory),
                        "computeCapability": str(props.major) + "." + str(props.minor),
                    })
                except Exception:
                    cuda_devices.append({"index": device_index, "name": "unavailable"})
        training_metadata = {
            "schemaVersion": 1,
            "adapterId": validated["adapterId"],
            "method": method,
            "domain": validated["domain"],
            "baseModelFingerprint": validated["baseFingerprint"],
            "tokenizerFingerprint": validated["tokenizerFingerprint"],
            "sourceDatasetFingerprint": validated["sourceDatasetFingerprint"],
            "holdoutPlanFingerprint": validated["holdoutPlanFingerprint"],
            "corpusFingerprint": validated["corpusFingerprint"],
            "seed": manifest["seed"],
            "trainingExampleCount": len(validated["training"]),
            "validationExampleCount": len(validated["validation"]),
            "maxSequenceLength": manifest["maxSequenceLength"],
            "epochs": manifest["epochs"],
            "learningRate": manifest["learningRate"],
            "lora": manifest["lora"],
            "targetModules": target_modules,
            "trainingMetrics": json_safe(train_result.metrics),
            "validationMetrics": json_safe(evaluation),
            "trainingEnvironment": {
                "python": platform.python_version(),
                "platform": platform.platform(),
                "torch": str(torch.__version__),
                "transformers": package_version("transformers"),
                "peft": package_version("peft"),
                "datasets": package_version("datasets"),
                "accelerate": package_version("accelerate"),
                "safetensors": package_version("safetensors"),
                "cudaRuntime": torch.version.cuda,
                "cudaAvailable": bool(torch.cuda.is_available()),
                "bf16Supported": bool(torch.cuda.is_available() and torch.cuda.is_bf16_supported()),
                "cudaDevices": cuda_devices,
                "offlineMode": True,
                "trustRemoteCode": False,
            },
            "quantization": ({
                "loadIn4Bit": True,
                "quantType": "nf4",
                "doubleQuant": True,
                "computeDtype": "bfloat16" if torch.cuda.is_bf16_supported() else "float16",
            } if method == "qlora" else None),
            "artifacts": artifact_hashes,
            "automaticActivation": False,
        }
        metadata = json_safe(training_metadata)
        (staging / "neuro-plastic-artifact.json").write_text(
            json.dumps(metadata, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        validated["output"].parent.mkdir(parents=True, exist_ok=True)
        if validated["output"].exists():
            raise RuntimeError("adapter-output-appeared-during-training")
        staging.replace(validated["output"])
        return metadata
    finally:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
        if trainer_work_dir.exists():
            shutil.rmtree(trainer_work_dir, ignore_errors=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--fingerprint-model", type=Path)
    parser.add_argument("--fingerprint-tokenizer", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.fingerprint_model is not None:
            print(base_model_fingerprint(args.fingerprint_model))
            return 0
        if args.fingerprint_tokenizer is not None:
            print(tokenizer_fingerprint(args.fingerprint_tokenizer))
            return 0
        if args.manifest is None:
            raise PreflightError("--manifest or --fingerprint-model is required")
        validated = validate_manifest(args.manifest)
        if args.check_only:
            print(json.dumps({
                "status": "preflight-passed",
                "method": validated["method"],
                "domain": validated["domain"],
                "adapterId": validated["adapterId"],
                "baseModelFingerprint": validated["baseFingerprint"],
                "sourceDatasetFingerprint": validated["sourceDatasetFingerprint"],
                "holdoutPlanFingerprint": validated["holdoutPlanFingerprint"],
                "tokenizerFingerprint": validated["tokenizerFingerprint"],
                "corpusFingerprint": validated["corpusFingerprint"],
                "trainingExampleCount": len(validated["training"]),
                "validationExampleCount": len(validated["validation"]),
                "automaticActivation": False,
                "holdoutIncluded": False,
            }, sort_keys=True))
            return 0
        metadata = train_adapter(validated)
        print(json.dumps({
            "status": "adapter-trained-unpromoted",
            "artifactDirectory": str(validated["output"]),
            "automaticActivation": False,
            "artifacts": metadata["artifacts"],
        }, sort_keys=True))
        return 0
    except (PreflightError, OSError, RuntimeError) as error:
        print("NEURO_PLASTIC_ERROR=" + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
