"use client"

import { useMemo } from "react"
import type { Filters } from "@/lib/calculations"
import { aggregate, groupAndAggregate } from "@/lib/calculations"
import type { LeaseRow } from "@/lib/types"
import { formatDollars, formatPsf } from "@/lib/format"

type Props = {
  rows: LeaseRow[]
  filters: Filters
  onSelectGroup: (groupKey: string) => void
}

/**
 * One picture, two grouping modes:
 * - No property type filter → group by property type
 * - Property type filter active → group by sub-market within that type
 *
 * When a sub-market is also selected, the chart hides itself
 * (the headline summary covers the full story at that scope).
 */
export function HeadlineChart({ rows, filters, onSelectGroup }: Props) {
  const groupBy: "propertyType" | "submarket" =
    filters.propertyType ? "submarket" : "propertyType"

  const groups = useMemo(() => {
    const grouped = groupAndAggregate(rows, (r) =>
      groupBy === "propertyType" ? r.propertyType : r.submarket,
    )
    // Sort by absolute gap impact descending so the visual ranks meaningfully.
    return grouped.sort((a, b) => {
      const av = a.agg.totalGapAnnual ?? 0
      const bv = b.agg.totalGapAnnual ?? 0
      return Math.abs(bv) - Math.abs(av)
    })
  }, [rows, groupBy])

  if (filters.submarket) {
    // At deepest scope, the headline summary already conveys everything.
    return null
  }

  if (groups.length <= 1) {
    return null
  }

  // Scale: max abs weighted gap among groups (so bars compare on $/SF).
  const maxAbs = Math.max(
    0.01,
    ...groups.map((g) => Math.abs(g.agg.weightedGapPsf ?? 0)),
  )

  const title =
    groupBy === "propertyType"
      ? "Gap vs market by property type"
      : `Gap vs market by sub-market — ${filters.propertyType}`

  return (
    <section className="chart-card" aria-label={title}>
      <header className="chart-header">
        <h2 className="section-title">{title}</h2>
        <p className="section-sub">
          Click a {groupBy === "propertyType" ? "type" : "sub-market"} to drill in.
          Bar length shows the SF-weighted $/SF gap. Length on the right means above market.
        </p>
      </header>

      <ul className="chart-bars">
        {groups.map((g) => {
          const gap = g.agg.weightedGapPsf
          const ratio = gap != null ? Math.abs(gap) / maxAbs : 0
          const tone = gap == null ? "neutral" : gap > 0 ? "above" : "below"
          const annual = g.agg.totalGapAnnual

          return (
            <li key={g.key} className="chart-bar-row">
              <button
                type="button"
                className="chart-bar-button"
                onClick={() => onSelectGroup(g.key)}
                aria-label={`Drill in to ${g.key}`}
              >
                <div className="chart-bar-meta">
                  <span className="chart-bar-name">{g.key}</span>
                  <span className="chart-bar-count">
                    {g.agg.count} {g.agg.count === 1 ? "lease" : "leases"}
                  </span>
                </div>

                <div className="chart-bar-track" aria-hidden="true">
                  <div className="chart-bar-axis" />
                  <div
                    className={`chart-bar-fill chart-bar-fill-${tone}`}
                    data-tone={tone}
                    style={{
                      width: `${ratio * 50}%`,
                      ...(tone === "below"
                        ? { right: "50%" }
                        : { left: "50%" }),
                    }}
                  />
                </div>

                <div className="chart-bar-numbers">
                  <span className={`chart-bar-gap mono chart-bar-gap-${tone}`}>
                    {gap != null ? formatPsf(gap, { sign: true }) : "—"}
                    <span className="chart-bar-gap-unit">/SF</span>
                  </span>
                  <span className="chart-bar-annual mono">
                    {annual != null ? formatDollars(annual, { sign: true }) : ""}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
