# [NK1][WorkPass626] VRM attribution and license metadata visibility

**Дата:** 30 октября 2026 г.  
**Рабочая ветка:** feature/embodiment-model-hardening-2026-10-29  
**PR:** [#392](https://github.com/ailtron1ss-rgb/NK1/pull/392)  
**Статус:** metadata parser, UI wiring, regression tests and CI step added; exact-head CI required. Release ZIP unchanged.

## Зачем

Возможность импортировать локальную VRM-модель не означает, что NK1 или её пользователь имеют право публиковать, изменять, распространять или коммерчески использовать эту модель. VRM 1.0 and legacy 0.x carry different metadata fields, so an import UI that shows only "model loaded" hides an important provenance boundary.

WorkPass626 makes the declared VRM metadata visible next to the local model state. It deliberately does not try to judge the legal validity of a license or automatically grant permissions.

## Implementation

New module: app/src/components/avatar/vrmLicenseMetadata.ts.

It reads a bounded, sanitized metadata summary from the official Pixiv VRM object's meta field:
- model name/title;
- authors array or legacy author string;
- licenseUrl and alternative otherLicenseUrl / otherPermissionUrl metadata;
- creditNotation (required / unnecessary / unspecified);
- allowRedistribution (allowed / disallowed / unspecified as declared);
- commercialUsage / legacy commercialUsageName;
- modification and avatarPermission.

Text controls are removed and every field is length-limited before display. URLs are never fetched or opened by the app; the UI only indicates whether an HTTP(S) license URL is declared. The metadata is user-supplied asset content and must be treated as untrusted data.

Avatar3DStage appends the summary to its status line after a successful VRM import or local restore. If metadata is absent, the status explicitly says that no VRM license metadata was found and creator/source/usage rights must be checked. For plain GLB, which has no recognized VRM metadata, the same caution is used.

The helper's summary is not a legal decision:
- a URL may be broken, misleading, outdated, or unrelated to the asset;
- a permission field may be absent or incomplete;
- a VRM author may not be the copyright holder;
- a permissive metadata field does not replace checking the original asset distribution page and third-party licenses.

## Regression

New test: app/scripts/avatar-vrm-license-metadata.test.mjs
- VRM 1.0 authors, license URL, credit, redistribution, commercial use, modification and avatar permission;
- VRM 0.x legacy author/license fields;
- missing metadata and malformed/non-HTTP URL warnings;
- control-character removal, field bounds and maximum author count.

Command: npm --prefix app run test:avatar-vrm-license-metadata. The dedicated embodiment CI workflow runs it after the official Pixiv runtime suite.

## Official references

- VRM 1.0 metadata fields: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/metadata.md
- Pixiv VRM1Meta API: https://pixiv.github.io/three-vrm/docs/interfaces/three-vrm.VRM1Meta.html
- Pixiv VRM runtime meta field: https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRM.html

## Remaining gates

This is only metadata visibility. A real asset license audit is still required before any third-party VRM is shipped in a NK1 Release ZIP. The current repository does not gain a bundled canonical Kurisu model from this pass. Real model visual review, Android GPU/FPS/soak, VRMA motion import, unified speech providers and 2.5D authoring remain open.
