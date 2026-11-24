# CHANGELOG V92

## Source-backed neural fusion

- Added `UpstreamBackendCatalog` with 20 neural/recurrent/attention/memory candidates.
- Added lazy exact import factory with no silent fallback.
- Added research-only boundary for restricted implementations.
- Added safe upstream ZIP intake with path traversal rejection and SHA-256 manifest.
- Added current tests for source catalog, missing dependency behavior and intake safety.
- Removed V91 class/buffer names from current recurrent implementation; historical names survive only in checkpoint migration.
- Added explicit external-source provenance docs and user-upload workflow.
- Historical benchmark entrypoints are separated from current test surface.

## Validation

Current test suite and compile checks are required before release. Upstream availability is environment-local and is reported rather than faked.


## V93 source-backed expansion
- Registry expanded to 53 candidates; 42 are exact current public `fla.layers` exports observed in upstream main, with additional FLA/model-level and external candidates separately marked.
- FLA targets use the public `fla.layers:<Class>` surface where available.
- Added constructor introspection and forward/backward probe runner.
- Hardened upstream ZIP intake: path traversal + symlink rejection, expected SHA-256 and license classification.
- Added network-enabled fetch helper; no source bytes are claimed as vendored when network access is unavailable.
- Current tests: 18/18 PASS.
