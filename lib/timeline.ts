import type { LeaseRow } from "./types"

export type Granularity = "quarter" | "month"

export type HorizonMonths = 12 | 24 | 36 | 60

export type TimelineBucket = {
  /** Stable id, e.g. "2025-Q3" or "2025-08". */
  key: string
  /** Short tick label, e.g. "Q3 '25" or "Aug '25". */
  label: string
  /** Long label for tooltip / panel title, e.g. "Q3 2025" or "August 2025". */
  longLabel: string
  /** First day of the bucket in epoch-ms (used only for sorting / hit-testing). */
  startMs: number
  /** Last day (exclusive) of the bucket in epoch-ms. */
  endMs: number
  /** Months from "now" to bucket start. Negative if past. */
  monthsFromNow: number
  /** Annualized $ above market expiring in this bucket — opportunity to renegotiate. */
  opportunity: number
  /** Annualized $ below market expiring in this bucket — at-risk savings. */
  atRisk: number
  /** Leases expiring in this bucket with a benchmark (counted in either bar). */
  benchmarkedCount: number
  /** Leases expiring in this bucket without a benchmark (drawn as grey tick). */
  unbenchmarkedCount: number
  /** All leases expiring in this bucket. */
  totalCount: number
}

/** Compute the bucket key a given expiry date falls into. */
export function bucketKeyOf(iso: string, granularity: Granularity): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  if (granularity === "quarter") {
    const q = Math.floor(d.getMonth() / 3) + 1
    return `${y}-Q${q}`
  }
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

/** Short label for an axis tick. */
function shortLabel(key: string, granularity: Granularity): string {
  if (granularity === "quarter") {
    const [y, q] = key.split("-")
    return `${q} '${y.slice(2)}`
  }
  const [y, m] = key.split("-")
  const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
  })
  return `${monthName} '${y.slice(2)}`
}

/** Long label for tooltip / panel title. */
function longLabel(key: string, granularity: Granularity): string {
  if (granularity === "quarter") {
    const [y, q] = key.split("-")
    return `${q} ${y}`
  }
  const [y, m] = key.split("-")
  const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
  })
  return `${monthName} ${y}`
}

/** Start of the bucket whose key is given. */
function bucketStart(key: string, granularity: Granularity): Date {
  if (granularity === "quarter") {
    const [y, q] = key.split("-")
    const month = (Number(q.slice(1)) - 1) * 3
    return new Date(Number(y), month, 1)
  }
  const [y, m] = key.split("-")
  return new Date(Number(y), Number(m) - 1, 1)
}

/** First day of the bucket *after* the one whose key is given. */
function bucketEnd(key: string, granularity: Granularity): Date {
  const start = bucketStart(key, granularity)
  if (granularity === "quarter") {
    return new Date(start.getFullYear(), start.getMonth() + 3, 1)
  }
  return new Date(start.getFullYear(), start.getMonth() + 1, 1)
}

/** Compute the ordered list of bucket keys spanning the horizon, starting at "now". */
function bucketKeysInHorizon(granularity: Granularity, horizon: HorizonMonths): string[] {
  const now = new Date()
  const keys: string[] = []
  if (granularity === "quarter") {
    const startQ = Math.floor(now.getMonth() / 3)
    let y = now.getFullYear()
    let q = startQ + 1 // 1-based
    const buckets = Math.ceil(horizon / 3)
    for (let i = 0; i < buckets; i++) {
      keys.push(`${y}-Q${q}`)
      q += 1
      if (q > 4) {
        q = 1
        y += 1
      }
    }
  } else {
    let y = now.getFullYear()
    let m = now.getMonth() + 1 // 1-based
    for (let i = 0; i < horizon; i++) {
      keys.push(`${y}-${String(m).padStart(2, "0")}`)
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
  }
  return keys
}

/**
 * Build the timeline for the given rows, granularity and horizon.
 * Only includes leases whose expiry falls inside the horizon window.
 */
export function buildTimeline(
  rows: LeaseRow[],
  granularity: Granularity,
  horizon: HorizonMonths,
): TimelineBucket[] {
  const now = new Date()
  const keys = bucketKeysInHorizon(granularity, horizon)
  const map = new Map<string, TimelineBucket>()
  for (const k of keys) {
    const start = bucketStart(k, granularity)
    const end = bucketEnd(k, granularity)
    const monthsFromNow =
      (start.getFullYear() - now.getFullYear()) * 12 + (start.getMonth() - now.getMonth())
    map.set(k, {
      key: k,
      label: shortLabel(k, granularity),
      longLabel: longLabel(k, granularity),
      startMs: start.getTime(),
      endMs: end.getTime(),
      monthsFromNow,
      opportunity: 0,
      atRisk: 0,
      benchmarkedCount: 0,
      unbenchmarkedCount: 0,
      totalCount: 0,
    })
  }

  for (const r of rows) {
    const k = bucketKeyOf(r.expiryDate, granularity)
    const bucket = map.get(k)
    if (!bucket) continue // expiry is outside horizon
    bucket.totalCount += 1
    if (r.varianceAnnual == null) {
      bucket.unbenchmarkedCount += 1
      continue
    }
    bucket.benchmarkedCount += 1
    if (r.varianceAnnual > 0) {
      bucket.opportunity += r.varianceAnnual
    } else if (r.varianceAnnual < 0) {
      bucket.atRisk += -r.varianceAnnual
    }
  }

  return keys.map((k) => map.get(k)!)
}

/** Filter rows to those expiring inside the given bucket. */
export function rowsInBucket(
  rows: LeaseRow[],
  bucketKey: string,
  granularity: Granularity,
): LeaseRow[] {
  return rows.filter((r) => bucketKeyOf(r.expiryDate, granularity) === bucketKey)
}
