import assert from "node:assert/strict";
import test from "node:test";
import { summarizeVrmLicenseMetadata } from "../src/components/avatar/vrmLicenseMetadata.ts";

test("reads VRM 1.0 author, license, credit and commercial-use declarations without granting rights", () => {
  const summary = summarizeVrmLicenseMetadata({
    metaVersion: "1",
    name: "Kurisu test avatar",
    authors: ["Creator One", "Creator Two"],
    licenseUrl: "https://example.invalid/license",
    creditNotation: "required",
    allowRedistribution: false,
    commercialUsage: "personalNonProfit",
    modification: "prohibited",
    avatarPermission: "onlySeparatelyLicensedPerson",
  });
  assert.equal(summary.metadataPresent, true);
  assert.equal(summary.modelName, "Kurisu test avatar");
  assert.deepEqual(summary.authors, ["Creator One", "Creator Two"]);
  assert.equal(summary.licenseUrlPresent, true);
  assert.equal(summary.creditNotation, "required");
  assert.equal(summary.redistribution, "disallowed-in-metadata");
  assert.equal(summary.commercialUsage, "personalNonProfit");
  assert.equal(summary.modification, "prohibited");
  assert.equal(summary.avatarPermission, "onlySeparatelyLicensedPerson");
  assert.match(summary.summary, /Verify the creator.s original terms/);
});

test("reads legacy VRM 0.x author/license metadata but does not assume permission", () => {
  const summary = summarizeVrmLicenseMetadata({
    title: "Legacy avatar",
    author: "Legacy Creator",
    licenseName: "Other",
    otherLicenseUrl: "https://example.invalid/legacy-terms",
    commercialUsageName: "personal",
  }, "legacy.vrm");
  assert.equal(summary.metadataPresent, true);
  assert.deepEqual(summary.authors, ["Legacy Creator"]);
  assert.equal(summary.licenseUrlPresent, true);
  assert.equal(summary.commercialUsage, "personal");
  assert.equal(summary.creditNotation, "unspecified");
  assert.equal(summary.redistribution, "unspecified");
});

test("missing or non-URL license metadata is visibly marked as unverified", () => {
  const missing = summarizeVrmLicenseMetadata(null, "unverified.vrm");
  assert.equal(missing.metadataPresent, false);
  assert.equal(missing.licenseUrlPresent, false);
  assert.match(missing.summary, /No VRM license metadata found/);
  const malformed = summarizeVrmLicenseMetadata({
    name: "No valid URL",
    licenseUrl: "not-a-url",
  });
  assert.equal(malformed.metadataPresent, true);
  assert.equal(malformed.licenseUrlPresent, false);
  assert.match(malformed.summary, /no valid license URL metadata/);
});

test("untrusted metadata is control-character cleaned and length bounded", () => {
  const long = "A".repeat(300);
  const summary = summarizeVrmLicenseMetadata({
    name: long,
    authors: ["Creator\n\u0000One", long, "Creator Three", "Creator Four"],
    licenseUrl: "javascript:alert(1)",
  });
  assert.equal(summary.modelName.length, 96);
  assert.deepEqual(summary.authors, ["Creator One", "A".repeat(72), "Creator Three"]);
  assert.equal(summary.licenseUrlPresent, false);
  assert.ok(summary.summary.length < 700);
});
