import type { LeaseRow } from "./types"
import {
  bucketKeyOf,
  enumerateBuckets,
  type BucketShell,
  type Granularity,
  type HorizonMonths,
} from "./timeline"

/**
 * Per-period spend composition. The chart in components/spend-composition.tsx
 * renders two adjacent stacked bars for each bucket:
 *
 *   Column 1 (current):  [ expiringSpendCurrent | lockedSpend ]
 *   Column 2 (market):   [ expiringSpendMarket  | lockedSpend ]
 *
 * Both columns share the SAME locked baseline because leases that aren't
 * expiring in this period can't be renegotiated against the market right now.
 * The visible delta is at the top — that's the renegotiation upside (when
 * market < current) or at-risk savings (when market > current) for that period.
 */
export type SpendBucket = BucketShell & {
  /** Number of leases in the filtered scope expiring in this period. */
  expiringCount: number
  /** Annualized $ spend at *current* contract rates for leases expiring here. */
  expiringSpendCurrent: number
  /**
   * Annualized $ spend at the *comparison* rate (broker override or system
   * default scope) for leases expiring here. For expiring leases that lack a
   * comparison value we fall back to currentRentPsf — they don't move the
   * delta but still contribute to the bar height.
   */
  expiringSpendMarket: number
  /** Annualized $ spend for leases NOT expiring in this period. */
  lockedSpend: number
  /** lockedSpend + expiringSpendCurrent. Constant across buckets in the same scope. */
  totalCurrent: number
  /** lockedSpend + expiringSpendMarket. */
  totalMarket: number
  /** expiringSpendCurrent − expiringSpendMarket. Positive = renegotiation save. */
  netDelta: number
  /** Of the expiring leases, how many lack a comparison value. */
  expiringWithoutComp: number
  /** Sum of varianceAnnual for above-market expiring leases (renegotiation $). */
  opportunity: number
  /** Sum of |varianceAnnual| for below-market expiring leases (at-risk $). */
  atRisk: number
  /** Count of expiring leases above market. */
  aboveCount: number
  /** Count of expiring leases below market. */
  belowCount: number
}

export type SpendComposition = {
  buckets: SpendBucket[]
  /** Annual run-rate spend across the entire filtered portfolio. Constant per bucket. */
  portfolioAnnualSpend: number
  /** Sum of expiringSpendCurrent across visible buckets (within horizon). */
  horizonExpiringCurrent: number
  /** Sum of expiringSpendMarket across visible buckets. */
  horizonExpiringMarket: number
  /** horizonExpiringCurrent − horizonExpiringMarket. */
  horizonNetDelta: number
  /** Total leases with expiries inside the horizon. */
  horizonExpiringCount: number
  /** Sum of opportunity across all buckets — above-market $ exposed to renewal. */
  horizonOpportunity: number
  /** Sum of atRisk across all buckets — below-market $ savings exposed to renewal. */
  horizonAtRisk: number
  /** Total above-market expiring leases. */
  horizonAboveCount: number
  /** Total below-market expiring leases. */
  horizonBelowCount: number
  /** Total expiring leases lacking comp data — excluded from variance bars. */
  horizonWithoutComp: number
}

/** Build the spend composition for the given rows over the visible horizon. */
export function buildSpendComposition(
  rows: LeaseRow[],
  granularity: Granularity,
  horizon: HorizonMonths,
): SpendComposition {
  const shells = enumerateBuckets(granularity, horizon)
  const map = new Map<string, SpendBucket>()
  for (const shell of shells) {
    map.set(shell.key, {
      ...shell,
      expiringCount: 0,
      expiringSpendCurrent: 0,
      expiringSpendMarket: 0,
      lockedSpend: 0,
      totalCurrent: 0,
      totalMarket: 0,
      netDelta: 0,
      expiringWithoutComp: 0,
      opportunity: 0,
      atRisk: 0,
      aboveCount: 0,
      belowCount: 0,
    })
  }

  // Total annual spend across the entire filtered scope. Used as the "locked"
  // baseline for any bucket where the lease isn't expiring.
  let portfolioAnnualSpend = 0
  for (const r of rows) {
    portfolioAnnualSpend += r.currentRentPsf * r.sf
  }

  // First pass: classify every row's contribution to each bucket. A given
  // lease expires in at most ONE bucket (or none, if outside horizon).
  for (const r of rows) {
    const annualCurrent = r.currentRentPsf * r.sf
    const k = bucketKeyOf(r.expiryDate, granularity)
    const expiringBucket = map.get(k) ?? null

    for (const bucket of map.values()) {
      if (bucket === expiringBucket) {
        // Lease expires in THIS bucket → contributes to the actionable top.
        const annualMarket =
          r.comparisonPsf != null ? r.comparisonPsf * r.sf : annualCurrent
        bucket.expiringCount += 1
        bucket.expiringSpendCurrent += annualCurrent
        bucket.expiringSpendMarket += annualMarket
        if (r.comparisonPsf == null) {
          bucket.expiringWithoutComp += 1
        } else if (r.varianceAnnual != null) {
          // Same convention as the timeline: opportunity = above-market $,
          // at-risk = |below-market $|. varianceAnnual is signed.
          if (r.varianceAnnual > 0) {
            bucket.opportunity += r.varianceAnnual
            bucket.aboveCount += 1
          } else if (r.varianceAnnual < 0) {
            bucket.atRisk += -r.varianceAnnual
            bucket.belowCount += 1
          }
        }
      } else {
        // Lease expires elsewhere (or outside horizon) → counts as locked
        // baseline for THIS bucket, in both current and market columns.
        bucket.lockedSpend += annualCurrent
      }
    }
  }

  // Finalize derived totals.
  let horizonExpiringCurrent = 0
  let horizonExpiringMarket = 0
  let horizonExpiringCount = 0
  let horizonOpportunity = 0
  let horizonAtRisk = 0
  let horizonAboveCount = 0
  let horizonBelowCount = 0
  let horizonWithoutComp = 0
  const buckets: SpendBucket[] = []
  for (const shell of shells) {
    const b = map.get(shell.key)!
    b.totalCurrent = b.lockedSpend + b.expiringSpendCurrent
    b.totalMarket = b.lockedSpend + b.expiringSpendMarket
    b.netDelta = b.expiringSpendCurrent - b.expiringSpendMarket
    horizonExpiringCurrent += b.expiringSpendCurrent
    horizonExpiringMarket += b.expiringSpendMarket
    horizonExpiringCount += b.expiringCount
    horizonOpportunity += b.opportunity
    horizonAtRisk += b.atRisk
    horizonAboveCount += b.aboveCount
    horizonBelowCount += b.belowCount
    horizonWithoutComp += b.expiringWithoutComp
    buckets.push(b)
  }

  return {
    buckets,
    portfolioAnnualSpend,
    horizonExpiringCurrent,
    horizonExpiringMarket,
    horizonNetDelta: horizonExpiringCurrent - horizonExpiringMarket,
    horizonExpiringCount,
    horizonOpportunity,
    horizonAtRisk,
    horizonAboveCount,
    horizonBelowCount,
    horizonWithoutComp,
  }
}
