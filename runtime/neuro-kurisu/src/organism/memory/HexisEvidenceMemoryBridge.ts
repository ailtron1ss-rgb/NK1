import { sha256Stable } from "../core/StableSerialization.ts";
import type { MemoryProvenanceClass, MemoryOS2 } from "../developmental/MemoryOS2.ts";
import type { MemoryFabric } from "./MemoryFabric.ts";
import type { EventLog } from "./EventSourcing.ts";
import {
  type HexisBeliefRevisionInput,
  type HexisReviewDecision,
  type HexisAdaptationFabric,
} from "../integration/hexis/HexisAdaptationFabric.ts";
import { adaptHexisEvidence, type CanonicalHexisEvidence } from "./HexisEvidenceAdapter.ts";

/** The canonical runtime writer/event log; used by production ingress, not a parallel store. */
export interface HexisCanonicalMemoryWriter {
  fabric: MemoryFabric;
  events: EventLog;
}

export type HexisMemoryEvidenceIngressResult =
  | { status: "accepted"; memoryId: string; evidenceId: string; stance: CanonicalHexisEvidence["stance"]; independentSources: number; evidence: CanonicalHexisEvidence }
  | { status: "duplicate"; memoryId: string; evidenceId: string; reason: "duplicate-evidence" | "duplicate-retired-evidence"; independentSources: number }
  | { status: "conflict"; memoryId: string; evidenceId: string; reason: "evidence-id-conflict" }
  | { status: "blocked"; memoryId: string; evidenceId: string; reason: "protected-memory-review-required" }
  | { status: "rejected"; reason: string; memoryId?: string; evidenceId?: string };

export type HexisEvidenceReviewIngressResult =
  | {
      status: "review-pending";
      memoryId: string;
      evidenceId: string;
      stance: CanonicalHexisEvidence["stance"];
      reviewId: string;
      reviewItemId: string;
      baselineConfidence01: number;
      proposedConfidence01: number;
      previewApplied: boolean;
      previewReason: string;
    }
  | Extract<HexisMemoryEvidenceIngressResult, { status: "duplicate" | "conflict" | "blocked" | "rejected" }>;

export type HexisEvidenceReviewDecisionResult =
  | {
      status: "decided";
      reviewId: string;
      reviewItemId: string;
      memoryId: string;
      decision: HexisReviewDecision;
      confidence01: number;
      confidenceChanged: boolean;
      reason: string;
      auditId?: string;
    }
  | { status: "rejected"; reviewId: string; reviewItemId: string; reason: string };

type HexisEvidenceReviewPayload = {
  pipeline: "nk1.hexis-evidence-review.v1";
  memoryId: string;
  evidenceId: string;
  digest: string;
  stance: CanonicalHexisEvidence["stance"];
  source: CanonicalHexisEvidence["source"];
  observedAt: string;
  evidenceConfidence01: number;
  note?: string;
  baselineConfidence01: number;
  proposedConfidence01: number;
  previewApplied: boolean;
  previewReason: string;
};

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

