"use client"

import { useMemo, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import { groupAndAggregate, PROPERTY_TYPE_ORDER } from "@/lib/calculations"
import { formatDollars, formatPsf } from "@/lib/format"

type GroupBy = "propertyType" | "submarket"

type Props = {
  rows: LeaseRow[]
  groupBy: GroupBy
  /** Optional override for the card title. */
  title?: string
}

/**
 * Cross-tabulating breakdown table.
 *
 * `groupBy` controls the outer grouping. Each outer row is expandable to reveal
 * the *other* dimension within it: by-property-type rows expand to show
 * sub-markets within that type, by-sub-market rows expand to show property
 * types within that sub-market.
 *
 * Multiple rows can be open at once so a broker can compare two segments
 * side by side while presenting.
 *
 * The widget is passive — it does not filter the page. Filters live solely in
 * the FilterBar.
 */
export function PortfolioBreakdown({ rows, groupBy, title }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const outerGroups = useMemo(() => {
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

  const maxAbs = Math.max(0.01, ...outerGroups.map((g) => Math.abs(g.agg.weightedGapPsf ?? 0)))

  const cardTitle =
    title ?? (groupBy === "propertyType" ? "By property type" : "By sub-market")

  const innerKeyFn = (r: LeaseRow): string =>
    groupBy === "propertyType" ? r.submarket : r.propertyType

  const innerHeading = groupBy === "propertyType" ? "Sub-markets" : "Property types"

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">{cardTitle}</div>
        <div className="card-actions">
          {rows.length} {rows.length === 1 ? "lease" : "leases"} · click to expand
        </div>
      </header>
      <div className="card-body">
        <div className="ptype-row header">
          <div>{groupBy === "propertyType" ? "Type" : "Sub-market"}</div>
          <div className="ptype-count">Leases</div>
          <div>Below ← gap → Above</div>
          <div className="ptype-count">Annual $</div>
        </div>

        {outerGroups.length === 0 ? (
          <div className="card-empty">No leases match the current filters.</div>
        ) : (
          outerGroups.map((g) => {
            const gap = g.agg.weightedGapPsf
            const ratio = gap != null ? Math.min(1, Math.abs(gap) / maxAbs) : 0
            const tone = gap == null ? "muted" : gap > 0 ? "danger" : "success"
            const annual = g.agg.totalGapAnnual
            const isOpen = !!expanded[g.key]

            const innerGroups = isOpen
              ? groupAndAggregate(g.rows, innerKeyFn).sort(
                  (a, b) =>
                    Math.abs(b.agg.totalGapAnnual ?? 0) -
                    Math.abs(a.agg.totalGapAnnual ?? 0),
                )
              : []

            const innerMaxAbs = Math.max(
              0.01,
              ...innerGroups.map((ig) => Math.abs(ig.agg.weightedGapPsf ?? 0)),
            )

            return (
              <div key={g.key}>
                <div
                  className={`ptype-row expandable${isOpen ? " expanded" : ""}`}
                  onClick={() => toggle(g.key)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      toggle(g.key)
                    }
                  }}
                >
                  <div className="ptype-name">
                    <span className={`ptype-caret${isOpen ? " open" : ""}`} aria-hidden="true">
                      ›
                    </span>
                    {g.key}
                  </div>
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

                {isOpen && (
                  <div className="ptype-children">
                    <div
                      className="ptype-child-row"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--text-3)",
                        fontWeight: 500,
                        paddingTop: 4,
                        paddingBottom: 4,
                      }}
                    >
                      <div className="name">{innerHeading}</div>
                      <div className="count">Leases</div>
                      <div>Gap</div>
                      <div className="gap">Annual $</div>
                    </div>
                    {innerGroups.map((ig) => {
                      const igGap = ig.agg.weightedGapPsf
                      const igRatio =
                        igGap != null ? Math.min(1, Math.abs(igGap) / innerMaxAbs) : 0
                      const igTone =
                        igGap == null ? "muted" : igGap > 0 ? "danger" : "success"
                      const igAnnual = ig.agg.totalGapAnnual
                      return (
                        <div className="ptype-child-row" key={`${g.key}:${ig.key}`}>
                          <div className="name">{ig.key}</div>
                          <div className="count">{ig.agg.count}</div>
                          <div className="ptype-child-bar" aria-hidden="true">
                            <div className="marker" />
                            {igGap != null && igGap < 0 && (
                              <div
                                className="below"
                                style={{
                                  left: `${50 - igRatio * 50}%`,
                                  width: `${igRatio * 50}%`,
                                }}
                              />
                            )}
                            {igGap != null && igGap > 0 && (
                              <div
                                className="above"
                                style={{
                                  left: "50%",
                                  width: `${igRatio * 50}%`,
                                }}
                              />
                            )}
                          </div>
                          <div className={`gap ${igTone}`}>
                            {igGap != null ? formatPsf(igGap, { sign: true }) : "—"}
                            {igAnnual != null && (
                              <div className="gap-meta">
                                {formatDollars(igAnnual, { sign: true })}/yr
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
