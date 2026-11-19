# NK1 UserModel HTTP host contract

The runtime exposes a narrow authenticated host endpoint for explicit response-style preferences.

## Endpoint

`POST /api/organism/user-model/preferences`

The existing API security middleware applies before this route. Remote callers require the configured `NEURO_API_TOKEN` as a Bearer token. Loopback research mode follows the existing `ApiSecurityPolicy` behavior; this endpoint does not add a separate bypass.

## Request

```json
{ "action": "record", "value": "concise", "confirmed": true }
```

- `action`: exactly `record` or `correct`.
- `value`: exactly `concise`, `balanced`, or `detailed`.
- `confirmed`: must be boolean `true`, representing an explicit user confirmation by the trusted host/UI.

The endpoint deliberately ignores caller-supplied `evidenceRef`, `tick`, `key`, `domain`, `explicit`, and `sensitivity`. The server fixes the claim to `response.style` / `interaction-style`, stamps the current organism tick, creates a fresh evidence reference, and classifies this one allowlisted field as low risk. It accepts no free text, arbitrary preference key, inferred behavior, sensitive attribute, or prompt instruction.

## Result

A successful response returns the current claim status (`confirmed` or `disputed`) and does not disclose the evidence reference. A conflicting `record` call leaves the existing claim disputed; the user must explicitly correct it with `action: "correct"` to restore a confirmed value. The canonical `SelfSubsystemRuntime.userModelEvidence` remains the only owner and `OrganismRuntime` serializes writes and checkpoints them.

## Integration boundary

A UI must show the exact preference being saved and obtain a direct user confirmation before sending `confirmed: true`. Do not automatically call this endpoint from free-text chat or infer preferences from behavior. This route is a host API contract; it does not claim that the current UI already exposes a settings control.
