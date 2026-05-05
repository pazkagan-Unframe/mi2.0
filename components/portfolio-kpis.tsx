import type { LeaseRow } from "@/lib/types"
import type { Aggregate } from "@/lib/calculations"
import { formatDollars, formatPsf } from "@/lib/format"

type Props = {
  rows: LeaseRow[]
  agg: Aggregate
}

/**
 * Four KPI cards at the top of the page. Always visible, always reflect current filters.
 *
 * 1. Leases in scope (count + total SF)
 * 2. Above-market exposure (count + weighted $/SF + annualized cost)
 * 3. Below-market savings (count + weighted $/SF + annualized savings)
 * 4. Broker estimates (count of overrides in scope)
 */
export function PortfolioKpis({ rows, agg }: Props) {
  const above = rows.filter((r) => (r.variancePsf ?? 0) > 0)
  const below = rows.filter((r) => (r.variancePsf ?? 0) < 0)

  const aboveSf = above.reduce((s, r) => s + r.sf, 0)
  const belowSf = below.reduce((s, r) => s + r.sf, 0)

  const aboveWeightedGap =
    aboveSf > 0 ? above.reduce((s, r) => s + (r.variancePsf ?? 0) * r.sf, 0) / aboveSf : 0
  const belowWeightedGap =
    belowSf > 0 ? below.reduce((s, r) => s + (r.variancePsf ?? 0) * r.sf, 0) / belowSf : 0

  const aboveAnnual = above.reduce((s, r) => s + (r.varianceAnnual ?? 0), 0)
  const belowAnnual = below.reduce((s, r) => s + (r.varianceAnnual ?? 0), 0)

  return (
    <div className="kpi-strip" role="region" aria-label="Portfolio summary">
      <div className="kpi">
        <div className="kpi-label">Leases in scope</div>
        <div className="kpi-value">
          {agg.count}
          <span className="small"> / {agg.totalSf.toLocaleString("en-US")} SF</span>
        </div>
        <div className="kpi-meta">
          <strong>{agg.benchmarkedCount}</strong> with comparison · <strong>{agg.noDataCount}</strong>{" "}
          unbenchmarked
        </div>
      </div>

      <div className="kpi">
        <div className="kpi-label">Above market</div>
        <div className="kpi-value danger">
          {formatPsf(aboveWeightedGap, { sign: true })}
          <span className="small">/SF</span>
        </div>
        <div className="kpi-meta">
          <strong>{above.length}</strong> {above.length === 1 ? "lease" : "leases"} ·{" "}
          {formatDollars(aboveAnnual, { sign: true })}/yr
        </div>
      </div>

      <div className="kpi">
        <div className="kpi-label">Below market</div>
        <div className="kpi-value success">
          {formatPsf(belowWeightedGap, { sign: true })}
          <span className="small">/SF</span>
        </div>
        <div className="kpi-meta">
          <strong>{below.length}</strong> {below.length === 1 ? "lease" : "leases"} ·{" "}
          {formatDollars(belowAnnual, { sign: true })}/yr
        </div>
      </div>

      <div className="kpi">
        <div className="kpi-label">Broker estimates</div>
        <div className="kpi-value">
          {agg.brokerEstimateCount}
          <span className="small"> / {agg.benchmarkedCount}</span>
        </div>
        <div className="kpi-meta">
          {agg.brokerEstimateCount > 0
            ? "Used as source of truth where present"
            : "Add an estimate from any lease row"}
        </div>
      </div>
    </div>
  )
}
