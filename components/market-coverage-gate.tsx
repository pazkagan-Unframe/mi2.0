"use client"

import { useMemo, useRef, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import {
  READINESS_THRESHOLD,
  attentionRows,
  type CoverageStats,
  type LeaseAttention,
} from "@/lib/coverage"
import { formatPsf } from "@/lib/format"
import { ScopePopover } from "./scope-popover"

type SharedHandlers = {
  onPickScope: (leaseId: string, scopeId: string) => void
  onSetManual: (leaseId: string, estimate: number) => void
  onPickSystemErv: (leaseId: string) => void
  onClearOverride: (leaseId: string) => void
}

type ChipProps = SharedHandlers & {
  coverage: CoverageStats
  /** Switches the page back into setup mode. */
  onOpenSetup: () => void
}

/**
 * Compact persistent chip rendered inside the dashboard header once coverage
 * is above READINESS_THRESHOLD. Shows the coverage % and offers a one-click
 * way back into Setup if the broker wants to keep tightening their data.
 */
export function CoverageChip({
  coverage,
  onOpenSetup,
}: Pick<ChipProps, "coverage" | "onOpenSetup">) {
  const pct = Math.round(coverage.readyPct * 100)
  const ready = coverage.attention === 0
  return (
    <button
      type="button"
      className={`coverage-chip${ready ? " ready" : " has-attention"}`}
      onClick={onOpenSetup}
      title={
        ready
          ? "All leases have a market estimate"
          : `${coverage.attention} ${coverage.attention === 1 ? "lease needs" : "leases need"} attention`
      }
    >
      <span className="coverage-chip-bar" aria-hidden="true">
        <span
          className="coverage-chip-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="coverage-chip-label">
        Coverage <strong>{pct}%</strong>
      </span>
      {!ready && (
        <span className="coverage-chip-pill">
          {coverage.attention} need{coverage.attention === 1 ? "s" : ""} attention
        </span>
      )}
    </button>
  )
}

type GateProps = SharedHandlers & {
  rows: LeaseRow[]
  coverage: CoverageStats
  /** Allow brokers to skip into the dashboard even when coverage is low. */
  onContinueAnyway: () => void
}

/**
 * Full-width Setup surface shown when coverage < threshold. Hides the
 * dashboard until the broker has put a defensible market estimate on most of
 * their leases. Inline ScopePopover lets them fix each lease in place — same
 * surface they would normally use from the lease table — so this is a
 * focused workflow rather than a separate wizard.
 */
export function MarketCoverageGate({
  rows,
  coverage,
  onContinueAnyway,
  onPickScope,
  onSetManual,
  onPickSystemErv,
  onClearOverride,
}: GateProps) {
  const triageList = useMemo(() => attentionRows(rows), [rows])
  const [filter, setFilter] = useState<
    "all" | "missing" | "fell-back" | "low-confidence"
  >("all")
  const [popover, setPopover] = useState<{
    leaseId: string
    rect: DOMRect
  } | null>(null)

  const filtered = useMemo(() => {
    if (filter === "all") return triageList
    return triageList.filter((t) => t.attention.severity === filter)
  }, [triageList, filter])

  // Look up the latest derived row for the open popover so override changes
  // are reflected without remounting.
  const popoverRow = popover
    ? rows.find((r) => r.id === popover.leaseId) ?? null
    : null

  const pct = Math.round(coverage.readyPct * 100)
  const thresholdPct = Math.round(READINESS_THRESHOLD * 100)

  return (
    <section className="coverage-gate">
      <header className="coverage-gate-header">
        <div className="coverage-gate-eyebrow">Setup · Market mapping</div>
        <h2 className="coverage-gate-title">
          Map every lease to the market before you read the dashboard
        </h2>
        <p className="coverage-gate-sub">
          Every chart in this report — opportunity, at-risk savings, the spend
          impact view, the portfolio pulse — is built on a single number per
          lease: what it would cost at market today. We hide the dashboard
          until coverage is above {thresholdPct}% so you never read a chart
          that&apos;s missing its spine.
        </p>
      </header>

      <div className="coverage-meter">
        <div className="coverage-meter-track" aria-hidden="true">
          <div
            className="coverage-meter-fill"
            style={{ width: `${pct}%` }}
            data-ready={coverage.readyPct >= READINESS_THRESHOLD}
          />
          <div
            className="coverage-meter-threshold"
            style={{ left: `${thresholdPct}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="coverage-meter-labels">
          <span className="coverage-meter-pct">
            <strong>{pct}%</strong> ready
          </span>
          <span className="coverage-meter-counts">
            {coverage.ready} of {coverage.total} leases ·{" "}
            <span className="muted">target {thresholdPct}%</span>
          </span>
        </div>
      </div>

      <div className="coverage-buckets">
        <SeverityCard
          tone="danger"
          label="No market estimate"
          count={coverage.missingCount}
          hint="Comparison can't be computed yet"
          active={filter === "missing"}
          onClick={() =>
            setFilter((f) => (f === "missing" ? "all" : "missing"))
          }
        />
        <SeverityCard
          tone="warning"
          label="System fell back"
          count={coverage.fellBackCount}
          hint="Narrow scope had too few comps"
          active={filter === "fell-back"}
          onClick={() =>
            setFilter((f) => (f === "fell-back" ? "all" : "fell-back"))
          }
        />
        <SeverityCard
          tone="info"
          label="Low confidence"
          count={coverage.lowConfidenceCount}
          hint="Backed by a small comp set"
          active={filter === "low-confidence"}
          onClick={() =>
            setFilter((f) =>
              f === "low-confidence" ? "all" : "low-confidence",
            )
          }
        />
      </div>

      <div className="coverage-actions">
        <div className="coverage-actions-left">
          {filter !== "all" && (
            <button
              type="button"
              className="coverage-link"
              onClick={() => setFilter("all")}
            >
              Show all {triageList.length}
            </button>
          )}
        </div>
        <div className="coverage-actions-right">
          <button
            type="button"
            className="coverage-secondary"
            onClick={onContinueAnyway}
          >
            Continue with partial data
          </button>
        </div>
      </div>

      <ul className="coverage-list" role="list">
        {filtered.length === 0 ? (
          <li className="coverage-list-empty">
            No leases match this severity — pick another bucket.
          </li>
        ) : (
          filtered.map(({ row, attention }) => (
            <AttentionRow
              key={row.id}
              row={row}
              attention={attention}
              onOpenPopover={(rect) => setPopover({ leaseId: row.id, rect })}
            />
          ))
        )}
      </ul>

      {popover && popoverRow && (
        <ScopePopover
          row={popoverRow}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
          onPickScope={(scopeId) => onPickScope(popoverRow.id, scopeId)}
          onClearOverride={() => onClearOverride(popoverRow.id)}
          onSetManual={(estimate) => onSetManual(popoverRow.id, estimate)}
          onPickSystemErv={() => onPickSystemErv(popoverRow.id)}
        />
      )}
    </section>
  )
}

function SeverityCard({
  tone,
  label,
  count,
  hint,
  active,
  onClick,
}: {
  tone: "danger" | "warning" | "info"
  label: string
  count: number
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`severity-card tone-${tone}${active ? " active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      disabled={count === 0}
    >
      <div className="severity-card-count">{count}</div>
      <div className="severity-card-label">{label}</div>
      <div className="severity-card-hint">{hint}</div>
    </button>
  )
}

function AttentionRow({
  row,
  attention,
  onOpenPopover,
}: {
  row: LeaseRow
  attention: LeaseAttention
  onOpenPopover: (rect: DOMRect) => void
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const toneClass =
    attention.severity === "missing"
      ? "danger"
      : attention.severity === "fell-back"
        ? "warning"
        : "info"

  return (
    <li className="coverage-row">
      <div className="coverage-row-main">
        <div className="coverage-row-title">{row.address}</div>
        <div className="coverage-row-meta">
          {row.propertyType} · {row.submarket} ·{" "}
          {row.sf.toLocaleString("en-US")} SF
        </div>
      </div>
      <div className="coverage-row-rent">
        <div className="coverage-row-rent-label">Current</div>
        <div className="coverage-row-rent-value">
          {formatPsf(row.currentRentPsf)}
        </div>
      </div>
      <div className={`coverage-row-flag tone-${toneClass}`}>
        <span className="coverage-row-flag-dot" aria-hidden="true" />
        <span className="coverage-row-flag-text">{attention.reason}</span>
      </div>
      <button
        ref={btnRef}
        type="button"
        className="coverage-row-action"
        onClick={() => {
          const rect = btnRef.current?.getBoundingClientRect()
          if (rect) onOpenPopover(rect)
        }}
      >
        {attention.severity === "missing" ? "Set estimate" : "Review"}
      </button>
    </li>
  )
}
