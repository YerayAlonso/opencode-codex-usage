export function windowsFromResponse(result) {
  const snapshot = result?.rateLimitsByLimitId?.codex ?? result?.rateLimits
  return [snapshot?.primary, snapshot?.secondary]
    .filter((window) => window && typeof window.usedPercent === "number" && Number.isFinite(window.usedPercent))
    .map((window) => ({
      used: Math.max(0, Math.min(100, window.usedPercent)),
      minutes: typeof window.windowDurationMins === "number" ? window.windowDurationMins : 0,
      resetsAt: typeof window.resetsAt === "number" ? window.resetsAt : 0,
    }))
}

export function resetCreditsFromResponse(result, now = Date.now()) {
  const summary = result?.rateLimitResetCredits
  const credits =
    Number.isSafeInteger(summary?.availableCount) && summary.availableCount >= 0 ? summary.availableCount : -1
  const expirations = (Array.isArray(summary?.credits) ? summary.credits : [])
    .filter(
      (credit) => credit.status === "available" && Number.isFinite(credit.expiresAt) && credit.expiresAt * 1000 > now,
    )
    .map((credit) => credit.expiresAt)
  return { credits, expiresAt: credits > 0 && expirations.length ? Math.min(...expirations) : 0 }
}

export function windowLabel(minutes, t = (key, params) => (key === "window.minutes" ? `${params.minutes} min` : key)) {
  if (minutes === 300) return t("window.fiveHours")
  if (minutes === 10080) return t("window.weekly")
  return minutes > 0 ? t("window.minutes", { minutes }) : t("window.limit")
}

export function countdown(timestamp, now = Date.now(), locale = "en", t = (key) => key) {
  if (!timestamp) return t("reset.unknown")
  const minutes = Math.max(0, Math.ceil((timestamp * 1000 - now) / 60000))
  if (minutes === 0) return t("reset.imminent")
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const remaining = minutes % 60
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "long" })
  const durationPart = (value, unit) =>
    rtf
      .formatToParts(value, unit)
      .slice(1)
      .map((part) => part.value)
      .join("")
  const duration = [
    days && durationPart(days, "day"),
    hours && durationPart(hours, "hour"),
    !days && remaining && durationPart(remaining, "minute"),
  ]
    .filter(Boolean)
    .join(" ")
  return `${t("reset.in")} ${duration}`
}

export function compactCountdown(timestamp, now = Date.now(), locale = "en") {
  if (!timestamp) return "—"
  const minutes = Math.max(0, Math.ceil((timestamp * 1000 - now) / 60000))
  if (minutes === 0) return "<1m"
  const format = (value, unit) =>
    new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow", maximumFractionDigits: 0 }).format(
      value,
    )
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const remaining = minutes % 60
  if (days) return `${format(days, "day")} ${hours ? format(hours, "hour") : ""}`.trim()
  if (hours) return `${format(hours, "hour")} ${remaining ? format(remaining, "minute") : ""}`.trim()
  return format(minutes, "minute")
}
