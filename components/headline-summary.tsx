import type { Aggregate } from "@/lib/calculations"
import type { Filters } from "@/lib/calculations"
import { formatDollars, formatPsf } from "@/lib/format"

type Props = {
  agg: Aggregate
  filters: Filters
}

function buildScopeLabel(filters: Filters): string {
  const parts: string[] = []
  if (filters.propertyType) parts.push(filters.propertyType)
  if (filters.submarket) parts.push(filters.submarket)
  if (parts.length === 0) return "Full portfolio"
  return parts.join(" · ")
}

export function HeadlineSummary({ agg, filters }: Props) {
  const scope = buildScopeLabel(filters)
  const gapPsf = agg.weightedGapPsf
  const gapAnnual = agg.totalGapAnnual

  // Above market = paying too much = unfavorable. Below market = favorable.
  let toneClass = "headline-tone-neutral"
  let toneLabel = "Aligned with market"
  if (gapPsf != null) {
    if (gapPsf > 0.5) {
      toneClass = "headline-tone-above"
      toneLabel = "Above market"
    } else if (gapPsf < -0.5) {
      toneClass = "headline-tone-below"
      toneLabel = "Below market"
    }
  }

  return (
    <section className={`headline ${toneClass}`} aria-label="Portfolio summary">
      <div className="headline-scope">
        <span className="headline-scope-label">{scope}</span>
        <span className="headline-scope-meta">
          {agg.count} {agg.count === 1 ? "lease" : "leases"} ·{" "}
          {agg.benchmarkedCount} benchmarked
          {agg.brokerEstimateCount > 0 ? (
            <>
              {" · "}
              <span className="meta-emphasis">
                {agg.brokerEstimateCount} broker{" "}
                {agg.brokerEstimateCount === 1 ? "estimate" : "estimates"}
              </span>
            </>
          ) : null}
        </span>
      </div>

      <div className="headline-stats">
        <div className="headline-primary">
          <div className="headline-primary-tone">{toneLabel}</div>
          <div className="headline-primary-value mono">
            {formatPsf(gapPsf, { sign: true })}
            <span className="headline-primary-unit">/SF</span>
          </div>
          <div className="headline-primary-sub">
            {gapAnnual != null
              ? `${formatDollars(gapAnnual, { sign: true })} annualized`
              : "No comparison available"}
          </div>
        </div>

        <dl className="headline-supporting">
          <div className="headline-supporting-item">
            <dt>Your weighted rent</dt>
            <dd className="mono">{formatPsf(agg.avgCurrentPsf)}/SF</dd>
          </div>
          <div className="headline-supporting-item">
            <dt>Comparison rent</dt>
            <dd className="mono">
              {agg.avgComparisonPsf != null ? `${formatPsf(agg.avgComparisonPsf)}/SF` : "—"}
            </dd>
          </div>
          <div className="headline-supporting-item">
            <dt>Total SF</dt>
            <dd className="mono">{agg.totalSf.toLocaleString("en-US")}</dd>
          </div>
          <div className="headline-supporting-item">
            <dt>No comparison</dt>
            <dd className="mono">{agg.noDataCount}</dd>
          </div>
        </dl>
      </div>

      {agg.brokerEstimateCount > 0 && (
        <p className="headline-footnote">
          Includes broker estimates for {agg.brokerEstimateCount} of {agg.benchmarkedCount}{" "}
          benchmarked leases. Where present, broker estimates override our market data.
        </p>
      )}
    </section>
  )
}
