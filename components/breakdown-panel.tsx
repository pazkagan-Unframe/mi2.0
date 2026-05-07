"use client"

import { useEffect, useMemo } from "react"
import type { LeaseRow } from "@/lib/types"
import { groupAndAggregate } from "@/lib/calculations"
import { formatDollars, formatPsf } from "@/lib/format"

type GroupBy = "propertyType" | "submarket"

export type BreakdownPanelData = {
  /** The outer dimension we drilled IN from. */
  outerGroupBy: GroupBy
  /** The selected outer row's key (e.g. "Office" or "Midtown"). */
  outerKey: string
  /** All rows that fall under that outer key (already filtered by the page filters). */
  rows: LeaseRow[]
}

type Props = {
  open: boolean
  data: BreakdownPanelData | null
  onClose: () => void
}

/**
 * Side panel that opens when a row in PortfolioBreakdown is clicked. It shows
 * the cross-tabulated inner breakdown for that selected row — sub-markets
 * within a property type, or property types within a sub-market.
 *
 * Replaces the previous inline expansion so the main page stays compact and
 * the deep detail has its own scrollable surface.
 */
export function BreakdownPanel({ open, data, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  // Inner groupBy is the OPPOSITE dimension of the outer one.
  const innerGroupBy: GroupBy =
    data?.outerGroupBy === "propertyType" ? "submarket" : "propertyType"

  const innerHeading =
    innerGroupBy === "submarket" ? "Sub-markets" : "Property types"

  const innerGroups = useMemo(() => {
    if (!data) return []
    const keyFn = (r: LeaseRow): string =>
      innerGroupBy === "submarket" ? r.submarket : r.propertyType
    return groupAndAggregate(data.rows, keyFn).sort(
      (a, b) =>
        Math.abs(b.agg.totalGapAnnual ?? 0) - Math.abs(a.agg.totalGapAnnual ?? 0),
    )
  }, [data, innerGroupBy])

  const maxAbs = Math.max(
    0.01,
    ...innerGroups.map((g) => Math.abs(g.agg.weightedGapPsf ?? 0)),
  )

  // Headline numbers for the outer scope.
  const outerCount = data?.rows.length ?? 0
  const outerSf = data?.rows.reduce((s, r) => s + r.sf, 0) ?? 0
  const outerBenchmarked = data?.rows.filter((r) => r.comparisonPsf != null) ?? []
  const outerBenchmarkedSf = outerBenchmarked.reduce((s, r) => s + r.sf, 0)
  const outerWeightedGapPsf =
    outerBenchmarkedSf > 0
      ? outerBenchmarked.reduce(
          (s, r) => s + (r.currentRentPsf - (r.comparisonPsf as number)) * r.sf,
          0,
        ) / outerBenchmarkedSf
      : null
  const outerAnnual =
    outerBenchmarked.length > 0
      ? outerBenchmarked.reduce((s, r) => s + (r.varianceAnnual ?? 0), 0)
      : null

  const eyebrowText =
    data?.outerGroupBy === "propertyType"
      ? `${innerHeading} within property type`
      : `${innerHeading} within sub-market`

  const outerTone =
    outerWeightedGapPsf == null
      ? "muted"
      : outerWeightedGapPsf > 0
        ? "danger"
        : "success"

  return (
    <>
      <div
        className={`panel-overlay${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`panel${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="breakdown-panel-title"
        aria-hidden={!open}
      >
        <header className="panel-header">
          <div className="panel-eyebrow">{eyebrowText}</div>
          <h2 id="breakdown-panel-title" className="panel-title">
            {data?.outerKey ?? ""}
          </h2>
          <p className="panel-subtitle">
            {outerCount} {outerCount === 1 ? "lease" : "leases"} ·{" "}
            {outerSf.toLocaleString("en-US")} SF
            {outerWeightedGapPsf != null && (
              <>
                {" · "}
                <span style={{ color: `var(--${outerTone === "muted" ? "text-3" : outerTone})` }}>
                  {formatPsf(outerWeightedGapPsf, { sign: true })}/SF
                </span>
              </>
            )}
            {outerAnnual != null && (
              <>
                {" · "}
                <span style={{ color: `var(--${outerTone === "muted" ? "text-3" : outerTone})` }}>
                  {formatDollars(outerAnnual, { sign: true })}/yr
                </span>
              </>
            )}
          </p>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close panel">
            ×
          </button>
        </header>

        <div className="panel-body panel-body--list">
          <div
            className="ptype-child-row"
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-3)",
              fontWeight: 500,
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
              position: "sticky",
              top: 0,
              background: "var(--surface)",
              zIndex: 1,
            }}
          >
            <div className="name">{innerHeading}</div>
            <div className="count">Leases</div>
            <div>Below ← gap → Above</div>
            <div className="gap">Annual $</div>
          </div>

          {innerGroups.length === 0 && (
            <div className="card-empty" style={{ padding: 24 }}>
              No further breakdown available.
            </div>
          )}

          {innerGroups.map((ig) => {
            const igGap = ig.agg.weightedGapPsf
            const igRatio =
              igGap != null ? Math.min(1, Math.abs(igGap) / maxAbs) : 0
            const igTone =
              igGap == null ? "muted" : igGap > 0 ? "danger" : "success"
            const igAnnual = ig.agg.totalGapAnnual
            return (
              <div
                className="ptype-child-row"
                key={ig.key}
                style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}
              >
                <div className="name" style={{ color: "var(--text)", fontWeight: 500 }}>
                  {ig.key}
                </div>
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
                        marginLeft: "50%",
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
      </aside>
    </>
  )
}
