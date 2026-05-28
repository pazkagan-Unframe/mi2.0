"use client"

import { useMemo, useState } from "react"
import type { Confidence, LeaseRow } from "@/lib/types"
import {
  formatDollars,
  formatExpiry,
  formatPercent,
  formatPsf,
  monthsUntil,
} from "@/lib/format"
import { confidenceReason, getLeaseAttention } from "@/lib/coverage"
import { ScopePopover } from "./scope-popover"

type Props = {
  rows: LeaseRow[]
  onPickScope: (leaseId: string, scopeId: string) => void
  onSetManual: (leaseId: string, estimate: number) => void
  onPickSystemErv: (leaseId: string) => void
  onClearOverride: (leaseId: string) => void
  onLeaseClick?: (leaseId: string) => void
}

type SortKey =
  | "address"
  | "propertyType"
  | "submarket"
  | "sf"
  | "expiry"
  | "current"
  | "market"
  | "variance"

type SortDir = "asc" | "desc"

type PopoverState =
  | { open: true; row: LeaseRow; rect: DOMRect }
  | { open: false }

export function LeaseTable({
  rows,
  onPickScope,
  onSetManual,
  onPickSystemErv,
  onClearOverride,
  onLeaseClick,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("variance")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [pageSize, setPageSize] = useState<10 | 25 | 100>(25)
  const [popover, setPopover] = useState<PopoverState>({ open: false })

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      const get = (r: LeaseRow): string | number | null => {
        switch (sortKey) {
          case "address":
            return r.address
          case "propertyType":
            return r.propertyType
          case "submarket":
            return r.submarket
          case "sf":
            return r.sf
          case "expiry":
            return new Date(r.expiryDate).getTime()
          case "current":
            return r.currentRentPsf
          case "market":
            return r.comparisonPsf
          case "variance":
            return r.variancePsf
        }
      }
      const av = get(a)
      const bv = get(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
    return copy
  }, [rows, sortKey, sortDir])

  const visible = sorted.slice(0, pageSize)

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(
        key === "address" || key === "submarket" || key === "propertyType" ? "asc" : "desc",
      )
    }
  }

  const openPopover = (row: LeaseRow, rect: DOMRect) =>
    setPopover({ open: true, row, rect })
  const closePopover = () => setPopover({ open: false })

  // The popover's `row` prop must reflect the latest derived row (after overrides
  // change), so look it up by id every render.
  const popoverRow =
    popover.open ? rows.find((r) => r.id === popover.row.id) ?? null : null

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">Leases</div>
        <div className="card-actions">
          Click any market $/SF to switch comp scope or add a broker estimate
        </div>
      </header>

      <div className="table-toolbar">
        <span className="meta">
          Showing <strong style={{ color: "var(--text)" }}>{visible.length}</strong> of{" "}
          <strong style={{ color: "var(--text)" }}>{sorted.length}</strong> leases
        </span>
        <span className="spacer" />
        <span className="meta">
          Page size:{" "}
          {[10, 25, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPageSize(n as 10 | 25 | 100)}
              style={{
                padding: "2px 8px",
                marginLeft: 2,
                fontSize: 12,
                color: pageSize === n ? "var(--accent)" : "var(--text-2)",
                fontWeight: pageSize === n ? 600 : 400,
                background: pageSize === n ? "var(--accent-bg)" : "transparent",
                borderRadius: 4,
              }}
            >
              {n}
            </button>
          ))}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="lease-table">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "15%" }} />
          </colgroup>
          <thead>
            <tr>
              <Th k="address" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                Lease
              </Th>
              <Th k="propertyType" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                Type
              </Th>
              <Th k="submarket" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                Sub-market
              </Th>
              <Th right k="sf" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                SF
              </Th>
              <Th right k="expiry" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                Expires
              </Th>
              <Th right k="current" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                Current $/SF
              </Th>
              <Th right k="market" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                Market $/SF
              </Th>
              <Th right k="variance" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                Gap
              </Th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="card-empty">
                  No leases match the current filters.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <LeaseRowView
                  key={row.id}
                  row={row}
                  onOpenPopover={openPopover}
                  popoverOpenForRowId={popover.open ? popover.row.id : null}
                  onLeaseClick={onLeaseClick}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > visible.length && (
        <div className="table-footer">
          <span>
            {sorted.length - visible.length} more not shown. Increase page size or refine filters.
          </span>
          <button
            type="button"
            className="link"
            onClick={() => setPageSize(100)}
            style={{ background: "none", border: "none", padding: 0 }}
          >
            Show all
          </button>
        </div>
      )}

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
    </section>
  )
}

