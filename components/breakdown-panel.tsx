"use client"

import { useEffect, useMemo, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import { groupAndAggregate } from "@/lib/calculations"
import { formatDollars, formatPsf } from "@/lib/format"
import { bucketKeyOf, type Granularity } from "@/lib/timeline"

type GroupBy = "propertyType" | "submarket"

export type BreakdownPanelSelection =
  | { kind: "group"; outerGroupBy: GroupBy; outerKey: string }
  | {
      kind: "period"
      bucketKey: string
      label: string
      granularity: Granularity
    }

type Props = {
  open: boolean
  selection: BreakdownPanelSelection | null
  allRows: LeaseRow[]
  onClose: () => void
  onLeaseClick: (leaseId: string) => void
}

/**
 * Side panel shared by two flows:
 * 1. "group" — opened from PortfolioBreakdown. Cross-tab of the *other* dimension
 *    (sub-markets within a property type, or property types within a sub-market).
 * 2. "period" — opened from RenewalTimeline. Cross-tab of sub-markets (default)
 *    or property types within all leases expiring in the chosen period; the
 *    user can toggle the inner dimension.
 *
 * In both cases each cross-tab row is expandable to reveal its underlying leases
 * inline. Clicking a lease opens the LeaseDetailPanel stacked above this one.
 */
export function BreakdownPanel({
  open,
  selection,
  allRows,
  onClose,
  onLeaseClick,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [periodInner, setPeriodInner] = useState<GroupBy>("submarket")

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

  // Reset which inner rows are expanded whenever the panel selection changes.
  useEffect(() => {
    setExpanded(new Set())
    setPeriodInner("submarket")
  }, [selection])

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Subset of the current filtered rows belonging to the selected scope.
  const rows = useMemo(() => {
    if (!selection) return [] as LeaseRow[]
    if (selection.kind === "group") {
      if (selection.outerGroupBy === "propertyType") {
        return allRows.filter((r) => r.propertyType === selection.outerKey)
      }
      return allRows.filter((r) => r.submarket === selection.outerKey)
    }
    // period
    return allRows.filter(
      (r) => bucketKeyOf(r.expiryDate, selection.granularity) === selection.bucketKey,
    )
  }, [allRows, selection])

  const innerGroupBy: GroupBy = useMemo(() => {
    if (!selection) return "submarket"
    if (selection.kind === "group") {
      return selection.outerGroupBy === "propertyType" ? "submarket" : "propertyType"
    }
    return periodInner
  }, [selection, periodInner])

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

  // Period view also breaks the dollar number into opportunity vs at-risk.
  const periodOpportunity =
    selection?.kind === "period"
      ? rows.reduce((s, r) => s + Math.max(0, r.varianceAnnual ?? 0), 0)
      : null
  const periodAtRisk =
    selection?.kind === "period"
      ? rows.reduce((s, r) => s + Math.max(0, -(r.varianceAnnual ?? 0)), 0)
      : null

  const eyebrowText =
    selection == null
      ? ""
      : selection.kind === "group"
        ? selection.outerGroupBy === "propertyType"
          ? `${innerHeading} within property type`
          : `${innerHeading} within sub-market`
        : "Leases expiring in this period"

  const titleText =
    selection == null
      ? ""
      : selection.kind === "group"
        ? selection.outerKey
        : selection.label

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
            {titleText}
          </h2>

          {selection?.kind === "period" ? (
            <div className="panel-period-summary">
              <div className="period-stat">
                <div className="period-stat-label">
                  <span className="dot above" /> Opportunity
                </div>
                <div className="period-stat-value danger">
                  {formatDollars(periodOpportunity ?? 0)}
                </div>
              </div>
              <div className="period-stat">
                <div className="period-stat-label">
                  <span className="dot below" /> At-risk savings
                </div>
                <div className="period-stat-value success">
                  {formatDollars(periodAtRisk ?? 0)}
                </div>
              </div>
              <div className="period-stat">
                <div className="period-stat-label">Leases expiring</div>
                <div className="period-stat-value">{outerCount}</div>
              </div>
            </div>
          ) : (
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
          )}

          {selection?.kind === "period" && (
            <div className="panel-inner-toggle" role="tablist" aria-label="Group by">
              <button
                type="button"
                role="tab"
                className={`seg-opt${periodInner === "submarket" ? " on" : ""}`}
                aria-selected={periodInner === "submarket"}
                onClick={() => setPeriodInner("submarket")}
              >
                By sub-market
              </button>
              <button
                type="button"
                role="tab"
                className={`seg-opt${periodInner === "propertyType" ? " on" : ""}`}
                aria-selected={periodInner === "propertyType"}
                onClick={() => setPeriodInner("propertyType")}
              >
                By property type
              </button>
            </div>
          )}

          <button type="button" className="panel-close" onClick={onClose} aria-label="Close panel">
            ×
          </button>
        </header>

        <div className="panel-body panel-body--list">
          {/* Sticky column header */}
          <div className="bp-row bp-row--header">
            <div className="caret-cell" aria-hidden="true" />
            <div className="name">{innerHeading}</div>
            <div className="count">Leases</div>
            <div className="bar-cell">Below ← gap → Above</div>
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
            const isOpen = expanded.has(ig.key)
            const groupLeases = rows
              .filter((r) =>
                innerGroupBy === "submarket"
                  ? r.submarket === ig.key
                  : r.propertyType === ig.key,
              )
              .sort(
                (a, b) =>
                  Math.abs(b.varianceAnnual ?? 0) - Math.abs(a.varianceAnnual ?? 0),
              )
            return (
              <div key={ig.key}>
                <button
                  type="button"
                  className={`bp-row bp-row--group${isOpen ? " open" : ""}`}
                  aria-expanded={isOpen}
                  onClick={() => toggle(ig.key)}
                >
                  <div className="caret-cell" aria-hidden="true">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      className={`bp-caret${isOpen ? " open" : ""}`}
                    >
                      <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="name">{ig.key}</div>
                  <div className="count">{ig.agg.count}</div>
                  <div className="bar-cell">
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
                  </div>
                  <div className={`gap ${igTone}`}>
                    {igGap != null ? formatPsf(igGap, { sign: true }) : "—"}
                    {igAnnual != null && (
                      <div className="gap-meta">
                        {formatDollars(igAnnual, { sign: true })}/yr
                      </div>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="bp-leases">
                    {groupLeases.length === 0 && (
                      <div className="bp-leases-empty">No leases in this group.</div>
                    )}
                    {groupLeases.map((lease) => {
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
                          className="bp-lease"
                          onClick={() => onLeaseClick(lease.id)}
                        >
                          <div className="bp-lease-main">
                            <div className="bp-lease-name">
                              {lease.address}
                              {isOverridden && (
                                <span className="broker-pill">
                                  {lease.comparisonSource === "broker" ? "Broker" : "Alt scope"}
                                </span>
                              )}
                            </div>
                            <div className="bp-lease-meta">
                              {lease.sf.toLocaleString("en-US")} SF · current{" "}
                              {formatPsf(lease.currentRentPsf)} · market{" "}
                              {formatPsf(lease.comparisonPsf)}
                            </div>
                          </div>
                          <div className="bp-lease-right">
                            <span className={`bp-lease-gap ${tone}`}>
                              {lease.variancePsf != null
                                ? formatPsf(lease.variancePsf, { sign: true })
                                : "—"}
                            </span>
                            {lease.varianceAnnual != null && (
                              <span className="bp-lease-annual">
                                {formatDollars(lease.varianceAnnual, { sign: true })}/yr
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
