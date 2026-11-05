import { test } from "node:test"
import { deepStrictEqual, equal } from "node:assert/strict"
import {
  countdown,
  compactCountdown,
  windowLabel,
  windowsFromResponse,
  resetCreditsFromResponse,
} from "../src/limits.js"
import { interpolateTranslation } from "../src/i18n.js"

test("uses Codex pool and preserves a weekly-only window", () => {
  deepStrictEqual(
    windowsFromResponse({
      rateLimitsByLimitId: {
        codex: { primary: { usedPercent: 27, windowDurationMins: 10080, resetsAt: 123 }, secondary: null },
      },
    }),
    [{ used: 27, minutes: 10080, resetsAt: 123 }],
  )
})
test("handles missing and malformed windows", () => {
  deepStrictEqual(windowsFromResponse({ rateLimits: { primary: { usedPercent: NaN }, secondary: null } }), [])
  equal(windowLabel(300), "window.fiveHours")
  equal(windowLabel(10080), "window.weekly")
})
test("formats reset times", () => {
  equal(countdown(0), "reset.unknown")
  equal(countdown(3600, 0), "reset.in 1 hour")
  equal(countdown(1, 2000), "reset.imminent")
})

test("formats a compact visible reset countdown", () => {
  equal(compactCountdown(0, 0, "en"), "—")
  equal(compactCountdown(1, 2000, "en"), "<1m")
  equal(compactCountdown(3600, 0, "en"), "1h")
  equal(compactCountdown(9000, 0, "en"), "2h 30m")
})

test("unknown reset availability is not treated as zero or enabled", () => {
  deepStrictEqual(resetCreditsFromResponse({}), { credits: -1, expiresAt: 0 })
  deepStrictEqual(resetCreditsFromResponse({ rateLimitResetCredits: { availableCount: -4 } }), {
    credits: -1,
    expiresAt: 0,
  })
})
test("uses authoritative reset count and earliest available future expiry", () => {
  deepStrictEqual(
    resetCreditsFromResponse(
      {
        rateLimitResetCredits: {
          availableCount: 3,
          credits: [
            { status: "available", expiresAt: 20 },
            { status: "available", expiresAt: 30 },
            { status: "redeemed", expiresAt: 15 },
            { status: "available", expiresAt: 1 },
          ],
        },
      },
      10000,
    ),
    { credits: 3, expiresAt: 20 },
  )
  deepStrictEqual(resetCreditsFromResponse({ rateLimitResetCredits: { availableCount: 2, credits: null } }), {
    credits: 2,
    expiresAt: 0,
  })
})

test("interpolates plugin translation parameters", () => {
  equal(interpolateTranslation("{count} resets available", { count: 3 }), "3 resets available")
  equal(interpolateTranslation("Updated {time}", { time: "14:20" }), "Updated 14:20")
  equal(interpolateTranslation("Unknown {key}", { count: 1 }), "Unknown {key}")
  equal(interpolateTranslation("No parameters"), "No parameters")
})
