"use client"

import { useEffect } from "react"
import type { Aggregate, Filters } from "@/lib/calculations"

type Props = {
  open: boolean
  onClose: () => void
  filters: Filters
  agg: Aggregate
}

function buildScopeLabel(filters: Filters): string {
  const parts: string[] = []
  if (filters.propertyType) parts.push(filters.propertyType)
  if (filters.submarket) parts.push(filters.submarket)
  if (parts.length === 0) return "Full portfolio"
  return parts.join(" · ")
}

export function MethodologyPanel({ open, onClose, filters, agg }: Props) {
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

  if (!open) return null

  const scope = buildScopeLabel(filters)

  return (
    <div
      className="panel-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="methodology-title"
      onClick={onClose}
    >
      <aside className="panel" onClick={(e) => e.stopPropagation()}>
        <header className="panel-header">
          <div>
            <h2 id="methodology-title" className="panel-title">
              How this is calculated
            </h2>
            <p className="panel-subtitle">Scope: {scope}</p>
          </div>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="panel-body">
          <section className="panel-section">
            <h3 className="panel-section-title">Source of truth</h3>
            <p>
              For each lease, we compare the current rent against a single comparison rent. When you
              have entered a broker estimate, it overrides our market figure. When you have not, we
              use our market intelligence.
            </p>
            <pre className="panel-code">
              {`comparison = brokerEstimate ?? marketRent\nvariance = currentRent - comparison`}
            </pre>
          </section>

          <section className="panel-section">
            <h3 className="panel-section-title">Aggregates in this view</h3>
            <ul className="panel-stats">
              <li>
                <span>Leases in scope</span>
                <span className="mono">{agg.count}</span>
              </li>
              <li>
                <span>Benchmarked (have a comparison)</span>
                <span className="mono">{agg.benchmarkedCount}</span>
              </li>
              <li>
                <span>Backed by broker estimate</span>
                <span className="mono">{agg.brokerEstimateCount}</span>
              </li>
              <li>
                <span>Backed by market data</span>
                <span className="mono">
                  {agg.benchmarkedCount - agg.brokerEstimateCount}
                </span>
              </li>
              <li>
                <span>No comparison available</span>
                <span className="mono">{agg.noDataCount}</span>
              </li>
            </ul>
            <p className="panel-note">
              Headline figures use SF-weighted averages across benchmarked leases only. Aggregates
              respect broker estimates per-lease.
            </p>
          </section>

          <section className="panel-section">
            <h3 className="panel-section-title">Market data methodology</h3>
            <ul className="panel-list">
              <li>
                Comps are sourced from signed leases within the same sub-market and property type,
                weighted toward recent transactions and similar building class.
              </li>
              <li>
                Confidence reflects comp count, recency, and proximity. <em>High</em> requires at
                least 8 recent comps within 12 months. <em>Medium</em> uses 4–7 comps or older
                transactions. <em>Low</em> indicates an insufficient comp set.
              </li>
              <li>
                The comp count shown next to each market rent is the number of comparable leases
                used for that specific lease&apos;s benchmark.
              </li>
            </ul>
          </section>

          <section className="panel-section">
            <h3 className="panel-section-title">Broker estimate</h3>
            <p>
              Type a $/SF figure into the broker column on any row to override the market figure
              for that lease. Estimates are saved per broker and persist across sessions. They
              flow into all aggregates immediately.
            </p>
          </section>
        </div>
      </aside>
    </div>
  )
}
