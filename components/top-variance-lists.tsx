import type { LeaseRow } from "@/lib/types"
import { formatDollars, formatPsf } from "@/lib/format"

type Props = {
  rows: LeaseRow[]
  onLeaseClick?: (leaseId: string) => void
}

/**
 * Two cards highlighting where the portfolio is most off market:
 *  - "Paying the most over market" (current > market, biggest annual $ gap)
 *  - "Paying the most under market" (current < market, biggest annual $ saving)
 *
 * Each row is clickable and opens the lease detail panel.
 */
export function TopVarianceLists({ rows, onLeaseClick }: Props) {
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
      <ListCard
        title="Paying the most over market"
        subtitle="Largest annual $ gap where current rent is above the market comp"
        rows={above}
        maxAbs={maxAbs}
        tone="danger"
        onLeaseClick={onLeaseClick}
      />
      <ListCard
        title="Paying the most under market"
        subtitle="Largest annual $ savings where current rent is below the market comp"
        rows={below}
        maxAbs={maxAbs}
        tone="success"
        onLeaseClick={onLeaseClick}
      />
    </div>
  )
}

function ListCard({
  title,
  subtitle,
  rows,
  maxAbs,
  tone,
  onLeaseClick,
}: {
  title: string
  subtitle: string
  rows: LeaseRow[]
  maxAbs: number
  tone: "danger" | "success"
  onLeaseClick?: (leaseId: string) => void
}) {
  return (
    <section className="card">
      <header className="card-header">
        <div>
          <div className="card-title">{title}</div>
          <div
            className="card-actions"
            style={{ marginTop: 2, display: "block" }}
          >
            {subtitle}
          </div>
        </div>
      </header>
      <div className="card-body">
        {rows.length === 0 ? (
          <div className="list-empty">None in the current scope.</div>
        ) : (
          rows.map((r) => {
            const ratio = Math.min(1, Math.abs(r.varianceAnnual ?? 0) / maxAbs)
            const Wrapper: React.ElementType = onLeaseClick ? "button" : "div"
            const wrapperProps = onLeaseClick
              ? {
                  type: "button" as const,
                  onClick: () => onLeaseClick(r.id),
                  className: "list-item clickable",
                  "aria-label": `Open detail for ${r.address}`,
                }
              : { className: "list-item" }
            return (
              <Wrapper key={r.id} {...wrapperProps}>
                <div>
                  <div className="list-item-name">{r.address}</div>
                  <div className="list-item-meta">
                    {r.propertyType} · {r.submarket} ·{" "}
                    {r.sf.toLocaleString("en-US")} SF
                    {(r.comparisonSource === "broker" ||
                      r.comparisonSource === "scope-override") && (
                      <>
                        {" · "}
                        <span style={{ color: "var(--accent)", fontWeight: 500 }}>
                          {r.comparisonSource === "broker"
                            ? "broker estimate"
                            : "alternate scope"}
                        </span>
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
              </Wrapper>
            )
          })
        )}
      </div>
    </section>
  )
}
