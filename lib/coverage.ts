import type { LeaseRow } from "./types"

/**
 * Readiness threshold below which the dashboard switches into "Setup" mode.
 * Brokers cannot trust portfolio-level numbers (opportunity, at-risk savings,
 * spend impact) until most leases have a defensible market estimate, so we
 * force the comp-mapping workflow to the front when coverage is below this.
 */
export const READINESS_THRESHOLD = 0.85

/** Per-lease problem classification, ordered by severity (highest first). */
export type AttentionSeverity = "missing" | "fell-back" | "low-confidence"

export type LeaseAttention = {
  severity: AttentionSeverity
  /** Short human reason shown next to the lease in the setup list. */
  reason: string
  /** Slightly longer hint shown in the action button or tooltip. */
  hint: string
}

/**
 * Decide whether a lease still needs broker attention before the dashboard's
 * comparisons can be trusted. Returns null when the lease is "ready":
 *  - broker has explicitly confirmed an estimate (manual / scope-override / ERV)
 *  - or the system default scope has medium/high confidence and didn't fall back
 *
 * The order of checks defines visual priority in the setup list.
 */
export function getLeaseAttention(row: LeaseRow): LeaseAttention | null {
  // 1. No comp at all — most urgent. Comparison can't be computed.
  if (row.comparisonSource === "none") {
    return {
      severity: "missing",
      reason: "No market estimate",
      hint: "Pick a comp scope or type your own ERV",
    }
  }

  // Broker-confirmed sources are always trusted.
  if (
    row.comparisonSource === "broker" ||
    row.comparisonSource === "scope-override" ||
    row.comparisonSource === "erv-system"
  ) {
    return null
  }

  // System default is in use. Two flavors of "needs review":
  // 2. The system fell back to a wider scope because the narrowest one had
  //    too few comps — broker should confirm or override.
  if (row.fellBack) {
    return {
      severity: "fell-back",
      reason: "Narrow scope had too few comps",
      hint: "System fell back to a wider scope — confirm or override",
    }
  }

  // 3. Default scope is low confidence (small comp set).
  if (row.marketConfidence === "low") {
    return {
      severity: "low-confidence",
      reason: "Low-confidence comp",
      hint: "Backed by a small comp set — review or override",
    }
  }

  return null
}

export type CoverageStats = {
  total: number
  ready: number
  /** total - ready */
  attention: number
  /** ready / total in [0,1]; 1 when there are zero leases. */
  readyPct: number
  /** Counts per severity for the setup-page summary. */
  missingCount: number
  fellBackCount: number
  lowConfidenceCount: number
}

export function coverageStats(rows: LeaseRow[]): CoverageStats {
  let ready = 0
  let missingCount = 0
  let fellBackCount = 0
  let lowConfidenceCount = 0

  for (const r of rows) {
    const a = getLeaseAttention(r)
    if (a == null) {
      ready += 1
      continue
    }
    if (a.severity === "missing") missingCount += 1
    else if (a.severity === "fell-back") fellBackCount += 1
    else lowConfidenceCount += 1
  }

  const total = rows.length
  return {
    total,
    ready,
    attention: total - ready,
    readyPct: total === 0 ? 1 : ready / total,
    missingCount,
    fellBackCount,
    lowConfidenceCount,
  }
}

/**
 * Filter + sort rows that still need attention. Severity ranking lines them
 * up the way a broker should triage: missing first (no number at all), then
 * fell-back (system guessed a wider scope), then low-confidence.
 */
export function attentionRows(rows: LeaseRow[]): Array<{
  row: LeaseRow
  attention: LeaseAttention
}> {
  const list: Array<{ row: LeaseRow; attention: LeaseAttention }> = []
  for (const r of rows) {
    const a = getLeaseAttention(r)
    if (a) list.push({ row: r, attention: a })
  }
  const order: Record<AttentionSeverity, number> = {
    missing: 0,
    "fell-back": 1,
    "low-confidence": 2,
  }
  list.sort((a, b) => {
    const so = order[a.attention.severity] - order[b.attention.severity]
    if (so !== 0) return so
    // Within a severity, surface the largest leases first — biggest dollar
    // impact when the broker confirms a comp.
    return b.row.sf - a.row.sf
  })
  return list
}