function resultFromCanonicalMemory(
  memoryOS: MemoryOS2,
  evidence: CanonicalHexisEvidence,
  writer?: HexisCanonicalMemoryWriter,
): HexisMemoryEvidenceIngressResult {
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
  const digest = sha256Stable(evidence, "legacy");
  // Detect both visible conflicts and replay after the detailed evidence ring
  // rotated. This check prevents a retry from creating a second pending review.
  const canonicalMemory = memoryOS.snapshot().items.find((item) => item.id === evidence.memoryId);
  if (!canonicalMemory) {
    return { status: "rejected", memoryId: evidence.memoryId, evidenceId: evidence.evidenceId, reason: "memory-not-found" };
  }
  const visible = canonicalMemory.evidenceRecords?.find((record) => record.evidenceId === evidence.evidenceId);
  if (visible) {
    if (visible.digest.toLowerCase() !== digest.toLowerCase()) {
      return { status: "conflict", memoryId: evidence.memoryId, evidenceId: evidence.evidenceId, reason: "evidence-id-conflict" };
    }
    return {
      status: "duplicate",
      memoryId: evidence.memoryId,
      evidenceId: evidence.evidenceId,
      reason: "duplicate-evidence",
      independentSources: memoryOS.evidenceTrail(evidence.memoryId)?.sources.length ?? 0,
    };
  }
  if (memoryOS.hasEvidenceId(evidence.memoryId, evidence.evidenceId)) {
    return {
      status: "duplicate",
      memoryId: evidence.memoryId,
      evidenceId: evidence.evidenceId,
      reason: "duplicate-retired-evidence",
      independentSources: memoryOS.evidenceTrail(evidence.memoryId)?.sources.length ?? 0,
    };
  }
  const independenceKey = sha256Stable(
    { kind: evidence.source.kind, ref: evidence.source.ref },
    "legacy",
  );
  const recordInput = {
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
  };
  let result: ReturnType<MemoryOS2["recordEvidence"]>;
  try {
    if (writer) {
      const commandId = "hexis-evidence:" + sha256Stable(
        { memoryId: evidence.memoryId, evidenceId: evidence.evidenceId },
        "legacy",
      );
      const commandResult = writer.fabric.applyLifecycleCommand({
        action: "record-evidence",
        id: evidence.memoryId,
        input: recordInput,
        commandId,
        tick: Math.max(0, Math.floor(observedAt)),
      });
      if (!commandResult || typeof commandResult !== "object" || !("ok" in commandResult) || !("added" in commandResult)) {
        return { status: "rejected", memoryId: evidence.memoryId, evidenceId: evidence.evidenceId, reason: "memory-fabric-evidence-result-invalid" };
      }
      result = commandResult as ReturnType<MemoryOS2["recordEvidence"]>;
    } else {
      result = memoryOS.recordEvidence(evidence.memoryId, recordInput);
    }
  } catch (error) {
    return {
      status: "rejected",
      memoryId: evidence.memoryId,
      evidenceId: evidence.evidenceId,
      reason: "memory-fabric-evidence-write-failed:" + String((error as Error)?.message ?? error).slice(0, 160),
    };
  }

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
    evidence,
  };
}

/**
 * Evidence-only ingress. It writes provenance into the one canonical MemoryOS2
 * store and does not revise belief confidence or promote a skill.
 */
export function ingestHexisEvidenceIntoMemory(
  memoryOS: MemoryOS2,
  input: unknown,
  writer?: HexisCanonicalMemoryWriter,
): HexisMemoryEvidenceIngressResult {
  const adapted = adaptHexisEvidence(input);
  if (!adapted.accepted) return { status: "rejected", reason: adapted.reason };
  return resultFromCanonicalMemory(memoryOS, adapted.evidence, writer);
}

function reviewInputFromPayload(payload: HexisEvidenceReviewPayload, confidence01: number, trust01?: number, protectedBelief?: boolean): HexisBeliefRevisionInput | null {
  if (payload.stance === "contextualizes") return null;
  return {
    memoryId: payload.memoryId,
    confidence01,
    ...(trust01 !== undefined ? { trust01 } : {}),
    stance: payload.stance,
    evidence: {
      ref: payload.source.ref,
      ...(payload.source.label ? { label: payload.source.label } : {}),
      contentHash: payload.digest,
      trust01: payload.evidenceConfidence01,
      ...(payload.note ? { note: payload.note } : {}),
    },
    context: "NK1 canonical-memory evidence review:" + payload.evidenceId,
    at: Date.parse(payload.observedAt),
    protectedBelief,
  };
}

/**
 * Full ingress-to-review path. An accepted evidence receipt becomes a pending
 * Hexis learning-review item. The belief proposal is previewed without applying
 * confidence changes; the sole canonical memory confidence is changed only by
 * decideHexisEvidenceReview(..., "approve").
 */
