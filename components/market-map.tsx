"use client"

import { useEffect, useMemo, useState } from "react"
import { geoAlbersUsa, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import type { LeaseRow } from "@/lib/types"

// Minimal structural types so we don't depend on @types/topojson-specification.
type TopoLike = {
  objects: Record<string, unknown>
  arcs: number[][][]
  type: string
  bbox?: number[]
  transform?: { scale: [number, number]; translate: [number, number] }
}
type StateFeature = {
  type: "Feature"
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: unknown }
}
import { formatDollars, formatPsf } from "@/lib/format"

type Props = {
  rows: LeaseRow[]
}

type SubmarketAggregate = {
  key: string
  city: string
  state: string
  lng: number
  lat: number
  count: number
  totalSf: number
  weightedGapPsf: number | null
  totalGapAnnual: number | null
  avgConfidence: "high" | "medium" | "low" | "muted"
}

type TooltipState =
  | { open: true; x: number; y: number; data: SubmarketAggregate }
  | { open: false }

const TOPO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"

export function MarketMap({ rows }: Props) {
  const [topology, setTopology] = useState<TopoLike | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({ open: false })

  useEffect(() => {
    let cancelled = false
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((data: TopoLike) => {
        if (!cancelled) setTopology(data)
      })
      .catch(() => {
        // Map will degrade gracefully to bubbles only.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const aggregates = useMemo<SubmarketAggregate[]>(() => {
    const grouped = new Map<string, LeaseRow[]>()
    for (const r of rows) {
      const list = grouped.get(r.submarket) ?? []
      list.push(r)
      grouped.set(r.submarket, list)
    }
    const result: SubmarketAggregate[] = []
    for (const [key, list] of grouped.entries()) {
      const totalSf = list.reduce((s, r) => s + r.sf, 0)
      const benchmarked = list.filter((r) => r.comparisonPsf != null)
      const benchmarkedSf = benchmarked.reduce((s, r) => s + r.sf, 0)

      const weightedAvgCurrent =
        benchmarkedSf > 0
          ? benchmarked.reduce((s, r) => s + r.currentRentPsf * r.sf, 0) / benchmarkedSf
          : null
      const weightedAvgComparison =
        benchmarkedSf > 0
          ? benchmarked.reduce((s, r) => s + (r.comparisonPsf as number) * r.sf, 0) / benchmarkedSf
          : null
      const weightedGap =
        weightedAvgCurrent != null && weightedAvgComparison != null
          ? weightedAvgCurrent - weightedAvgComparison
          : null
      const totalGap = benchmarked.length
        ? benchmarked.reduce((s, r) => s + (r.varianceAnnual ?? 0), 0)
        : null

      // Average lng/lat across leases in the sub-market (close enough for plotting).
      const lng = list.reduce((s, r) => s + r.lng, 0) / list.length
      const lat = list.reduce((s, r) => s + r.lat, 0) / list.length

      // Average confidence — pick worst of the rows (so high requires all-high).
      let avgConfidence: SubmarketAggregate["avgConfidence"] = "muted"
      const confs = benchmarked.map((r) =>
        r.comparisonSource === "broker" ? "high" : r.marketConfidence,
      )
      if (confs.length > 0) {
        if (confs.every((c) => c === "high")) avgConfidence = "high"
        else if (confs.every((c) => c === "high" || c === "medium")) avgConfidence = "medium"
        else avgConfidence = "low"
      }

      result.push({
        key,
        city: list[0].city,
        state: list[0].state,
        lng,
        lat,
        count: list.length,
        totalSf,
        weightedGapPsf: weightedGap,
        totalGapAnnual: totalGap,
        avgConfidence,
      })
    }
    return result
  }, [rows])

  const width = 920
  const height = 420

  const projection = useMemo(
    () =>
      geoAlbersUsa()
        .scale(1100)
        .translate([width / 2, height / 2]),
    [],
  )

  const path = useMemo(() => geoPath(projection), [projection])

  const stateFeatures = useMemo(() => {
    if (!topology) return null
    // d3 feature() takes a topology and a geometry object; we pass through unknown to avoid
    // depending on @types/topojson-specification.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc = feature(topology as any, (topology.objects as any).states) as unknown as {
      features: StateFeature[]
    }
    return fc.features
  }, [topology])

  // Project sub-market coordinates and filter out any that fall outside the US.
  const points = useMemo(
    () =>
      aggregates
        .map((a) => {
          const projected = projection([a.lng, a.lat])
          return projected ? { agg: a, x: projected[0], y: projected[1] } : null
        })
        .filter((p): p is { agg: SubmarketAggregate; x: number; y: number } => p !== null),
    [aggregates, projection],
  )

  const maxCount = Math.max(1, ...points.map((p) => p.agg.count))

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">Geographic distribution</div>
        <div className="card-actions">
          <span>Bubble size = lease count · color = position vs market</span>
        </div>
      </header>
      <div className="map-wrap">
        <svg
          className="map-svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="US map of sub-markets"
        >
          {stateFeatures &&
            stateFeatures.map((f, i) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = path(f as any)
              return d ? <path key={i} className="map-state" d={d} /> : null
            })}

          {points.map(({ agg, x, y }) => {
            const tone =
              agg.weightedGapPsf == null
                ? "muted"
                : agg.weightedGapPsf > 0.5
                  ? "danger"
                  : agg.weightedGapPsf < -0.5
                    ? "success"
                    : "info"
            const fill =
              tone === "danger"
                ? "#A32D2D"
                : tone === "success"
                  ? "#0F6E56"
                  : tone === "info"
                    ? "#185FA5"
                    : "#888780"
            const r = 8 + (agg.count / maxCount) * 20

            return (
              <g
                key={agg.key}
                className="map-pin"
                onMouseEnter={(e) =>
                  setTooltip({
                    open: true,
                    x: e.clientX,
                    y: e.clientY,
                    data: agg,
                  })
                }
                onMouseMove={(e) =>
                  setTooltip({
                    open: true,
                    x: e.clientX,
                    y: e.clientY,
                    data: agg,
                  })
                }
                onMouseLeave={() => setTooltip({ open: false })}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={fill}
                  fillOpacity={0.85}
                  stroke="white"
                  strokeWidth={1.5}
                />
                <text x={x} y={y} className="map-pin-label">
                  {agg.count}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="map-legend">
          <div className="map-legend-item">
            <span className="dot" style={{ background: "#A32D2D" }} />
            <span>Above market</span>
          </div>
          <div className="map-legend-item">
            <span className="dot" style={{ background: "#0F6E56" }} />
            <span>Below market</span>
          </div>
          <div className="map-legend-item">
            <span className="dot" style={{ background: "#185FA5" }} />
            <span>Aligned</span>
          </div>
          <div className="map-legend-item">
            <span className="dot" style={{ background: "#888780" }} />
            <span>No comparison</span>
          </div>
        </div>

        {tooltip.open && <Tooltip state={tooltip} />}

        {points.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-3)",
              fontSize: 13,
            }}
          >
            No leases in scope
          </div>
        )}
      </div>
    </section>
  )
}

