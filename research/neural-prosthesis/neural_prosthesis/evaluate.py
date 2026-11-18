from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from .engine import NeuralProsthesisBank
from .training import (
    MAX_EVALUATION_EXAMPLES,
    dataset_fingerprint,
    encode_example,
    ensure_holdout_is_distinct,
    ensure_validation_is_distinct,
    paired_bootstrap_mean_interval,
    read_jsonl,
)


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
    parser.add_argument("--bootstrap-samples", type=int, default=2000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", required=True)
    parser.add_argument("--device", default="auto", choices=("auto", "cpu", "cuda", "mps"))
    args = parser.parse_args()
    if not 64 <= args.max_length <= 32768:
        raise SystemExit("max-length out of range")
    if not 100 <= args.bootstrap_samples <= 10_000 or not 0 <= args.seed <= 0xFFFFFFFF:
        raise SystemExit("bootstrap configuration out of range")
    evaluation_dataset_sha256 = dataset_fingerprint(args.dataset_jsonl)
    examples = read_jsonl(args.dataset_jsonl, max_examples=MAX_EVALUATION_EXAMPLES)
    if dataset_fingerprint(args.dataset_jsonl) != evaluation_dataset_sha256:
        raise SystemExit("evaluation-dataset-changed-while-loading")
    try:
        manifest = json.loads((Path(args.adapter_dir).expanduser() / "manifest.json").read_text(encoding="utf-8"))
    except Exception as error:
        raise SystemExit("adapter-manifest-unreadable") from error
    if not isinstance(manifest, dict):
        raise SystemExit("adapter-manifest-invalid")
    training_evidence = manifest.get("training_evidence")
    training_dataset_sha256 = training_evidence.get("dataset_sha256") if isinstance(training_evidence, dict) else None
    validation_dataset_sha256 = training_evidence.get("validation_dataset_sha256") if isinstance(training_evidence, dict) else None
    try:
        if args.split == "holdout":
            ensure_holdout_is_distinct(
                training_dataset_sha256,
                evaluation_dataset_sha256,
                validation_digest=validation_dataset_sha256,
            )
        else:
            ensure_validation_is_distinct(training_dataset_sha256, evaluation_dataset_sha256)
            if validation_dataset_sha256 is not None and evaluation_dataset_sha256 != validation_dataset_sha256:
                raise ValueError("evaluation-dataset-does-not-match-recorded-validation-dataset")
    except ValueError as error:
        raise SystemExit(str(error)) from error
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
                if not math.isfinite(baseline) or not math.isfinite(candidate):
                    raise RuntimeError("non-finite-evaluation-loss")
                paired.append({
                    "pair": index + 1,
                    "baseline_loss": baseline,
                    "candidate_loss": candidate,
                    "loss_delta": candidate - baseline,
                })
        baseline_mean = sum(row["baseline_loss"] for row in paired) / len(paired)
        candidate_mean = sum(row["candidate_loss"] for row in paired) / len(paired)
        mean_delta = candidate_mean - baseline_mean
        deltas = [row["loss_delta"] for row in paired]
        interval = paired_bootstrap_mean_interval(
            deltas,
            bootstrap_samples=args.bootstrap_samples,
            seed=args.seed,
        ) if len(paired) >= 2 else None
        improved = sum(1 for row in paired if row["loss_delta"] < 0)
        worsened = sum(1 for row in paired if row["loss_delta"] > 0)
        tied = len(paired) - improved - worsened
        review_ineligibility = []
        if args.split != "holdout":
            review_ineligibility.append("split-is-not-holdout")
        if training_dataset_sha256 is None:
            review_ineligibility.append("training-provenance-missing")
        if len(paired) < 5:
            review_ineligibility.append("fewer-than-five-paired-examples")
        if mean_delta >= 0:
            review_ineligibility.append("mean-loss-did-not-improve")
        if interval is None or float(interval["upper"]) >= 0:
            review_ineligibility.append("paired-bootstrap-95ci-overlaps-zero")
        report = {
            "status": "observed",
            "split": args.split,
            "adapter_id": adapter_id,
            "manifest_sha256": json.loads((Path(args.adapter_dir) / "manifest.json").read_text(encoding="utf-8"))["manifest_sha256"],
            "dataset_sha256": evaluation_dataset_sha256,
            "training_dataset_sha256": training_dataset_sha256,
            "validation_dataset_sha256": validation_dataset_sha256,
            "sample_count": len(paired),
            "baseline_mean_loss": baseline_mean,
            "candidate_mean_loss": candidate_mean,
            "mean_loss_delta": mean_delta,
            "success_rate": improved / len(paired),
            "improved_pairs": improved,
            "worsened_pairs": worsened,
            "tied_pairs": tied,
            "paired_bootstrap_95ci_mean_loss_delta": (
                [float(interval["lower"]), float(interval["upper"])] if interval is not None else None
            ),
            "bootstrap_samples": args.bootstrap_samples,
            "bootstrap_seed": args.seed,
            "review_ineligibility_reasons": review_ineligibility,
            "eligible_for_human_review": not review_ineligibility,
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
