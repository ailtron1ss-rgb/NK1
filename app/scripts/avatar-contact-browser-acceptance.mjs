#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = new URL(process.argv[2] || "http://127.0.0.1:8080/").origin;
const timeoutMs = Math.max(5_000, Math.min(30_000, Number(process.env.AVATAR_CONTACT_TIMEOUT_MS) || 15_000));
const observedEvents = [];
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.__nkAvatarSpriteDraws = [];
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
      if (image instanceof HTMLImageElement && image.src.includes("/sprites/")) {
        window.__nkAvatarSpriteDraws.push({ args });
      }
      return drawImage.call(this, image, ...args);
    };
  });
  // Do not mock the organism boundary: the Vite dev proxy must forward each
  // browser contact to the real runtime on port 3310.
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.pathname !== "/api/organism/event" || request.method() !== "POST") return;
    try { observedEvents.push(request.postDataJSON()); } catch { /* malformed requests fail the event-count assertions */ }
  });
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: timeoutMs });

  // The initial viewer-ready event may race React hydration. No synthetic ready
  // message is sent here: the parent must recover through the real handshake.
  await page.waitForFunction(() =>
    ![...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Open Legacy"),
    null,
    { timeout: timeoutMs },
  );
  const viewer = page.frames().find((frame) => frame.url().includes("/live2d/viewer.html"));
  assert.ok(viewer, "Live2D viewer iframe must be mounted");
  assert.match(await viewer.locator("#status").textContent(), /^ок · /, "Live2D model must be ready");

  const canvas = viewer.locator("#canvas");
  const bounds = await canvas.boundingBox();
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0, "Live2D canvas must have a visible hit target");
  // The toolbar overlays the top of Live2D; 45% is still the head zone and is
  // intentionally below its hit area so this tests the user's actual click.
  await canvas.click({ position: { x: bounds.width * 0.5, y: bounds.height * 0.45 } });
  await page.waitForFunction(() => document.body.innerText.includes("касание зарегистрировано организмом"), null, { timeout: timeoutMs });
  await page.waitForTimeout(1_600);
  await canvas.click({ position: { x: bounds.width * 0.5, y: bounds.height * 0.76 } });
  const eventDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 2 && Date.now() < eventDeadline) await page.waitForTimeout(50);
  await page.waitForFunction(() => document.body.innerText.includes("касание зарегистрировано организмом"), null, { timeout: timeoutMs });

  assert.deepEqual(observedEvents, [
    { detail: "Пользователь коснулся области головы аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "head" } },
    { detail: "Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "body" } },
  ], "desktop head/body clicks must reach the canonical organism event client with low salience");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1_600);
  const mobileBounds = await canvas.boundingBox();
  assert.ok(mobileBounds && mobileBounds.width >= 320, "mobile Live2D canvas must retain a usable hit target");
  await canvas.click({ position: { x: mobileBounds.width * 0.5, y: mobileBounds.height * 0.48 } });
  const mobileDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 3 && Date.now() < mobileDeadline) await page.waitForTimeout(50);
  await page.waitForTimeout(1_600);
  await canvas.click({ position: { x: mobileBounds.width * 0.5, y: mobileBounds.height * 0.75 } });
  const allEventsDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 4 && Date.now() < allEventsDeadline) await page.waitForTimeout(50);
  assert.deepEqual(observedEvents, [
    { detail: "Пользователь коснулся области головы аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "head" } },
    { detail: "Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "body" } },
    { detail: "Пользователь коснулся области головы аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "head" } },
    { detail: "Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "body" } },
  ], "desktop and mobile head/body clicks must reach the canonical organism event client with low salience");

  // 3D uses raycasts against the loaded character-only meshes. A camera drag must
  // rotate the view without being misreported as a social contact.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "Переключить на режим 3D preview" }).click();
  const threeCanvas = page.locator('canvas[aria-label="3D-модель Курису, потяните для поворота"]');
  await threeCanvas.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(() =>
    document.body.innerText.includes("Модель загружена")
      || document.body.innerText.includes("Геометрия загружена"),
    null,
    { timeout: timeoutMs },
  );
  const threeBounds = await threeCanvas.boundingBox();
  assert.ok(threeBounds && threeBounds.width > 0 && threeBounds.height > 0,
    "3D canvas must expose a real interactive hit target after model load");

  await page.mouse.move(threeBounds.x + threeBounds.width * 0.5, threeBounds.y + threeBounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(threeBounds.x + threeBounds.width * 0.5 + 32, threeBounds.y + threeBounds.height * 0.5, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  assert.equal(observedEvents.length, 4, "3D camera orbit must not create a false contact event");

  await page.waitForTimeout(1_600);
  await threeCanvas.click({ position: { x: threeBounds.width * 0.5, y: threeBounds.height * 0.20 } });
  const desktopThreeHeadDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 5 && Date.now() < desktopThreeHeadDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[4]?.interaction?.zone, "head",
    "3D head raycast must reach the canonical avatar-contact protocol");
  await page.waitForTimeout(1_600);
  await threeCanvas.click({ position: { x: threeBounds.width * 0.5, y: threeBounds.height * 0.52 } });
  const desktopThreeBodyDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 6 && Date.now() < desktopThreeBodyDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[5]?.interaction?.zone, "body",
    "3D body raycast must reach the canonical avatar-contact protocol");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileThreeBounds = await threeCanvas.boundingBox();
  assert.ok(mobileThreeBounds && mobileThreeBounds.width >= 320,
    "mobile 3D canvas must retain a usable contact target");
  await page.waitForTimeout(1_600);
  await threeCanvas.click({ position: { x: mobileThreeBounds.width * 0.5, y: mobileThreeBounds.height * 0.20 } });
  const mobileThreeHeadDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 7 && Date.now() < mobileThreeHeadDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[6]?.interaction?.zone, "head",
    "mobile 3D head raycast must use the canonical avatar-contact protocol");
  await page.waitForTimeout(1_600);
  await threeCanvas.click({ position: { x: mobileThreeBounds.width * 0.5, y: mobileThreeBounds.height * 0.52 } });
  const mobileThreeBodyDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 8 && Date.now() < mobileThreeBodyDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[7]?.interaction?.zone, "body",
    "mobile 3D body raycast must use the canonical avatar-contact protocol");
  assert.deepEqual(observedEvents.slice(4, 8).map((event) => event.interaction), [
    { protocolVersion: 1, kind: "avatar-contact", zone: "head" },
    { protocolVersion: 1, kind: "avatar-contact", zone: "body" },
    { protocolVersion: 1, kind: "avatar-contact", zone: "head" },
    { protocolVersion: 1, kind: "avatar-contact", zone: "body" },
  ]);

  // Legacy stills have no deformable rig. Hit-test the actual painted sprite bounds
  // and send the same canonical contact protocol rather than inventing a second path.
  await page.getByRole("button", { name: "Переключить на режим Legacy" }).click();
  const legacyCanvas = page.getByLabel("Курису. Нажмите на голову или корпус, чтобы передать сенсорное событие.");
  await legacyCanvas.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(() => document.body.innerText.includes("legacy deck"), null, { timeout: timeoutMs });
  // The shared recorder intentionally throttles across renderer modes.
  await page.waitForTimeout(1_600);
  const spriteDrawDeadline = Date.now() + timeoutMs;
  let spriteDraw = null;
  while (!spriteDraw && Date.now() < spriteDrawDeadline) {
    spriteDraw = await page.evaluate(() => window.__nkAvatarSpriteDraws?.at(-1) ?? null);
    if (!spriteDraw) await page.waitForTimeout(50);
  }
  assert.ok(spriteDraw?.args?.length >= 4, "Legacy must expose the current painted sprite bounds for hit testing");
  const [spriteX, spriteY, spriteWidth, spriteHeight] = spriteDraw.args;
  await legacyCanvas.click({ position: { x: spriteX + spriteWidth * 0.5, y: spriteY + spriteHeight * 0.22 } });
  const legacyHeadDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 9 && Date.now() < legacyHeadDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[8]?.interaction?.zone, "head", "Legacy sprite head hit must use the canonical social contact protocol");
  await page.waitForTimeout(1_600);
  await legacyCanvas.click({ position: { x: spriteX + spriteWidth * 0.5, y: spriteY + spriteHeight * 0.64 } });
  const legacyBodyDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 10 && Date.now() < legacyBodyDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[9]?.interaction?.zone, "body", "Legacy sprite body hit must use the canonical social contact protocol");
  assert.deepEqual(observedEvents.slice(8).map((event) => event.interaction), [
    { protocolVersion: 1, kind: "avatar-contact", zone: "head" },
    { protocolVersion: 1, kind: "avatar-contact", zone: "body" },
  ]);

  assert.equal(observedEvents.length, 10, "all Live2D, 3D and Legacy desktop/mobile contacts must reach the canonical event route");

  // Verify the real runtime consumed the interactions, rather than accepting
  // only a browser-side HTTP payload.
  const socialResponse = await page.request.get(`${origin}/api/organism/social-mind`);
  assert.equal(socialResponse.status(), 200, "real runtime SocialMind endpoint must remain reachable");
  const socialBody = await socialResponse.json();
  const socialEvidence = socialBody.socialMind?.evidence ?? [];
  for (const claim of ["user-action:avatar-contact-head", "user-action:avatar-contact-body"]) {
    assert.ok(socialEvidence.some((row) => row.claim === claim && row.source === "interaction" && row.evidenceKind === "observed"),
      `real SocialMind evidence ledger must contain ${claim}`);
  }
  assert.equal(socialBody.socialMind?.persons?.find((person) => person.id === "user")?.visible01, 0,
    "avatar interaction must not fabricate visual-presence evidence");

  const snapshotResponse = await page.request.get(`${origin}/api/organism/ui-snapshot`);
  assert.equal(snapshotResponse.status(), 200, "real runtime UI snapshot endpoint must remain reachable");
  const uiSnapshot = await snapshotResponse.json();
  assert.equal(uiSnapshot.avatarInteraction?.schemaVersion, 1);
  assert.equal(uiSnapshot.avatarInteraction?.kind, "avatar-contact");
  assert.equal(uiSnapshot.avatarInteraction?.zone, "body", "latest browser contact must be projected to the canonical avatar frame");
  assert.equal(uiSnapshot.avatarInteraction?.confidence01, 0.72);
  assert.ok(socialEvidence.some((row) => row.id === uiSnapshot.avatarInteraction?.evidenceId),
    "UI projection must reference the exact SocialMind evidence record");

  console.log(JSON.stringify({
    ok: true,
    origin,
    readiness: "recovered-without-synthetic-message",
    backend: "real-organism-runtime",
    viewports: ["1280x900", "390x844"],
    contactEvents: observedEvents.length,
    socialEvidence: socialEvidence.filter((row) => ["user-action:avatar-contact-head", "user-action:avatar-contact-body"].includes(row.claim)),
    avatarInteraction: uiSnapshot.avatarInteraction,
    events: observedEvents,
  }, null, 2));
} finally {
  await browser.close();
}
