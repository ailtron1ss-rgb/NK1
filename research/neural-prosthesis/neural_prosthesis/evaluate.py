from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from .engine import NeuralProsthesisBank
from .training import dataset_fingerprint, encode_example, read_jsonl


def main() -> None:
    parser = argparse.ArgumentParser(description="Paired baseline/candidate loss evaluation on an explicit holdout set.")
    parser.add_argument("--base-model-path", required=True)
    parser.add_argument("--base-model-id", required=True)
    parser.add_argument("--base-model-revision", required=True)
    parser.add_argument("--adapter-dir", required=True)
    parser.add_argument("--dataset-jsonl", required=True)
    parser.add_argument("--split", required=True, choices=("validation", "holdout"))
    parser.add_argument("--layer-path", default="")
    parser.add_argument("--max-length", type=int, default=1024)
    parser.add_argument("--output", required=True)
    parser.add_argument("--device", default="auto", choices=("auto", "cpu", "cuda", "mps"))
    args = parser.parse_args()
    examples = read_jsonl(args.dataset_jsonl)
    if not 64 <= args.max_length <= 32768:
        raise SystemExit("max-length out of range")
    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available() else "cpu")
    else:
        device = torch.device(args.device)
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
    bank = NeuralProsthesisBank(model, model_id=args.base_model_id, model_revision=args.base_model_revision, layer_path=layer_path)
    try:
        adapter_id = bank.load_adapter(args.adapter_dir)
        bank.eval()
        paired = []
        with torch.inference_mode():
            for index, example in enumerate(examples):
                input_ids, labels = encode_example(tokenizer, example, args.max_length, device)
                with bank.activate(None):
                    baseline = float(model(input_ids=input_ids, labels=labels, use_cache=False).loss.float().item())
                with bank.activate(adapter_id):
                    candidate = float(model(input_ids=input_ids, labels=labels, use_cache=False).loss.float().item())
                paired.append({
                    "pair": index + 1,
                    "baseline_loss": baseline,
                    "candidate_loss": candidate,
                    "loss_delta": candidate - baseline,
                })
        baseline_mean = sum(row["baseline_loss"] for row in paired) / len(paired)
        candidate_mean = sum(row["candidate_loss"] for row in paired) / len(paired)
        mean_delta = candidate_mean - baseline_mean
        improved = sum(1 for row in paired if row["loss_delta"] < 0)
        report = {
            "status": "observed",
            "split": args.split,
            "adapter_id": adapter_id,
            "manifest_sha256": json.loads((Path(args.adapter_dir) / "manifest.json").read_text(encoding="utf-8"))["manifest_sha256"],
            "dataset_sha256": dataset_fingerprint(args.dataset_jsonl),
            "sample_count": len(paired),
            "baseline_mean_loss": baseline_mean,
            "candidate_mean_loss": candidate_mean,
            "mean_loss_delta": mean_delta,
            "improved_pairs": improved,
            "success_rate": improved / len(paired),
            "eligible_for_human_review": bool(args.split == "holdout" and len(paired) >= 5 and mean_delta < 0),
            "independently_verified": False,
            "promotion_allowed": False,
            "pairs": paired,
        }
        Path(args.output).expanduser().write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({key: value for key, value in report.items() if key != "pairs"}, ensure_ascii=False))
    finally:
        bank.close()


if __name__ == "__main__":
    main()
