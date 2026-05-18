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
 * Spend composition view — for every period in the horizon, shows two adjacent
 * stacked bars:
 *   • Column 1 (current): locked baseline + actionable spend at current rates.
 *   • Column 2 (market):  same locked baseline + actionable spend at market.
 *
 * The bottoms are intentionally identical within a period (you can't
 * renegotiate non-expiring leases). The visible delta at the top is the
 * renegotiation upside (green) or at-risk savings (red) for that period.
 *
 * Clicking any column opens the breakdown side panel filtered to that period —
 * same drill-down as the renewal timeline beneath it.
 */
/**
 * "full" shows the entire spend stack (locked + actionable) so absolute
 * magnitudes are honest. "actionable" hides the locked baseline and rescales
 * to the largest expiring portion, surfacing the current-vs-market delta on
 * periods where the renegotiable slice is small relative to total spend.
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

  const netLabel =
    data.horizonNetDelta > 0
      ? "Renegotiation upside"
      : data.horizonNetDelta < 0
        ? "At-risk savings"
        : "Net to market"
  const netClass =
    data.horizonNetDelta > 0
      ? "success"
      : data.horizonNetDelta < 0
        ? "danger"
        : "muted"

  return (
    <section className="card timeline-card spend-card">
      <header className="timeline-header">
        <div>
          <div className="card-title">Spend composition vs market</div>
          <div className="card-sub">
            Annual run-rate spend per period split into locked (non-expiring)
            and actionable (expiring). The market column shows what the
            actionable portion would cost at comp rates — the visible delta at
            the top is your renegotiation upside or at-risk savings.
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

      <div className="timeline-totals">
        <div className="totals-block">
          <div className="totals-label">
            <span className="dot locked" />
            Annual spend in scope
          </div>
          <div className="totals-value">
            {formatDollars(data.portfolioAnnualSpend)}
          </div>
          <div className="totals-meta">
            {rows.length} {rows.length === 1 ? "lease" : "leases"} · run-rate
          </div>
        </div>
        <div className="totals-block">
          <div className="totals-label">
            <span className="dot current" />
            Expiring within horizon
          </div>
          <div className="totals-value">
            {formatDollars(data.horizonExpiringCurrent)}
          </div>
          <div className="totals-meta">
            {data.horizonExpiringCount}{" "}
            {data.horizonExpiringCount === 1 ? "lease" : "leases"} · actionable
          </div>
        </div>
        <div className="totals-block">
          <div className="totals-label">
            <span className={`dot ${netClass}`} />
            {netLabel}
          </div>
          <div className={`totals-value ${netClass}`}>
            {formatDollars(Math.abs(data.horizonNetDelta), { sign: false })}
          </div>
          <div className="totals-meta">
            At market: {formatDollars(data.horizonExpiringMarket)}
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
      <div className="tl-tip-row">
        <span className="lbl">{deltaLabel}</span>
        <span className={`val ${deltaClass}`}>
          {formatDollars(Math.abs(b.netDelta), { sign: false })}
        </span>
      </div>
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
