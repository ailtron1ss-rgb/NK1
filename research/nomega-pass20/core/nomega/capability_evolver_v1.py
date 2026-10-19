from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence, List, Tuple
import hashlib, json, random

from .program_acquisition_v2 import Program
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
from .evolution_archive_v1 import EvolutionArchiveV1


@dataclass(frozen=True)
class OperatorGenomeV1:
    primitives: Tuple[str, ...]
    max_depth: int = 2
    mutation_rate: float = 0.7

    def __post_init__(self):
        allowed = {
            "replace_opcode", "swap_adjacent", "replace_operand",
            "duplicate_instruction", "drop_instruction", "insert_load",
        }
        if not self.primitives:
            raise ValueError("genome requires at least one primitive")
        unknown = set(self.primitives) - allowed
        if unknown:
            raise ValueError(f"unknown primitives: {sorted(unknown)}")
        if int(self.max_depth) < 1 or int(self.max_depth) > 4:
            raise ValueError("max_depth must be in [1, 4]")
        if not 0.0 <= float(self.mutation_rate) <= 1.0:
            raise ValueError("mutation_rate must be in [0,1]")

    def fingerprint(self) -> str:
        payload = {
            "primitives": sorted(set(self.primitives)),
            "max_depth": int(self.max_depth),
            "mutation_rate": round(float(self.mutation_rate), 6),
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:24]


@dataclass(frozen=True)
class CapabilityDiscoveryReportV1:
    version: str
    family: str
    candidates: int
    verified: int
    best_success: float
    best_complexity: float
    baseline_present: bool
    lineage: Tuple[Mapping[str, Any], ...]
    genome_diversity: int
    verified_novel_candidates: int
    generations: int
    budget: int
    best_code: Tuple[Tuple[int, int, int], ...] = ()
    best_operator: Mapping[str, Any] | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["lineage"] = [dict(x) for x in self.lineage]
        return d


