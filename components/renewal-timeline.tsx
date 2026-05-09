"use client"

import { useMemo, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import {
  buildTimeline,
  type Granularity,
  type HorizonMonths,
  type TimelineBucket,
} from "@/lib/timeline"
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

// Visual "near-term" cutoff. Past this many months we render bars dimmed.
const NEAR_TERM_MONTHS = 12

/**
 * Renewal timeline — shows opportunity (above-market $ expiring) and at-risk
 * savings (below-market $ expiring) per quarter or month, across a configurable
 * horizon. Bars beyond 12 months are dimmed; a vertical line marks the
 * near-term boundary. Click a column to drill into that period.
 */
export function RenewalTimeline({ rows, onSelectPeriod }: Props) {
  const [granularity, setGranularity] = useState<Granularity>("quarter")
  const [horizon, setHorizon] = useState<HorizonMonths>(24)

  const buckets = useMemo(
    () => buildTimeline(rows, granularity, horizon),
    [rows, granularity, horizon],
  )

  // Y-axis scale anchored at the largest single side across all visible buckets.
  const maxBar = Math.max(
    1,
    ...buckets.map((b) => Math.max(b.opportunity, b.atRisk)),
  )

  const totals = useMemo(() => {
    let opp = 0
    let risk = 0
    let benchmarked = 0
    let unbenchmarked = 0
    for (const b of buckets) {
      opp += b.opportunity
      risk += b.atRisk
      benchmarked += b.benchmarkedCount
      unbenchmarked += b.unbenchmarkedCount
    }
    return { opp, risk, benchmarked, unbenchmarked }
  }, [buckets])

  return (
    <section className="card timeline-card">
      <header className="timeline-header">
        <div>
          <div className="card-title">Renewal timeline</div>
          <div className="card-sub">
            Annual $ position for leases expiring in each period — within the
            currently filtered scope.
          </div>
        </div>
        <div className="timeline-controls">
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
            <span className="dot above" />
            Opportunity in horizon
          </div>
          <div className="totals-value danger">{formatDollars(totals.opp)}</div>
          <div className="totals-meta">
            {totals.benchmarked} {totals.benchmarked === 1 ? "lease" : "leases"} benchmarked
          </div>
        </div>
        <div className="totals-block">
          <div className="totals-label">
            <span className="dot below" />
            At-risk savings in horizon
          </div>
          <div className="totals-value success">{formatDollars(totals.risk)}</div>
          <div className="totals-meta">
            Net {formatDollars(totals.opp - totals.risk, { sign: true })}
          </div>
        </div>
        <div className="totals-block">
          <div className="totals-label">
            <span className="dot grey" />
            Lacking comp data
          </div>
          <div className="totals-value muted">{totals.unbenchmarked}</div>
          <div className="totals-meta">Excluded from bars</div>
        </div>
      </div>

      <TimelineChart
        buckets={buckets}
        maxBar={maxBar}
        granularity={granularity}
        onSelectPeriod={onSelectPeriod}
      />
    </section>
  )
}

function TimelineChart({
  buckets,
  maxBar,
  granularity,
  onSelectPeriod,
}: {
  buckets: TimelineBucket[]
  maxBar: number
  granularity: Granularity
  onSelectPeriod: (key: string, label: string, granularity: Granularity) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (buckets.length === 0) {
    return (
      <div className="timeline-empty">No leases expire within the selected horizon.</div>
    )
  }

  // Index where the "near-term boundary" sits — first bucket whose start is
  // >= 12 months from now. If none, line goes at the end (off-canvas).
  const nearTermBoundaryIdx = buckets.findIndex((b) => b.monthsFromNow >= NEAR_TERM_MONTHS)

  return (
    <div className="timeline-chart-wrap">
      <div className="timeline-chart" role="list">
        {buckets.map((b, i) => {
          const dim = b.monthsFromNow >= NEAR_TERM_MONTHS
          const oppH = (b.opportunity / maxBar) * 100
          const riskH = (b.atRisk / maxBar) * 100
          const isHovered = hovered === b.key
          const hasContent = b.totalCount > 0
          return (
            <button
              key={b.key}
              type="button"
              role="listitem"
              className={`tl-col${dim ? " dim" : ""}${isHovered ? " hover" : ""}${
                hasContent ? "" : " empty"
              }`}
              onClick={() => onSelectPeriod(b.key, b.longLabel, granularity)}
              onMouseEnter={() => setHovered(b.key)}
              onMouseLeave={() => setHovered((cur) => (cur === b.key ? null : cur))}
              onFocus={() => setHovered(b.key)}
              onBlur={() => setHovered((cur) => (cur === b.key ? null : cur))}
              aria-label={`${b.longLabel}: ${b.totalCount} leases expiring`}
            >
              <div className="tl-col-count">{hasContent ? b.totalCount : ""}</div>
              <div className="tl-col-bars">
                {b.unbenchmarkedCount > 0 && (
                  <div
                    className="tl-tick"
                    aria-hidden="true"
                    title={`${b.unbenchmarkedCount} lease${
                      b.unbenchmarkedCount === 1 ? "" : "s"
                    } without comp data`}
                  />
                )}
                <div className="tl-bar-pair">
                  <div
                    className="tl-bar above"
                    style={{ height: `${oppH}%` }}
                    aria-hidden="true"
                  />
                  <div
                    className="tl-bar below"
                    style={{ height: `${riskH}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div className="tl-col-label">{b.label}</div>

              {isHovered && hasContent && (
                <div className="tl-tooltip" role="presentation">
                  <div className="tl-tip-title">{b.longLabel}</div>
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
                  <div className="tl-tip-divider" />
                  <div className="tl-tip-row">
                    <span className="lbl">Net position</span>
                    <span
                      className={`val ${
                        b.opportunity - b.atRisk > 0
                          ? "danger"
                          : b.opportunity - b.atRisk < 0
                            ? "success"
                            : "muted"
                      }`}
                    >
                      {formatDollars(b.opportunity - b.atRisk, { sign: true })}
                    </span>
                  </div>
                  <div className="tl-tip-row">
                    <span className="lbl">Leases expiring</span>
                    <span className="val">{b.totalCount}</span>
                  </div>
                  {b.unbenchmarkedCount > 0 && (
                    <div className="tl-tip-row">
                      <span className="lbl muted">No comp data</span>
                      <span className="val muted">{b.unbenchmarkedCount}</span>
                    </div>
                  )}
                  <div className="tl-tip-cta">Click to drill in →</div>
                </div>
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
