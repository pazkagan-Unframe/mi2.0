"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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

type ViewBox = { x: number; y: number; w: number; h: number }

const TOPO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"
const BASE_WIDTH = 920
const BASE_HEIGHT = 420
const MIN_ZOOM = 1
const MAX_ZOOM = 6

export function MarketMap({ rows }: Props) {
  const [topology, setTopology] = useState<TopoLike | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({ open: false })

  const initialView: ViewBox = { x: 0, y: 0, w: BASE_WIDTH, h: BASE_HEIGHT }
  const [view, setView] = useState<ViewBox>(initialView)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{
    startClientX: number
    startClientY: number
    startView: ViewBox
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((data: TopoLike) => {
        if (!cancelled) setTopology(data)
      })
      .catch(() => {})
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

      const lng = list.reduce((s, r) => s + r.lng, 0) / list.length
      const lat = list.reduce((s, r) => s + r.lat, 0) / list.length

      let avgConfidence: SubmarketAggregate["avgConfidence"] = "muted"
      const confs = benchmarked.map((r) =>
        r.comparisonSource === "broker" || r.comparisonSource === "scope-override"
          ? "high"
          : r.marketConfidence,
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

  const projection = useMemo(
    () =>
      geoAlbersUsa()
        .scale(1100)
        .translate([BASE_WIDTH / 2, BASE_HEIGHT / 2]),
    [],
  )

  const path = useMemo(() => geoPath(projection), [projection])

  const stateFeatures = useMemo(() => {
    if (!topology) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc = feature(topology as any, (topology.objects as any).states) as unknown as {
      features: StateFeature[]
    }
    return fc.features
  }, [topology])

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

  // Current zoom level relative to base view (used to keep bubble sizes constant
  // visually as the user zooms in).
  const zoom = BASE_WIDTH / view.w

  const clampView = (v: ViewBox): ViewBox => {
    // Don't allow zooming out past the base view.
    const w = Math.min(BASE_WIDTH, Math.max(BASE_WIDTH / MAX_ZOOM, v.w))
    const h = Math.min(BASE_HEIGHT, Math.max(BASE_HEIGHT / MAX_ZOOM, v.h))
    // Keep the view inside [0, BASE_WIDTH] × [0, BASE_HEIGHT].
    const x = Math.min(Math.max(0, v.x), BASE_WIDTH - w)
    const y = Math.min(Math.max(0, v.y), BASE_HEIGHT - h)
    return { x, y, w, h }
  }

  const zoomBy = (factor: number, centerScreen?: { cx: number; cy: number }) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // Convert centerScreen (or the rect center) to viewBox coords.
    const cx = centerScreen?.cx ?? rect.left + rect.width / 2
    const cy = centerScreen?.cy ?? rect.top + rect.height / 2
    const px = ((cx - rect.left) / rect.width) * view.w + view.x
    const py = ((cy - rect.top) / rect.height) * view.h + view.y

    const newW = view.w / factor
    const newH = view.h / factor
    // Keep (px,py) under the cursor.
    const newX = px - ((cx - rect.left) / rect.width) * newW
    const newY = py - ((cy - rect.top) / rect.height) * newH
    setView(clampView({ x: newX, y: newY, w: newW, h: newH }))
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Only left mouse / primary touch.
    if (e.button !== 0 && e.pointerType === "mouse") return
    const target = e.target as Element
    // If clicking on a pin, don't start a drag.
    if (target.closest("g.map-pin")) return
    e.preventDefault()
    ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startView: view,
    }
    setIsDragging(true)
    setTooltip({ open: false })
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // Convert pixel delta to viewBox delta.
    const dxPx = e.clientX - drag.startClientX
    const dyPx = e.clientY - drag.startClientY
    const dxView = (dxPx / rect.width) * drag.startView.w
    const dyView = (dyPx / rect.height) * drag.startView.h
    setView(
      clampView({
        x: drag.startView.x - dxView,
        y: drag.startView.y - dyView,
        w: drag.startView.w,
        h: drag.startView.h,
      }),
    )
  }

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      ;(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId)
      dragRef.current = null
      setIsDragging(false)
    }
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
    zoomBy(factor, { cx: e.clientX, cy: e.clientY })
  }

  const reset = () => setView(initialView)

  // Visual scale for bubbles: shrink as we zoom in so they don't engulf the map.
  const bubbleScale = 1 / zoom

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">Geographic distribution</div>
        <div className="card-actions">
          <span>Drag to pan · scroll to zoom · bubble size = lease count</span>
        </div>
      </header>
      <div className="map-wrap" style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          className={`map-svg${isDragging ? " dragging" : ""}`}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="US map of sub-markets"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
        >
          {stateFeatures &&
            stateFeatures.map((f, i) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = path(f as any)
              return d ? (
                <path
                  key={i}
                  className="map-state"
                  d={d}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null
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
            const baseR = 8 + (agg.count / maxCount) * 20
            const r = baseR * bubbleScale

            return (
              <g
                key={agg.key}
                className="map-pin"
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) =>
                  !isDragging &&
                  setTooltip({
                    open: true,
                    x: e.clientX,
                    y: e.clientY,
                    data: agg,
                  })
                }
                onMouseMove={(e) =>
                  !isDragging &&
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
                  strokeWidth={1.5 * bubbleScale}
                />
                <text
                  x={x}
                  y={y}
                  className="map-pin-label"
                  style={{ fontSize: `${12 * bubbleScale}px` }}
                >
                  {agg.count}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="map-controls" role="group" aria-label="Map controls">
          <button
            type="button"
            onClick={() => zoomBy(1.5)}
            disabled={zoom >= MAX_ZOOM - 0.01}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.5)}
            disabled={zoom <= MIN_ZOOM + 0.01}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={zoom <= MIN_ZOOM + 0.01 && view.x === 0 && view.y === 0}
            aria-label="Reset view"
            title="Reset view"
            style={{ fontSize: 11 }}
          >
            ⟲
          </button>
        </div>

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

        {tooltip.open && !isDragging && <Tooltip state={tooltip} />}

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
