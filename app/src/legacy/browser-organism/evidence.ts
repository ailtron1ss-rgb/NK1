import type { Belief, EvidenceKind } from "./types";
import { clamp01, id } from "./math";
import { tokenize } from "./encoder";

/** NOMEGA rule: never promote HYPOTHESIS to FACT without independent support. */
export class EvidenceLedger {
  beliefs: Belief[] = [];

  note(claim: string, kind: EvidenceKind, source: string, support = 1) {
    const key = tokenize(claim).slice(0, 6).join(" ");
    const existing = this.beliefs.find((b) => tokenize(b.claim).slice(0, 6).join(" ") === key);
    if (existing) {
      existing.support += support;
      existing.updatedAt = Date.now();
      existing.confidence = clamp01(existing.confidence + 0.08 * support);
      existing.kind = promote(existing);
      return existing;
    }
    const b: Belief = {
      id: id(),
      claim: claim.slice(0, 240),
      kind,
      confidence: kind === "FACT" ? 0.9 : kind === "MEASURED" ? 0.7 : kind === "ESTIMATED" ? 0.45 : 0.25,
      support,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source,
    };
    this.beliefs.unshift(b);
    this.beliefs = this.beliefs.slice(0, 80);
    return b;
  }

  contradict(claim: string) {
    const tokens = new Set(tokenize(claim));
    for (const b of this.beliefs) {
      const overlap = tokenize(b.claim).filter((t) => tokens.has(t)).length;
      if (overlap >= 2) {
        b.confidence = clamp01(b.confidence - 0.2);
        b.kind = b.confidence < 0.4 ? "HYPOTHESIS" : b.kind;
        b.updatedAt = Date.now();
      }
    }
  }

  restore(raw?: Belief[]) {
    this.beliefs = Array.isArray(raw) ? raw.slice(0, 80) : [];
  }
}

function promote(b: Belief): EvidenceKind {
  if (b.kind === "FACT") return "FACT";
  if (b.kind === "MEASURED" && b.support >= 6 && b.confidence > 0.85) return "MEASURED";
  if (b.kind === "HYPOTHESIS" && b.support >= 4 && b.confidence > 0.7) return "ESTIMATED";
  if (b.kind === "ESTIMATED" && b.support >= 8 && b.confidence > 0.82) return "MEASURED";
  return b.kind;
}
