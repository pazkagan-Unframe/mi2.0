"use client"

import type { Filters } from "@/lib/calculations"
import { AT_MARKET_THRESHOLD, type PulseStats } from "@/lib/calculations"
import { formatDollars } from "@/lib/format"
import type { PulseBucket } from "./breakdown-panel"

type Props = {
  stats: PulseStats
  filters: Filters
  onFilterLowConfidence: () => void
  /**
   * Drill into the side panel scoped to a pulse bucket — same surface as the
   * renewal-timeline period drill-down. Optional so the component still
   * renders standalone in any context that doesn't wire the panel.
   */
  onSelectBucket?: (bucket: PulseBucket) => void
}

/**
 * Headline component. One stacked bar shows where the portfolio sits vs market,
 * with two big numbers underneath: annual opportunity (above-market exposure)
 * and locked-in savings (below-market). At-market threshold is ±5%.
 *
 * Aggregate $/SF averages are deliberately omitted — they conflate leases of
 * very different sizes and don't represent anything actionable. Dollars do.
 */
export function PortfolioPulse({
  stats,
  filters,
  onFilterLowConfidence,
  onSelectBucket,
}: Props) {
  const { aboveCount, atCount, belowCount, noDataCount, benchmarkedCount } = stats

  const denom = benchmarkedCount > 0 ? benchmarkedCount : 1
  const abovePct = (aboveCount / denom) * 100
  const atPct = (atCount / denom) * 100
  const belowPct = (belowCount / denom) * 100

  const scopeLabel = buildScopeLabel(filters)
  const thresholdPct = Math.round(AT_MARKET_THRESHOLD * 100)

  const drill = (bucket: PulseBucket, count: number) => {
    if (!onSelectBucket || count === 0) return undefined
    return () => onSelectBucket(bucket)
  }

  return (
    <section className="pulse" role="region" aria-label="Portfolio pulse">
      <div className="pulse-head">
        <div className="pulse-head-left">
          <div className="pulse-eyebrow">Portfolio pulse</div>
          <div className="pulse-scope">{scopeLabel}</div>
        </div>
        <div className="pulse-head-right">
          <span className="pulse-meta">
            {benchmarkedCount} benchmarked
            {noDataCount > 0 ? ` · ${noDataCount} unbenchmarked` : ""}
          </span>
        </div>
      </div>

      <div className="pulse-bar" aria-hidden="true">
        {aboveCount > 0 && (
          <button
            type="button"
            className="pulse-seg above"
            style={{ width: `${abovePct}%` }}
            title={`${aboveCount} above market — click to drill in`}
            onClick={drill("above", aboveCount)}
            disabled={!onSelectBucket}
            aria-label={`${aboveCount} leases above market`}
          >
            {abovePct >= 8 && <span className="pulse-seg-label">{aboveCount}</span>}
          </button>
        )}
        {atCount > 0 && (
          <button
            type="button"
            className="pulse-seg at"
            style={{ width: `${atPct}%` }}
            title={`${atCount} at market — click to drill in`}
            onClick={drill("at", atCount)}
            disabled={!onSelectBucket}
            aria-label={`${atCount} leases at market`}
          >
            {atPct >= 8 && <span className="pulse-seg-label">{atCount}</span>}
          </button>
        )}
        {belowCount > 0 && (
          <button
            type="button"
            className="pulse-seg below"
            style={{ width: `${belowPct}%` }}
            title={`${belowCount} below market — click to drill in`}
            onClick={drill("below", belowCount)}
            disabled={!onSelectBucket}
            aria-label={`${belowCount} leases below market`}
          >
            {belowPct >= 8 && <span className="pulse-seg-label">{belowCount}</span>}
          </button>
        )}
        {benchmarkedCount === 0 && (
          <div className="pulse-seg empty" style={{ width: "100%" }}>
            <span className="pulse-seg-label muted">No benchmarked leases in scope</span>
          </div>
        )}
      </div>

      <div className="pulse-legend">
        <button
          type="button"
          className="pulse-legend-item"
          onClick={drill("above", aboveCount)}
          disabled={!onSelectBucket || aboveCount === 0}
        >
          <span className="dot above" />
          <span className="lbl">
            Above market <span className="muted">(&gt; +{thresholdPct}%)</span>
          </span>
          <span className="num">{aboveCount}</span>
        </button>
        <button
          type="button"
          className="pulse-legend-item"
          onClick={drill("at", atCount)}
          disabled={!onSelectBucket || atCount === 0}
        >
          <span className="dot at" />
          <span className="lbl">
            At market <span className="muted">(±{thresholdPct}%)</span>
          </span>
          <span className="num">{atCount}</span>
        </button>
        <button
          type="button"
          className="pulse-legend-item"
          onClick={drill("below", belowCount)}
          disabled={!onSelectBucket || belowCount === 0}
        >
          <span className="dot below" />
          <span className="lbl">
            Below market <span className="muted">(&lt; −{thresholdPct}%)</span>
          </span>
          <span className="num">{belowCount}</span>
        </button>
      </div>

      <div className="pulse-numbers">
        <button
          type="button"
          className="pulse-number opportunity"
          onClick={drill("above", aboveCount)}
          disabled={!onSelectBucket || aboveCount === 0}
        >
          <div className="pulse-number-label">Annual opportunity</div>
          <div className="pulse-number-value danger">
            {formatDollars(stats.annualOpportunity)}
          </div>
          <div className="pulse-number-meta">
            across {aboveCount} above-market {aboveCount === 1 ? "lease" : "leases"}
          </div>
        </button>
        <button
          type="button"
          className="pulse-number savings"
          onClick={drill("below", belowCount)}
          disabled={!onSelectBucket || belowCount === 0}
        >
          <div className="pulse-number-label">Annual locked-in savings</div>
          <div className="pulse-number-value success">
            {formatDollars(stats.annualSavings)}
          </div>
          <div className="pulse-number-meta">
            across {belowCount} below-market {belowCount === 1 ? "lease" : "leases"}
          </div>
        </button>
      </div>

      {(stats.lowConfidenceCount > 0 || stats.brokerOverrideCount > 0) && (
        <div className="pulse-footer">
          {stats.brokerOverrideCount > 0 && (
            <span>
              <strong>{stats.brokerOverrideCount}</strong>
              {stats.brokerOverrideCount === 1 ? " lease uses" : " leases use"} a broker
              estimate or alternate scope
            </span>
          )}
          {stats.brokerOverrideCount > 0 && stats.lowConfidenceCount > 0 && (
            <span className="sep">·</span>
          )}
          {stats.lowConfidenceCount > 0 && (
            <button type="button" className="pulse-footer-action" onClick={onFilterLowConfidence}>
              {stats.lowConfidenceCount}{" "}
              {stats.lowConfidenceCount === 1 ? "lease lacks" : "leases lack"} high-confidence
              comps — review
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function buildScopeLabel(filters: Filters): string {
  if (filters.propertyType && filters.submarket) {
    return `${filters.propertyType} · ${filters.submarket}`
  }
  if (filters.propertyType) return filters.propertyType
  if (filters.submarket) return filters.submarket
  return "All leases"
}