export function ingestHexisEvidenceForReview(
  memoryOS: MemoryOS2,
  fabric: HexisAdaptationFabric,
  input: unknown,
  writer?: HexisCanonicalMemoryWriter,
): HexisEvidenceReviewIngressResult {
  const adapted = adaptHexisEvidence(input);
  if (!adapted.accepted) return { status: "rejected", reason: adapted.reason };

  // The evidence receipt and its pending review are one logical operation across
  // two owners. Snapshot both before the canonical append so a thrown/failed
  // review creation cannot leave durable evidence that can never be reviewed
  // on retry (the duplicate receipt would otherwise short-circuit ingestion).
  const memoryBefore = memoryOS.snapshot();
  const fabricBefore = fabric.snapshot();
  const memoryFabricBefore = writer?.fabric.snapshot();
  const eventLogBefore = writer?.events.list();
  let failureReason = "hexis-review-ingress-failed";
  let memoryId = adapted.evidence.memoryId;
  let evidenceId = adapted.evidence.evidenceId;
  try {
    const ingress = resultFromCanonicalMemory(memoryOS, adapted.evidence, writer);
    if (ingress.status !== "accepted") return ingress;

    const evidence = ingress.evidence;
    const digest = sha256Stable(evidence, "legacy");
    const snapshot = memoryOS.snapshot();
    const memory = snapshot.items.find((item) => item.id === evidence.memoryId);
    if (!memory) {
      failureReason = "memory-missing-after-canonical-evidence-append";
      throw new Error(failureReason);
    }

    let proposedConfidence01 = memory.confidence;
    let previewApplied = false;
    let previewReason = "contextual-evidence-only";
    const baselineConfidence01 = memory.confidence;
    const protectedBelief = memory.kind === "identity" || memory.kind === "autobiographical";
    if (evidence.stance !== "contextualizes") {
      const belief = fabric.registerOrUpdateBelief({
        memoryId: memory.id,
        confidence01: memory.confidence,
        trust01: memory.sourceAuthority01 ?? 0.5,
        at: Date.parse(evidence.observedAt),
      });
      const payload: HexisEvidenceReviewPayload = {
        pipeline: "nk1.hexis-evidence-review.v1",
        memoryId: memory.id,
        evidenceId: evidence.evidenceId,
        digest,
        stance: evidence.stance,
        source: evidence.source,
        observedAt: evidence.observedAt,
        evidenceConfidence01: evidence.confidence,
        ...(evidence.note ? { note: evidence.note } : {}),
        baselineConfidence01,
        proposedConfidence01,
        previewApplied,
        previewReason,
      };
      const reviewInput = reviewInputFromPayload(payload, memory.confidence, belief.trust01, protectedBelief);
      if (!reviewInput) {
        failureReason = "hexis-review-input-expected";
        throw new Error(failureReason);
      }
      const preview = fabric.previewBeliefRevision(reviewInput);
      proposedConfidence01 = preview.posteriorConfidence01;
      previewApplied = preview.applied;
      previewReason = preview.reason;
      payload.proposedConfidence01 = proposedConfidence01;
      payload.previewApplied = previewApplied;
      payload.previewReason = previewReason;
      const review = fabric.createLearningReview({
        periodStart: Date.parse(evidence.observedAt),
        periodEnd: Date.parse(evidence.observedAt),
        summary: "Hexis evidence requires review before canonical belief confidence may change.",
        items: [{
          kind: "semantic_belief",
          title: evidence.stance === "supports" ? "Review supporting evidence" : "Review contradicting evidence",
          content: (evidence.note || "Evidence from " + evidence.source.kind + ":" + evidence.source.ref + " was recorded for canonical memory " + memory.id).slice(0, 2000),
          sourceMemoryId: memory.id,
          evidence: payload as unknown as Record<string, unknown>,
        }],
      });
      const item = review.items[0];
      if (!item) {
        failureReason = "hexis-review-item-not-created";
        throw new Error(failureReason);
      }
      return {
        status: "review-pending",
        memoryId: memory.id,
        evidenceId: evidence.evidenceId,
        stance: evidence.stance,
        reviewId: review.id,
        reviewItemId: item.id,
        baselineConfidence01,
        proposedConfidence01,
        previewApplied,
        previewReason,
      };
    }

    const payload: HexisEvidenceReviewPayload = {
      pipeline: "nk1.hexis-evidence-review.v1",
      memoryId: memory.id,
      evidenceId: evidence.evidenceId,
      digest,
      stance: evidence.stance,
      source: evidence.source,
      observedAt: evidence.observedAt,
      evidenceConfidence01: evidence.confidence,
      ...(evidence.note ? { note: evidence.note } : {}),
      baselineConfidence01,
      proposedConfidence01,
      previewApplied,
      previewReason,
    };
    const review = fabric.createLearningReview({
      periodStart: Date.parse(evidence.observedAt),
      periodEnd: Date.parse(evidence.observedAt),
      summary: "Contextual Hexis evidence is recorded for review; it does not revise confidence.",
      items: [{
        kind: "semantic_belief",
        title: "Review contextual evidence",
        content: (evidence.note || "Context from " + evidence.source.kind + ":" + evidence.source.ref + " was recorded for canonical memory " + memory.id).slice(0, 2000),
        sourceMemoryId: memory.id,
        evidence: payload as unknown as Record<string, unknown>,
      }],
    });
    const item = review.items[0];
    if (!item) {
      failureReason = "hexis-review-item-not-created";
      throw new Error(failureReason);
    }
    return {
      status: "review-pending",
      memoryId: memory.id,
      evidenceId: evidence.evidenceId,
      stance: evidence.stance,
      reviewId: review.id,
      reviewItemId: item.id,
      baselineConfidence01,
      proposedConfidence01,
      previewApplied,
      previewReason,
    };
  } catch {
    try {
      memoryOS.restore(memoryBefore);
      if (writer && memoryFabricBefore) writer.fabric.restore(memoryFabricBefore);
      if (writer && eventLogBefore) writer.events.restore(eventLogBefore);
      fabric.restore(fabricBefore);
    } catch {
      failureReason = "hexis-review-ingress-rollback-failed";
    }
    return { status: "rejected", reason: failureReason, memoryId, evidenceId };
  }
}

