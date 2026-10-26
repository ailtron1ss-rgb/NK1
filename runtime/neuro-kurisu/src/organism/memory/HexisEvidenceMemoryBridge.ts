import { sha256Stable } from "../core/StableSerialization.ts";
import type { MemoryProvenanceClass, MemoryOS2 } from "../developmental/MemoryOS2.ts";
import { adaptHexisEvidence, type CanonicalHexisEvidence } from "./HexisEvidenceAdapter.ts";

export type HexisMemoryEvidenceIngressResult =
  | { status: "accepted"; memoryId: string; evidenceId: string; stance: CanonicalHexisEvidence["stance"]; independentSources: number }
  | { status: "duplicate"; memoryId: string; evidenceId: string; reason: "duplicate-evidence" | "duplicate-retired-evidence"; independentSources: number }
  | { status: "conflict"; memoryId: string; evidenceId: string; reason: "evidence-id-conflict" }
  | { status: "blocked"; memoryId: string; evidenceId: string; reason: "protected-memory-review-required" }
  | { status: "rejected"; reason: string; memoryId?: string; evidenceId?: string };

function provenanceClassForHexisSource(kind: string): MemoryProvenanceClass {
  const normalized = kind.toLocaleLowerCase().normalize("NFKC");
  if (/(^|[-_:])(user|human)([-_:]|$)/u.test(normalized)) return "user";
  if (/(device|sensor|android|termux|os)/u.test(normalized)) return "device";
  if (/(agent|model|llm|organism)/u.test(normalized)) return "agent";
  if (/(simulation|synthetic|sandbox)/u.test(normalized)) return "simulation";
  if (/(derived|inference|internal)/u.test(normalized)) return "derived";
  if (/(document|paper|web|api|external|repository|tool|browser)/u.test(normalized)) return "external";
  return "unknown";
}

/**
 * Converts a validated Hexis evidence envelope into NK1's canonical MemoryOS2
 * provenance trail. This function never revises belief confidence and never
 * promotes a skill; those decisions remain with the existing evaluator/gates.
 */
export function ingestHexisEvidenceIntoMemory(
  memoryOS: MemoryOS2,
  input: unknown,
): HexisMemoryEvidenceIngressResult {
  const adapted = adaptHexisEvidence(input);
  if (!adapted.accepted) return { status: "rejected", reason: adapted.reason };

  const evidence = adapted.evidence;
  if (evidence.protectedMemory) {
    return {
      status: "blocked",
      memoryId: evidence.memoryId,
      evidenceId: evidence.evidenceId,
      reason: "protected-memory-review-required",
    };
  }

  const observedAt = Date.parse(evidence.observedAt);
  const provenanceClass = provenanceClassForHexisSource(evidence.source.kind);
  // The content digest binds identity, stance, provenance, time, confidence and
  // note. The source reference gets its own digest because MemoryOS2's lineage
  // key is intentionally short and the original reference can be longer.
  const digest = sha256Stable(evidence, "legacy");
  const independenceKey = sha256Stable(
    { kind: evidence.source.kind, ref: evidence.source.ref },
    "legacy",
  );

  const result = memoryOS.recordEvidence(evidence.memoryId, {
    evidenceId: evidence.evidenceId,
    digest,
    stance: evidence.stance,
    sourceKind: evidence.source.kind,
    sourceRef: evidence.source.ref,
    ...(evidence.source.label ? { label: evidence.source.label } : {}),
    ...(evidence.source.author ? { author: evidence.source.author } : {}),
    ...(evidence.note ? { note: evidence.note } : {}),
    confidence01: evidence.confidence,
    observedAt,
    protectedMemory: false,
    provenanceClass,
    independenceKey,
  });

  if (!result.ok) {
    if (result.reason === "protected-memory-review-required") {
      return { status: "blocked", memoryId: evidence.memoryId, evidenceId: evidence.evidenceId, reason: result.reason };
    }
    if (result.reason === "evidence-id-conflict") {
      return { status: "conflict", memoryId: evidence.memoryId, evidenceId: evidence.evidenceId, reason: result.reason };
    }
    return { status: "rejected", memoryId: evidence.memoryId, evidenceId: evidence.evidenceId, reason: result.reason };
  }
  if (!result.added) {
    return {
      status: "duplicate",
      memoryId: evidence.memoryId,
      evidenceId: evidence.evidenceId,
      reason: result.reason === "duplicate-retired-evidence" ? result.reason : "duplicate-evidence",
      independentSources: result.independentSources,
    };
  }
  return {
    status: "accepted",
    memoryId: result.memoryId,
    evidenceId: evidence.evidenceId,
    stance: evidence.stance,
    independentSources: result.independentSources,
  };
}
