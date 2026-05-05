export type PropertyType =
  | "Office"
  | "Industrial"
  | "Retail"
  | "Multifamily"
  | "Mixed-Use"

export type Confidence = "high" | "medium" | "low"

export type Lease = {
  id: string
  address: string
  tenant: string
  propertyType: PropertyType
  submarket: string
  city: string
  state: string
  sf: number
  /** Current contractual rent per square foot, annualized. */
  currentRentPsf: number
  /** Our market intelligence rent per square foot. Null when no comp set is available. */
  marketRentPsf: number | null
  /** Number of comparable leases used to compute marketRentPsf. */
  marketCompCount: number
  marketConfidence: Confidence
  /** ISO date (YYYY-MM-DD). */
  expiryDate: string
}

export type BrokerOverride = {
  /** Broker's own assessment of the achievable market rent per SF, annualized. */
  estimatePsf: number
  note?: string
  updatedAt: string
}

export type BrokerOverrides = Record<string, BrokerOverride>

/** Computed view of a lease with the source-of-truth rule applied. */
export type LeaseRow = Lease & {
  /** The rent we are comparing against. Broker estimate when present, else market rent. */
  comparisonPsf: number | null
  comparisonSource: "broker" | "market" | "none"
  /** currentRentPsf − comparisonPsf. Positive = above market (paying too much). */
  variancePsf: number | null
  /** Annualized $ impact across the full SF. */
  varianceAnnual: number | null
  brokerOverride: BrokerOverride | null
}
