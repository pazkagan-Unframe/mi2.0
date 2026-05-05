import type { LeaseRow } from "@/lib/types"
import { formatDollars, formatPsf } from "@/lib/format"

type Props = {
  rows: LeaseRow[]
}

/**
 * Two cards: top-5 above market, top-5 below market, ranked by absolute annual $ impact.
 * Purely informational — does not filter the page. Each entry shows the address, sub-market,
 * variance $/SF and annualized $.
 */
export function TopVarianceLists({ rows }: Props) {
  const benched = rows.filter((r) => r.variancePsf != null)

  const above = [...benched]
    .filter((r) => (r.variancePsf as number) > 0)
    .sort((a, b) => (b.varianceAnnual ?? 0) - (a.varianceAnnual ?? 0))
    .slice(0, 5)

  const below = [...benched]
    .filter((r) => (r.variancePsf as number) < 0)
    .sort((a, b) => (a.varianceAnnual ?? 0) - (b.varianceAnnual ?? 0))
    .slice(0, 5)

  const maxAbs = Math.max(
    0.01,
    ...above.map((r) => Math.abs(r.varianceAnnual ?? 0)),
    ...below.map((r) => Math.abs(r.varianceAnnual ?? 0)),
  )

  return (
    <div className="row split-50-50">
      <ListCard title="Largest above-market exposure" rows={above} maxAbs={maxAbs} tone="danger" />
      <ListCard title="Largest below-market savings" rows={below} maxAbs={maxAbs} tone="success" />
    </div>
  )
}

function ListCard({
  title,
  rows,
  maxAbs,
  tone,
}: {
  title: string
  rows: LeaseRow[]
  maxAbs: number
  tone: "danger" | "success"
}) {
  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">{title}</div>
        <div className="card-actions">By annualized $ impact</div>
      </header>
      <div className="card-body">
        {rows.length === 0 ? (
          <div className="list-empty">None in the current scope.</div>
        ) : (
          rows.map((r) => {
            const ratio = Math.min(1, Math.abs(r.varianceAnnual ?? 0) / maxAbs)
            return (
              <div className="list-item" key={r.id}>
                <div>
                  <div className="list-item-name">{r.address}</div>
                  <div className="list-item-meta">
                    {r.propertyType} · {r.submarket} · {r.sf.toLocaleString("en-US")} SF
                    {r.comparisonSource === "broker" && (
                      <>
                        {" · "}
                        <span style={{ color: "var(--accent)", fontWeight: 500 }}>broker estimate</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="list-item-bar-wrap">
                  <div className="list-item-bar">
                    <div className={`fill ${tone}`} style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <div className={`list-item-val ${tone}`}>
                    {formatPsf(r.variancePsf, { sign: true })}
                    <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 400 }}>
                      {formatDollars(r.varianceAnnual, { sign: true })}/yr
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
