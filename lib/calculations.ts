import type {
  BrokerOverrides,
  LeaseRow,
  LeaseWithScopes,
  PropertyType,
} from "./types"
import { monthsUntil } from "./format"

/**
 * Threshold (as a fraction of comparison rent) within which a lease is
 * considered "at market" rather than above or below. ±5%.
 */
export const AT_MARKET_THRESHOLD = 0.05

/**
 * Source-of-truth rule.
 * comparisonPsf = brokerOverride ?? defaultScope.rentPsf
 * variancePsf = currentRent − comparisonPsf
 * Positive variance = paying above market = unfavorable for tenant.
 */
export function buildLeaseRow(
  lease: LeaseWithScopes,
  overrides: BrokerOverrides,
): LeaseRow {
  const brokerOverride = overrides[lease.id] ?? null

  const defaultScope = lease.scopes.find((s) => s.id === lease.defaultScopeId) ?? null

  let comparisonPsf: number | null
  let comparisonSource: LeaseRow["comparisonSource"]
  let comparisonLabel: string

  if (brokerOverride) {
    comparisonPsf = brokerOverride.estimatePsf
    comparisonSource =
      brokerOverride.kind === "manual"
        ? "broker"
        : brokerOverride.kind === "system-erv"
          ? "erv-system"
          : "scope-override"
    comparisonLabel = brokerOverride.sourceLabel
  } else if (lease.systemErvPsf != null) {
    // External ERV is the strongest signal we ship — when one exists for a
    // lease and the broker hasn't manually picked something else, it
    // becomes the default comparison. Treated as broker-confirmed for
    // attention/coverage purposes (the broker's implicit choice is to
    // accept the strongest source).
    comparisonPsf = lease.systemErvPsf
    comparisonSource = "erv-system"
    comparisonLabel = "External ERV"
  } else if (defaultScope) {
    comparisonPsf = defaultScope.rentPsf
    comparisonSource = "market"
    comparisonLabel = defaultScope.label
  } else {
    comparisonPsf = null
    comparisonSource = "none"
    comparisonLabel = "No comp set"
  }

  const variancePsf =
    comparisonPsf != null ? lease.currentRentPsf - comparisonPsf : null
  const variancePct =
    variancePsf != null && comparisonPsf
      ? variancePsf / comparisonPsf
      : null
  const varianceAnnual = variancePsf != null ? variancePsf * lease.sf : null

  return {
    ...lease,
    comparisonPsf,
    comparisonSource,
    comparisonLabel,
    variancePsf,
    variancePct,
    varianceAnnual,
    brokerOverride,
  }
}

export function buildLeaseRows(
  leases: LeaseWithScopes[],
  overrides: BrokerOverrides,
): LeaseRow[] {
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
      const sourceConfidence =
        r.comparisonSource === "broker" ||
        r.comparisonSource === "scope-override" ||
        r.comparisonSource === "erv-system"
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

/** Position of a single lease relative to its comparison rent (±5% = at market). */
export type Position = "above" | "at" | "below" | "no-data"

export function positionOf(row: LeaseRow): Position {
  if (row.variancePct == null) return "no-data"
  if (row.variancePct > AT_MARKET_THRESHOLD) return "above"
  if (row.variancePct < -AT_MARKET_THRESHOLD) return "below"
  return "at"
}

/** Counts and dollar impact bucketed by position. */
export type PulseStats = {
  totalCount: number
  benchmarkedCount: number
  aboveCount: number
  atCount: number
  belowCount: number
  noDataCount: number
  /** Sum of (current − comparison) × SF across above-market leases (positive). */
  annualOpportunity: number
  /** Sum of (comparison − current) × SF across below-market leases (positive). */
  annualSavings: number
  /** Net = annualOpportunity − annualSavings. Positive = paying more than market overall. */
  netAnnual: number
  /** Count of leases whose source is broker (manual or scope-override). */
  brokerOverrideCount: number
  /** Count of benchmarked leases backed by low-confidence comps. */
  lowConfidenceCount: number
}

export function pulseStats(rows: LeaseRow[]): PulseStats {
  let aboveCount = 0
  let atCount = 0
  let belowCount = 0
  let noDataCount = 0
  let benchmarkedCount = 0
  let annualOpportunity = 0
  let annualSavings = 0
  let brokerOverrideCount = 0
  let lowConfidenceCount = 0

  for (const r of rows) {
    if (
      r.comparisonSource === "broker" ||
      r.comparisonSource === "scope-override" ||
      r.comparisonSource === "erv-system"
    ) {
      brokerOverrideCount += 1
    }
    const pos = positionOf(r)
    if (pos === "no-data") {
      noDataCount += 1
      continue
    }
    benchmarkedCount += 1
    if (pos === "above") {
      aboveCount += 1
      annualOpportunity += r.varianceAnnual ?? 0
    } else if (pos === "below") {
      belowCount += 1
      annualSavings += -(r.varianceAnnual ?? 0)
    } else {
      atCount += 1
    }
    if (r.comparisonSource === "market" && r.marketConfidence === "low") {
      lowConfidenceCount += 1
    }
  }

  return {
    totalCount: rows.length,
    benchmarkedCount,
    aboveCount,
    atCount,
    belowCount,
    noDataCount,
    annualOpportunity,
    annualSavings,
    netAnnual: annualOpportunity - annualSavings,
    brokerOverrideCount,
    lowConfidenceCount,
  }
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
    brokerEstimateCount: rows.filter(
      (r) =>
        r.comparisonSource === "broker" ||
        r.comparisonSource === "scope-override" ||
        r.comparisonSource === "erv-system",
    ).length,
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
