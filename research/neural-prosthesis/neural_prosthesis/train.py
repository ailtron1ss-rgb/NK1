from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from .engine import NeuralProsthesisBank
from .training import dataset_fingerprint, encode_example, read_jsonl


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train an isolated NK1 Transformer residual adapter.")
    parser.add_argument("--base-model-path", required=True, help="Existing local Transformers model directory; downloads are disabled.")
    parser.add_argument("--base-model-id", required=True, help="Stable host model identifier.")
    parser.add_argument("--base-model-revision", required=True, help="Immutable commit/revision identifier pinned by the host.")
    parser.add_argument("--train-jsonl", required=True, help="Sanitized, consented JSONL with prompt/completion pairs.")
    parser.add_argument("--output-dir", required=True, help="New, empty adapter artifact directory.")
    parser.add_argument("--adapter-id", required=True)
    parser.add_argument("--layer-path", default="", help="Explicit layer container path, for example model.layers.")
    parser.add_argument("--layers", required=True, help="Comma-separated decoder layer indexes, for example 3,7,11.")
    parser.add_argument("--bottleneck-size", type=int, default=64)
    parser.add_argument("--max-residual-ratio", type=float, default=0.25)
    parser.add_argument("--dropout", type=float, default=0.05)
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--max-length", type=int, default=1024)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default="auto", choices=("auto", "cpu", "cuda", "mps"))
    return parser


def _select_device(name: str) -> torch.device:
    if name == "auto":
        if torch.cuda.is_available():
            return torch.device("cuda")
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")
    device = torch.device(name)
    if device.type == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("cuda-unavailable")
    if device.type == "mps" and not (hasattr(torch.backends, "mps") and torch.backends.mps.is_available()):
        raise RuntimeError("mps-unavailable")
    return device


def main() -> None:
    args = build_parser().parse_args()
    if not 1 <= args.epochs <= 10 or not 1e-6 <= args.learning_rate <= 1e-2:
        raise SystemExit("epochs or learning-rate out of supported range")
    if not 64 <= args.max_length <= 32768:
        raise SystemExit("max-length out of supported range")
    layers = [int(value.strip()) for value in args.layers.split(",") if value.strip()]
    if not layers:
        raise SystemExit("at least one decoder layer is required")
    examples = read_jsonl(args.train_jsonl)
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    device = _select_device(args.device)
    dtype = torch.bfloat16 if device.type == "cuda" and torch.cuda.is_bf16_supported() else (
        torch.float16 if device.type == "cuda" else torch.float32
    )
    model_path = str(Path(args.base_model_path).expanduser().resolve())
    tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True, trust_remote_code=False)
    model = AutoModelForCausalLM.from_pretrained(
        model_path, local_files_only=True, trust_remote_code=False, torch_dtype=dtype
    ).to(device)
    model.eval()
    model.config.use_cache = False
    for parameter in model.parameters():
        parameter.requires_grad_(False)
    layer_path = args.layer_path.strip()
    if not layer_path:
        for candidate in ("model.layers", "transformer.h", "gpt_neox.layers", "model.decoder.layers", "decoder.layers", "layers"):
            current = model
            try:
                for part in candidate.split("."):
                    current = getattr(current, part)
                if isinstance(current, (torch.nn.ModuleList, list, tuple)) and len(current):
                    layer_path = candidate
                    break
            except AttributeError:
                continue
    if not layer_path:
        raise SystemExit("unsupported-layer-layout; pass --layer-path")
    bank = NeuralProsthesisBank(
        model,
        model_id=args.base_model_id,
        model_revision=args.base_model_revision,
        layer_path=layer_path,
    )
    try:
        bank.add_adapter(
            args.adapter_id,
            layer_indices=layers,
            bottleneck_size=args.bottleneck_size,
            max_residual_ratio=args.max_residual_ratio,
            dropout=args.dropout,
        )
        branch = bank.adapters[args.adapter_id]
        for parameter in branch.parameters():
            parameter.requires_grad_(True)
        optimizer = torch.optim.AdamW(branch.parameters(), lr=args.learning_rate, weight_decay=0.01)
        bank.train()
        history = []
        for epoch in range(args.epochs):
            random.shuffle(examples)
            epoch_losses = []
            for example in examples:
                input_ids, labels = encode_example(tokenizer, example, args.max_length, device)
                optimizer.zero_grad(set_to_none=True)
                with bank.activate(args.adapter_id):
                    output = model(input_ids=input_ids, labels=labels, use_cache=False)
                loss = output.loss
                if not torch.isfinite(loss).item():
                    raise RuntimeError("non-finite-training-loss")
                loss.backward()
                torch.nn.utils.clip_grad_norm_(branch.parameters(), max_norm=1.0)
                optimizer.step()
                epoch_losses.append(float(loss.detach().float().item()))
            history.append({"epoch": epoch + 1, "mean_loss": sum(epoch_losses) / max(1, len(epoch_losses))})
        bank.eval()
        manifest = bank.save_adapter(args.adapter_id, args.output_dir)
        report = {
            "status": "candidate",
            "adapter_id": args.adapter_id,
            "manifest_sha256": manifest["manifest_sha256"],
            "train_examples": len(examples),
            "train_dataset_sha256": dataset_fingerprint(args.train_jsonl),
            "epochs": args.epochs,
            "seed": args.seed,
            "history": history,
            "holdout_evaluated": False,
            "promotion_allowed": False,
        }
        Path(args.output_dir, "training-report.json").write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        print(json.dumps(report, ensure_ascii=False))
    finally:
        bank.close()


if __name__ == "__main__":
    main()
