"use client"

import { useMemo, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import {
  READINESS_THRESHOLD,
  getLeaseAttention,
  type CoverageStats,
} from "@/lib/coverage"
import { LeaseTable } from "./lease-table"

type SharedHandlers = {
  onPickScope: (leaseId: string, scopeId: string) => void
  onSetManual: (leaseId: string, estimate: number) => void
  onPickSystemErv: (leaseId: string) => void
  onClearOverride: (leaseId: string) => void
}

type GateProps = SharedHandlers & {
  rows: LeaseRow[]
  coverage: CoverageStats
}

/**
 * Setup view filter — toggled via the stat strip above the lease table.
 *  - all:            every lease (default)
 *  - missing:        no comparison rent at all
 *  - fell-back:      system widened scope because narrow scope was thin
 *  - low-confidence: small comp set
 *  - erv-available:  externally-sourced ERV exists for this lease (best signal)
 */
type SetupFilter =
  | "all"
  | "missing"
  | "fell-back"
  | "low-confidence"
  | "erv-available"

/**
 * Setup surface — shown before the dashboard. Redesigned around the broker's
 * actual workflow: the lease table is the focal point (one row per lease,
 * its current rent vs comparison rent), and the four cards above act as
 * filters and explainers ("how much ERV context do we have?", "how many are
 * low confidence and why?"). The original analytical surface was too dense
 * for what is fundamentally a data-hygiene step.
 *
 * The popover / set-manual flow lives entirely inside LeaseTable, so brokers
 * fix comps in the same row they read them — no separate triage list.
 */
export function MarketCoverageGate({
  rows,
  coverage,
  onPickScope,
  onSetManual,
  onPickSystemErv,
  onClearOverride,
}: GateProps) {
  const [filter, setFilter] = useState<SetupFilter>("all")

  const filteredRows = useMemo(() => {
    switch (filter) {
      case "all":
        return rows
      case "erv-available":
        return rows.filter((r) => r.systemErvPsf != null)
      case "missing":
      case "fell-back":
      case "low-confidence":
        return rows.filter((r) => {
          const a = getLeaseAttention(r)
          return a?.severity === filter
        })
    }
  }, [rows, filter])

  const pct = Math.round(coverage.readyPct * 100)
  const thresholdPct = Math.round(READINESS_THRESHOLD * 100)
  const ervPct = coverage.total
    ? Math.round((coverage.ervAvailableCount / coverage.total) * 100)
    : 0

  return (
    <section className="coverage-gate">
      <header className="coverage-gate-header">
        <div className="coverage-gate-eyebrow">
          Step 1 · Configure your portfolio
        </div>
        <h2 className="coverage-gate-title">
          Confirm a market estimate on every lease
        </h2>
        <p className="coverage-gate-sub">
          The dashboard and market analysis tabs are built on one number per
          lease — what it would cost at market today. We default to the
          external ERV when one exists; everywhere else, use the table below
          to confirm a comp scope or type your own. The dashboard tab unlocks
          at {thresholdPct}% coverage.
        </p>
      </header>

      <div className="setup-stats" role="tablist" aria-label="Filter leases">
        <StatCard
          tone="neutral"
          label="Coverage"
          primary={`${pct}%`}
          secondary={`${coverage.ready} of ${coverage.total} leases ready`}
          tertiary={`Target ${thresholdPct}%`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <StatCard
          tone="success"
          label="ERV context"
          primary={`${coverage.ervAvailableCount}`}
          secondary={`${ervPct}% of leases have an external ERV`}
          tertiary={
            coverage.ervPinnedCount > 0
              ? `${coverage.ervPinnedCount} pinned as comparison`
              : "Strongest signal — pin where it fits"
          }
          active={filter === "erv-available"}
          onClick={() =>
            setFilter((f) =>
              f === "erv-available" ? "all" : "erv-available",
            )
          }
          disabled={coverage.ervAvailableCount === 0}
        />
        <StatCard
          tone="warning"
          label="Low confidence"
          primary={`${coverage.lowConfidenceCount + coverage.fellBackCount}`}
          secondary={
            coverage.fellBackCount > 0 && coverage.lowConfidenceCount > 0
              ? `${coverage.fellBackCount} fell back · ${coverage.lowConfidenceCount} thin comps`
              : coverage.fellBackCount > 0
                ? `${coverage.fellBackCount} fell back to a wider scope`
                : `${coverage.lowConfidenceCount} backed by a small comp set`
          }
          tertiary="Pin an ERV or pick a wider scope"
          active={filter === "fell-back" || filter === "low-confidence"}
          onClick={() =>
            // Cycle through fell-back → low-confidence → all to expose both
            // sub-categories without crowding the strip with extra cards.
            setFilter((f) =>
              f === "fell-back"
                ? "low-confidence"
                : f === "low-confidence"
                  ? "all"
                  : "fell-back",
            )
          }
          disabled={
            coverage.lowConfidenceCount + coverage.fellBackCount === 0
          }
          subFilter={
            filter === "fell-back"
              ? "Showing fell back"
              : filter === "low-confidence"
                ? "Showing thin comps"
                : undefined
          }
        />
        <StatCard
          tone="danger"
          label="No estimate"
          primary={`${coverage.missingCount}`}
          secondary={
            coverage.missingCount === 0
              ? "Every lease has a comparison rent"
              : "Comparison can't be computed"
          }
          tertiary="Set a manual ERV or pick a scope"
          active={filter === "missing"}
          onClick={() =>
            setFilter((f) => (f === "missing" ? "all" : "missing"))
          }
          disabled={coverage.missingCount === 0}
        />
      </div>

      {filter !== "all" && (
        <div className="coverage-actions">
          <button
            type="button"
            className="coverage-link"
            onClick={() => setFilter("all")}
          >
            Show all leases
          </button>
        </div>
      )}

      <LeaseTable
        rows={filteredRows}
        onPickScope={onPickScope}
        onSetManual={onSetManual}
        onPickSystemErv={onPickSystemErv}
        onClearOverride={onClearOverride}
      />
    </section>
  )
}

/**
 * Small filter card above the lease table. Reads as a stat (primary value +
 * supporting text) and behaves as a toggle into the underlying filter, with
 * a clear active state so brokers can see what they're scoped to.
 */
function StatCard({
  tone,
  label,
  primary,
  secondary,
  tertiary,
  active,
  onClick,
  disabled,
  subFilter,
}: {
  tone: "neutral" | "success" | "warning" | "danger"
  label: string
  primary: string
  secondary: string
  tertiary?: string
  active: boolean
  onClick: () => void
  disabled?: boolean
  subFilter?: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`stat-card tone-${tone}${active ? " active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="stat-card-head">
        <span className="stat-card-label">{label}</span>
        {subFilter && <span className="stat-card-subfilter">{subFilter}</span>}
      </div>
      <div className="stat-card-primary">{primary}</div>
      <div className="stat-card-secondary">{secondary}</div>
      {tertiary && <div className="stat-card-tertiary">{tertiary}</div>}
    </button>
  )
}
