import test from "node:test";
import assert from "node:assert/strict";
import { collectBrowserFailures, summarizeBrowserSample } from "./aspect12-browser-smoke.mjs";

test("browser timing summary is deterministic and reports nearest-rank p95", () => {
  assert.deepEqual(summarizeBrowserSample({ samples: [9, 1, 5, 3, 7, 11, 13, 15, 17, 19] }), {
    count: 10, min: 1, median: 9, p95: 19, max: 19,
  });
});

test("browser timing summary ignores missing/non-finite measurements", () => {
  assert.deepEqual(summarizeBrowserSample({ samples: [null, NaN, Infinity, 4, 8] }), {
    count: 2, min: 4, median: 4, p95: 8, max: 8,
  });
});

test("empty timing summary is explicit rather than inventing zero latency", () => {
  assert.deepEqual(summarizeBrowserSample({ samples: [] }), {
    count: 0, min: null, median: null, p95: null, max: null,
  });
});

test("browser smoke fails closed on console errors and failed network requests", () => {
  const failures = collectBrowserFailures([{
    viewport: "mobile",
    httpStatus: 200,
    title: "Neuro Kurisu",
    bodyTextLength: 100,
    horizontalOverflow: false,
    consoleErrors: ["uncaught resource error"],
    pageErrors: [],
    failedRequests: [{ url: "/api/missing", error: "net::ERR_FAILED" }],
  }]);
  assert.deepEqual(failures, [
    "mobile: 1 console error(s)",
    "mobile: 1 failed request(s)",
  ]);
});

test("browser smoke accepts a clean rendered viewport", () => {
  assert.deepEqual(collectBrowserFailures([{
    viewport: "desktop",
    httpStatus: 200,
    title: "Neuro Kurisu",
    bodyTextLength: 100,
    horizontalOverflow: false,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  }]), []);
});
