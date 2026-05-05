import type { BrokerOverrides, Lease, LeaseRow, PropertyType } from "./types"
import { monthsUntil } from "./format"

/**
 * Source-of-truth rule.
 * comparisonPsf = brokerEstimate ?? marketRent
 * variancePsf = currentRent − comparisonPsf
 * Positive variance = paying above market = unfavorable for tenant.
 */
export function buildLeaseRow(lease: Lease, overrides: BrokerOverrides): LeaseRow {
  const brokerOverride = overrides[lease.id] ?? null
  const comparisonPsf =
    brokerOverride?.estimatePsf != null
      ? brokerOverride.estimatePsf
      : lease.marketRentPsf

  const comparisonSource: LeaseRow["comparisonSource"] =
    brokerOverride?.estimatePsf != null
      ? "broker"
      : lease.marketRentPsf != null
        ? "market"
        : "none"

  const variancePsf =
    comparisonPsf != null ? lease.currentRentPsf - comparisonPsf : null
  const varianceAnnual = variancePsf != null ? variancePsf * lease.sf : null

  return {
    ...lease,
    comparisonPsf,
    comparisonSource,
    variancePsf,
    varianceAnnual,
    brokerOverride,
  }
}

export function buildLeaseRows(leases: Lease[], overrides: BrokerOverrides): LeaseRow[] {
  return leases.map((l) => buildLeaseRow(l, overrides))
}

export type Filters = {
  propertyType: PropertyType | null
  submarket: string | null
  expiryWindow: "lt12" | "12to24" | "24to36" | "gt36" | null
  confidence: "high" | "highmedium" | null
}

export const EMPTY_FILTERS: Filters = {
  propertyType: null,
  submarket: null,
  expiryWindow: null,
  confidence: null,
}

export function applyFilters(rows: LeaseRow[], filters: Filters): LeaseRow[] {
  return rows.filter((r) => {
    if (filters.propertyType && r.propertyType !== filters.propertyType) return false
    if (filters.submarket && r.submarket !== filters.submarket) return false
    if (filters.expiryWindow) {
      const months = monthsUntil(r.expiryDate)
      if (filters.expiryWindow === "lt12" && months >= 12) return false
      if (filters.expiryWindow === "12to24" && (months < 12 || months >= 24)) return false
      if (filters.expiryWindow === "24to36" && (months < 24 || months >= 36)) return false
      if (filters.expiryWindow === "gt36" && months < 36) return false
    }
    if (filters.confidence) {
      // Filter applies to the source backing the comparison.
      // Broker estimates are treated as "high" for filtering since the broker has affirmed them.
      const sourceConfidence =
        r.comparisonSource === "broker"
          ? "high"
          : r.comparisonSource === "market"
            ? r.marketConfidence
            : "low"
      if (filters.confidence === "high" && sourceConfidence !== "high") return false
      if (
        filters.confidence === "highmedium" &&
        sourceConfidence !== "high" &&
        sourceConfidence !== "medium"
      )
        return false
    }
    return true
  })
}

/** Aggregate stats for a set of rows. */
export type Aggregate = {
  count: number
  benchmarkedCount: number
  brokerEstimateCount: number
  totalSf: number
  /** SF-weighted average current rent. */
  avgCurrentPsf: number
  /** SF-weighted average comparison rent (over rows that have a comparison). */
  avgComparisonPsf: number | null
  /** Weighted gap $/SF (avgCurrentPsf − avgComparisonPsf), restricted to rows with a comparison. */
  weightedGapPsf: number | null
  /** Sum of variancePsf × sf across rows with variance. */
  totalGapAnnual: number | null
  /** Number of rows with no comparison data at all. */
  noDataCount: number
}

export function aggregate(rows: LeaseRow[]): Aggregate {
  const count = rows.length
  const totalSf = rows.reduce((s, r) => s + r.sf, 0)
  const benchmarked = rows.filter((r) => r.comparisonPsf != null)
  const benchmarkedSf = benchmarked.reduce((s, r) => s + r.sf, 0)

  const avgCurrentPsf =
    totalSf > 0 ? rows.reduce((s, r) => s + r.currentRentPsf * r.sf, 0) / totalSf : 0

  const avgComparisonPsf =
    benchmarkedSf > 0
      ? benchmarked.reduce((s, r) => s + (r.comparisonPsf as number) * r.sf, 0) / benchmarkedSf
      : null

  const weightedAvgCurrentForBenchmarked =
    benchmarkedSf > 0
      ? benchmarked.reduce((s, r) => s + r.currentRentPsf * r.sf, 0) / benchmarkedSf
      : null

  const weightedGapPsf =
    weightedAvgCurrentForBenchmarked != null && avgComparisonPsf != null
      ? weightedAvgCurrentForBenchmarked - avgComparisonPsf
      : null

  const totalGapAnnual =
    benchmarked.length > 0
      ? benchmarked.reduce((s, r) => s + (r.varianceAnnual ?? 0), 0)
      : null

  return {
    count,
    benchmarkedCount: benchmarked.length,
    brokerEstimateCount: rows.filter((r) => r.comparisonSource === "broker").length,
    totalSf,
    avgCurrentPsf,
    avgComparisonPsf,
    weightedGapPsf,
    totalGapAnnual,
    noDataCount: rows.filter((r) => r.comparisonSource === "none").length,
  }
}

/** Group rows by a key and aggregate each bucket. */
export function groupAndAggregate<K extends string>(
  rows: LeaseRow[],
  keyFn: (row: LeaseRow) => K,
): Array<{ key: K; rows: LeaseRow[]; agg: Aggregate }> {
  const map = new Map<K, LeaseRow[]>()
  for (const r of rows) {
    const k = keyFn(r)
    const list = map.get(k) ?? []
    list.push(r)
    map.set(k, list)
  }
  return Array.from(map.entries()).map(([key, list]) => ({
    key,
    rows: list,
    agg: aggregate(list),
  }))
}

/** Distinct sub-markets present in the filtered set, sorted alphabetically. */
export function distinctSubmarkets(rows: LeaseRow[]): string[] {
  const set = new Set(rows.map((r) => r.submarket))
  return Array.from(set).sort()
}

/** Distinct property types in the data, in a fixed order. */
export const PROPERTY_TYPE_ORDER: PropertyType[] = [
  "Office",
  "Industrial",
  "Retail",
  "Multifamily",
  "Mixed-Use",
]
