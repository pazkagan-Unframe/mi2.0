import type { Confidence, Lease, LeaseWithScopes, ScopeOption } from "./types"

/**
 * Build the scope chain for every lease in the portfolio.
 *
 * In production this comes from the market-intelligence backend. For the
 * prototype we derive realistic-looking scopes per lease using the actual
 * portfolio shape so counts and rents stay internally consistent.
 *
 * Scope levels, narrowest → widest:
 *   1. {propertyType} in {submarket}
 *   2. {propertyType} in {city}
 *   3. All property types in {submarket}
 *   4. All property types in {city}
 *
 * The system's default scope is the narrowest one with at least 5 comps.
 */
export const MIN_COMPS_FOR_SCOPE = 5
export const MIN_COMPS_FOR_HIGH_CONFIDENCE = 10

export function confidenceForCount(count: number): Confidence {
  if (count >= MIN_COMPS_FOR_HIGH_CONFIDENCE) return "high"
  if (count >= MIN_COMPS_FOR_SCOPE) return "medium"
  return "low"
}

/** Deterministic pseudo-random in [0,1) from a string. */
function hash01(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Convert to [0,1)
  return ((h >>> 0) % 100000) / 100000
}

export function buildLeasesWithScopes(leases: Lease[]): LeaseWithScopes[] {
  // Pre-compute portfolio counts per scope so wider scopes correlate with
  // actual portfolio breadth (a market with more of our leases tends to have
  // more available comps).
  const countByTypeSubmarket = new Map<string, number>()
  const countByTypeCity = new Map<string, number>()
  const countBySubmarket = new Map<string, number>()
  const countByCity = new Map<string, number>()

  for (const l of leases) {
    countByTypeSubmarket.set(
      `${l.propertyType}|${l.submarket}`,
      (countByTypeSubmarket.get(`${l.propertyType}|${l.submarket}`) ?? 0) + 1,
    )
    countByTypeCity.set(
      `${l.propertyType}|${l.city}`,
      (countByTypeCity.get(`${l.propertyType}|${l.city}`) ?? 0) + 1,
    )
    countBySubmarket.set(l.submarket, (countBySubmarket.get(l.submarket) ?? 0) + 1)
    countByCity.set(l.city, (countByCity.get(l.city) ?? 0) + 1)
  }

  return leases.map((lease) => {
    const seed = (s: string) => hash01(`${lease.id}|${s}`)

    // Comp counts: a synthetic-but-stable function of the lease + portfolio
    // breadth. The narrowest scope uses the lease's own marketCompCount.
    const narrow = lease.marketCompCount
    const typeCity = Math.max(
      narrow,
      Math.round(narrow + 8 + seed("tc") * 30 + (countByTypeCity.get(`${lease.propertyType}|${lease.city}`) ?? 0) * 4),
    )
    const submarketAll = Math.max(
      Math.round(narrow * 1.4 + 6 + seed("sa") * 25),
      Math.round((countBySubmarket.get(lease.submarket) ?? 0) * 6 + 8),
    )
    const cityAll = Math.max(
      typeCity,
      submarketAll,
      Math.round(narrow * 2.5 + 30 + seed("ca") * 80 + (countByCity.get(lease.city) ?? 0) * 7),
    )

    // Rents at wider scopes drift from the narrow rent.
    const baseRent = lease.marketRentPsf ?? lease.currentRentPsf * 0.85
    const drift = (key: string, max: number) => (seed(key) - 0.5) * 2 * max
    const typeCityRent = round2(baseRent * (1 + drift("rc", 0.06)))
    const submarketAllRent = round2(baseRent * (1 + drift("rs", 0.18)))
    const cityAllRent = round2(baseRent * (1 + drift("rk", 0.22)))

    const scopes: ScopeOption[] = [
      {
        id: `${lease.id}:type-submarket`,
        label: `${lease.propertyType} in ${lease.submarket}`,
        level: "type-submarket",
        rentPsf: lease.marketRentPsf ?? round2(baseRent),
        compCount: narrow,
        confidence: confidenceForCount(narrow),
      },
      {
        id: `${lease.id}:type-city`,
        label: `${lease.propertyType} across ${lease.city}`,
        level: "type-city",
        rentPsf: typeCityRent,
        compCount: typeCity,
        confidence: confidenceForCount(typeCity),
      },
      {
        id: `${lease.id}:submarket-all`,
        label: `All property types in ${lease.submarket}`,
        level: "submarket-all",
        rentPsf: submarketAllRent,
        compCount: submarketAll,
        confidence: confidenceForCount(submarketAll),
      },
      {
        id: `${lease.id}:city-all`,
        label: `All property types in ${lease.city}`,
        level: "city-all",
        rentPsf: cityAllRent,
        compCount: cityAll,
        confidence: confidenceForCount(cityAll),
      },
    ]

    // Default = first scope with >= MIN_COMPS_FOR_SCOPE comps.
    const defaultScope =
      scopes.find((s) => s.compCount >= MIN_COMPS_FOR_SCOPE) ?? scopes[scopes.length - 1]
    const fellBack = defaultScope.id !== scopes[0].id

    return {
      ...lease,
      scopes,
      defaultScopeId: defaultScope.id,
      fellBack,
      // Override the lease's marketRentPsf / marketCompCount / marketConfidence
      // to reflect the system-selected default scope, so existing UI uses the
      // right numbers without changes.
      marketRentPsf: defaultScope.rentPsf,
      marketCompCount: defaultScope.compCount,
      marketConfidence: defaultScope.confidence,
    }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