/**
 * Applies an approved belief proposal with a compare-before-write guard. Review
 * approval, the Hexis audit and the canonical confidence update roll back as a
 * unit if any of those steps fails. Correct/forget decisions remain review
 * metadata only; they do not silently rewrite or erase canonical memory.
 */
export function decideHexisEvidenceReview(
  memoryOS: MemoryOS2,
  fabric: HexisAdaptationFabric,
  reviewId: string,
  reviewItemId: string,
  decision: HexisReviewDecision,
  correction?: string,
  writer?: HexisCanonicalMemoryWriter,
): HexisEvidenceReviewDecisionResult {
  const review = fabric.getLearningReview(reviewId);
  const item = review?.items.find((candidate) => candidate.id === reviewItemId);
  const reject = (reason: string): HexisEvidenceReviewDecisionResult => ({ status: "rejected", reviewId, reviewItemId, reason });
  if (!review || !item || item.status !== "pending") return reject("review-item-not-pending");
  const payload = item.evidence as Partial<HexisEvidenceReviewPayload>;
  if (payload.pipeline !== "nk1.hexis-evidence-review.v1" || typeof payload.memoryId !== "string" ||
      item.sourceMemoryId !== payload.memoryId || typeof payload.evidenceId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/.test(payload.evidenceId) ||
      !/^[a-f0-9]{64}$/i.test(String(payload.digest ?? ""))) {
    return reject("not-a-valid-hexis-evidence-review");
  }
  if (payload.stance !== "supports" && payload.stance !== "contradicts" && payload.stance !== "contextualizes") {
    return reject("invalid-review-stance");
  }
  if (typeof payload.baselineConfidence01 !== "number" || !Number.isFinite(payload.baselineConfidence01) ||
      typeof payload.proposedConfidence01 !== "number" || !Number.isFinite(payload.proposedConfidence01) ||
      typeof payload.previewApplied !== "boolean" || typeof payload.previewReason !== "string" ||
      typeof payload.evidenceConfidence01 !== "number" || !Number.isFinite(payload.evidenceConfidence01) ||
      payload.evidenceConfidence01 < 0 || payload.evidenceConfidence01 > 1 ||
      typeof payload.observedAt !== "string" || !Number.isFinite(Date.parse(payload.observedAt)) ||
      typeof payload.source !== "object" || payload.source === null ||
      typeof payload.source.kind !== "string" || typeof payload.source.ref !== "string" ||
      !payload.source.kind.trim() || payload.source.kind.length > 96 ||
      !payload.source.ref.trim() || payload.source.ref.length > 512) {
    return reject("invalid-review-evidence-metadata");
  }

  if (decision !== "approve") {
    const decided = fabric.decideLearningReview(reviewId, reviewItemId, decision, correction);
    if (!decided) return reject("review-decision-rejected");
    const memory = memoryOS.snapshot().items.find((candidate) => candidate.id === payload.memoryId);
    return {
      status: "decided",
      reviewId,
      reviewItemId,
      memoryId: payload.memoryId,
      decision,
      confidence01: memory?.confidence ?? Number(payload.baselineConfidence01 ?? 0),
      confidenceChanged: false,
      reason: decision === "correct" ? "correction-saved-in-review-only" : "review-dismissed-without-memory-deletion",
    };
  }

  const memorySnapshot = memoryOS.snapshot();
  const memory = memorySnapshot.items.find((candidate) => candidate.id === payload.memoryId);
  if (!memory) return reject("canonical-memory-no-longer-exists");
  const evidenceRecord = memory.evidenceRecords?.find((record) => record.evidenceId === payload.evidenceId && record.digest.toLowerCase() === String(payload.digest).toLowerCase());
  if (!evidenceRecord) return reject("canonical-evidence-receipt-missing-or-retired");

  const baseline = payload.baselineConfidence01;
  if (typeof baseline !== "number" || !Number.isFinite(baseline) || Math.abs(memory.confidence - baseline) > 1e-9) {
    return reject("stale-review-canonical-confidence-changed");
  }

  const stance = payload.stance;
  if (stance === "contextualizes") {
    const memoryBefore = memorySnapshot;
    const fabricBefore = fabric.snapshot();
    try {
      const decided = fabric.decideLearningReview(reviewId, reviewItemId, "approve");
      if (!decided) return reject("review-decision-rejected");
      fabric.registerOrUpdateBelief({ memoryId: memory.id, confidence01: memory.confidence, trust01: memory.sourceAuthority01 ?? 0.5 });
      return {
        status: "decided",
        reviewId,
        reviewItemId,
        memoryId: memory.id,
        decision: "approve",
        confidence01: memory.confidence,
        confidenceChanged: false,
        reason: "contextual-evidence-approved-without-confidence-change",
      };
    } catch {
      memoryOS.restore(memoryBefore);
      if (writer && memoryFabricBefore) writer.fabric.restore(memoryFabricBefore);
      if (writer && eventLogBefore) writer.events.restore(eventLogBefore);
      fabric.restore(fabricBefore);
      return reject("approval-failed-and-rolled-back");
    }
  }

  const revisionInput = reviewInputFromPayload(payload as HexisEvidenceReviewPayload, memory.confidence, memory.sourceAuthority01 ?? 0.5,
    memory.kind === "identity" || memory.kind === "autobiographical");
  if (!revisionInput) return reject("review-stance-does-not-revise-belief");
  // Preview against current lineage before changing either the review or memory.
  const preview = fabric.previewBeliefRevision(revisionInput);
  if (Math.abs(preview.posteriorConfidence01 - Number(payload.proposedConfidence01)) > 1e-9 ||
      preview.applied !== payload.previewApplied || preview.reason !== payload.previewReason) {
    return reject("stale-review-belief-preview-changed");
  }

  const fabricBefore = fabric.snapshot();
  const memoryFabricBefore = writer?.fabric.snapshot();
  const eventLogBefore = writer?.events.list();
  try {
    const decided = fabric.decideLearningReview(reviewId, reviewItemId, "approve");
    if (!decided) return reject("review-decision-rejected");
    fabric.registerOrUpdateBelief({
      memoryId: memory.id,
      confidence01: memory.confidence,
      trust01: memory.sourceAuthority01 ?? 0.5,
      at: Date.parse(payload.observedAt),
    });
    const audit = fabric.reviseBelief(revisionInput);
    let updatedConfidence01 = memory.confidence;
    if (audit.applied) {
      const updatedRaw = writer
        ? writer.fabric.applyLifecycleCommand({
            action: "update-signals",
            id: memory.id,
            patch: { confidence: audit.posteriorConfidence01 },
            reason: "hexis-reviewed-evidence:" + payload.evidenceId,
            commandId: "hexis-review-confidence:" + sha256Stable({ reviewId, reviewItemId, memoryId: memory.id }, "legacy"),
            tick: Math.max(0, Math.floor(Date.parse(payload.observedAt))),
          })
        : memoryOS.updateSignals(memory.id, { confidence: audit.posteriorConfidence01 }, "hexis-reviewed-evidence:" + payload.evidenceId);
      if (!updatedRaw || typeof updatedRaw !== "object" || !("confidence" in updatedRaw)) throw new Error("canonical-confidence-update-failed");
      const updated = updatedRaw as { confidence: number };
      updatedConfidence01 = updated.confidence;
      fabric.registerOrUpdateBelief({
        memoryId: memory.id,
        confidence01: updated.confidence,
        trust01: audit.posteriorTrust01,
        at: Date.parse(payload.observedAt),
      });
    } else {
      // Keep Hexis's projection aligned with the canonical owner even when this
      // review is approved but policy says no belief revision should be applied.
      fabric.registerOrUpdateBelief({ memoryId: memory.id, confidence01: memory.confidence, trust01: audit.posteriorTrust01 });
    }
    return {
      status: "decided",
      reviewId,
      reviewItemId,
      memoryId: memory.id,
      decision: "approve",
      confidence01: updatedConfidence01,
      confidenceChanged: Math.abs(updatedConfidence01 - memory.confidence) > 1e-12,
      reason: audit.reason,
      auditId: audit.id,
    };
  } catch {
    memoryOS.restore(memorySnapshot);
    if (writer && memoryFabricBefore) writer.fabric.restore(memoryFabricBefore);
    if (writer && eventLogBefore) writer.events.restore(eventLogBefore);
    fabric.restore(fabricBefore);
    return reject("approval-failed-and-rolled-back");
  }
}