class CapabilityEvolverV1:
    VERSION = "capability-evolver-v1"
    MAX_PROGRAM_LEN = 48
    OPCODES = (1, 3, 4, 5, 6, 7, 13, 14, 15, 17, 18)

    def __init__(self, root: Path | None = None, seed: int = 12091):
        self.root = Path(root) if root is not None else Path(".")
        self.seed = int(seed)
        self.rng = random.Random(self.seed)
        self.log = self.root / "runtime" / "capability_evolution_v1.jsonl"
        self.archive = EvolutionArchiveV1(self.root)

    @staticmethod
    def _fp(code: Sequence[Sequence[int]]) -> str:
        return hashlib.sha256(json.dumps([list(map(int, x)) for x in code], sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:24]

    @staticmethod
    def _distance(a: Sequence[Sequence[int]], b: Sequence[Sequence[int]]) -> float:
        m = max(len(a), len(b), 1)
        diff = abs(len(a) - len(b))
        for i in range(min(len(a), len(b))):
            diff += sum(int(x) != int(y) for x, y in zip(a[i], b[i])) / 3.0
        return min(1.0, diff / (m * 1.5))

    def _one(self, code: Program, primitive: str, rng: random.Random) -> Program:
        p = [tuple(map(int, x)) for x in code]
        if not p:
            return [(13, 0, 0), (14, 0, 0)]
        i = rng.randrange(len(p))
        if primitive == "replace_opcode":
            op, a, b = p[i]
            p[i] = (rng.choice(self.OPCODES), a, b)
        elif primitive == "swap_adjacent" and len(p) > 1:
            j = min(i, len(p) - 2)
            p[j], p[j + 1] = p[j + 1], p[j]
        elif primitive == "replace_operand":
            op, a, b = p[i]
            p[i] = (op, rng.randrange(4), b if rng.random() < 0.5 else rng.randrange(4))
        elif primitive == "duplicate_instruction":
            p.insert(min(len(p), i + 1), p[i])
        elif primitive == "drop_instruction" and len(p) > 2:
            p.pop(i)
        elif primitive == "insert_load":
            p.insert(min(i, len(p)), (1, rng.randrange(4), 0))
        return p[: self.MAX_PROGRAM_LEN]

    def apply_operator(self, code: Program, genome: OperatorGenomeV1) -> Program:
        out = [tuple(map(int, x)) for x in code]
        local = random.Random(self.seed + genome.max_depth * 97 + len(out) * 13)
        for depth in range(int(genome.max_depth)):
            if local.random() > float(genome.mutation_rate):
                continue
            primitive = genome.primitives[local.randrange(len(genome.primitives))]
            out = self._one(out, primitive, local)
        return out[: self.MAX_PROGRAM_LEN]

    @staticmethod
    def _expected_rows(rows: Sequence[Tuple[Sequence[int], int]]) -> list[tuple[list[int], int]]:
        return [(list(map(int, tape)), int(expected) & 255) for tape, expected in rows]

    def _evaluate(self, code: Program, rows: Sequence[Tuple[Sequence[int], int]]) -> tuple[float, float, int]:
        tiny_ok = 0
        hvm_ok = 0
        for tape, expected in rows:
            tiny = run_tiny_v2(code, list(tape), 512)
            good = bool(tiny.get("ok")) and int(tiny.get("result", -1)) == (int(expected) & 255)
            tiny_ok += int(good)
            if good:
                hvm = run_hvm_compiled_v2(code, list(tape), 512)
                hvm_ok += int(bool(hvm.get("ok")) and int(hvm.get("result", -1)) == (int(expected) & 255))
        n = max(1, len(rows))
        return tiny_ok / n, hvm_ok / n, len(rows) - tiny_ok

    def _mutate_genome(self, genome: OperatorGenomeV1, rng: random.Random) -> OperatorGenomeV1:
        primitives = list(genome.primitives)
        allowed = [
            "replace_opcode", "swap_adjacent", "replace_operand",
            "duplicate_instruction", "drop_instruction", "insert_load",
        ]
        if rng.random() < 0.55:
            choice = rng.choice(allowed)
            if choice not in primitives:
                primitives.append(choice)
        if rng.random() < 0.35 and len(primitives) > 1:
            primitives.pop(rng.randrange(len(primitives)))
        if not primitives:
            primitives = ["replace_opcode"]
        depth = max(1, min(4, int(genome.max_depth) + rng.choice((-1, 0, 1))))
        rate = max(0.2, min(1.0, float(genome.mutation_rate) + rng.uniform(-0.15, 0.15)))
        return OperatorGenomeV1(tuple(primitives), depth, rate)

    def _baseline(self, family: str) -> Program:
        from .program_acquisition_v2 import ProgramAcquisitionCoreV2
        templates = ProgramAcquisitionCoreV2(self.root, seed=self.seed + 33).templates(family)
        return [tuple(map(int, x)) for x in (templates[0] if templates else [(13, 0, 0), (14, 0, 0)])]

    def discover(
        self,
        family: str,
        seed_code: Program | None,
        rows: Sequence[Tuple[Sequence[int], int]],
        verifier: Callable[[Program, Sequence[Tuple[Sequence[int], int]]], Tuple[float, float, int]] | None = None,
        *,
        budget: int = 16,
        generations: int = 3,
    ) -> CapabilityDiscoveryReportV1:
        budget = max(1, int(budget))
        generations = max(1, int(generations))
        verifier = verifier or self._evaluate
        baseline = [tuple(x) for x in (seed_code if seed_code else self._baseline(family))]
        rows2 = self._expected_rows(rows)
        seen = {self._fp(baseline)}
        lineage: list[dict[str, Any]] = [{
            "source": "safe_baseline", "family": str(family),
            "fingerprint": self._fp(baseline), "parent": None,
            "generation": 0, "novelty": 1.0,
        }]
        pool: list[tuple[Program, str, int, str]] = [(baseline, "safe_baseline", 0, "")]
        genomes = [
            OperatorGenomeV1(("replace_opcode", "replace_operand"), 1, 0.9),
            OperatorGenomeV1(("swap_adjacent", "drop_instruction", "insert_load"), 2, 0.8),
            OperatorGenomeV1(("duplicate_instruction", "replace_opcode", "replace_operand"), 2, 0.65),
        ]
        seen_genomes = {g.fingerprint() for g in genomes}
        best_success = -1.0
        best_complexity = float("inf")
        verified_total = 0
        verified_novel_candidates = 0
        best_code: Tuple[Tuple[int, int, int], ...] = tuple(tuple(x) for x in baseline)
        best_operator: Mapping[str, Any] | None = None
        for generation in range(1, generations + 1):
            parents = [row[0] for row in pool[-max(2, min(6, len(pool))):]]
            rng = random.Random(self.seed + generation * 101)
            expanded = list(genomes)
            for genome in list(genomes):
                child_genome = self._mutate_genome(genome, rng)
                if child_genome.fingerprint() not in seen_genomes:
                    seen_genomes.add(child_genome.fingerprint())
                    expanded.append(child_genome)
            genomes = expanded[-6:]
            candidates: list[tuple[Program, str, int, str]] = []
            for parent_i, parent in enumerate(parents):
                for genome_i, genome in enumerate(genomes):
                    if len(candidates) >= budget:
                        break
                    child = self.apply_operator(parent, genome)
                    fp = self._fp(child)
                    if fp in seen:
                        continue
                    seen.add(fp)
                    novelty = min(1.0, sum(self._distance(child, prior[0]) for prior in pool) / max(1, len(pool)))
                    candidates.append((child, f"genome:{genome_i}", generation, self._fp(parent)))
                    lineage.append({
                        "source": "evolved_operator", "family": str(family),
                        "fingerprint": fp, "parent": self._fp(parent),
                        "generation": generation, "novelty": novelty,
                        "genome": genome.fingerprint(),
                        "genome_spec": {
                            "primitives": list(genome.primitives),
                            "max_depth": int(genome.max_depth),
                            "mutation_rate": float(genome.mutation_rate),
                        },
                    })
                if len(candidates) >= budget:
                    break
            scored: list[tuple[float, Program, str, int, str, dict[str, Any]]] = []
            # Safe baseline remains eligible every generation and is never removed.
            candidates.insert(0, (baseline, "safe_baseline", 0, ""))
            for code, source, gen, parent_fp in candidates[:budget]:
                tiny, hvm, counter = verifier(code, rows2)
                verified = hvm >= 0.999 and tiny >= 0.999
                complexity = float(len(code)) / self.MAX_PROGRAM_LEN
                novelty = min(1.0, sum(self._distance(code, prior[0]) for prior in pool) / max(1, len(pool)))
                score = 0.60 * hvm + 0.15 * tiny + 0.15 * novelty - 0.10 * complexity - 0.01 * counter
                scored.append((score, code, source, gen, parent_fp, {
                    "source": source, "tiny_rate": tiny, "hvm_rate": hvm,
                    "verified": verified, "complexity": complexity,
                    "counterexamples": counter, "novelty": novelty,
                }))
                verified_total += int(verified)
                if verified and source != "safe_baseline":
                    verified_novel_candidates += 1
                    self.archive.add(
                        family=str(family), operator=str(source), code=code, verified=True,
                        success=float(hvm), search_cost=float(len(code)),
                        complexity=float(complexity), source="open_ended_evolver",
                        cycle_id=f"{family}-g{generation}",
                    )
                if hvm > best_success or (hvm == best_success and complexity < best_complexity):
                    best_success, best_complexity = hvm, complexity
                    best_code = tuple(tuple(int(v) for v in row) for row in code)
                    if source != "safe_baseline":
                        genome_spec = next((
                            item.get("genome_spec")
                            for item in reversed(lineage)
                            if item.get("fingerprint") == self._fp(code) and item.get("genome_spec")
                        ), None)
                        best_operator = dict(genome_spec) if genome_spec else None
            scored.sort(key=lambda x: (-x[0], -float(x[5]["hvm_rate"]), float(x[5]["complexity"]), str(x[2])))
            pool = [(x[1], x[2], x[3], x[4]) for x in scored[: max(2, min(6, len(scored)))] ]
        result = CapabilityDiscoveryReportV1(
            self.VERSION, str(family), len(seen), verified_total, float(max(0.0, best_success)),
            float(best_complexity if best_complexity != float("inf") else 1.0),
            any(x.get("source") == "safe_baseline" for x in lineage), tuple(lineage),
            len(seen_genomes), verified_novel_candidates, generations, budget, best_code, best_operator,
        )
        self.log.parent.mkdir(parents=True, exist_ok=True)
        with self.log.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(result.to_dict(), sort_keys=True) + "\n")
        return result
