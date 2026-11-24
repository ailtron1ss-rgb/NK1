# Roadmap gaps to target — WorkPass53 (2026-10-16)

## Closed in code in this pass

1. **No uniform owner consent for direct effects.** Canonical `ActionGateway` now owns persisted exact-input one-time approval records with five-minute expiry, serialized admission/consume, durable transition, replay protection and private request hash.
2. **Legacy direct adapters could bypass review.** Current/legacy outbound routes and voice speak/listen/turn use the same exact-input approval lifecycle; research bridge subprocess endpoints request a runtime ticket and fail closed if the runtime cannot be reached.
3. **Approval lived only in API/queue with no safe retry path.** Operator Console shows bounded/redacted fields and explicitly approves then resubmits the exact captured call once. Runtime Atlas shows the global queue for less common surfaces.
4. **Approval previews could leak sensitive scalar strings.** The preview sanitizes bearer tokens, secret query parameters, URL userinfo, email addresses and phone-like strings; nested object content is summarized by keys, never serialized directly.
5. **The release had no integrated proof that direct interfaces actually blocked.** A local process E2E runs real Node runtime and Python bridge, confirms block-before-side-effect, owner approval, one-time run and replay denial. This proves contract behavior but not production web deployment.

## Still open and why it matters

1. Install app dependencies and run a production Vite build plus interactive browser E2E. JSX transpile and route linking are not equivalent to a working browser.
2. Validate protected web/device actions against live configured providers and real device receipts, reconnection and ambiguous outcome reconciliation. Deterministic local E2E cannot prove external postconditions.
3. Extend one-time approval UI to every remaining uncommon protected tool surface; Runtime Atlas queue permits approve/decline, while only frequently used voice/outbound and research actions have built-in exact retry paths today.
4. Add expiry/decline/modified-input browser flows to real end-to-end tests after browser dependencies are available.
5. Deliver true audio-buffer/phoneme lip sync, not word-boundary approximation.
6. Improve MemoryOS2 only when an independent labelled holdout shows measurable recall/answer-quality uplift; current broad recallDelta is 0.
7. Finish clean-room rollback, manual nested-source licensing review and long soak before claiming release readiness.

## Architectural rules preserved

- Single canonical ActionGateway for approvals, not a parallel permission service.
- Existing Runtime Atlas / Operator Console remain the UI owners.
- No approval displays or persists raw tool body, patches or private request fingerprints.
- Approval is distinct from execution: a ticket means owner permitted one exact attempt, not that the action succeeded.
- Official weighted roadmap score remains 78.0%; release status remains implementation-workpass.
