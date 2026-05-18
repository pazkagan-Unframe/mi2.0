"use client"

import { useEffect, useMemo, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import { AT_MARKET_THRESHOLD, groupAndAggregate } from "@/lib/calculations"
import { formatDollars, formatExpiry, formatPsf } from "@/lib/format"
import { bucketKeyOf, type Granularity } from "@/lib/timeline"
import { ScopePopover } from "./scope-popover"

type GroupBy = "propertyType" | "submarket"
export type PulseBucket = "above" | "at" | "below"

export type BreakdownPanelSelection =
  | { kind: "group"; outerGroupBy: GroupBy; outerKey: string }
  | {
      kind: "period"
      bucketKey: string
      label: string
      granularity: Granularity
    }
  | { kind: "pulse"; bucket: PulseBucket }

type Props = {
  open: boolean
  selection: BreakdownPanelSelection | null
  allRows: LeaseRow[]
  onClose: () => void
  onPickScope: (leaseId: string, scopeId: string) => void
  onSetManual: (leaseId: string, estimate: number) => void
  onPickSystemErv: (leaseId: string) => void
  onClearOverride: (leaseId: string) => void
}

type PopoverState =
  | { open: true; leaseId: string; rect: DOMRect }
  | { open: false }

/**
 * Side panel shared by two flows:
 * 1. "group"  — opened from PortfolioBreakdown.
 * 2. "period" — opened from RenewalTimeline.
 *
 * Both render a cross-tab of the *other* dimension, with each row expandable to
 * reveal the underlying leases in an explicit four-column layout
 * [Lease | Current | Market+source | Gap]. Clicking the Market cell on a lease
 * row opens an inline scope/ERV popover (same surface as the lease table).
 * The lease rows themselves are not navigable — we deliberately avoid
 * stacking another side panel on top of this one.
 */
export function BreakdownPanel({
  open,
  selection,
  allRows,
  onClose,
  onPickScope,
  onSetManual,
  onPickSystemErv,
  onClearOverride,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [innerToggle, setInnerToggle] = useState<GroupBy>("submarket")
  const [popover, setPopover] = useState<PopoverState>({ open: false })

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (popover.open) {
          setPopover({ open: false })
          return
        }
        onClose()
      }
    }
    document.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [open, onClose, popover.open])

  // Reset expanded rows / inner toggle / popover whenever the panel selection changes.
  useEffect(() => {
    setExpanded(new Set())
    setInnerToggle("submarket")
    setPopover({ open: false })
  }, [selection])

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Subset of rows belonging to the selected scope.
  const rows = useMemo(() => {
    if (!selection) return [] as LeaseRow[]
    if (selection.kind === "group") {
      if (selection.outerGroupBy === "propertyType") {
        return allRows.filter((r) => r.propertyType === selection.outerKey)
      }
      return allRows.filter((r) => r.submarket === selection.outerKey)
    }
    if (selection.kind === "period") {
      return allRows.filter(
        (r) => bucketKeyOf(r.expiryDate, selection.granularity) === selection.bucketKey,
      )
    }
    // pulse: bucket leases by variance vs market.
    return allRows.filter((r) => {
      if (r.variancePct == null) return false
      if (selection.bucket === "at") return Math.abs(r.variancePct) <= AT_MARKET_THRESHOLD
      if (selection.bucket === "above") return r.variancePct > AT_MARKET_THRESHOLD
      return r.variancePct < -AT_MARKET_THRESHOLD
    })
  }, [allRows, selection])

  const innerGroupBy: GroupBy = useMemo(() => {
    if (!selection) return "submarket"
    if (selection.kind === "group") {
      return selection.outerGroupBy === "propertyType" ? "submarket" : "propertyType"
    }
    // period and pulse both expose the inner toggle.
    return innerToggle
  }, [selection, innerToggle])

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

  // Period view also splits the dollar number into opportunity vs at-risk.
  const periodOpportunity =
    selection?.kind === "period"
      ? rows.reduce((s, r) => s + Math.max(0, r.varianceAnnual ?? 0), 0)
      : null
  const periodAtRisk =
    selection?.kind === "period"
      ? rows.reduce((s, r) => s + Math.max(0, -(r.varianceAnnual ?? 0)), 0)
      : null

  // Pulse view shows a single signed dollar headline matching the bucket
  // (annual opportunity for above, annual locked-in savings for below, total
  // at-market exposure for at).
  const pulseDollars =
    selection?.kind === "pulse"
      ? rows.reduce((s, r) => s + Math.abs(r.varianceAnnual ?? 0), 0)
      : null
  const pulseSf =
    selection?.kind === "pulse"
      ? rows.reduce((s, r) => s + r.sf, 0)
      : null

  const pulseLabels: Record<PulseBucket, { eyebrow: string; title: string; tone: "danger" | "success" | "muted"; dollarsLabel: string }> = {
    above: {
      eyebrow: "Leases above market",
      title: "Above-market exposure",
      tone: "danger",
      dollarsLabel: "Annual opportunity",
    },
    below: {
      eyebrow: "Leases below market",
      title: "Below-market positions",
      tone: "success",
      dollarsLabel: "Annual locked-in savings",
    },
    at: {
      eyebrow: "Leases at market",
      title: "At-market positions",
      tone: "muted",
      dollarsLabel: "Annual spend in scope",
    },
  }
  const pulseAnnualSpend =
    selection?.kind === "pulse"
      ? rows.reduce((s, r) => s + r.currentRentPsf * r.sf, 0)
      : null

  const eyebrowText =
    selection == null
      ? ""
      : selection.kind === "group"
        ? selection.outerGroupBy === "propertyType"
          ? `${innerHeading} within property type`
          : `${innerHeading} within sub-market`
        : selection.kind === "period"
          ? "Leases expiring in this period"
          : pulseLabels[selection.bucket].eyebrow

  const titleText =
    selection == null
      ? ""
      : selection.kind === "group"
        ? selection.outerKey
        : selection.kind === "period"
          ? selection.label
          : pulseLabels[selection.bucket].title

  const outerTone =
    outerWeightedGapPsf == null
      ? "muted"
      : outerWeightedGapPsf > 0
        ? "danger"
        : "success"

  // The popover's row prop must reflect the *latest* derived row (so that
  // override changes drive its UI). Look up by id every render.
  const popoverRow = popover.open
    ? allRows.find((r) => r.id === popover.leaseId) ?? null
    : null

  const closePopover = () => setPopover({ open: false })

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
          ) : selection?.kind === "pulse" ? (
            <div className="panel-period-summary">
              <div className="period-stat">
                <div className="period-stat-label">
                  <span className={`dot ${selection.bucket}`} />{" "}
                  {pulseLabels[selection.bucket].dollarsLabel}
                </div>
                <div
                  className={`period-stat-value ${
                    pulseLabels[selection.bucket].tone === "muted"
                      ? ""
                      : pulseLabels[selection.bucket].tone
                  }`}
                >
                  {formatDollars(
                    selection.bucket === "at"
                      ? pulseAnnualSpend ?? 0
                      : pulseDollars ?? 0,
                  )}
                </div>
              </div>
              <div className="period-stat">
                <div className="period-stat-label">Leases</div>
                <div className="period-stat-value">{outerCount}</div>
              </div>
              <div className="period-stat">
                <div className="period-stat-label">SF in scope</div>
                <div className="period-stat-value">
                  {(pulseSf ?? 0).toLocaleString("en-US")}
                </div>
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

          {(selection?.kind === "period" || selection?.kind === "pulse") && (
            <div className="panel-inner-toggle" role="tablist" aria-label="Group by">
              <button
                type="button"
                role="tab"
                className={`seg-opt${innerToggle === "submarket" ? " on" : ""}`}
                aria-selected={innerToggle === "submarket"}
                onClick={() => setInnerToggle("submarket")}
              >
                By sub-market
              </button>
              <button
                type="button"
                role="tab"
                className={`seg-opt${innerToggle === "propertyType" ? " on" : ""}`}
                aria-selected={innerToggle === "propertyType"}
                onClick={() => setInnerToggle("propertyType")}
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
          {/* Sticky cross-tab header */}
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
                    <div className="bp-lease bp-lease--header">
                      <div className="bp-lease-info">Lease</div>
                      <div className="bp-lease-current">Current</div>
                      <div className="bp-lease-market">Market</div>
                      <div className="bp-lease-gap-cell">Gap</div>
                    </div>
                    {groupLeases.length === 0 && (
                      <div className="bp-leases-empty">No leases in this group.</div>
                    )}
                    {groupLeases.map((lease) => (
                      <BpLeaseRow
                        key={lease.id}
                        lease={lease}
                        popoverActive={
                          popover.open && popover.leaseId === lease.id
                        }
                        onMarketClick={(rect) =>
                          setPopover({ open: true, leaseId: lease.id, rect })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      {popover.open && popoverRow && (
        <ScopePopover
          row={popoverRow}
          anchorRect={popover.rect}
          onClose={closePopover}
          onPickScope={(scopeId) => onPickScope(popoverRow.id, scopeId)}
          onSetManual={(estimate) => onSetManual(popoverRow.id, estimate)}
          onPickSystemErv={() => onPickSystemErv(popoverRow.id)}
          onClearOverride={() => onClearOverride(popoverRow.id)}
        />
      )}
    </>
  )
}

function BpLeaseRow({
  lease,
  popoverActive,
  onMarketClick,
}: {
  lease: LeaseRow
  popoverActive: boolean
  onMarketClick: (rect: DOMRect) => void
}) {
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
    lease.comparisonSource === "scope-override" ||
    lease.comparisonSource === "erv-system"

  const overridePillLabel =
    lease.comparisonSource === "broker"
      ? "Your ERV"
      : lease.comparisonSource === "erv-system"
        ? "ERV"
        : "Alt scope"

  // Sub-line under the market price: scope label + comp meta, or ERV label.
  const activeScope = lease.scopes.find(
    (s) =>
      (lease.brokerOverride?.kind === "scope" &&
        s.id === lease.brokerOverride.scopeId) ||
      (!lease.brokerOverride && s.id === lease.defaultScopeId),
  )
  const marketLine1 =
    lease.comparisonSource === "broker"
      ? "Your ERV"
      : lease.comparisonSource === "erv-system"
        ? "External ERV"
        : activeScope?.label ?? lease.comparisonLabel
  const marketLine2 =
    lease.comparisonSource === "broker"
      ? "Manual estimate"
      : lease.comparisonSource === "erv-system"
        ? "Market intelligence"
        : activeScope
          ? `${activeScope.compCount} comps · ${activeScope.confidence}`
          : null

  const handleMarketClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onMarketClick(e.currentTarget.getBoundingClientRect())
  }

  return (
    <div className="bp-lease">
      <div className="bp-lease-info">
        <div className="bp-lease-name">
          <span className="bp-lease-address">{lease.address}</span>
          {isOverridden && (
            <span className="broker-pill">{overridePillLabel}</span>
          )}
        </div>
        <div className="bp-lease-meta">
          {lease.sf.toLocaleString("en-US")} SF · {lease.tenant} · expires{" "}
          {formatExpiry(lease.expiryDate)}
        </div>
      </div>

      <div className="bp-lease-current">
        <div className="bp-cell-num">{formatPsf(lease.currentRentPsf)}</div>
        <div className="bp-cell-meta">/SF</div>
      </div>

      <button
        type="button"
        className={`bp-lease-market${popoverActive ? " active" : ""}`}
        onClick={handleMarketClick}
        aria-label="Change comp scope or set ERV"
      >
        {lease.comparisonPsf != null ? (
          <>
            <div className="bp-cell-num">{formatPsf(lease.comparisonPsf)}</div>
            <div className="bp-cell-meta">{marketLine1}</div>
            {marketLine2 && (
              <div className="bp-cell-meta muted">{marketLine2}</div>
            )}
          </>
        ) : (
          <>
            <div className="bp-cell-num muted">—</div>
            <div className="bp-cell-meta muted">No comp set</div>
          </>
        )}
      </button>

      <div className="bp-lease-gap-cell">
        <div className={`bp-cell-num ${tone}`}>
          {lease.variancePsf != null
            ? formatPsf(lease.variancePsf, { sign: true })
            : "—"}
        </div>
        {lease.varianceAnnual != null && (
          <div className="bp-cell-meta">
            {formatDollars(lease.varianceAnnual, { sign: true })}/yr
          </div>
        )}
      </div>
    </div>
  )
}
