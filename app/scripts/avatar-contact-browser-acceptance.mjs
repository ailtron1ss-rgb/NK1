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
  await page.route("**/api/organism/event", async (route) => {
    observedEvents.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, perception: { accepted: true } }),
    });
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
    { detail: "Пользователь коснулся области головы аватара Курису через экранный интерфейс.", importance: 0.24 },
    { detail: "Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.", importance: 0.24 },
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
    { detail: "Пользователь коснулся области головы аватара Курису через экранный интерфейс.", importance: 0.24 },
    { detail: "Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.", importance: 0.24 },
    { detail: "Пользователь коснулся области головы аватара Курису через экранный интерфейс.", importance: 0.24 },
    { detail: "Пользователь коснулся области корпуса аватара Курису через экранный интерфейс.", importance: 0.24 },
  ], "desktop and mobile head/body clicks must reach the canonical organism event client with low salience");

  console.log(JSON.stringify({ ok: true, origin, readiness: "recovered-without-synthetic-message", viewports: ["1280x900", "390x844"], contactEvents: observedEvents.length, events: observedEvents }, null, 2));
} finally {
  await browser.close();
}
