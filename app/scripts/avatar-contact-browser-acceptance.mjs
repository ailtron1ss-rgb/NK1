#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = new URL(process.argv[2] || "http://127.0.0.1:8080/").origin;
const timeoutMs = Math.max(5_000, Math.min(30_000, Number(process.env.AVATAR_CONTACT_TIMEOUT_MS) || 15_000));
const observedEvents = [];

async function clickUntilContact(canvas, bounds, expectedCount, yCandidates) {
  for (const y of yCandidates) {
    await canvas.click({ position: { x: bounds.width * 0.5, y: bounds.height * y } });
    const attemptDeadline = Date.now() + 450;
    while (observedEvents.length < expectedCount && Date.now() < attemptDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (observedEvents.length >= expectedCount) return y;
  }
  const diagnostics = await canvas.evaluate((element) => ({
    rect: (() => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })(),
    pointerTrace: window.__nkAvatarPointerTrace ?? [],
    fitDiagnostics: element.getAttribute("data-avatar-fit-diagnostics"),
    cameraFit: element.getAttribute("data-avatar-camera-fit"),
    lastRaycast: element.getAttribute("data-avatar-last-raycast"),
    readyText: document.body.innerText.match(/Модель загружена|Геометрия загружена|Модель не загружена|3D-рендерер недоступен/g) ?? [],
  }));
  const screenshotPath = `${process.env.RUNNER_TEMP ?? process.cwd()}/avatar-contact-debug.png`;
  await canvas.screenshot({ path: screenshotPath }).catch((error) => {
    console.error("[avatar-contact] Failed to capture 3D canvas:", error);
  });
  console.error("[avatar-contact] 3D pointer diagnostics", JSON.stringify({
    expectedCount,
    observedCount: observedEvents.length,
    yCandidates,
    screenshotPath,
    ...diagnostics,
  }));
  throw new Error(`No avatar contact was recorded after probing canvas y positions: ${yCandidates.join(", ")}`);
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.__nkAvatarSpriteDraws = [];
    window.__nkAvatarPointerTrace = [];
    window.__nkOriginalPointerTrace = [];
    const traceOriginalPointer = (event) => {
      if (!(event.target instanceof Element)) return;
      const stage = event.target.closest('[data-testid="kurisu-original-stage"]');
      if (!stage) return;
      const svg = stage.querySelector('svg[role="img"]');
      const rect = svg?.getBoundingClientRect();
      const top = document.elementFromPoint(event.clientX, event.clientY);
      window.__nkOriginalPointerTrace.push({
        type: event.type,
        button: event.button,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
        target: event.target.tagName,
        targetInsideSvg: Boolean(svg && event.target instanceof Node && svg.contains(event.target)),
        svgRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
        normalized: rect && rect.width > 0 && rect.height > 0
          ? { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
          : null,
        topElement: top ? { tag: top.tagName, aria: top.getAttribute?.("aria-label"), testId: top.getAttribute?.("data-testid") } : null,
      });
    };
    for (const type of ["pointerdown", "pointerup", "pointercancel"]) {
      document.addEventListener(type, traceOriginalPointer, true);
    }
    const tracePointer = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLCanvasElement)
        || !String(target.getAttribute("aria-label") ?? "").startsWith("3D-модель")) return;
      window.__nkAvatarPointerTrace.push({
        type: event.type,
        button: event.button,
        pointerId: event.pointerId,
        isPrimary: event.isPrimary,
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      });
    };
    document.addEventListener("pointerdown", tracePointer, true);
    document.addEventListener("pointermove", tracePointer, true);
    document.addEventListener("pointerup", tracePointer, true);
    document.addEventListener("pointercancel", tracePointer, true);
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
    try {
      const payload = request.postDataJSON();
      // The organism event route also carries unrelated UI/system events. Only
      // canonical avatar-contact events belong in this renderer acceptance ledger.
      if (payload?.interaction?.kind === "avatar-contact") observedEvents.push(payload);
    } catch { /* malformed requests fail the event-count assertions */ }
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
  // The shared production recorder applies one global 1.5 s cooldown across
  // renderer modes. Let the final mobile Live2D tap leave that window before
  // probing Original; a throttled (valid) tap is not a renderer failure.
  await page.waitForTimeout(1_600);
  assert.deepEqual(observedEvents, [
    { detail: "Пользователь коснулся области головы аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "head" } },
    { detail: "Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "body" } },
    { detail: "Пользователь коснулся области головы аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "head" } },
    { detail: "Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.", importance: 0.24, interaction: { protocolVersion: 1, kind: "avatar-contact", zone: "body" } },
  ], "desktop and mobile head/body clicks must reach the canonical organism event client with low salience");

  // Original SVG must use the same canonical contact protocol instead of being a
  // visual-only mode. Its face occupies the upper third of the authored viewBox.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "Переключить на режим NK1 Original" }).click();
  const originalStage = page.getByTestId("kurisu-original-stage");
  const originalSvg = originalStage.locator("svg[role='img']");
  await originalSvg.waitFor({ state: "visible", timeout: timeoutMs });
  const originalBounds = await originalSvg.boundingBox();
  assert.ok(originalBounds && originalBounds.width > 0 && originalBounds.height > 0,
    "Original 2D SVG must expose a visible contact surface");
  await originalSvg.click({ position: { x: originalBounds.width * 0.5, y: originalBounds.height * 0.22 } });
  const originalDesktopHeadDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 5 && Date.now() < originalDesktopHeadDeadline) await page.waitForTimeout(50);
  if (observedEvents.length < 5) {
    const diagnostics = await page.evaluate(() => {
      const stage = document.querySelector('[data-testid="kurisu-original-stage"]');
      const svg = stage?.querySelector('svg[role="img"]');
      const rect = svg?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width * 0.5 : 0;
      const y = rect ? rect.top + rect.height * 0.22 : 0;
      const top = document.elementFromPoint(x, y);
      return {
        eventCount: window.__nkOriginalPointerTrace?.length ?? 0,
        pointerTrace: window.__nkOriginalPointerTrace ?? [],
        stageRect: stage?.getBoundingClientRect().toJSON() ?? null,
        svgRect: rect?.toJSON() ?? null,
        expectedClick: { x, y, topElement: top ? { tag: top.tagName, aria: top.getAttribute?.("aria-label"), testId: top.getAttribute?.("data-testid") } : null },
        observedEventCount: window.__nkAvatarObservedContacts?.length ?? null,
      };
    });
    const screenshotPath = `${process.env.RUNNER_TEMP ?? process.cwd()}/nk1-original-contact-debug.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    console.error("[avatar-contact] Original SVG pointer diagnostics", JSON.stringify({ ...diagnostics, screenshotPath, observedEvents: observedEvents.length }));
  }
  assert.equal(observedEvents[4]?.interaction?.zone, "head",
    "Original 2D SVG face tap must reach the canonical avatar-contact protocol");
  await page.waitForTimeout(1_600);
  await originalSvg.click({ position: { x: originalBounds.width * 0.5, y: originalBounds.height * 0.58 } });
  const originalDesktopBodyDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 6 && Date.now() < originalDesktopBodyDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[5]?.interaction?.zone, "body",
    "Original 2D SVG torso tap must reach the canonical avatar-contact protocol");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileOriginalBounds = await originalSvg.boundingBox();
  assert.ok(mobileOriginalBounds && mobileOriginalBounds.width >= 320,
    "mobile Original 2D SVG must retain a usable hit target");
  await page.waitForTimeout(1_600);
  await originalSvg.click({ position: { x: mobileOriginalBounds.width * 0.5, y: mobileOriginalBounds.height * 0.22 } });
  const originalMobileHeadDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 7 && Date.now() < originalMobileHeadDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[6]?.interaction?.zone, "head",
    "mobile Original 2D face tap must use the canonical contact protocol");
  await page.waitForTimeout(1_600);
  await originalSvg.click({ position: { x: mobileOriginalBounds.width * 0.5, y: mobileOriginalBounds.height * 0.58 } });
  const originalMobileBodyDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 8 && Date.now() < originalMobileBodyDeadline) await page.waitForTimeout(50);
  // The same recorder cooldown spans renderer switches. Do not begin the 3D
  // acceptance until the final Original SVG event is eligible again.
  await page.waitForTimeout(1_600);
  assert.equal(observedEvents[7]?.interaction?.zone, "body",
    "mobile Original 2D torso tap must use the canonical contact protocol");

  assert.deepEqual(observedEvents.slice(4, 8).map((event) => event.interaction), [
    { protocolVersion: 1, kind: "avatar-contact", zone: "head" },
    { protocolVersion: 1, kind: "avatar-contact", zone: "body" },
    { protocolVersion: 1, kind: "avatar-contact", zone: "head" },
    { protocolVersion: 1, kind: "avatar-contact", zone: "body" },
  ]);

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
  assert.equal(observedEvents.length, 8, "3D camera orbit must not create a false contact event");

  await page.waitForTimeout(1_600);
  await clickUntilContact(threeCanvas, threeBounds, 9, [0.18, 0.22, 0.26, 0.30, 0.34]);
  assert.equal(observedEvents[8]?.interaction?.zone, "head",
    "3D head raycast must reach the canonical avatar-contact protocol");
  await page.waitForTimeout(1_600);
  await clickUntilContact(threeCanvas, threeBounds, 10, [0.44, 0.48, 0.52, 0.56, 0.60]);
  assert.equal(observedEvents[9]?.interaction?.zone, "body",
    "3D body raycast must reach the canonical avatar-contact protocol");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileThreeBounds = await threeCanvas.boundingBox();
  assert.ok(mobileThreeBounds && mobileThreeBounds.width >= 320,
    "mobile 3D canvas must retain a usable contact target");
  await page.waitForTimeout(1_600);
  await clickUntilContact(threeCanvas, mobileThreeBounds, 11, [0.18, 0.22, 0.26, 0.30, 0.34]);
  assert.equal(observedEvents[10]?.interaction?.zone, "head",
    "mobile 3D head raycast must use the canonical avatar-contact protocol");
  await page.waitForTimeout(1_600);
  await clickUntilContact(threeCanvas, mobileThreeBounds, 12, [0.44, 0.48, 0.52, 0.56, 0.60]);
  assert.equal(observedEvents[11]?.interaction?.zone, "body",
    "mobile 3D body raycast must use the canonical avatar-contact protocol");
  assert.deepEqual(observedEvents.slice(8, 12).map((event) => event.interaction), [
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
  while (observedEvents.length < 13 && Date.now() < legacyHeadDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[12]?.interaction?.zone, "head", "Legacy sprite head hit must use the canonical social contact protocol");
  await page.waitForTimeout(1_600);
  await legacyCanvas.click({ position: { x: spriteX + spriteWidth * 0.5, y: spriteY + spriteHeight * 0.64 } });
  const legacyBodyDeadline = Date.now() + timeoutMs;
  while (observedEvents.length < 14 && Date.now() < legacyBodyDeadline) await page.waitForTimeout(50);
  assert.equal(observedEvents[13]?.interaction?.zone, "body", "Legacy sprite body hit must use the canonical social contact protocol");
  assert.deepEqual(observedEvents.slice(12).map((event) => event.interaction), [
    { protocolVersion: 1, kind: "avatar-contact", zone: "head" },
    { protocolVersion: 1, kind: "avatar-contact", zone: "body" },
  ]);

  assert.equal(observedEvents.length, 14, "Live2D, Original 2D, 3D and Legacy desktop/mobile contacts must reach the canonical event route");

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
