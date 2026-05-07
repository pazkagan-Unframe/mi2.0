"use client"

import { useEffect } from "react"
import type { LeaseRow } from "@/lib/types"
import {
  formatDollars,
  formatExpiry,
  formatPercent,
  formatPsf,
  monthsUntil,
} from "@/lib/format"

type Props = {
  open: boolean
  row: LeaseRow | null
  onClose: () => void
  onPickScope: (leaseId: string, scopeId: string) => void
  onClearOverride: (leaseId: string) => void
}

/**
 * Read-only summary panel for a single lease. Stacks above the BreakdownPanel
 * (z-index 110/111) and is the natural target for clicks from the breakdown
 * lease list, the top-variance lists, and lease table rows.
 *
 * Lets the broker pick a different comp scope from the chain. Manual broker
 * estimates remain editable via the lease table's market-cell popover (one
 * editing surface for the in-row workflow).
 */
export function LeaseDetailPanel({
  open,
  row,
  onClose,
  onPickScope,
  onClearOverride,
}: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => {
      document.removeEventListener("keydown", handler)
    }
  }, [open, onClose])

  if (!row) {
    return (
      <>
        <div
          className={`panel-overlay panel-overlay--top${open ? " open" : ""}`}
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          className={`panel panel--top panel--detail${open ? " open" : ""}`}
          aria-hidden="true"
        />
      </>
    )
  }

  const months = monthsUntil(row.expiryDate)
  const annualCurrent = row.currentRentPsf * row.sf
  const annualMarket =
    row.comparisonPsf != null ? row.comparisonPsf * row.sf : null

  const tone =
    row.variancePsf == null
      ? "muted"
      : row.variancePct != null && Math.abs(row.variancePct) <= 0.05
        ? "muted"
        : row.variancePsf > 0
          ? "danger"
          : "success"

  const sourcePill =
    row.comparisonSource === "broker"
      ? "Broker estimate"
      : row.comparisonSource === "scope-override"
        ? `Alternate scope · ${row.comparisonLabel}`
        : row.comparisonSource === "market"
          ? `System default · ${row.comparisonLabel}`
          : "No comp set"

  const activeScopeId =
    row.brokerOverride?.kind === "scope"
      ? row.brokerOverride.scopeId
      : row.brokerOverride
        ? null // manual: no scope is active in the chain
        : row.defaultScopeId

  const positionLabel =
    row.variancePct == null
      ? "No comp set"
      : Math.abs(row.variancePct) <= 0.05
        ? "At market"
        : row.variancePsf! > 0
          ? "Above market"
          : "Below market"

  return (
    <>
      <div
        className={`panel-overlay panel-overlay--top${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`panel panel--top panel--detail${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lease-detail-title"
        aria-hidden={!open}
      >
        <header className="panel-header">
          <div className="panel-eyebrow">Lease detail</div>
          <h2 id="lease-detail-title" className="panel-title">
            {row.address}
          </h2>
          <p className="panel-subtitle">
            {row.tenant} · {row.id} · {row.propertyType} · {row.submarket},{" "}
            {row.city}, {row.state}
          </p>
          <button
            type="button"
            className="panel-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            ×
          </button>
        </header>

        <div className="panel-body">
          {/* Lease basics */}
          <section className="panel-section">
            <div className="panel-section-title">At a glance</div>
            <div className="panel-stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="panel-stat">
                <div className="lbl">SF</div>
                <div className="val">{row.sf.toLocaleString("en-US")}</div>
              </div>
              <div className="panel-stat">
                <div className="lbl">Expires</div>
                <div className={`val${months <= 12 ? " danger" : ""}`}>
                  {formatExpiry(row.expiryDate)}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: months <= 12 ? "var(--danger)" : "var(--text-3)",
                      fontFamily: "var(--font-sans)",
                      marginTop: 2,
                    }}
                  >
                    {months < 0
                      ? "Expired"
                      : `${months} ${months === 1 ? "month" : "months"} away`}
                  </div>
                </div>
              </div>
              <div className="panel-stat">
                <div className="lbl">Current $/SF</div>
                <div className="val">{formatPsf(row.currentRentPsf)}</div>
              </div>
              <div className="panel-stat">
                <div className="lbl">Annual current rent</div>
                <div className="val">{formatDollars(annualCurrent)}</div>
              </div>
            </div>
          </section>

          {/* Market comparison */}
          <section className="panel-section">
            <div className="panel-section-title">Market comparison</div>

            <div style={{ marginBottom: 12 }}>
              <span className={`detail-source-pill${row.comparisonSource === "none" ? " muted" : ""}`}>
                {sourcePill}
              </span>
            </div>

            {row.comparisonPsf != null ? (
              <div className="panel-stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="panel-stat">
                  <div className="lbl">Comparison $/SF</div>
                  <div className="val">{formatPsf(row.comparisonPsf)}</div>
                </div>
                <div className="panel-stat">
                  <div className="lbl">Annual at comparison</div>
                  <div className="val">
                    {annualMarket != null ? formatDollars(annualMarket) : "—"}
                  </div>
                </div>
                <div className="panel-stat">
                  <div className="lbl">Gap $/SF</div>
                  <div className={`val ${tone}`}>
                    {formatPsf(row.variancePsf, { sign: true })}
                  </div>
                </div>
                <div className="panel-stat">
                  <div className="lbl">Gap % · annual</div>
                  <div className={`val ${tone}`}>
                    {row.variancePct != null
                      ? formatPercent(row.variancePct, { sign: true })
                      : "—"}
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        color: "var(--text-3)",
                        marginTop: 2,
                      }}
                    >
                      {formatDollars(row.varianceAnnual, { sign: true })}/yr
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-empty" style={{ padding: 16 }}>
                No comparable lease data available for this scope.
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "var(--text-2)",
                fontWeight: 500,
              }}
            >
              {positionLabel}
            </div>
          </section>

          {/* Available scopes */}
          {row.scopes.length > 0 && (
            <section className="panel-section">
              <div className="panel-section-title">Available comp scopes</div>
              <p style={{ marginBottom: 10 }}>
                Click a scope to use it for this lease&apos;s comparison rent.
                The system default is the narrowest scope with at least 5 comps.
                {row.fellBack &&
                  " Narrower scopes were skipped — too few comparable leases."}
              </p>
              <div className="detail-scope-table">
                {row.scopes.map((scope) => {
                  const isActive = scope.id === activeScopeId
                  const isDefault = scope.id === row.defaultScopeId
                  return (
                    <button
                      key={scope.id}
                      type="button"
                      className={`detail-scope-row${isActive ? " active" : ""}`}
                      onClick={() => onPickScope(row.id, scope.id)}
                      style={{
                        textAlign: "left",
                        cursor: "pointer",
                        width: "100%",
                        font: "inherit",
                        color: "inherit",
                      }}
                    >
                      <div className="label">
                        <div className="name">
                          {scope.label}
                          {isDefault && <span className="badge">Default</span>}
                          {isActive && !isDefault && (
                            <span className="badge">In use</span>
                          )}
                        </div>
                        <div className="meta">
                          <span>
                            {scope.compCount}{" "}
                            {scope.compCount === 1 ? "comp" : "comps"}
                          </span>
                          <span>·</span>
                          <span
                            className={`scope-conf ${
                              scope.confidence === "high"
                                ? "high"
                                : scope.confidence === "medium"
                                  ? "med"
                                  : "low"
                            }`}
                          >
                            {scope.confidence}
                          </span>
                        </div>
                      </div>
                      <div className="price">{formatPsf(scope.rentPsf)}</div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Override info, if any */}
          {row.brokerOverride && (
            <section className="panel-section">
              <div className="panel-section-title">Active override</div>
              <p>
                This lease is using {row.brokerOverride.kind === "manual"
                  ? "a manual broker estimate"
                  : "an alternate comp scope"}{" "}
                (<strong style={{ color: "var(--text)" }}>{row.brokerOverride.sourceLabel}</strong>)
                instead of the system default. Overrides flow into all aggregates and
                are saved to your account.
              </p>
              <button
                type="button"
                className="btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() => onClearOverride(row.id)}
              >
                Reset to system default
              </button>
            </section>
          )}
        </div>
      </aside>
    </>
  )
}
