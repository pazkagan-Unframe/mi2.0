"use client"

import { useEffect } from "react"
import type { Aggregate, Filters } from "@/lib/calculations"
import { formatDollars, formatPsf } from "@/lib/format"

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
  if (filters.expiryWindow) {
    const labels: Record<NonNullable<Filters["expiryWindow"]>, string> = {
      lt12: "< 12 months",
      "12to24": "12–24 months",
      "24to36": "24–36 months",
      gt36: "> 36 months",
    }
    parts.push(`expires ${labels[filters.expiryWindow]}`)
  }
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

  const scope = buildScopeLabel(filters)

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
        aria-labelledby="methodology-title"
        aria-hidden={!open}
      >
        <header className="panel-header">
          <div className="panel-eyebrow">Methodology</div>
          <h2 id="methodology-title" className="panel-title">
            How this is calculated
          </h2>
          <p className="panel-subtitle">Scope: {scope}</p>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close panel">
            ×
          </button>
        </header>

        <div className="panel-body">
          <section className="panel-section">
            <div className="panel-section-title">Source-of-truth rule</div>
            <p>
              For every lease we compare the current contractual rent against a single comparison
              rent. A broker estimate, when present, overrides our market intelligence for that
              lease. Aggregates respect the override per row.
            </p>
            <pre className="panel-formula">
              comparison = brokerEstimate ?? marketRent{"\n"}
              variance = currentRent − comparison
            </pre>
            <p style={{ marginTop: 12 }}>
              Positive variance means the lease is paying above the comparison — unfavorable for
              the tenant. Negative variance is favorable.
            </p>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">In this view</div>
            <div className="panel-stats">
              <div className="panel-stat">
                <div className="lbl">Leases</div>
                <div className="val">{agg.count}</div>
              </div>
              <div className="panel-stat">
                <div className="lbl">Total SF</div>
                <div className="val">{agg.totalSf.toLocaleString("en-US")}</div>
              </div>
              <div className="panel-stat">
                <div className="lbl">Benchmarked</div>
                <div className="val">{agg.benchmarkedCount}</div>
              </div>
              <div className="panel-stat">
                <div className="lbl">Broker estimates</div>
                <div className="val">{agg.brokerEstimateCount}</div>
              </div>
              <div className="panel-stat">
                <div className="lbl">Weighted gap</div>
                <div
                  className={`val ${
                    agg.weightedGapPsf == null
                      ? "muted"
                      : agg.weightedGapPsf > 0
                        ? "danger"
                        : "success"
                  }`}
                >
                  {agg.weightedGapPsf != null
                    ? `${formatPsf(agg.weightedGapPsf, { sign: true })}/SF`
                    : "—"}
                </div>
              </div>
              <div className="panel-stat">
                <div className="lbl">Annualized</div>
                <div
                  className={`val ${
                    agg.totalGapAnnual == null
                      ? "muted"
                      : agg.totalGapAnnual > 0
                        ? "danger"
                        : "success"
                  }`}
                >
                  {agg.totalGapAnnual != null
                    ? formatDollars(agg.totalGapAnnual, { sign: true })
                    : "—"}
                </div>
              </div>
            </div>
            <p style={{ marginTop: 12 }}>
              Headline figures and breakdowns use SF-weighted averages over benchmarked leases
              only. Unbenchmarked leases (no comp set, no broker estimate) are counted but excluded
              from gap math.
            </p>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">Market data methodology</div>
            <p>
              Comps are signed leases within the same sub-market and property type, weighted toward
              recent transactions and similar building class. The comp count shown next to each
              market rent is the number of comparable leases used to compute that lease&apos;s
              benchmark.
            </p>
            <p>Confidence levels:</p>
            <ul style={{ paddingLeft: 18, fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
              <li>
                <strong style={{ color: "var(--success)" }}>High</strong> — 8+ recent comps within
                12 months, similar building class.
              </li>
              <li>
                <strong style={{ color: "var(--warning)" }}>Medium</strong> — 4–7 comps or
                older transactions.
              </li>
              <li>
                <strong style={{ color: "var(--danger)" }}>Low</strong> — fewer than 4 comps or
                materially different building class.
              </li>
            </ul>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">Broker estimate workflow</div>
            <p>
              Type a $/SF figure into the broker column on any lease row to set your own
              assessment. Estimates are saved per broker and persist across sessions. They flow
              into all aggregates immediately and are tagged on every row that uses them.
            </p>
            <p>
              In a client meeting, the broker estimate becomes the comparison rent for that lease;
              the market figure remains visible as supporting context (struck through) so you can
              answer &ldquo;what does the data say?&rdquo; if asked.
            </p>
          </section>
        </div>
      </aside>
    </>
  )
}
