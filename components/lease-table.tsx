"use client"

import { useMemo, useState } from "react"
import type { BrokerOverride, LeaseRow } from "@/lib/types"
import { formatDollars, formatExpiry, formatPsf, monthsUntil } from "@/lib/format"

type Props = {
  rows: LeaseRow[]
  onSetEstimate: (leaseId: string, estimate: number | null, note?: string) => void
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
    <section className="lease-table-card" aria-label="Lease benchmarks">
      <header className="lease-table-header">
        <h2 className="section-title">Leases</h2>
        <p className="section-sub">
          Source of truth: broker estimate when present, market data otherwise. Click the broker
          column on any row to enter your own estimate. Variance is current rent minus the
          comparison.
        </p>
      </header>

      <div className="lease-table-scroll">
        <table className="lease-table">
          <thead>
            <tr>
              <th>
                <SortButton current={sortKey} dir={sortDir} k="address" onClick={setSort}>
                  Address
                </SortButton>
              </th>
              <th>
                <SortButton current={sortKey} dir={sortDir} k="propertyType" onClick={setSort}>
                  Type
                </SortButton>
              </th>
              <th>
                <SortButton current={sortKey} dir={sortDir} k="submarket" onClick={setSort}>
                  Sub-market
                </SortButton>
              </th>
              <th className="num">
                <SortButton current={sortKey} dir={sortDir} k="sf" onClick={setSort}>
                  SF
                </SortButton>
              </th>
              <th>
                <SortButton current={sortKey} dir={sortDir} k="expiry" onClick={setSort}>
                  Expires
                </SortButton>
              </th>
              <th className="num">
                <SortButton current={sortKey} dir={sortDir} k="current" onClick={setSort}>
                  Current $/SF
                </SortButton>
              </th>
              <th className="num">
                <SortButton current={sortKey} dir={sortDir} k="market" onClick={setSort}>
                  Market $/SF
                </SortButton>
              </th>
              <th className="num">
                <SortButton current={sortKey} dir={sortDir} k="broker" onClick={setSort}>
                  Broker $/SF
                </SortButton>
              </th>
              <th className="num">
                <SortButton current={sortKey} dir={sortDir} k="variance" onClick={setSort}>
                  Variance
                </SortButton>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <LeaseRowView key={row.id} row={row} onSetEstimate={onSetEstimate} />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-state">
                  No leases match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SortButton({
  current,
  dir,
  k,
  onClick,
  children,
}: {
  current: SortKey
  dir: SortDir
  k: SortKey
  onClick: (k: SortKey) => void
  children: React.ReactNode
}) {
  const active = current === k
  return (
    <button
      type="button"
      className={`th-sort ${active ? "th-sort-active" : ""}`}
      onClick={() => onClick(k)}
    >
      <span>{children}</span>
      <span className="th-sort-arrow" aria-hidden="true">
        {active ? (dir === "asc" ? "↑" : "↓") : ""}
      </span>
    </button>
  )
}

function LeaseRowView({
  row,
  onSetEstimate,
}: {
  row: LeaseRow
  onSetEstimate: (leaseId: string, estimate: number | null, note?: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(
    row.brokerOverride ? String(row.brokerOverride.estimatePsf) : "",
  )

  const months = monthsUntil(row.expiryDate)
  const expiryClass =
    months <= 12 ? "expiry-soon" : months <= 24 ? "expiry-watch" : "expiry-far"

  const tone =
    row.variancePsf == null
      ? "neutral"
      : row.variancePsf > 0.5
        ? "above"
        : row.variancePsf < -0.5
          ? "below"
          : "neutral"

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed === "") {
      onSetEstimate(row.id, null)
    } else {
      const parsed = Number.parseFloat(trimmed)
      if (Number.isFinite(parsed) && parsed > 0) {
        onSetEstimate(row.id, parsed)
      }
    }
    setEditing(false)
  }

  const cancel = () => {
    setDraft(row.brokerOverride ? String(row.brokerOverride.estimatePsf) : "")
    setEditing(false)
  }

  const clear = () => {
    setDraft("")
    onSetEstimate(row.id, null)
    setEditing(false)
  }

  return (
    <tr className={row.comparisonSource === "broker" ? "row-overridden" : undefined}>
      <td>
        <div className="cell-address">
          <span className="cell-address-main">{row.address}</span>
          <span className="cell-address-sub">
            {row.tenant} · {row.id}
          </span>
        </div>
      </td>
      <td>
        <span className="cell-type">{row.propertyType}</span>
      </td>
      <td>
        <div className="cell-submarket">
          <span>{row.submarket}</span>
          <span className="cell-submarket-sub">
            {row.city}, {row.state}
          </span>
        </div>
      </td>
      <td className="num mono">{row.sf.toLocaleString("en-US")}</td>
      <td>
        <span className={`expiry-pill ${expiryClass}`}>{formatExpiry(row.expiryDate)}</span>
      </td>
      <td className="num mono">{formatPsf(row.currentRentPsf)}</td>
      <td className="num">
        {row.marketRentPsf != null ? (
          <div className="cell-market">
            <span
              className={`mono ${row.comparisonSource === "broker" ? "cell-market-muted" : ""}`}
            >
              {formatPsf(row.marketRentPsf)}
            </span>
            <span className={`confidence confidence-${row.marketConfidence}`}>
              {row.marketCompCount} {row.marketCompCount === 1 ? "comp" : "comps"} ·{" "}
              {row.marketConfidence}
            </span>
          </div>
        ) : (
          <span className="cell-no-data">No comp set</span>
        )}
      </td>
      <td className="num">
        {editing ? (
          <BrokerEditor
            draft={draft}
            setDraft={setDraft}
            commit={commit}
            cancel={cancel}
            clear={clear}
            existing={row.brokerOverride}
          />
        ) : row.brokerOverride ? (
          <button
            type="button"
            className="broker-cell broker-cell-set"
            onClick={() => setEditing(true)}
          >
            <span className="mono">{formatPsf(row.brokerOverride.estimatePsf)}</span>
            <span className="broker-pill">Broker</span>
          </button>
        ) : (
          <button
            type="button"
            className="broker-cell broker-cell-empty"
            onClick={() => setEditing(true)}
          >
            <span>Add estimate</span>
          </button>
        )}
      </td>
      <td className="num">
        {row.variancePsf != null ? (
          <div className={`cell-variance cell-variance-${tone}`}>
            <span className="mono cell-variance-psf">
              {formatPsf(row.variancePsf, { sign: true })}
            </span>
            <span className="mono cell-variance-annual">
              {formatDollars(row.varianceAnnual ?? 0, { sign: true })}/yr
            </span>
          </div>
        ) : (
          <span className="cell-no-data">—</span>
        )}
      </td>
    </tr>
  )
}

function BrokerEditor({
  draft,
  setDraft,
  commit,
  cancel,
  clear,
  existing,
}: {
  draft: string
  setDraft: (v: string) => void
  commit: () => void
  cancel: () => void
  clear: () => void
  existing: BrokerOverride | null
}) {
  return (
    <div className="broker-editor">
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        className="broker-input mono"
        placeholder="$/SF"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") cancel()
        }}
        onBlur={commit}
      />
      {existing && (
        <button
          type="button"
          className="broker-clear"
          onMouseDown={(e) => {
            e.preventDefault()
            clear()
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
