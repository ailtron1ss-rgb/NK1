"""Independent, dependency-free validator for privacy-reduced NK1 CEF exports."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "nk1.inspect-evidence/v1"
FULL_STAGES = ("observation", "prediction", "appraisal", "attention", "memory", "goal", "plan", "action", "outcome", "learning", "self-update")
CORE_STAGES = ("observation", "prediction", "action", "outcome", "learning", "self-update")
FULL_EDGES = (
    ("prediction", "observation"), ("action", "prediction"), ("action", "observation"),
    ("outcome", "action"), ("learning", "outcome"), ("self-update", "learning"),
    ("appraisal", "observation"), ("appraisal", "prediction"),
    ("attention", "appraisal"), ("attention", "prediction"),
    ("memory", "attention"), ("memory", "observation"),
    ("goal", "appraisal"), ("goal", "memory"), ("plan", "goal"),
    ("plan", "prediction"), ("action", "plan"), ("outcome", "prediction"),
    ("learning", "action"), ("self-update", "outcome"),
)
CORE_EDGES = FULL_EDGES[:6]


class EvidenceFormatError(ValueError):
    """Input evidence cannot be safely parsed or bounded."""


def _safe_id(value: Any) -> bool:
    return (isinstance(value, str) and 0 < len(value) <= 180 and value == value.strip()
            and not any(ord(ch) < 32 or 127 <= ord(ch) <= 159 for ch in value))


def _edge_missing(found: dict[str, dict[str, Any]], edges: tuple[tuple[str, str], ...]) -> list[str]:
    return [f"{child}->{parent}" for child, parent in edges
            if child not in found or parent not in found
            or found[parent].get("id") not in found[child].get("parentIds", [])]


def _validate_cycle(record: dict[str, Any]) -> dict[str, Any]:
    cycle = record.get("cycle")
    if not isinstance(cycle, dict) or not isinstance(record.get("tick"), int) or isinstance(record.get("tick"), bool):
        return {"full": False, "core": False, "integrity": 0.0, "missing_stages": list(FULL_STAGES),
                "invalid_stages": [], "missing_edges": [f"{a}->{b}" for a, b in FULL_EDGES], "issues": ["cycle-or-tick-invalid"]}
    tick, stage_ids = record["tick"], cycle.get("stageIds")
    if tick < 0 or not isinstance(stage_ids, dict):
        return {"full": False, "core": False, "integrity": 0.0, "missing_stages": list(FULL_STAGES),
                "invalid_stages": [], "missing_edges": [f"{a}->{b}" for a, b in FULL_EDGES], "issues": ["cycle-stage-map-invalid"]}

    events: dict[str, dict[str, Any]] = {}
    issues: list[str] = []
    rows = cycle.get("events")
    if not isinstance(rows, list):
        rows = []
        issues.append("cycle-events-not-array")
    for row in rows:
        if not isinstance(row, dict) or not _safe_id(row.get("id")):
            issues.append("cycle-event-invalid")
            continue
        if row["id"] in events:
            issues.append("duplicate-cycle-event-id")
            continue
        if row.get("tick") != tick or not isinstance(row.get("parentIds"), list):
            issues.append(f"cycle-event-contract-invalid:{row['id']}")
        events[row["id"]] = row

    found: dict[str, dict[str, Any]] = {}
    missing: list[str] = []
    invalid: list[str] = []
    seen: dict[str, str] = {}
    for stage in FULL_STAGES:
        event_id = stage_ids.get(stage)
        if event_id is None:
            missing.append(stage)
            continue
        if not _safe_id(event_id):
            invalid.append(f"{stage}:invalid-id")
            continue
        if event_id in seen:
            invalid.append(f"{stage}:duplicate-event-id-with-{seen[event_id]}")
            continue
        seen[event_id] = stage
        event = events.get(event_id)
        if event is None or event.get("stage") != stage:
            invalid.append(f"{stage}:event-missing-or-wrong-stage")
            continue
        found[stage] = event

    ambiguous = cycle.get("ambiguousStages", [])
    if not isinstance(ambiguous, list):
        ambiguous = []
        issues.append("ambiguous-stage-list-invalid")
    for stage in ambiguous:
        if stage in FULL_STAGES and stage not in missing:
            invalid.append(f"{stage}:ambiguous")

    missing_edges = _edge_missing(found, FULL_EDGES)
    core_missing = [s for s in CORE_STAGES if s not in found]
    core_edges = _edge_missing(found, CORE_EDGES)
    full = not missing and not invalid and not missing_edges and not issues
    core = not core_missing and not core_edges and not any(x.startswith(tuple(f"{s}:" for s in CORE_STAGES)) for x in invalid)
    integrity = 1.0 if full else 0.5 * ((11 - len(missing)) / 11) + 0.5 * ((20 - len(missing_edges)) / 20)

    verdict = cycle.get("verdict") if isinstance(cycle.get("verdict"), dict) else {}
    if verdict.get("fullComplete") is not full:
        issues.append("declared-full-complete-mismatch")
    if verdict.get("coreComplete") is not core:
        issues.append("declared-core-complete-mismatch")
    claimed_integrity = verdict.get("fullIntegrity01")
    if not isinstance(claimed_integrity, (int, float)) or isinstance(claimed_integrity, bool) or abs(claimed_integrity - integrity) > 1e-9:
        issues.append("declared-full-integrity-mismatch")
    if isinstance(verdict.get("fullMissingEdges"), list) and sorted(verdict["fullMissingEdges"]) != sorted(missing_edges):
        issues.append("declared-missing-edges-mismatch")
    if isinstance(verdict.get("fullMissingStages"), list) and sorted(verdict["fullMissingStages"]) != sorted(missing):
        issues.append("declared-missing-stages-mismatch")
    if isinstance(verdict.get("coreMissingEdges"), list) and sorted(verdict["coreMissingEdges"]) != sorted(core_edges):
        issues.append("declared-core-missing-edges-mismatch")

    return {"full": full, "core": core, "integrity": integrity, "missing_stages": missing,
            "invalid_stages": invalid, "missing_edges": missing_edges, "issues": issues}


def _check_event(value: Any, stage: str, execution_id: Any) -> tuple[dict[str, Any] | None, list[str]]:
    if not isinstance(value, dict):
        return None, [f"{stage}-event-missing"]
    payload = value.get("payload") if isinstance(value.get("payload"), dict) else {}
    problems = []
    if value.get("stage") != stage:
        problems.append(f"{stage}-wrong-stage")
    if payload.get("executionId") != execution_id:
        problems.append(f"{stage}-execution-id-mismatch")
    return value, problems


def _validate_receipts(record: dict[str, Any]) -> dict[str, Any]:
    audit = record.get("receiptAudit")
    if not isinstance(audit, dict) or not isinstance(audit.get("receipts"), list):
        return {"integrity": 0.0, "external_integrity": 0.0, "presence": 0.0,
                "count": 0, "claims": 0, "verified": 0, "invalid": 1, "issues": ["receipt-audit-invalid"]}
    receipts = audit["receipts"]
    invalid = claims = verified = 0
    issues: list[str] = []
    for index, receipt in enumerate(receipts):
        local: list[str] = []
        if not isinstance(receipt, dict):
            invalid += 1
            issues.append(f"receipt-{index}-not-object")
            continue
        execution_id = receipt.get("executionId")
        if not _safe_id(execution_id):
            local.append("receipt-execution-id-invalid")
        action, e1 = _check_event(receipt.get("action"), "tool-action", execution_id)
        outcome, e2 = _check_event(receipt.get("outcome"), "tool-outcome", execution_id)
        evidence, e3 = _check_event(receipt.get("evidence"), "tool-evidence", execution_id)
        local.extend(e1 + e2 + e3)
        if action and outcome and evidence:
            ap, op, ep = action.get("payload", {}), outcome.get("payload", {}), evidence.get("payload", {})
            tool, action_id, outcome_id = ap.get("tool"), action.get("id"), outcome.get("id")
            if not tool or op.get("tool") != tool or ep.get("tool") != tool:
                local.append("receipt-tool-mismatch")
            if action_id not in outcome.get("parentIds", []):
                local.append("receipt-outcome-parent-mismatch")
            if outcome_id not in evidence.get("parentIds", []):
                local.append("receipt-evidence-parent-mismatch")
            if not (action.get("tick") == outcome.get("tick") == evidence.get("tick")):
                local.append("receipt-tick-mismatch")
            if ap.get("decisionId") and (ap.get("decisionLinked") is not True or ap.get("decisionId") not in action.get("parentIds", [])):
                local.append("receipt-decision-link-invalid")
        top_hash = receipt.get("projectionHash")
        if top_hash is not None and (not isinstance(top_hash, str) or len(top_hash) != 64):
            local.append("receipt-projection-hash-invalid")

        revisions = receipt.get("receiptRevisions", [])
        if not isinstance(revisions, list):
            local.append("receipt-revisions-not-array")
            revisions = []
        for revision in revisions:
            rev, rev_issues = _check_event(revision.get("event") if isinstance(revision, dict) else None, "tool-reconciliation", execution_id)
            local.extend(rev_issues)
            if rev and isinstance(revision, dict):
                rp = rev.get("payload", {})
                if rp.get("revisionId") != revision.get("revisionId") or rp.get("projectionHash") != revision.get("projectionHash"):
                    local.append("receipt-revision-projection-mismatch")
                if not isinstance(revision.get("projectionHash"), str) or len(revision["projectionHash"]) != 64:
                    local.append("receipt-revision-hash-invalid")
                if outcome and outcome.get("id") not in rev.get("parentIds", []):
                    local.append("receipt-revision-outcome-link-missing")

        ext_rows = receipt.get("externalObservations", [])
        if not isinstance(ext_rows, list):
            ext_rows = []
            local.append("external-observations-not-array")
        valid_ext = []
        for ext in ext_rows:
            event, ext_issues = _check_event(ext.get("event") if isinstance(ext, dict) else None, "external-evidence", execution_id)
            if event and isinstance(ext, dict):
                p = event.get("payload", {})
                if p.get("observationId") != ext.get("observationId") or p.get("projectionHash") != ext.get("projectionHash"):
                    ext_issues.append("external-projection-binding-mismatch")
                if outcome and outcome.get("id") not in event.get("parentIds", []):
                    ext_issues.append("external-outcome-parent-mismatch")
                expected_hash, observed_hash = p.get("expectedPostconditionHash"), p.get("observedPostconditionHash")
                if (p.get("verified") is True and p.get("evidenceStatus") == "corroborated"
                        and p.get("expectedPostconditionPresent") is True and p.get("observedPostconditionPresent") is True
                        and isinstance(expected_hash, str) and len(expected_hash) == 64 and expected_hash == observed_hash
                        and bool(p.get("independenceKey")) and not ext_issues):
                    valid_ext.append(ext)
            local.extend(ext_issues)

        ep = evidence.get("payload", {}) if evidence else {}
        external_claim = ep.get("externalObservation") is True and ep.get("verificationBasis") == "external-postcondition"
        matching_ext = any(
            row.get("observationId") == ep.get("observationId")
            and row.get("event", {}).get("payload", {}).get("toolId") == ep.get("tool")
            for row in valid_ext if isinstance(row, dict) and isinstance(row.get("event"), dict)
        )
        externally_verified = bool(external_claim and ep.get("observationIntegrated") is True and matching_ext)
        claims += int(external_claim)
        verified += int(externally_verified)
        if external_claim and not externally_verified:
            local.append("external-postcondition-not-corroborated")
        if receipt.get("externalPostconditionClaim") is not external_claim:
            local.append("exporter-external-claim-flag-mismatch")
        if receipt.get("externalPostconditionVerified") is not externally_verified:
            local.append("exporter-external-verdict-flag-mismatch")
        if local or receipt.get("integrity01") != 1:
            invalid += 1
            issues.extend(local or ["exporter-reported-receipt-invalid"])

    intact = len(receipts) - invalid
    expected = {"receiptCount": len(receipts), "intactReceiptCount": intact, "invalidReceiptCount": invalid,
                "externalPostconditionClaimCount": claims, "externallyCorroboratedCount": verified}
    for key, value in expected.items():
        if audit.get(key) != value:
            issues.append(f"receipt-summary-mismatch:{key}")
    return {"integrity": 1.0 if invalid == 0 and not issues else 0.0,
            "external_integrity": 1.0 if claims == 0 or claims == verified else verified / max(1, claims),
            "presence": 1.0 if receipts else 0.0, "count": len(receipts), "claims": claims,
            "verified": verified, "invalid": invalid, "issues": issues}


def validate_evidence_record(record: Any) -> dict[str, Any]:
    """Recompute the causal cycle and receipt verdicts; never trust claimed scores alone."""
    if not isinstance(record, dict):
        return {"passed": False, "issues": ["record-not-object"]}
    issues: list[str] = []
    if record.get("schemaVersion") != SCHEMA_VERSION:
        issues.append("unsupported-evidence-schema")
    if not _safe_id(record.get("sampleId")):
        issues.append("sample-id-invalid")
    for field in ("tick", "exportedAt"):
        if not isinstance(record.get(field), int) or isinstance(record.get(field), bool) or record[field] < 0:
            issues.append(f"{field}-invalid")
    commit = record.get("sourceCommit")
    if commit is not None and (not isinstance(commit, str) or len(commit) != 40 or any(ch not in "0123456789abcdefABCDEF" for ch in commit)):
        issues.append("source-commit-invalid")
    cycle, receipts = _validate_cycle(record), _validate_receipts(record)
    issues.extend(cycle["issues"])
    issues.extend(receipts["issues"])
    passed = bool(not issues and cycle["full"] and receipts["integrity"] == 1.0 and receipts["external_integrity"] == 1.0)
    return {
        "passed": passed,
        "full_cycle": 1.0 if cycle["full"] else 0.0,
        "full_cycle_integrity": float(cycle["integrity"]),
        "receipt_integrity": float(receipts["integrity"]),
        "external_postcondition_integrity": float(receipts["external_integrity"]),
        "evidence_presence": float(receipts["presence"]),
        "tick": record.get("tick"), "sample_id": record.get("sampleId"),
        "receipt_count": receipts["count"], "external_postcondition_claims": receipts["claims"],
        "external_postcondition_verified": receipts["verified"], "invalid_receipts": receipts["invalid"],
        "missing_stages": cycle["missing_stages"], "invalid_stages": cycle["invalid_stages"],
        "missing_edges": cycle["missing_edges"], "issues": issues[:128],
    }


def load_evidence_jsonl(path: str | Path, *, max_bytes: int = 64 * 1024 * 1024, max_rows: int = 5000) -> list[dict[str, Any]]:
    """Read bounded immutable JSONL. Malformed rows and duplicate IDs are fatal."""
    raw = Path(path).read_bytes()
    if len(raw) > max_bytes:
        raise EvidenceFormatError("evidence-file-exceeds-size-limit")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise EvidenceFormatError("evidence-file-is-not-utf8") from exc
    records, ids = [], set()
    for line_no, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        if len(line.encode("utf-8")) > 2 * 1024 * 1024:
            raise EvidenceFormatError(f"line-{line_no}-exceeds-size-limit")
        try:
            item = json.loads(line, parse_constant=lambda token: (_ for _ in ()).throw(ValueError(token)))
        except (json.JSONDecodeError, ValueError) as exc:
            raise EvidenceFormatError(f"line-{line_no}-invalid-json") from exc
        if not isinstance(item, dict) or not _safe_id(item.get("sampleId")):
            raise EvidenceFormatError(f"line-{line_no}-sample-id-invalid")
        if item["sampleId"] in ids:
            raise EvidenceFormatError(f"line-{line_no}-duplicate-sample-id")
        ids.add(item["sampleId"])
        records.append(item)
        if len(records) > max_rows:
            raise EvidenceFormatError("evidence-file-exceeds-row-limit")
    if not records:
        raise EvidenceFormatError("evidence-file-has-no-records")
    return records
