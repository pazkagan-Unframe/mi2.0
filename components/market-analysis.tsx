"use client"

/**
 * Market analysis section — twelve read-only widgets summarising the markets
 * the broker's portfolio touches. Where the lease dataset has the answer
 * (size buckets, top submarkets, recent leases) we derive from `rows`. The
 * remaining widgets (vacancy trend, supply/demand, construction delivered,
 * asking-vs-achieved rent, building class mix) are not in the lease schema,
 * so they're rendered from deterministic synthetic series seeded on the
 * portfolio scope. That keeps the wireframe meaningful without inventing
 * fake dependencies.
 *
 * All charts are inline SVG — no chart library — so the section adds no
 * runtime weight and stays consistent with the existing card primitives.
 */

import { useMemo, useState } from "react"
import type { LeaseRow } from "@/lib/types"
import { formatDollars } from "@/lib/format"

type Props = {
  rows: LeaseRow[]
  /**
   * Optional override for the synthetic-series seed and scope label. When the
   * scope includes "comparable" markets that have no leases, `rows` alone
   * doesn't reflect them — passing the explicit market keys lets vacancy /
   * supply / construction / etc. respond to those additions.
   */
  marketKeys?: string[]
}

// ---------------- shared helpers ----------------

/** FNV-ish deterministic hash → [0, 1). Used to seed synthetic series. */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function jitter(seed: string, base: number, spread: number): number {
  return base + (hash01(seed) - 0.5) * 2 * spread
}

const SIZE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "< 5K SF", min: 0, max: 5_000 },
  { label: "5 – 10K", min: 5_000, max: 10_000 },
  { label: "10 – 25K", min: 10_000, max: 25_000 },
  { label: "25 – 50K", min: 25_000, max: 50_000 },
  { label: "50 – 100K", min: 50_000, max: 100_000 },
  { label: "100K+", min: 100_000, max: Infinity },
]

const QUARTERS = ["2024 Q2", "2024 Q3", "2024 Q4", "2025 Q1", "2025 Q2", "2025 Q3", "2025 Q4", "2026 Q1"]
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

// ---------------- root ----------------

