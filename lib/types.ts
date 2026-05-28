export type PropertyType =
  | "Office"
  | "Industrial"
  | "Retail"
  | "Multifamily"
  | "Mixed-Use"

export type Confidence = "high" | "medium" | "low"

/**
 * One option in a lease's market-rent scope chain. The broker can hover the
 * Market $/SF cell on a lease and pick which of these scopes drives the
 * comparison. Confidence is derived from compCount (>=10 high, >=5 medium, <5 low).
 */
export type ScopeOption = {
  id: string
  /** Human label, e.g. "Office in Midtown" or "All NYC properties". */
  label: string
  /** Semantic level of the scope, narrowest first. */
  level: "type-submarket" | "type-city" | "submarket-all" | "city-all"
  rentPsf: number
  compCount: number
  confidence: Confidence
}

export type Lease = {
  id: string
  address: string
  tenant: string
  propertyType: PropertyType
  submarket: string
  city: string
  state: string
  /** Approximate longitude / latitude of the lease for map plotting. */
  lng: number
  lat: number
  sf: number
  /** Current contractual rent per square foot, annualized. */
  currentRentPsf: number
  /** Our market intelligence rent per square foot at the default (narrowest viable) scope. */
  marketRentPsf: number | null
  /** Number of comparable leases used to compute marketRentPsf at the default scope. */
  marketCompCount: number
  marketConfidence: Confidence
  /**
   * Optional system-supplied Estimated Rental Value, sourced from external
   * market intelligence outside the comp dataset. Available only for some
   * leases. Selectable in the comp picker as an alternative to comp scopes.
   */
  systemErvPsf?: number | null
  /** ISO date (YYYY-MM-DD). */
  expiryDate: string
}

/** Lease + its scope chain, built once from the static portfolio. */
export type LeaseWithScopes = Lease & {
  scopes: ScopeOption[]
  /** id of the scope our system auto-selected. The broker can override it. */
  defaultScopeId: string
  /** True when narrowest scope had too few comps and the system fell back. */
  fellBack: boolean
  /** Resolved system ERV (filled deterministically for a subset of leases). */
  systemErvPsf: number | null
}

/**
 * Override stored per lease, per broker. Sources:
 * - "manual": broker typed their own ERV (sourceLabel = "Your ERV").
 * - "scope": broker picked an alternate comp scope (sourceLabel = scope label).
 * - "system-erv": broker chose to compare against the externally-sourced ERV
 *   (sourceLabel = "External ERV"). estimatePsf holds the ERV at pick time.
 * estimatePsf is always what we compare against.
 */
export type BrokerOverride = {
  estimatePsf: number
  kind: "manual" | "scope" | "system-erv"
  /** Scope id when kind === "scope". */
  scopeId?: string
  /** Human label shown on the row. */
  sourceLabel: string
  note?: string
  updatedAt: string
}

export type BrokerOverrides = Record<string, BrokerOverride>

/** Computed view of a lease with the source-of-truth rule applied. */
export type LeaseRow = LeaseWithScopes & {
  /** The rent we are comparing against. Override when present, else default scope rent. */
  comparisonPsf: number | null
  /**
   * - "broker"         broker typed their own ERV
   * - "scope-override" broker picked an alternate comp scope
   * - "erv-system"     broker pinned the externally-sourced ERV
   * - "market"         system default comp scope
   * - "none"           no comparison data of any kind
   */
  comparisonSource: "broker" | "scope-override" | "erv-system" | "market" | "none"
  comparisonLabel: string
  /** currentRentPsf − comparisonPsf. Positive = above market (paying too much). */
  variancePsf: number | null
  /** Variance as a percentage of comparison. */
  variancePct: number | null
  /** Annualized $ impact across the full SF. */
  varianceAnnual: number | null
  brokerOverride: BrokerOverride | null
}