function Tooltip({
  state,
}: {
  state: { open: true; x: number; y: number; data: SubmarketAggregate }
}) {
  const { x, y, data } = state
  // Position above-right of the cursor, with viewport clamping.
  const offset = 16
  const tooltipWidth = 260
  const tooltipHeight = 180
  let left = x + offset
  let top = y - tooltipHeight - offset / 2
  if (left + tooltipWidth > window.innerWidth - 12) left = x - tooltipWidth - offset
  if (top < 12) top = y + offset

  const tone =
    data.weightedGapPsf == null
      ? "muted"
      : data.weightedGapPsf > 0.5
        ? "danger"
        : data.weightedGapPsf < -0.5
          ? "success"
          : "warning"

  return (
    <div className="map-tooltip" style={{ left, top }}>
      <div className="map-tooltip-title">{data.key}</div>
      <div className="map-tooltip-meta">
        {data.city}, {data.state} · {data.count} {data.count === 1 ? "lease" : "leases"} ·{" "}
        {data.totalSf.toLocaleString("en-US")} SF
      </div>
      <div className="map-tooltip-row">
        <span className="label">Weighted gap</span>
        <span className={`value ${tone}`}>
          {data.weightedGapPsf != null ? `${formatPsf(data.weightedGapPsf, { sign: true })}/SF` : "—"}
        </span>
      </div>
      <div className="map-tooltip-row">
        <span className="label">Annual impact</span>
        <span className={`value ${tone}`}>
          {data.totalGapAnnual != null ? formatDollars(data.totalGapAnnual, { sign: true }) : "—"}
        </span>
      </div>
      <div className="map-tooltip-divider" />
      <div className="map-tooltip-row">
        <span className="label">Confidence</span>
        <span className="value">{data.avgConfidence}</span>
      </div>
    </div>
  )
}
