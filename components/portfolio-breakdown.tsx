"use client"

import { useMemo } from "react"
import type { LeaseRow } from "@/lib/types"
import type { Filters } from "@/lib/calculations"
import { groupAndAggregate, PROPERTY_TYPE_ORDER } from "@/lib/calculations"
import { formatDollars, formatPsf } from "@/lib/format"

type Props = {
  rows: LeaseRow[]
  filters: Filters
}

/**
 * Two-card row: a breakdown table on the left and a position donut on the right.
 *
 * The breakdown table groups by property type at portfolio scope and by sub-market
 * once a property type is filtered. It does NOT click-to-filter — the filter bar
 * is the single source of navigation. The breakdown is a passive analytical view.
 */
export function PortfolioBreakdown({ rows, filters }: Props) {
  const groupBy: "propertyType" | "submarket" = filters.propertyType ? "submarket" : "propertyType"

  const groups = useMemo(() => {
    const grouped = groupAndAggregate(rows, (r) =>
      groupBy === "propertyType" ? r.propertyType : r.submarket,
    )
    if (groupBy === "propertyType") {
      const order = new Map(PROPERTY_TYPE_ORDER.map((t, i) => [t as string, i]))
      return grouped.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99))
    }
    return grouped.sort(
      (a, b) => Math.abs(b.agg.totalGapAnnual ?? 0) - Math.abs(a.agg.totalGapAnnual ?? 0),
    )
  }, [rows, groupBy])

  const maxAbs = Math.max(0.01, ...groups.map((g) => Math.abs(g.agg.weightedGapPsf ?? 0)))

  // Donut — counts of leases by position relative to comparison rent.
  const above = rows.filter((r) => (r.variancePsf ?? 0) > 0).length
  const below = rows.filter((r) => (r.variancePsf ?? 0) < 0).length
  const aligned = rows.filter((r) => r.variancePsf != null && Math.abs(r.variancePsf) < 0.01).length
  const noData = rows.filter((r) => r.comparisonSource === "none").length
  const total = rows.length || 1

  const segments = [
    { key: "above", label: "Above market", count: above, color: "var(--danger)" },
    { key: "below", label: "Below market", count: below, color: "var(--success)" },
    { key: "aligned", label: "Aligned", count: aligned, color: "var(--info)" },
    { key: "nodata", label: "No comparison", count: noData, color: "var(--text-3)" },
  ].filter((s) => s.count > 0)

  return (
    <div className="row split-60-40">
      <section className="card">
        <header className="card-header">
          <div className="card-title">
            {groupBy === "propertyType"
              ? "Portfolio by property type"
              : `${filters.propertyType} by sub-market`}
          </div>
          <div className="card-actions">SF-weighted $/SF gap vs comparison</div>
        </header>
        <div className="card-body">
          <div className="ptype-row header">
            <div>{groupBy === "propertyType" ? "Type" : "Sub-market"}</div>
            <div className="ptype-count">Leases</div>
            <div>Below ← gap → Above</div>
            <div className="ptype-count">Annual $</div>
          </div>
          {groups.length === 0 ? (
            <div className="card-empty">No leases match the current filters.</div>
          ) : (
            groups.map((g) => {
              const gap = g.agg.weightedGapPsf
              const ratio = gap != null ? Math.min(1, Math.abs(gap) / maxAbs) : 0
              const tone = gap == null ? "muted" : gap > 0 ? "danger" : "success"
              const annual = g.agg.totalGapAnnual

              return (
                <div className="ptype-row" key={g.key}>
                  <div className="ptype-name">{g.key}</div>
                  <div className="ptype-count">{g.agg.count}</div>
                  <div className="ptype-bar" aria-hidden="true">
                    <div className="marker" />
                    {gap != null && gap < 0 && (
                      <div
                        className="below"
                        style={{
                          marginLeft: `${50 - ratio * 50}%`,
                          width: `${ratio * 50}%`,
                        }}
                      />
                    )}
                    {gap != null && gap > 0 && (
                      <div
                        className="above"
                        style={{
                          marginLeft: "50%",
                          width: `${ratio * 50}%`,
                        }}
                      />
                    )}
                  </div>
                  <div className={`ptype-gap ${tone}`}>
                    {gap != null ? formatPsf(gap, { sign: true }) : "—"}
                    {annual != null && (
                      <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>
                        {formatDollars(annual, { sign: true })}/yr
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div className="card-title">Position vs market</div>
          <div className="card-actions">{rows.length} leases</div>
        </header>
        <div className="card-body">
          <div className="donut-wrap">
            <Donut segments={segments} total={total} />
            <div className="donut-legend">
              {segments.map((s) => (
                <div className="donut-legend-item" key={s.key}>
                  <span className="left">
                    <span className="swatch" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="right">
                    {s.count} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>leases</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/** SVG donut chart. Segments are drawn proportionally with stroke-dasharray. */
function Donut({
  segments,
  total,
}: {
  segments: Array<{ key: string; label: string; count: number; color: string }>
  total: number
}) {
  const radius = 70
  const stroke = 22
  const circ = 2 * Math.PI * radius

  let offset = 0
  return (
    <div className="donut">
      <svg viewBox="0 0 180 180" width={180} height={180} aria-hidden="true">
        <circle
          cx={90}
          cy={90}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        {segments.map((s) => {
          const len = (s.count / total) * circ
          const dash = `${len} ${circ - len}`
          const dashOffset = -offset
          offset += len
          return (
            <circle
              key={s.key}
              cx={90}
              cy={90}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 90 90)"
              strokeLinecap="butt"
            />
          )
        })}
      </svg>
      <div className="donut-center">
        <div className="num">{total}</div>
        <div className="lbl">Leases</div>
      </div>
    </div>
  )
}
