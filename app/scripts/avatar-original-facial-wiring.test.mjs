import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stage = readFileSync(new URL("../src/components/KurisuOriginalStage.tsx", import.meta.url), "utf8");
const parent = readFileSync(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");

test("Original 2D consumes the shared renderer-neutral facial channels", () => {
  for (const token of ["FacialMicrochannels", "facial.eyeSmile", "facial.browLeftY", "facial.browRightY", "facial.cheek"]) assert.ok(stage.includes(token), token);
  assert.match(parent, /KurisuOriginalStage[\\s\\S]*?facial=\\{facialProfile\\}/);
});

test("mouth visemes remain authoritative while speaking", () => {
  assert.match(stage, /speaking \\? <g>[\\s\\S]*?mouthPose\\.open/);
});
