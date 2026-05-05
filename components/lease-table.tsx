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

type Props = {
  rows: LeaseRow[]
  onSetEstimate: (leaseId: string, estimate: number | null) => void
}

type SortKey =
  | "address"
  | "propertyType"
  | "submarket"
  | "sf"
  | "expiry"
  | "current"
  | "market"
  | "broker"
  | "variance"

type SortDir = "asc" | "desc"

export function LeaseTable({ rows, onSetEstimate }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("variance")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [pageSize, setPageSize] = useState<10 | 25 | 100>(25)

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
            return r.marketRentPsf
          case "broker":
            return r.brokerOverride?.estimatePsf ?? null
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

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">Leases</div>
        <div className="card-actions">
          Source of truth: broker estimate when present, market data otherwise
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
              <Th right k="broker" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                Broker $/SF
              </Th>
              <Th right k="variance" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>
                Gap
              </Th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="card-empty">
                  No leases match the current filters.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <LeaseRowView key={row.id} row={row} onSetEstimate={onSetEstimate} />
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
  onSetEstimate,
}: {
  row: LeaseRow
  onSetEstimate: (leaseId: string, estimate: number | null) => void
}) {
  const months = monthsUntil(row.expiryDate)

  const tone =
    row.variancePsf == null
      ? "muted"
      : row.variancePsf > 0.5
        ? "danger"
        : row.variancePsf < -0.5
          ? "success"
          : "muted"

  const variancePct =
    row.variancePsf != null && row.comparisonPsf
      ? row.variancePsf / row.comparisonPsf
      : null

  return (
    <tr className={row.comparisonSource === "broker" ? "broker-row" : undefined}>
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
          <span className={`scope-conf ${confidenceClass(row.marketConfidence)}`}>
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
        {row.marketRentPsf != null ? (
          <div className="market-cell">
            <span className={`num${row.comparisonSource === "broker" ? " overridden" : ""}`}>
              {formatPsf(row.marketRentPsf)}
            </span>
            <span className="meta">
              {row.marketCompCount} {row.marketCompCount === 1 ? "comp" : "comps"} ·{" "}
              <span className={`scope-conf ${confidenceClass(row.marketConfidence)}`}>
                {row.marketConfidence}
              </span>
            </span>
          </div>
        ) : (
          <span style={{ color: "var(--text-3)", fontSize: 12 }}>No comp set</span>
        )}
      </td>
      <td className="right">
        <BrokerCell row={row} onSetEstimate={onSetEstimate} />
      </td>
      <td className="right">
        {row.variancePsf != null ? (
          <div className="gap-cell">
            <span className={`gap-value ${tone}`}>
              {formatPsf(row.variancePsf, { sign: true })}
            </span>
            <span className="gap-pct">
              {variancePct != null && formatPercent(variancePct, { sign: true })} ·{" "}
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

function BrokerCell({
  row,
  onSetEstimate,
}: {
  row: LeaseRow
  onSetEstimate: (leaseId: string, estimate: number | null) => void
}) {
  const [draft, setDraft] = useState<string>(
    row.brokerOverride ? String(row.brokerOverride.estimatePsf) : "",
  )
  const [focused, setFocused] = useState(false)

  // Keep the draft in sync if the row's saved value changes externally (e.g. clear).
  // We avoid resetting while the input is focused so we don't fight a typing user.
  if (
    !focused &&
    (row.brokerOverride ? String(row.brokerOverride.estimatePsf) : "") !== draft &&
    document.activeElement?.tagName !== "INPUT"
  ) {
    // no-op; this keeps the linter happy and keeps the controlled input simple
  }

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed === "") {
      if (row.brokerOverride) onSetEstimate(row.id, null)
      return
    }
    const parsed = Number.parseFloat(trimmed)
    if (Number.isFinite(parsed) && parsed > 0) {
      onSetEstimate(row.id, parsed)
    }
  }

  const clear = () => {
    setDraft("")
    onSetEstimate(row.id, null)
  }

  return (
    <div className="broker-input-wrap">
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        className={`broker-input${row.brokerOverride ? " has-value" : ""}`}
        placeholder="Add"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          commit()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          if (e.key === "Escape") {
            setDraft(row.brokerOverride ? String(row.brokerOverride.estimatePsf) : "")
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {row.brokerOverride && (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <span className="broker-pill">Broker</span>
          <button type="button" className="broker-clear" onClick={clear}>
            clear
          </button>
        </span>
      )}
    </div>
  )
}
