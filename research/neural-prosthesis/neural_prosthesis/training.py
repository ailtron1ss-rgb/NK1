from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import torch


MAX_DATASET_BYTES = 256 * 1024 * 1024
MAX_EXAMPLES = 100_000
MAX_TEXT_CHARS = 32_000


def read_jsonl(path: str | Path) -> list[dict[str, str]]:
    source = Path(path).expanduser().resolve()
    if not source.is_file() or source.stat().st_size > MAX_DATASET_BYTES:
        raise ValueError("dataset-missing-or-too-large")
    examples: list[dict[str, str]] = []
    with source.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            if len(examples) >= MAX_EXAMPLES:
                raise ValueError("dataset-example-limit-exceeded")
            try:
                row = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"dataset-json-invalid-line-{line_number}") from error
            if not isinstance(row, dict) or set(row) - {"prompt", "completion", "id"}:
                raise ValueError(f"dataset-schema-invalid-line-{line_number}")
            prompt, completion = row.get("prompt"), row.get("completion")
            if not isinstance(prompt, str) or not isinstance(completion, str):
                raise ValueError(f"dataset-text-invalid-line-{line_number}")
            if not prompt.strip() or not completion.strip() or len(prompt) > MAX_TEXT_CHARS or len(completion) > MAX_TEXT_CHARS:
                raise ValueError(f"dataset-text-out-of-range-line-{line_number}")
            examples.append({"prompt": prompt, "completion": completion})
    if not examples:
        raise ValueError("dataset-empty")
    return examples


def dataset_fingerprint(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).expanduser().open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def encode_example(tokenizer: Any, example: dict[str, str], max_length: int, device: torch.device):
    prompt_ids = tokenizer.encode(example["prompt"], add_special_tokens=False)
    completion_ids = tokenizer.encode(example["completion"], add_special_tokens=False)
    if tokenizer.bos_token_id is not None and (not prompt_ids or prompt_ids[0] != tokenizer.bos_token_id):
        prompt_ids = [tokenizer.bos_token_id, *prompt_ids]
    if tokenizer.eos_token_id is not None:
        completion_ids = [*completion_ids, tokenizer.eos_token_id]
    if not completion_ids:
        raise ValueError("completion-token-sequence-empty")
    if len(completion_ids) >= max_length:
        completion_ids = completion_ids[-max_length:]
        prompt_ids = []
    elif len(prompt_ids) + len(completion_ids) > max_length:
        prompt_ids = prompt_ids[-(max_length - len(completion_ids)):]
    input_ids = prompt_ids + completion_ids
    labels = ([-100] * len(prompt_ids)) + completion_ids
    return (
        torch.tensor([input_ids], dtype=torch.long, device=device),
        torch.tensor([labels], dtype=torch.long, device=device),
    )
