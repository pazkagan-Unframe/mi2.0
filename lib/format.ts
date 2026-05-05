/** Format a $/SF rent figure. */
export function formatPsf(value: number | null | undefined, options?: { sign?: boolean }): string {
  if (value == null || Number.isNaN(value)) return "—"
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (options?.sign) {
    if (value > 0) return `+$${abs}`
    if (value < 0) return `-$${abs}`
  }
  return `$${abs}`
}

/** Format a large dollar value with abbreviations. */
export function formatDollars(
  value: number | null | undefined,
  options?: { sign?: boolean; compact?: boolean },
): string {
  if (value == null || Number.isNaN(value)) return "—"
  const sign = options?.sign && value > 0 ? "+" : value < 0 ? "-" : ""
  const abs = Math.abs(value)

  if (options?.compact ?? true) {
    if (abs >= 1_000_000) {
      return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
    }
    if (abs >= 1_000) {
      return `${sign}$${(abs / 1_000).toFixed(1)}K`
    }
  }
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

/** Format square footage. */
export function formatSf(value: number): string {
  return `${value.toLocaleString("en-US")} SF`
}

/** Format an ISO date as e.g. "Mar 2027". */
export function formatExpiry(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

/** Months from today to the given ISO date. Negative if past. */
export function monthsUntil(iso: string): number {
  const now = new Date()
  const target = new Date(iso)
  const years = target.getFullYear() - now.getFullYear()
  const months = target.getMonth() - now.getMonth()
  return years * 12 + months
}

/** Format a percentage with one decimal. */
export function formatPercent(ratio: number | null | undefined, options?: { sign?: boolean }): string {
  if (ratio == null || Number.isNaN(ratio)) return "—"
  const pct = ratio * 100
  const sign = options?.sign && pct > 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}