export function MarketAnalysis({ rows, marketKeys }: Props) {
  const submarkets = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.submarket, (m.get(r.submarket) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  // Prefer an explicit market list (so added "comparable" markets affect
  // synthetic series even though they carry no leases). Fall back to the
  // submarkets pulled from rows.
  const marketCount = marketKeys?.length ?? submarkets.length
  const scopeLabel =
    marketCount === 0
      ? "No markets"
      : marketCount === 1
        ? (marketKeys?.[0] ?? submarkets[0][0])
        : `${marketCount} markets`

  const seed =
    marketKeys && marketKeys.length > 0
      ? marketKeys.slice().sort().join("|")
      : submarkets.slice(0, 5).map((s) => s[0]).join("|") || "default"

  // Allow rendering with no rows when the user has selected only added
  // markets — synthetic widgets still produce useful context.
  if (rows.length === 0 && (!marketKeys || marketKeys.length === 0)) {
    return (
      <section className="card">
        <header className="card-header">
          <div className="card-title">Market analysis</div>
        </header>
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          No markets in scope — adjust filters to see market widgets.
        </div>
      </section>
    )
  }

  return (
    <section className="card">
      <header className="card-header">
        <div>
          <div className="card-title">Market analysis</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
            Scoped to {scopeLabel} — based on the leases currently in view.
          </div>
        </div>
      </header>

      <div className="ma-grid">
        <WidgetAvailabilityBySize rows={rows} scope={scopeLabel} seed={seed} />
        <WidgetLeasesBySize rows={rows} scope={scopeLabel} />
        <WidgetTopSubmarkets submarkets={submarkets} scope={scopeLabel} />
        <WidgetConstructionByYear scope={scopeLabel} seed={seed} />
        <WidgetSupplyDemand scope={scopeLabel} seed={seed} />
        <WidgetVacancyTrend scope={scopeLabel} seed={seed} />
        <WidgetTopRecentLeases rows={rows} />
        <WidgetTopAvailable rows={rows} seed={seed} />
        <WidgetAvailabilityByClass scope={scopeLabel} seed={seed} />
        <WidgetAskingAchievedRent scope={scopeLabel} seed={seed} />
        <WidgetQuarterlyLeasing scope={scopeLabel} seed={seed} />
        <WidgetRentByClass scope={scopeLabel} seed={seed} />
      </div>
    </section>
  )
}

// ---------------- chart primitives ----------------

function MaCard({
  title,
  scope,
  children,
}: {
  title: string
  scope?: string
  children: React.ReactNode
}) {
  return (
    <div className="ma-card">
      <div className="ma-card-header">
        <div className="ma-card-title">
          {title}
          {scope ? <span className="ma-card-scope"> — {scope}</span> : null}
        </div>
      </div>
      <div className="ma-card-body">{children}</div>
    </div>
  )
}

/** Horizontal bar list — one row per category. */
function HBarList({
  data,
  unit,
  color = "var(--info)",
  format,
}: {
  data: { label: string; value: number }[]
  unit: string
  color?: string
  format?: (n: number) => string
}) {
  const max = Math.max(0.0001, ...data.map((d) => d.value))
  const fmt = format ?? ((n: number) => n.toLocaleString("en-US"))
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="ma-hbars">
      {data.map((d) => {
        const share = total > 0 ? (d.value / total) * 100 : 0
        const tip = `${d.label} — ${fmt(d.value)} ${unit}${
          total > 0 ? ` (${share.toFixed(1)}% of total)` : ""
        }`
        return (
          <div key={d.label} className="ma-hbar-row" title={tip}>
            <div className="ma-hbar-label">{d.label}</div>
            <div className="ma-hbar-track">
              <div
                className="ma-hbar-fill"
                style={{ width: `${(d.value / max) * 100}%`, background: color }}
              />
            </div>
            <div className="ma-hbar-value mono">
              {fmt(d.value)}
              <span className="ma-unit"> {unit}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Multi-series line / area chart on a shared X axis. */
function LineChart({
  series,
  xLabels,
  yFormat,
  height = 180,
  fillFirst = false,
}: {
  series: { name: string; values: number[]; color: string }[]
  xLabels: string[]
  yFormat?: (n: number) => string
  height?: number
  fillFirst?: boolean
}) {
  const W = 600
  const H = height
  const PAD_L = 40
  const PAD_R = 12
  const PAD_T = 10
  const PAD_B = 26
  const all = series.flatMap((s) => s.values)
  const yMax = Math.max(0.0001, ...all)
  const yMin = Math.min(0, ...all)
  const xN = xLabels.length
  const x = (i: number) =>
    PAD_L + (i / Math.max(1, xN - 1)) * (W - PAD_L - PAD_R)
  const y = (v: number) =>
    PAD_T + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD_T - PAD_B)
  const yTicks = 4
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) =>
    yMin + ((yMax - yMin) * i) / yTicks,
  )
  const fmt = yFormat ?? ((n) => n.toFixed(1))

  // Hovered x-index drives a vertical guide and an HTML overlay tooltip
  // listing every series' value at that index. The overlay is positioned
  // using the SVG's percentage-of-width so it lines up regardless of the
  // chart's actual rendered width.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const hitWidth = (W - PAD_L - PAD_R) / Math.max(1, xN - 1)

  return (
    <div className="ma-chart-wrap">
      <div className="ma-chart-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="ma-svg">
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PAD_L - 6}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="ma-axis"
              >
                {fmt(t)}
              </text>
            </g>
          ))}
          {series.map((s, si) => {
            const linePath = s.values
              .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
              .join(" ")
            const areaPath =
              fillFirst && si === 0
                ? `${linePath} L ${x(s.values.length - 1)} ${y(yMin)} L ${x(0)} ${y(yMin)} Z`
                : null
            return (
              <g key={s.name}>
                {areaPath && (
                  <path d={areaPath} fill={s.color} fillOpacity={0.12} />
                )}
                <path
                  d={linePath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {s.values.map((v, i) => (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(v)}
                    r={hoverIdx === i ? 4 : 2.5}
                    fill={s.color}
                  />
                ))}
              </g>
            )
          })}
          {hoverIdx !== null && (
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={PAD_T}
              y2={H - PAD_B}
              stroke="var(--text-3)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          )}
          {xLabels.map((label, i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="ma-axis"
            >
              {label}
            </text>
          ))}
          {/* Invisible hit zones — one per x-index — capture pointer position. */}
          {xLabels.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={x(i) - hitWidth / 2}
              y={PAD_T}
              width={hitWidth}
              height={H - PAD_T - PAD_B}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() =>
                setHoverIdx((cur) => (cur === i ? null : cur))
              }
              style={{ cursor: "crosshair" }}
            />
          ))}
        </svg>
        {hoverIdx !== null && (
          <div
            className="ma-tooltip"
            style={{
              left: `${(x(hoverIdx) / W) * 100}%`,
            }}
            role="presentation"
          >
            <div className="ma-tip-title">{xLabels[hoverIdx]}</div>
            {series.map((s) => (
              <div key={s.name} className="ma-tip-row">
                <span className="ma-tip-lbl">
                  <span
                    className="ma-swatch"
                    style={{ background: s.color }}
                  />
                  {s.name}
                </span>
                <span className="ma-tip-val mono">
                  {fmt(s.values[hoverIdx])}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <div className="ma-legend">
          {series.map((s) => (
            <span key={s.name} className="ma-legend-item">
              <span className="ma-swatch" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Donut chart (used for building-class mix). */
function Donut({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[]
  total: number
}) {
  const R = 72
  const r = 44
  const cx = 100
  const cy = 100
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  let cum = 0
  const arcs = segments.map((s) => {
    const start = cum / total
    cum += s.value
    const end = cum / total
    const a0 = start * Math.PI * 2 - Math.PI / 2
    const a1 = end * Math.PI * 2 - Math.PI / 2
    const large = end - start > 0.5 ? 1 : 0
    const x0 = cx + Math.cos(a0) * R
    const y0 = cy + Math.sin(a0) * R
    const x1 = cx + Math.cos(a1) * R
    const y1 = cy + Math.sin(a1) * R
    const ix0 = cx + Math.cos(a0) * r
    const iy0 = cy + Math.sin(a0) * r
    const ix1 = cx + Math.cos(a1) * r
    const iy1 = cy + Math.sin(a1) * r
    const d = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix0} ${iy0} Z`
    return { d, ...s }
  })
  const focus = hoverIdx === null ? null : segments[hoverIdx]
  const focusShare = focus ? (focus.value / total) * 100 : 0
  return (
    <div className="ma-donut-wrap">
      <div className="ma-donut-svg-wrap">
        <svg viewBox="0 0 200 200" className="ma-donut">
          {arcs.map((a, i) => (
            <path
              key={a.label}
              d={a.d}
              fill={a.color}
              opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.4}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() =>
                setHoverIdx((cur) => (cur === i ? null : cur))
              }
              style={{ cursor: "pointer", transition: "opacity 0.12s ease" }}
            />
          ))}
          <text x={100} y={97} textAnchor="middle" className="ma-donut-total">
            {focus ? focus.value.toFixed(2) : total.toFixed(2)}
          </text>
          <text x={100} y={114} textAnchor="middle" className="ma-donut-unit">
            {focus ? `${focusShare.toFixed(1)}%` : "MMSF"}
          </text>
        </svg>
        {focus && (
          <div className="ma-tooltip ma-tooltip-static" role="presentation">
            <div className="ma-tip-title">{focus.label}</div>
            <div className="ma-tip-row">
              <span className="ma-tip-lbl">
                <span className="ma-swatch" style={{ background: focus.color }} />
                Availability
              </span>
              <span className="ma-tip-val mono">
                {focus.value.toFixed(2)} MMSF
              </span>
            </div>
            <div className="ma-tip-row">
              <span className="ma-tip-lbl">Share</span>
              <span className="ma-tip-val mono">{focusShare.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
      <ul className="ma-donut-legend">
        {segments.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() =>
              setHoverIdx((cur) => (cur === i ? null : cur))
            }
            style={{ cursor: "pointer" }}
          >
            <span className="ma-swatch" style={{ background: s.color }} />
            <span className="ma-donut-name">{s.label}</span>
            <span className="mono ma-donut-val">{s.value.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------- widgets ----------------

function WidgetAvailabilityBySize({
  rows,
  scope,
  seed,
}: {
  rows: LeaseRow[]
  scope: string
  seed: string
}) {
  // Derive availability MMSF per bucket from total lease SF × a synthetic
  // availability rate per bucket that's stable for a given portfolio scope.
  const data = SIZE_BUCKETS.map((b, i) => {
    const sf = rows
      .filter((r) => r.sf >= b.min && r.sf < b.max)
      .reduce((s, r) => s + r.sf, 0)
    const rate = 0.06 + hash01(`${seed}|avail|${i}`) * 0.18
    return { label: b.label, value: (sf * rate) / 1_000_000 }
  })
  return (
    <MaCard title="Availability area by size" scope={scope}>
      <HBarList
        data={data}
        unit="MMSF"
        color="var(--info)"
        format={(n) => n.toFixed(2)}
      />
    </MaCard>
  )
}

function WidgetLeasesBySize({ rows, scope }: { rows: LeaseRow[]; scope: string }) {
  const data = SIZE_BUCKETS.map((b) => ({
    label: b.label,
    value: rows.filter((r) => r.sf >= b.min && r.sf < b.max).length,
  }))
  return (
    <MaCard title="Total lease count by size" scope={scope}>
      <HBarList data={data} unit="leases" color="var(--accent)" />
    </MaCard>
  )
}

function WidgetTopSubmarkets({
  submarkets,
  scope,
}: {
  submarkets: [string, number][]
  scope: string
}) {
  const data = submarkets.slice(0, 7).map(([name, count]) => ({
    label: name,
    value: count,
  }))
  return (
    <MaCard title="Top submarkets by lease count" scope={scope}>
      <HBarList data={data} unit="leases" color="var(--info)" />
    </MaCard>
  )
}

function WidgetConstructionByYear({ scope, seed }: { scope: string; seed: string }) {
  const values = YEARS.map((y) => Math.max(0.05, jitter(`${seed}|cons|${y}`, 0.6, 0.45)))
  return (
    <MaCard title="Construction delivered" scope={scope}>
      <LineChart
        series={[{ name: "Delivered MMSF", values, color: "var(--info)" }]}
        xLabels={YEARS.map(String)}
        yFormat={(n) => n.toFixed(1)}
        fillFirst
      />
    </MaCard>
  )
}

function WidgetSupplyDemand({ scope, seed }: { scope: string; seed: string }) {
  const xs = [2021, 2022, 2023, 2024, 2025, 2026]
  const supply = xs.map((y) => Math.max(0.4, jitter(`${seed}|sup|${y}`, 1.6, 1.0)))
  const demand = xs.map((y) => Math.max(0.4, jitter(`${seed}|dem|${y}`, 1.8, 0.9)))
  return (
    <MaCard title="Supply vs demand" scope={scope}>
      <LineChart
        series={[
          { name: "Supply MMSF", values: supply, color: "var(--info)" },
          { name: "Demand MMSF", values: demand, color: "var(--warning)" },
        ]}
        xLabels={xs.map(String)}
        yFormat={(n) => n.toFixed(1)}
      />
    </MaCard>
  )
}

function WidgetVacancyTrend({ scope, seed }: { scope: string; seed: string }) {
  const values = QUARTERS.map((q) =>
    Math.max(0.1, jitter(`${seed}|vac|${q}`, 0.7, 0.55)),
  )
  return (
    <MaCard title="Vacancy trend" scope={scope}>
      <LineChart
        series={[{ name: "Vacancy %", values, color: "var(--info)" }]}
        xLabels={QUARTERS}
        yFormat={(n) => `${n.toFixed(1)}%`}
        fillFirst
      />
    </MaCard>
  )
}

function WidgetTopRecentLeases({ rows }: { rows: LeaseRow[] }) {
  const top = [...rows]
    .sort((a, b) => b.sf - a.sf)
    .slice(0, 5)
  return (
    <MaCard title="Top recent leases">
      <table className="ma-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Submarket</th>
            <th className="num">SF</th>
            <th className="num">Rent / SF</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r) => (
            <tr key={r.id}>
              <td>{r.tenant}</td>
              <td>{r.submarket}</td>
              <td className="num mono">{r.sf.toLocaleString("en-US")}</td>
              <td className="num mono">${r.currentRentPsf.toFixed(2)}</td>
              <td>{r.propertyType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </MaCard>
  )
}

function WidgetTopAvailable({ rows, seed }: { rows: LeaseRow[]; seed: string }) {
  // Pick 5 leases deterministically and recast as "available spaces".
  const pool = [...rows].sort((a, b) =>
    hash01(`${seed}|av|${a.id}`) - hash01(`${seed}|av|${b.id}`),
  )
  const top = pool.slice(0, 5)
  return (
    <MaCard title="Top available spaces">
      <table className="ma-table">
        <thead>
          <tr>
            <th>Address</th>
            <th>Submarket</th>
            <th className="num">SF</th>
            <th className="num">Rent / SF</th>
            <th>Class</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r, i) => {
            const cls = ["A", "A", "B", "B", "C"][i] ?? "B"
            return (
              <tr key={r.id}>
                <td>{r.address}</td>
                <td>{r.submarket}</td>
                <td className="num mono">{r.sf.toLocaleString("en-US")}</td>
                <td className="num mono">
                  ${(r.currentRentPsf * (0.92 + hash01(`${seed}|q|${r.id}`) * 0.2)).toFixed(2)}
                </td>
                <td>{cls}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </MaCard>
  )
}

function WidgetAvailabilityByClass({ scope, seed }: { scope: string; seed: string }) {
  // Class mix biased toward "Other" (consistent with the source design).
  const totals = {
    A: 0.6 + hash01(`${seed}|cA`) * 0.4,
    B: 0.18 + hash01(`${seed}|cB`) * 0.15,
    C: 0.18 + hash01(`${seed}|cC`) * 0.15,
    Other: 2.4 + hash01(`${seed}|cO`) * 1.6,
  }
  const sum = totals.A + totals.B + totals.C + totals.Other
  const segments = [
    { label: "Other", value: totals.Other, color: "var(--info)" },
    { label: "Class A", value: totals.A, color: "var(--accent)" },
    { label: "Class B", value: totals.B, color: "var(--success)" },
    { label: "Class C", value: totals.C, color: "var(--warning)" },
  ]
  return (
    <MaCard title="Availability by building class" scope={scope}>
      <Donut segments={segments} total={sum} />
    </MaCard>
  )
}

function WidgetAskingAchievedRent({ scope, seed }: { scope: string; seed: string }) {
  const asking = QUARTERS.map((q) => jitter(`${seed}|ask|${q}`, 24, 2.5))
  const achieved = QUARTERS.map((q) => jitter(`${seed}|ach|${q}`, 23, 2.5))
  return (
    <MaCard title="Asking vs achieved rent" scope={scope}>
      <LineChart
        series={[
          { name: "Asking $/SF", values: asking, color: "var(--info)" },
          { name: "Achieved $/SF", values: achieved, color: "var(--warning)" },
        ]}
        xLabels={QUARTERS}
        yFormat={(n) => `$${n.toFixed(0)}`}
      />
    </MaCard>
  )
}

function WidgetQuarterlyLeasing({ scope, seed }: { scope: string; seed: string }) {
  const values = QUARTERS.map((q) => Math.max(0.1, jitter(`${seed}|ql|${q}`, 0.5, 0.3)))
  return (
    <MaCard title="Quarterly leasing volume" scope={scope}>
      <LineChart
        series={[{ name: "Leased MMSF", values, color: "var(--info)" }]}
        xLabels={QUARTERS}
        yFormat={(n) => n.toFixed(2)}
        fillFirst
      />
    </MaCard>
  )
}

function WidgetRentByClass({ scope, seed }: { scope: string; seed: string }) {
  const data: { label: string; asking: number; achieved: number }[] = [
    { label: "A", asking: jitter(`${seed}|cra|a`, 28, 2), achieved: jitter(`${seed}|crh|a`, 27, 2) },
    { label: "B", asking: jitter(`${seed}|cra|b`, 22, 2), achieved: jitter(`${seed}|crh|b`, 21, 2) },
    { label: "C", asking: jitter(`${seed}|cra|c`, 18, 2), achieved: jitter(`${seed}|crh|c`, 17, 2) },
  ]
  const max = Math.max(...data.flatMap((d) => [d.asking, d.achieved]))
  return (
    <MaCard title="Asking & achieved rent by class" scope={scope}>
      <div className="ma-grouped-bars">
        {data.map((d) => {
          const gap = d.asking - d.achieved
          const gapPct = d.asking > 0 ? (gap / d.asking) * 100 : 0
          return (
            <div key={d.label} className="ma-grouped-row">
              <div className="ma-grouped-label">Class {d.label}</div>
              <div className="ma-grouped-stack">
                <div
                  className="ma-grouped-pair"
                  title={`Class ${d.label} · Asking $${d.asking.toFixed(0)}/SF — gap to achieved ${gapPct.toFixed(1)}%`}
                >
                  <div className="ma-grouped-name">Asking</div>
                  <div className="ma-grouped-track">
                    <div
                      className="ma-grouped-fill"
                      style={{
                        width: `${(d.asking / max) * 100}%`,
                        background: "var(--info)",
                      }}
                    />
                  </div>
                  <div className="ma-grouped-val mono">${d.asking.toFixed(0)}</div>
                </div>
                <div
                  className="ma-grouped-pair"
                  title={`Class ${d.label} · Achieved $${d.achieved.toFixed(0)}/SF — ${gapPct.toFixed(1)}% below asking`}
                >
                <div className="ma-grouped-name">Achieved</div>
                <div className="ma-grouped-track">
                  <div
                    className="ma-grouped-fill"
                    style={{
                      width: `${(d.achieved / max) * 100}%`,
                      background: "var(--warning)",
                    }}
                  />
                </div>
                <div className="ma-grouped-val mono">${d.achieved.toFixed(0)}</div>
              </div>
            </div>
          </div>
          )
        })}
      </div>
    </MaCard>
  )
}

// Reference unused import so tree-shaking keeps formatDollars available if
// future widgets need it; harmless no-op.
void formatDollars
