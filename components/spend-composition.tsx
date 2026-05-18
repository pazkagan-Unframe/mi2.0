"use client"

import { useMemo, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import type { Granularity, HorizonMonths } from "@/lib/timeline"
import { buildSpendComposition, type SpendBucket } from "@/lib/spend"
import { formatDollars } from "@/lib/format"

type Props = {
  rows: LeaseRow[]
  onSelectPeriod: (
    bucketKey: string,
    bucketLabel: string,
    granularity: Granularity,
  ) => void
}

const HORIZONS: HorizonMonths[] = [12, 24, 36, 60]
const NEAR_TERM_MONTHS = 12

/**
 * Renewal & spend impact — merges the old Renewal timeline (opportunity vs
 * at-risk variance bars) and Spend composition (current vs market paired
 * bars) into a single view. Each period shows two adjacent stacked bars
 * comparing current contract spend to what that same actionable slice would
 * cost at market — and the totals strip surfaces the renegotiation
 * opportunity, the at-risk savings, and the net.
 *
 * Modes:
 *   • Full spend       — locked baseline (non-expiring) + actionable expiring
 *                        spend. Honest absolute magnitudes.
 *   • Actionable only  — hides locked baseline, rescales to expiring portion.
 *                        Surfaces small periods you might otherwise miss.
 *
 * Clicking any column opens the breakdown side panel scoped to that period.
 */
type ViewMode = "full" | "actionable"

export function SpendComposition({ rows, onSelectPeriod }: Props) {
  const [granularity, setGranularity] = useState<Granularity>("quarter")
  const [horizon, setHorizon] = useState<HorizonMonths>(24)
  const [viewMode, setViewMode] = useState<ViewMode>("actionable")

  const data = useMemo(
    () => buildSpendComposition(rows, granularity, horizon),
    [rows, granularity, horizon],
  )

  // Y-axis scale: anchored to the largest visible bar across both columns.
  // In "actionable" mode we exclude the locked baseline so the rescale makes
  // small deltas visible.
  const maxBar = useMemo(() => {
    let m = 0
    for (const b of data.buckets) {
      const hi =
        viewMode === "actionable"
          ? Math.max(b.expiringSpendCurrent, b.expiringSpendMarket)
          : Math.max(b.totalCurrent, b.totalMarket)
      if (hi > m) m = hi
    }
    return Math.max(1, m * 1.04)
  }, [data.buckets, viewMode])

  const netDollars = data.horizonOpportunity - data.horizonAtRisk
  const netLabel =
    netDollars > 0
      ? "Net renegotiation upside"
      : netDollars < 0
        ? "Net at-risk savings"
        : "Net to market"
  const netClass =
    netDollars > 0 ? "danger" : netDollars < 0 ? "success" : "muted"

  return (
    <section className="card timeline-card spend-card">
      <header className="timeline-header">
        <div>
          <div className="card-title">Renewal &amp; spend impact</div>
          <div className="card-sub">
            Annual run-rate spend per period split into locked (non-expiring)
            and actionable (expiring). The market column shows what the
            actionable portion would cost at comp rates — green bars mean
            current spend is above market (renegotiation opportunity), red
            means below market (at-risk savings).
          </div>
        </div>
        <div className="timeline-controls">
          <div className="seg" role="group" aria-label="Spend view">
            <button
              type="button"
              className={`seg-opt${viewMode === "full" ? " on" : ""}`}
              onClick={() => setViewMode("full")}
              aria-pressed={viewMode === "full"}
              title="Show locked + actionable spend"
            >
              Full spend
            </button>
            <button
              type="button"
              className={`seg-opt${viewMode === "actionable" ? " on" : ""}`}
              onClick={() => setViewMode("actionable")}
              aria-pressed={viewMode === "actionable"}
              title="Hide non-expiring baseline, rescale to actionable spend"
            >
              Actionable only
            </button>
          </div>
          <div className="seg">
            <button
              type="button"
              className={`seg-opt${granularity === "quarter" ? " on" : ""}`}
              onClick={() => setGranularity("quarter")}
              aria-pressed={granularity === "quarter"}
            >
              Quarterly
            </button>
            <button
              type="button"
              className={`seg-opt${granularity === "month" ? " on" : ""}`}
              onClick={() => setGranularity("month")}
              aria-pressed={granularity === "month"}
            >
              Monthly
            </button>
          </div>
          <div className="seg">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                className={`seg-opt${horizon === h ? " on" : ""}`}
                onClick={() => setHorizon(h)}
                aria-pressed={horizon === h}
              >
                {h === 60 ? "5 yr" : `${h} mo`}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Totals strip — single consolidated headline replacing the two cards
          we used to show across the spend composition + renewal timeline. */}
      <div className="timeline-totals">
        <div className="totals-block">
          <div className="totals-label">
            <span className="dot above" />
            Renegotiation opportunity
          </div>
          <div className="totals-value danger">
            {formatDollars(data.horizonOpportunity)}
          </div>
          <div className="totals-meta">
            {data.horizonAboveCount}{" "}
            {data.horizonAboveCount === 1 ? "lease" : "leases"} above market ·
            expiring within {horizon === 60 ? "5 yr" : `${horizon} mo`}
          </div>
        </div>
        <div className="totals-block">
          <div className="totals-label">
            <span className="dot below" />
            At-risk savings
          </div>
          <div className="totals-value success">
            {formatDollars(data.horizonAtRisk)}
          </div>
          <div className="totals-meta">
            {data.horizonBelowCount}{" "}
            {data.horizonBelowCount === 1 ? "lease" : "leases"} below market ·
            renewal at market would cost more
          </div>
        </div>
        <div className="totals-block">
          <div className="totals-label">
            <span className={`dot ${netClass}`} />
            {netLabel}
          </div>
          <div className={`totals-value ${netClass}`}>
            {formatDollars(Math.abs(netDollars), { sign: false })}
          </div>
          <div className="totals-meta">
            {formatDollars(data.horizonExpiringCurrent)} expiring ·{" "}
            {formatDollars(data.portfolioAnnualSpend)} total spend
          </div>
        </div>
      </div>

      <SpendChart
        buckets={data.buckets}
        maxBar={maxBar}
        granularity={granularity}
        viewMode={viewMode}
        onSelectPeriod={onSelectPeriod}
      />
    </section>
  )
}

