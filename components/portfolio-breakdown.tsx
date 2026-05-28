"use client"

import { useMemo } from "react"
import type { LeaseRow } from "@/lib/types"
import { groupAndAggregate, PROPERTY_TYPE_ORDER } from "@/lib/calculations"
import { formatDollars, formatPsf } from "@/lib/format"

type GroupBy = "propertyType" | "submarket"

type Props = {
  rows: LeaseRow[]
  groupBy: GroupBy
  /** Optional override for the card title. */
  title?: string
  /**
   * Called when a row is clicked to open the side panel with the inner
   * breakdown. The parent receives the rows that fall under that group key
   * so it can hand them to the panel.
   */
  onSelect: (key: string, rows: LeaseRow[]) => void
  /** The currently-selected outer key, if a panel is open. */
  selectedKey: string | null
}

/**
 * Cross-tabulating breakdown table.
 *
 * `groupBy` controls the outer grouping. Clicking a row no longer expands
 * inline — instead it calls `onSelect`, and the parent opens a side panel
 * showing the inner cross-tab. This keeps the page compact even when the
 * portfolio spans many sub-markets.
 *
 * The widget is passive — it does not filter the page. Filters live solely in
 * the FilterBar.
 */
export function PortfolioBreakdown({
  rows,
  groupBy,
  title,
  onSelect,
  selectedKey,
}: Props) {
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

  const innerLabel = groupBy === "propertyType" ? "sub-markets" : "property types"

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">{cardTitle}</div>
        <div className="card-actions">
          {rows.length} {rows.length === 1 ? "lease" : "leases"} · click for {innerLabel}
        </div>
      </header>
      <div className="card-body card-body--scroll">
        <div className="ptype-row header sticky-row">
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
            const isSelected = selectedKey === g.key

            return (
              <div
                key={g.key}
                className={`ptype-row expandable${isSelected ? " selected" : ""}`}
                onClick={() => onSelect(g.key, g.rows)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelect(g.key, g.rows)
                  }
                }}
              >
                <div className="ptype-name">
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
            )
          })
        )}
      </div>
    </section>
  )
}
