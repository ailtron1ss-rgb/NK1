from __future__ import annotations

"""Canonical neural-program execution bridge.

This module makes the canonical V13 neural program synthesizer a real participant in
NOMEGA's executable/evidence loop. It does not promote neural proposals by their own
confidence: every proposed program is evaluated by the independent TinyVM/HVM spine.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
import hashlib
import json
import random
import time

import torch

from .neural_program_synth import NeuralProgramSynthesizer
from .neural_program_trainer_v6 import AtomicProgramTrainerV6
from .program_acquisition_v2 import ProgramAcquisitionCoreV2, Program
from .task_spec_v1 import CANONICAL_PROMPT, FAMILY_TO_ID, FAMILY_ORDER


@dataclass(frozen=True)
class NeuralCandidateV1:
    family: str
    program: Program
    model_version: str
    checkpoint_digest: str
    source: str = "pure_neural_v13"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "family": self.family,
            "program": [list(x) for x in self.program],
            "model_version": self.model_version,
            "checkpoint_digest": self.checkpoint_digest,
            "source": self.source,
        }


@dataclass(frozen=True)
class NeuralBridgeReportV1:
    version: str
    checkpoint: str
    checkpoint_digest: str
    model_signature: Dict[str, Any]
    families: Tuple[str, ...]
    training_examples: int
    training_epochs: int
    training_steps: int
    training_wall_s: float
    candidates: Tuple[Dict[str, Any], ...]
    baseline: Dict[str, Any]
    after: Dict[str, Any]
    evidence: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            "families": list(self.families),
            "candidates": list(self.candidates),
        }


class CanonicalNeuralProgramBridgeV1:
    """Load/train the canonical V13 neural synthesizer and expose verified candidates."""

    VERSION = "canonical-neural-execution-v1"
    DEFAULT_CHECKPOINT = "runtime/nomega_canonical_neural_program_v1.pt"

    def __init__(
        self,
        root: Path,
        *,
        seed: int = 2027,
        checkpoint: Optional[str | Path] = None,
        hidden: int = 32,
        latent_dim: int = 32,
        max_len: int = 24,
        max_b: int = 64,
        layers: int = 1,
        heads: int = 2,
        evidence_ledger=None,
    ):
        self.root = Path(root)
        self.seed = int(seed)
        self.checkpoint_path = Path(checkpoint) if checkpoint else self.root / self.DEFAULT_CHECKPOINT
        if not self.checkpoint_path.is_absolute():
            self.checkpoint_path = self.root / self.checkpoint_path
        self.architecture = {
            "vocab": 2048,
            "hidden": int(hidden),
            "latent_dim": int(latent_dim),
            "max_len": int(max_len),
            "max_b": int(max_b),
            "layers": int(layers),
            "heads": int(heads),
            "family_count": len(FAMILY_TO_ID),
        }
        self.model: Optional[NeuralProgramSynthesizer] = None
        self.evidence_ledger = evidence_ledger
        self.loaded = False
        self.load_error: Optional[str] = None
        self._load()

    @property
    def available(self) -> bool:
        return self.model is not None and self.loaded

    def _new_model(self) -> NeuralProgramSynthesizer:
        torch.manual_seed(self.seed)
        model = NeuralProgramSynthesizer(**self.architecture)
        model.eval()
        return model

    @staticmethod
    def _state_digest(model: torch.nn.Module) -> str:
        h = hashlib.sha256()
        for name, tensor in sorted(model.state_dict().items()):
            h.update(name.encode("utf-8"))
            h.update(tensor.detach().cpu().contiguous().numpy().tobytes())
        return h.hexdigest()

    @property
    def checkpoint_digest(self) -> str:
        if self.model is None:
            return ""
        return self._state_digest(self.model)

    def _load(self) -> None:
        if not self.checkpoint_path.exists():
            self.load_error = "checkpoint_missing"
            return
        try:
            blob = torch.load(self.checkpoint_path, map_location="cpu", weights_only=False)
            architecture = dict(blob.get("architecture") or self.architecture)
            for key, value in self.architecture.items():
                architecture.setdefault(key, value)
            # A checkpoint produced by the bridge must use the canonical facade class.
            model = NeuralProgramSynthesizer(**architecture)
            state = blob["model"]
            if any(str(k).startswith("semantic_probe.") for k in state):
                import torch.nn as nn
                model.semantic_probe = nn.Linear(model.hidden, 10)
            model.load_state_dict(state, strict=True)
            model.eval()
            self.architecture = architecture
            self.model = model
            self.loaded = True
            self.load_error = None
        except Exception as exc:  # measured degradation is surfaced to callers
            self.load_error = f"{type(exc).__name__}: {exc}"
            self.model = None
            self.loaded = False

    def save(self, *, trainer_steps: int = 0, report: Optional[Dict[str, Any]] = None) -> Path:
        if self.model is None:
            raise RuntimeError("cannot save an unavailable neural model")
        self.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "bridge_version": self.VERSION,
            "has_semantic_probe": bool(hasattr(self.model, "semantic_probe")),
            "model_class": self.model.__class__.__module__ + "." + self.model.__class__.__name__,
            "architecture": dict(self.architecture),
            "model": self.model.state_dict(),
            "state_digest": self.checkpoint_digest,
            "trainer_steps": int(trainer_steps),
            "report": report or {},
            "seed": self.seed,
        }
        torch.save(payload, self.checkpoint_path)
        meta_path = self.checkpoint_path.with_suffix(".json")
        meta_path.write_text(json.dumps({
            "bridge_version": self.VERSION,
            "checkpoint": str(self.checkpoint_path),
            "state_digest": self.checkpoint_digest,
            "architecture": self.architecture,
            "trainer_steps": int(trainer_steps),
            "report": report or {},
        }, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        return self.checkpoint_path

    def model_signature(self) -> Dict[str, Any]:
        if self.model is None:
            return {"available": False, "error": self.load_error, "architecture": self.architecture}
        try:
            sig = dict(self.model.checkpoint_signature())
        except Exception:
            sig = {"model_class": self.model.__class__.__name__}
        sig.update({"available": True, "state_digest": self.checkpoint_digest})
        return sig

    @staticmethod
    def _prompt_variants(family: str) -> Tuple[str, ...]:
        prompt = CANONICAL_PROMPT[family]
        return (
            prompt,
            f"Solve this task exactly: {prompt}",
            f"Compute the requested program for this task: {prompt}",
        )

    def _verified_training_programs(self, acquisition: ProgramAcquisitionCoreV2, family: str, *, limit: int = 3) -> List[Program]:
        """Build training targets only from programs that execute correctly on a hidden split.

        The neural target set is therefore grounded in the same executable semantics used
        by the verifier; malformed or merely plausible mutations never become hard labels.
        """
        from .neural_program_synth_v2 import ProgramAugmenterV2

        templates = acquisition.templates(str(family))
        if not templates:
            return []
        base = [tuple(x) for x in templates[0]]
        pool: List[Program] = [base]
        pool.extend([tuple(tuple(x) for x in code) for code in ProgramAugmenterV2(self.seed + 17).augment(base, n=4)[1:]])
        pool.extend([tuple(tuple(x) for x in code) for code in acquisition._mutate(base, n=8)])
        _train, holdout, _adv = acquisition._examples(str(family), self.seed + 59)
        verified: List[Program] = []
        seen = set()
        for code in pool:
            fp = tuple(code)
            if fp in seen:
                continue
            seen.add(fp)
            fitness, agreement, _ = acquisition._eval(code, holdout)
            if fitness >= 1.0 and agreement >= 1.0:
                verified.append(list(code))
                if len(verified) >= max(1, int(limit)):
                    break
        return verified or [base]

    def training_rows(
        self,
        families: Optional[Sequence[str]] = None,
        *,
        variants_per_family: int = 2,
        max_verified_programs_per_family: int = 3,
    ) -> List[Tuple[str, Program, int]]:
        acquisition = ProgramAcquisitionCoreV2(self.root, seed=self.seed + 31)
        selected = list(families or FAMILY_ORDER)
        rows: List[Tuple[str, Program, int]] = []
        for family in selected:
            verified_programs = self._verified_training_programs(
                acquisition, str(family), limit=max_verified_programs_per_family
            )
            if not verified_programs:
                continue
            fid = int(FAMILY_TO_ID.get(str(family), 0))
            prompts = self._prompt_variants(str(family))[: max(1, int(variants_per_family))]
            for code in verified_programs:
                rows.extend((prompt, [tuple(x) for x in code], fid) for prompt in prompts)
        return rows

    def fit(
        self,
        families: Optional[Sequence[str]] = None,
        *,
        epochs: int = 2,
        variants_per_family: int = 2,
        max_examples: int = 96,
        lr: float = 8e-4,
        max_verified_programs_per_family: int = 3,
    ) -> Dict[str, Any]:
        rows = self.training_rows(
            families,
            variants_per_family=variants_per_family,
            max_verified_programs_per_family=max_verified_programs_per_family,
        )
        if not rows:
            raise ValueError("no canonical training rows available")
        return self.fit_rows(
            rows,
            epochs=epochs,
            max_examples=max_examples,
            lr=lr,
            reset_model=True,
            source="canonical_verified_acquisition",
        )

    def fit_rows(
        self,
        rows: Sequence[Tuple[str, Program, int]],
        *,
        epochs: int = 2,
        max_examples: int = 96,
        lr: float = 8e-4,
        reset_model: bool = False,
        source: str = "execution_guided",
    ) -> Dict[str, Any]:
        """Fit on an explicit execution-verified row set.

        This is the learning boundary used by execution-guided development: the
        caller is responsible for constructing rows whose program targets were
        independently verified.  ``reset_model=False`` permits verified repairs to
        update the live neural proposer instead of silently starting from scratch.
        """
        data = list(rows)[: max(1, int(max_examples))]
        if not data:
            raise ValueError("no training rows supplied")
        if reset_model or self.model is None:
            self.model = self._new_model()
        trainer = AtomicProgramTrainerV6(self.model, seed=self.seed + 7, lr=lr)
        started = time.perf_counter()
        report = trainer.fit(
            data,
            epochs=max(1, int(epochs)),
            batch_size=min(8, max(1, len(data))),
            max_examples=len(data),
            semantic_weight=0.20,
        )
        wall = time.perf_counter() - started
        self.model.eval()
        self.loaded = True
        self.load_error = None
        payload = report.to_dict()
        payload["training_source"] = str(source)
        payload["rows_hash"] = hashlib.sha256(
            json.dumps([(str(t), [list(x) for x in c], int(fid)) for t, c, fid in data], sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()[:24]
        checkpoint = self.save(trainer_steps=report.steps, report=payload)
        return {
            "rows": len(data),
            "epochs": int(epochs),
            "steps": int(report.steps),
            "wall_s": round(wall, 4),
            "checkpoint": str(checkpoint),
            "checkpoint_digest": self.checkpoint_digest,
            "report": payload,
            "model": self.model_signature(),
        }

    def fit_execution_guided(
        self,
        verified_rows: Sequence[Tuple[str, Program, int]],
        *,
        epochs: int = 1,
        max_examples: int = 32,
        lr: float = 5e-4,
    ) -> Dict[str, Any]:
        """Continue training from verified repair trajectories.

        Only explicit rows supplied by an independent verifier are consumed here;
        failures by themselves never become positive labels.
        """
        return self.fit_rows(
            verified_rows,
            epochs=epochs,
            max_examples=max_examples,
            lr=lr,
            reset_model=False,
            source="execution_guided_verified_repair",
        )

    @torch.no_grad()
    def propose(
        self,
        text: str,
        *,
        family: Optional[str] = None,
        latent: Optional[torch.Tensor] = None,
        beam_size: int = 2,
        max_len: Optional[int] = None,
    ) -> Optional[NeuralCandidateV1]:
        # ``model`` can be an ephemeral freshly initialized model during matched
        # baseline measurement; runtime availability additionally requires a loaded
        # checkpoint.
        if self.model is None:
            return None
        family_name = str(family) if family else None
        if family_name not in FAMILY_TO_ID:
            from .task_spec_v1 import parse_task_spec
            spec = parse_task_spec(str(text))
            family_name = spec.family if spec.semantic_valid else None
        if family_name not in FAMILY_TO_ID:
            return None
        code = self.model.generate(
            str(text),
            family_id=int(FAMILY_TO_ID[family_name]),
            latent=latent,
            max_len=max_len or self.architecture["max_len"],
            beam_size=max(1, int(beam_size)),
        )
        return NeuralCandidateV1(
            family=family_name,
            program=[tuple(int(v) for v in ins) for ins in code],
            model_version=str(getattr(self.model, "version", "unknown")),
            checkpoint_digest=self.checkpoint_digest,
        )

    def candidates_for_families(self, families: Iterable[str]) -> List[NeuralCandidateV1]:
        out = []
        for family in families:
            candidate = self.propose(CANONICAL_PROMPT[str(family)], family=str(family), beam_size=2)
            if candidate is not None:
                out.append(candidate)
        return out

    def benchmark(
        self,
        families: Sequence[str],
        *,
        seed: Optional[int] = None,
        ood_seed: Optional[int] = None,
        compare_baseline: bool = True,
    ) -> Dict[str, Any]:
        from .executable_spine_v2 import ExecutableSpineV2

        selected = [str(x) for x in families if str(x) in FAMILY_TO_ID]
        eval_seed = self.seed + 101 if seed is None else int(seed)
        ood = eval_seed + 100003 if ood_seed is None else int(ood_seed)
        spine = ExecutableSpineV2(self.root, seed=eval_seed, max_candidates=4)

        def evaluate_model(model: Optional[NeuralProgramSynthesizer]) -> Dict[str, Any]:
            old = self.model
            self.model = model
            values = []
            try:
                for family in selected:
                    candidate = self.propose(CANONICAL_PROMPT[family], family=family, beam_size=2)
                    if candidate is None:
                        values.append({"family": family, "available": False})
                        continue
                    evidence = spine.evaluate_program(family, candidate.program, seed=eval_seed, ood_seed=ood)
                    values.append({"family": family, "candidate": candidate.to_dict(), "evaluation": evidence})
            finally:
                self.model = old
            vals = [x["evaluation"] for x in values if x.get("evaluation")]
            mean = lambda key: sum(float(v.get(key, 0.0)) for v in vals) / max(1, len(vals))
            return {
                "families_evaluated": len(vals),
                "verified": mean("verified"),
                "train": mean("train"),
                "holdout": mean("holdout"),
                "ood": mean("ood"),
                "adversarial": mean("adversarial"),
                "hvm": mean("hvm"),
                "rows": values,
            }

        baseline_model = self._new_model() if compare_baseline else None
        baseline = evaluate_model(baseline_model) if compare_baseline else {"families_evaluated": 0}
        after = evaluate_model(self.model) if self.model is not None else {"families_evaluated": 0}
        return {
            "version": self.VERSION,
            "families": selected,
            "baseline": baseline,
            "after": after,
            "checkpoint_digest": self.checkpoint_digest,
            "model": self.model_signature(),
        }

    def train_and_measure(
        self,
        families: Optional[Sequence[str]] = None,
        *,
        epochs: int = 2,
        variants_per_family: int = 2,
        max_examples: int = 96,
        evaluation_seeds: Optional[Sequence[int]] = None,
    ) -> NeuralBridgeReportV1:
        selected = tuple(str(x) for x in (families or FAMILY_ORDER) if str(x) in FAMILY_TO_ID)
        eval_seeds = tuple(int(x) for x in (evaluation_seeds or (self.seed + 101, self.seed + 202, self.seed + 303)))
        before_model = self._new_model()
        # Evaluate a fixed baseline before updating self.model. Every after-measurement
        # uses the same family/seed grid, so the comparison is matched rather than a
        # different random sample before and after training.
        from .executable_spine_v2 import ExecutableSpineV2

        def measure(model: NeuralProgramSynthesizer) -> Dict[str, Any]:
            old = self.model
            self.model = model
            try:
                per_seed = []
                for eval_seed in eval_seeds:
                    spine = ExecutableSpineV2(self.root, seed=eval_seed, max_candidates=4)
                    rows = []
                    for family in selected:
                        candidate = self.propose(CANONICAL_PROMPT[family], family=family, beam_size=2)
                        if candidate is None:
                            continue
                        ev = spine.evaluate_program(family, candidate.program, seed=eval_seed, ood_seed=eval_seed + 100003)
                        rows.append(ev)
                    mean = lambda key: sum(float(r.get(key, 0.0)) for r in rows) / max(1, len(rows))
                    per_seed.append({
                        "seed": eval_seed,
                        "families_evaluated": len(rows),
                        "verified": mean("verified"),
                        "train": mean("train"),
                        "holdout": mean("holdout"),
                        "ood": mean("ood"),
                        "adversarial": mean("adversarial"),
                        "hvm": mean("hvm"),
                    })
                mean = lambda key: sum(float(r.get(key, 0.0)) for r in per_seed) / max(1, len(per_seed))
                return {
                    "families_evaluated": int(sum(int(r["families_evaluated"]) for r in per_seed)),
                    **{key: mean(key) for key in ("verified", "train", "holdout", "ood", "adversarial", "hvm")},
                    "per_seed": per_seed,
                }
            finally:
                self.model = old

        baseline = measure(before_model)
        training = self.fit(selected, epochs=epochs, variants_per_family=variants_per_family, max_examples=max_examples)
        after = measure(self.model) if self.model is not None else {"families_evaluated": 0}
        candidates = tuple(c.to_dict() for c in self.candidates_for_families(selected))
        metric_keys = ("verified", "train", "holdout", "ood", "adversarial", "hvm")
        deltas = {key: float(after.get(key, 0.0)) - float(baseline.get(key, 0.0)) for key in metric_keys}
        matched_rows = []
        before_by_seed = {int(r["seed"]): r for r in baseline.get("per_seed", [])}
        after_by_seed = {int(r["seed"]): r for r in after.get("per_seed", [])}
        for seed in eval_seeds:
            b = before_by_seed.get(seed, {})
            a = after_by_seed.get(seed, {})
            matched_rows.append({"seed": seed, **{key: float(a.get(key, 0.0)) - float(b.get(key, 0.0)) for key in metric_keys}})
        holdout_sign_consistency = sum(1 for r in matched_rows if r["holdout"] > 0.0) / max(1, len(matched_rows))
        evidence = {
            "training_data_source": "ProgramAcquisitionCoreV2 execution-verified template/augmentation targets + deterministic prompt variants",
            "holdout_source": "ProgramAcquisitionCoreV2 hidden holdout split",
            "ood_source": "ProgramAcquisitionCoreV2 alternate seed holdout evaluated independently",
            "seed_policy": {"training": self.seed + 7, "evaluation_seeds": list(eval_seeds), "ood_offset": 100003},
            "checkpoint_lineage": {"digest": self.checkpoint_digest, "path": str(self.checkpoint_path)},
            "baseline_metrics": baseline,
            "after_metrics": after,
            "delta": deltas,
            "matched_multi_seed_effect": matched_rows,
            "holdout_positive_seed_fraction": holdout_sign_consistency,
            "execution_verifier": "TinyVM + HVM via ExecutableSpineV2",
            "pure_neural_candidate_source": True,
            "causal_claim_status": "descriptive_matched_effect_only; no causal uplift claim",
            "promotion_status": "research_only",
        }
        if self.evidence_ledger is not None:
            try:
                self.evidence_ledger.append("neural_program_training", {
                    "families": list(selected),
                    "evaluation_seeds": list(eval_seeds),
                    "training_examples": int(training["rows"]),
                    "training_steps": int(training["steps"]),
                    "checkpoint_digest": self.checkpoint_digest,
                    "baseline": baseline,
                    "after": after,
                    "delta": deltas,
                    "matched_multi_seed_effect": matched_rows,
                    "holdout_positive_seed_fraction": holdout_sign_consistency,
                    "promotion_status": "research_only",
                })
            except Exception as exc:
                evidence["evidence_ledger_error"] = f"{type(exc).__name__}: {exc}"
        report = NeuralBridgeReportV1(
            version=self.VERSION,
            checkpoint=str(self.checkpoint_path),
            checkpoint_digest=self.checkpoint_digest,
            model_signature=self.model_signature(),
            families=selected,
            training_examples=int(training["rows"]),
            training_epochs=int(training["epochs"]),
            training_steps=int(training["steps"]),
            training_wall_s=float(training["wall_s"]),
            candidates=candidates,
            baseline=baseline,
            after=after,
            evidence=evidence,
        )
        artifact = self.root / "runtime" / "nomega_canonical_neural_execution_v1.json"
        artifact.write_text(json.dumps(report.to_dict(), indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        return report