function SpendChart({
  buckets,
  maxBar,
  granularity,
  viewMode,
  onSelectPeriod,
}: {
  buckets: SpendBucket[]
  maxBar: number
  granularity: Granularity
  viewMode: ViewMode
  onSelectPeriod: (key: string, label: string, granularity: Granularity) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (buckets.length === 0) {
    return (
      <div className="timeline-empty">
        No leases in the selected horizon.
      </div>
    )
  }

  const nearTermBoundaryIdx = buckets.findIndex(
    (b) => b.monthsFromNow >= NEAR_TERM_MONTHS,
  )

  return (
    <div className="timeline-chart-wrap">
      <div className="timeline-chart sc-chart" role="list">
        {buckets.map((b) => {
          const dim = b.monthsFromNow >= NEAR_TERM_MONTHS
          // In "actionable only" mode the locked baseline is hidden — the top
          // (expiring) segment anchors at 0 and gets the full chart height to
          // expand into.
          const lockedH =
            viewMode === "actionable" ? 0 : (b.lockedSpend / maxBar) * 100
          const topCurrentH = (b.expiringSpendCurrent / maxBar) * 100
          const topMarketH = (b.expiringSpendMarket / maxBar) * 100
          const isHovered = hovered === b.key
          const isActionable = b.expiringCount > 0
          // The "delta" tells the story: green (savings) when current > market,
          // red (at-risk) when current < market.
          const variant: "savings" | "risk" | "neutral" =
            b.netDelta > 0 ? "savings" : b.netDelta < 0 ? "risk" : "neutral"

          return (
            <button
              key={b.key}
              type="button"
              role="listitem"
              className={`tl-col sc-col${dim ? " dim" : ""}${
                isHovered ? " hover" : ""
              }${isActionable ? "" : " empty"}`}
              onClick={() => onSelectPeriod(b.key, b.longLabel, granularity)}
              onMouseEnter={() => setHovered(b.key)}
              onMouseLeave={() =>
                setHovered((cur) => (cur === b.key ? null : cur))
              }
              onFocus={() => setHovered(b.key)}
              onBlur={() => setHovered((cur) => (cur === b.key ? null : cur))}
              aria-label={`${b.longLabel}: ${b.expiringCount} leases expiring`}
            >
              <div className="tl-col-count">
                {isActionable ? b.expiringCount : ""}
              </div>
              <div className="sc-col-bars">
                <SpendStack
                  variant="current"
                  lockedH={lockedH}
                  topH={topCurrentH}
                />
                <SpendStack
                  variant={variant}
                  lockedH={lockedH}
                  topH={topMarketH}
                />
              </div>
              <div className="tl-col-label">{b.label}</div>

              {isHovered && (
                <SpendTooltip bucket={b} variant={variant} />
              )}
            </button>
          )
        })}
        {nearTermBoundaryIdx > 0 && (
          <div
            className="tl-near-line"
            style={{
              left: `${(nearTermBoundaryIdx / buckets.length) * 100}%`,
            }}
            aria-hidden="true"
          >
            <span className="tl-near-label">Next 12 months ←</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SpendStack({
  variant,
  lockedH,
  topH,
}: {
  variant: "current" | "savings" | "risk" | "neutral"
  lockedH: number
  topH: number
}) {
  // Two segments stacked. Locked at the bottom (always neutral grey), the top
  // segment varies by column: dark for "current you pay", green for "market
  // savings", red for "market at-risk".
  return (
    <div className="sc-stack" aria-hidden="true">
      <div
        className="sc-seg sc-seg-locked"
        style={{ height: `${lockedH}%` }}
      />
      <div
        className={`sc-seg sc-seg-top sc-top-${variant}`}
        style={{ height: `${topH}%`, bottom: `${lockedH}%` }}
      />
    </div>
  )
}

function SpendTooltip({
  bucket: b,
  variant,
}: {
  bucket: SpendBucket
  variant: "savings" | "risk" | "neutral"
}) {
  const deltaClass =
    variant === "savings"
      ? "success"
      : variant === "risk"
        ? "danger"
        : "muted"
  const deltaLabel =
    variant === "savings"
      ? "Renegotiation upside"
      : variant === "risk"
        ? "At-risk savings"
        : "Net to market"

  return (
    <div className="tl-tooltip" role="presentation">
      <div className="tl-tip-title">{b.longLabel}</div>
      <div className="tl-tip-row">
        <span className="lbl">
          <span className="dot current" /> Expiring (current)
        </span>
        <span className="val">{formatDollars(b.expiringSpendCurrent)}</span>
      </div>
      <div className="tl-tip-row">
        <span className="lbl">
          <span className={`dot ${deltaClass}`} /> Expiring (market)
        </span>
        <span className="val">{formatDollars(b.expiringSpendMarket)}</span>
      </div>
      <div className="tl-tip-divider" />
      {/* Variance breakdown — surfaces the same opportunity/at-risk numbers
          that used to live in the separate Renewal timeline tooltip. */}
      <div className="tl-tip-row">
        <span className="lbl">
          <span className="dot above" /> Opportunity
        </span>
        <span className="val danger">{formatDollars(b.opportunity)}</span>
      </div>
      <div className="tl-tip-row">
        <span className="lbl">
          <span className="dot below" /> At-risk savings
        </span>
        <span className="val success">{formatDollars(b.atRisk)}</span>
      </div>
      <div className="tl-tip-row">
        <span className="lbl">{deltaLabel}</span>
        <span className={`val ${deltaClass}`}>
          {formatDollars(Math.abs(b.netDelta), { sign: false })}
        </span>
      </div>
      <div className="tl-tip-divider" />
      <div className="tl-tip-row">
        <span className="lbl">Locked (non-expiring)</span>
        <span className="val muted">{formatDollars(b.lockedSpend)}</span>
      </div>
      <div className="tl-tip-row">
        <span className="lbl">Leases expiring</span>
        <span className="val">{b.expiringCount}</span>
      </div>
      {b.expiringWithoutComp > 0 && (
        <div className="tl-tip-row">
          <span className="lbl muted">Without comp data</span>
          <span className="val muted">{b.expiringWithoutComp}</span>
        </div>
      )}
      <div className="tl-tip-cta">Click to drill in →</div>
    </div>
  )
}
