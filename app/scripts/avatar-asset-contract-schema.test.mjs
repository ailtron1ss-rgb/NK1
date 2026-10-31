import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const calibrationSchema = JSON.parse(await readFile(new URL("../../contracts/avatar/vrm-calibration-bundle.v1.schema.json", import.meta.url), "utf8"));
const assetSchema = JSON.parse(await readFile(new URL("../../contracts/avatar/asset-provenance-manifest.v1.schema.json", import.meta.url), "utf8"));

test("VRM calibration bundle schema requires both a model-bound profile and measured fixture session", () => {
  assert.equal(calibrationSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepEqual(calibrationSchema.required, ["schemaVersion", "profile", "session"]);
  assert.equal(calibrationSchema.properties.profile.$ref, "#/$defs/profile");
  assert.equal(calibrationSchema.properties.session.$ref, "#/$defs/session");
  assert.equal(calibrationSchema.$defs.profile.properties.calibrationMethod.const, "manual-measured");
  assert.equal(calibrationSchema.$defs.session.properties.referencePose.type, "object");
  assert.equal(calibrationSchema.$defs.session.properties.reference.properties.fixtureId.minLength, 1);
  assert.equal(calibrationSchema.additionalProperties, false);
});

test("avatar manifest separates format, license, frame identity and independent validation receipts", () => {
  assert.equal(assetSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  for (const field of ["modelFingerprint", "source", "license", "coordinateFrame", "validation"]) {
    assert.ok(assetSchema.required.includes(field), "missing manifest field " + field);
  }
  assert.equal(assetSchema.properties.license.properties.redistributionPermitted.type, "boolean");
  assert.equal(assetSchema.properties.coordinateFrame.properties.unit.const, "meter");
  assert.equal(assetSchema.properties.validation.properties.nk1PreflightStatus.const, "pass");
  assert.equal(assetSchema.additionalProperties, false);
});

test("manifest cannot encode validation pass without a Khronos report digest", () => {
  const validation = assetSchema.properties.validation;
  assert.ok(validation.required.includes("khronosReportSha256"));
  assert.ok(validation.required.includes("nk1PreflightStatus"));
  assert.equal(validation.properties.khronosReportSha256.pattern, "^[0-9a-f]{64}$");
});
