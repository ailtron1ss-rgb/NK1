# N.E.K.O. plugin runtime composition (NK1)

**Branch:** `aspect/neko-plugin-runtime-composition-20261104`  
**Stacked on:** PR #786, `aspect/neko-plugin-gateway-refresh-20261104`  
**Scope:** host-side composition only; no provider or listener is enabled.

## Why this layer exists

The N.E.K.O. archive contains a plugin manifest/SDK model. NK1 already has two separate owners:

- `PluginGatewayAdapter`: protocol/request normalization, inert bounded JSON, namespace checks, and delegation to `ActionGateway`.
- `NekoPluginManifestPolicyRegistry`: host-owned manifest validation and an authorization check bound to the live `ActionGateway.listTools()` descriptor.

The runtime composes these owners so that callers cannot accidentally supply a permissive callback and bypass the manifest policy.

## Authorization/execution path

```text
untrusted plugin request
  -> PluginGatewayAdapter host protocol allowlist
  -> PluginGatewayAdapter request/JSON/namespace validation
  -> NekoPluginManifestPolicyRegistry.asAuthorizer()
       manifest exists and enabled
       protocol is declared by manifest
       tool belongs to plugin namespace
       action is explicitly declared
       current ActionGateway descriptor still matches declaration
  -> ActionGateway.executeTool()
       approval + idempotency + outcome verification stay canonical
  -> bounded inert JSON response
```

Both protocol gates are required: the host's explicit allowlist is the ceiling, and each manifest can only narrow it. A manifest's `enabled` value is not applied automatically at import time; the host explicitly registers and controls enablement.

## Host integration

Construct the runtime where the host already owns the canonical ActionGateway:

```ts
const pluginRuntime = new NekoPluginGatewayRuntime({
  gateway: actionGateway,
  allowedProtocols: hostApprovedProtocols,
});

const registration = pluginRuntime.registerManifest(reviewedManifest);
if (!registration.registered) {
  throw new Error(`plugin-manifest-rejected:${registration.reason}`);
}

// In the host-owned transport handler:
const response = await pluginRuntime.handle(untrustedRequest);

// Persist policy only through the host's existing state/persistence owner:
const policySnapshot = pluginRuntime.snapshotPolicy();
```

The module does not create persistence, a second action executor, a network listener, or background scheduling. The host must restore its validated policy snapshot and decide explicitly which manifests/protocols are allowed.

## Boundaries

- No `import()`, `require()`, `exec`, entrypoint field, plugin code loading or discovery.
- No automatic activation from manifest `enabled` metadata.
- No widening of the host protocol allowlist.
- No direct writes to memory, beliefs, goals, self-model or external evidence.
- `event_push` remains rejected; it requires a separate host-owned event-bus bridge.
- Tool execution remains under `ActionGateway`; approval, idempotency, receipts and postcondition verification are not duplicated.
- No claim of live transport wiring or production plugin enablement.
- No changes to `main` or the published Release ZIP.

The supplied N.E.K.O. repository metadata identifies Apache-2.0 for the upstream project. This adaptation adds NK1-owned composition code; any future copied upstream source or third-party package/assets must retain its own applicable notices and license review.
