"use client"

import { useEffect, useMemo } from "react"
import type { LeaseRow } from "@/lib/types"
import { groupAndAggregate } from "@/lib/calculations"
import { formatDollars, formatPsf } from "@/lib/format"

type GroupBy = "propertyType" | "submarket"

export type BreakdownPanelSelection = {
  /** The outer dimension we drilled IN from. */
  outerGroupBy: GroupBy
  /** The selected outer row's key (e.g. "Office" or "Midtown"). */
  outerKey: string
}

type Props = {
  open: boolean
  selection: BreakdownPanelSelection | null
  /** All currently filtered rows. The panel re-derives its scope on every render. */
  allRows: LeaseRow[]
  onClose: () => void
  onLeaseClick: (leaseId: string) => void
}

/**
 * Side panel that opens when a row in PortfolioBreakdown is clicked. It shows
 * the cross-tabulated inner breakdown for that selected row — sub-markets
 * within a property type, or property types within a sub-market — and below
 * it the actual leases that drive those numbers. Clicking a lease opens the
 * LeaseDetailPanel stacked above this one.
 */
export function BreakdownPanel({
  open,
  selection,
  allRows,
  onClose,
  onLeaseClick,
}: Props) {
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

  // Slice the current filtered rows down to the outer group on every render so
  // the panel stays in sync with override/filter changes.
  const rows = useMemo(() => {
    if (!selection) return [] as LeaseRow[]
    if (selection.outerGroupBy === "propertyType") {
      return allRows.filter((r) => r.propertyType === selection.outerKey)
    }
    return allRows.filter((r) => r.submarket === selection.outerKey)
  }, [allRows, selection])

  // Inner groupBy is the OPPOSITE dimension of the outer one.
  const innerGroupBy: GroupBy =
    selection?.outerGroupBy === "propertyType" ? "submarket" : "propertyType"

  const innerHeading =
    innerGroupBy === "submarket" ? "Sub-markets" : "Property types"

  const innerGroups = useMemo(() => {
    if (!selection) return []
    const keyFn = (r: LeaseRow): string =>
      innerGroupBy === "submarket" ? r.submarket : r.propertyType
    return groupAndAggregate(rows, keyFn).sort(
      (a, b) =>
        Math.abs(b.agg.totalGapAnnual ?? 0) - Math.abs(a.agg.totalGapAnnual ?? 0),
    )
  }, [rows, innerGroupBy, selection])

  const maxAbs = Math.max(
    0.01,
    ...innerGroups.map((g) => Math.abs(g.agg.weightedGapPsf ?? 0)),
  )

  // Headline numbers for the outer scope.
  const outerCount = rows.length
  const outerSf = rows.reduce((s, r) => s + r.sf, 0)
  const outerBenchmarked = rows.filter((r) => r.comparisonPsf != null)
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

  // Leases sorted by absolute annual $ gap, descending.
  const leasesSorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          Math.abs(b.varianceAnnual ?? 0) - Math.abs(a.varianceAnnual ?? 0),
      ),
    [rows],
  )

  const eyebrowText =
    selection?.outerGroupBy === "propertyType"
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
            {selection?.outerKey ?? ""}
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
          {/* Cross-tab — sub-markets within a property type, or vice versa. */}
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
              zIndex: 2,
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

          {/* Underlying leases. Click a lease → opens the lease detail panel
              stacked above this one. */}
          {leasesSorted.length > 0 && (
            <>
              <div className="panel-section-heading">
                <span>
                  Leases in this {selection?.outerGroupBy === "propertyType" ? "type" : "sub-market"}
                </span>
                <span className="ct">
                  {leasesSorted.length}{" "}
                  {leasesSorted.length === 1 ? "lease" : "leases"} · sorted by gap
                </span>
              </div>
              {leasesSorted.map((lease) => {
                const tone =
                  lease.variancePsf == null
                    ? "muted"
                    : lease.variancePct != null && Math.abs(lease.variancePct) <= 0.05
                      ? "muted"
                      : lease.variancePsf > 0
                        ? "danger"
                        : "success"
                const isOverridden =
                  lease.comparisonSource === "broker" ||
                  lease.comparisonSource === "scope-override"
                return (
                  <button
                    key={lease.id}
                    type="button"
                    className="lease-list-row"
                    onClick={() => onLeaseClick(lease.id)}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="name">
                        {lease.address}
                        {isOverridden && (
                          <span
                            className="broker-pill"
                            style={{ marginLeft: 6, verticalAlign: "middle" }}
                          >
                            {lease.comparisonSource === "broker" ? "Broker" : "Alt scope"}
                          </span>
                        )}
                      </div>
                      <div className="meta">
                        {selection?.outerGroupBy === "propertyType"
                          ? lease.submarket
                          : lease.propertyType}{" "}
                        · {lease.sf.toLocaleString("en-US")} SF · current{" "}
                        {formatPsf(lease.currentRentPsf)} · market{" "}
                        {formatPsf(lease.comparisonPsf)}
                      </div>
                    </div>
                    <div className="right">
                      <span className={`gap-num ${tone}`}>
                        {lease.variancePsf != null
                          ? formatPsf(lease.variancePsf, { sign: true })
                          : "—"}
                      </span>
                      {lease.varianceAnnual != null && (
                        <span className="gap-meta">
                          {formatDollars(lease.varianceAnnual, { sign: true })}/yr
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