function Th({
  k,
  sortKey,
  sortDir,
  setSort,
  children,
  right,
}: {
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  setSort: (k: SortKey) => void
  children: React.ReactNode
  right?: boolean
}) {
  const active = sortKey === k
  return (
    <th
      className={`sortable${active ? " active" : ""}${right ? " right" : ""}`}
      onClick={() => setSort(k)}
    >
      {children}
      <span className="sort-arrow">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  )
}

function confidenceClass(c: Confidence | "muted"): string {
  if (c === "high") return "high"
  if (c === "medium") return "med"
  if (c === "low") return "low"
  return "muted"
}

function LeaseRowView({
  row,
  onOpenPopover,
  popoverOpenForRowId,
  onLeaseClick,
}: {
  row: LeaseRow
  onOpenPopover: (row: LeaseRow, rect: DOMRect) => void
  popoverOpenForRowId: string | null
  onLeaseClick?: (leaseId: string) => void
}) {
  const months = monthsUntil(row.expiryDate)

  const tone =
    row.variancePsf == null
      ? "muted"
      : row.variancePct != null && Math.abs(row.variancePct) <= 0.05
        ? "muted"
        : row.variancePsf > 0
          ? "danger"
          : "success"

  // Treat ERV-by-default (no brokerOverride, ERV picked up automatically) as
  // a labelled-but-not-broker-edited source: show the "ERV" pill so brokers
  // know what they're seeing, but skip the row tint reserved for explicit
  // broker actions.
  const isErvDefault =
    row.comparisonSource === "erv-system" && !row.brokerOverride
  const isOverridden =
    row.comparisonSource === "broker" ||
    row.comparisonSource === "scope-override" ||
    row.comparisonSource === "erv-system"
  const isBrokerEdited = isOverridden && !isErvDefault
  const overridePillLabel =
    row.comparisonSource === "broker"
      ? "Your ERV"
      : row.comparisonSource === "erv-system"
        ? "ERV"
        : "Alt scope"

  const handleMarketClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    onOpenPopover(row, rect)
  }

  const handleRowClick = () => {
    if (onLeaseClick) onLeaseClick(row.id)
  }

  const popoverActive = popoverOpenForRowId === row.id

  // Single muted subline below the market $/SF price. We deliberately collapse
  // scope label + comp count + confidence into one line so the cell is two
  // lines tall total (matching Lease / Sub-market cells), which lets
  // vertical-align: middle on the td keep the price near the row centerline.
  const activeScope = row.scopes.find(
    (s) =>
      (row.brokerOverride?.kind === "scope" && s.id === row.brokerOverride.scopeId) ||
      (!row.brokerOverride && s.id === row.defaultScopeId),
  )
  const compConfidence: Confidence =
    row.comparisonSource === "broker" || row.comparisonSource === "erv-system"
      ? "high"
      : activeScope?.confidence ?? row.marketConfidence
  // For ERV/manual sources, show only the source label (no comp count makes
  // sense). For scope-based sources, show "<scope> · <N> comps".
  const subInfo: { label: string; showConf: boolean } | null =
    row.comparisonPsf == null
      ? null
      : row.comparisonSource === "broker"
        ? { label: "Your ERV", showConf: false }
        : row.comparisonSource === "erv-system"
          ? { label: "External ERV", showConf: false }
          : activeScope
            ? {
                label: `${row.comparisonLabel} · ${activeScope.compCount} ${activeScope.compCount === 1 ? "comp" : "comps"}`,
                showConf: true,
              }
            : { label: row.comparisonLabel, showConf: true }

  // Inline explanation for weak comps. We keep this separate from subInfo
  // because the reason should be rendered with attention-grabbing colour
  // (warning/danger), not with the muted scope/comp metadata. Returns null
  // when the row's comp is trustworthy.
  const reason = confidenceReason(row)
  const reasonSeverity = getLeaseAttention(row)?.severity ?? null
  const reasonClass =
    reasonSeverity === "missing"
      ? "danger"
      : reasonSeverity === "fell-back"
        ? "warning"
        : "info"

  return (
    <tr
          className={isBrokerEdited ? "broker-row" : undefined}
      onClick={onLeaseClick ? handleRowClick : undefined}
      style={onLeaseClick ? { cursor: "pointer" } : undefined}
    >
      <td>
        <div className="lease-name">{row.address}</div>
        <div className="lease-meta">
          {row.tenant} · {row.id}
        </div>
      </td>
      <td>{row.propertyType}</td>
      <td>
        <div className="scope-chip">
          <span className="scope-text">{row.submarket}</span>
          <span className="scope-conf muted">
            {row.city}, {row.state}
          </span>
        </div>
      </td>
      <td className="right mono">{row.sf.toLocaleString("en-US")}</td>
      <td className={`right expiry-cell${months <= 12 ? " urgent" : ""}`}>
        {formatExpiry(row.expiryDate)}
      </td>
      <td className="right mono">{formatPsf(row.currentRentPsf)}</td>
      <td className="right">
        <button
          type="button"
          className={`market-cell-trigger${popoverActive ? " active" : ""}`}
          onClick={handleMarketClick}
        >
          {row.comparisonPsf != null && subInfo ? (
            <>
              <span
                className="market-cell-num"
                style={{ display: "flex", gap: 6, alignItems: "baseline" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {formatPsf(row.comparisonPsf)}
                </span>
                {isOverridden && (
                  <span className="broker-pill">{overridePillLabel}</span>
                )}
                {row.systemErvPsf != null &&
                  row.comparisonSource !== "erv-system" && (
                    <span
                      className="erv-pill"
                      title="External ERV available — pin it as the comparison rent"
                    >
                      ERV available
                    </span>
                  )}
              </span>
              <span
                className="meta"
                style={{ fontSize: 11, color: "var(--text-3)" }}
              >
                {subInfo.label}
                {subInfo.showConf && (
                  <>
                    {" · "}
                    <span className={`scope-conf ${confidenceClass(compConfidence)}`}>
                      {compConfidence}
                    </span>
                  </>
                )}
              </span>
              {reason && (
                <span className={`market-cell-reason ${reasonClass}`}>
                  {reason}
                </span>
              )}
            </>
          ) : (
            <>
              <span style={{ color: "var(--text-3)", fontSize: 12 }}>
                No comp set
              </span>
              <span className="market-cell-reason danger">
                {reason ?? "No comp — needs your input"}
              </span>
            </>
          )}
        </button>
      </td>
      <td className="right">
        {row.variancePsf != null ? (
          <div className="gap-cell">
            <span className={`gap-value ${tone}`}>
              {formatPsf(row.variancePsf, { sign: true })}
            </span>
            <span className="gap-pct">
              {row.variancePct != null && formatPercent(row.variancePct, { sign: true })} ·{" "}
              {formatDollars(row.varianceAnnual, { sign: true })}/yr
            </span>
          </div>
        ) : (
          <span className="gap-value muted">—</span>
        )}
      </td>
    </tr>
  )
}
