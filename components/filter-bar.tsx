"use client"

import { useEffect, useRef, useState } from "react"
import type { Filters } from "@/lib/calculations"
import { PROPERTY_TYPE_ORDER } from "@/lib/calculations"
import type { PropertyType } from "@/lib/types"

type Props = {
  filters: Filters
  onChange: (next: Filters) => void
  availableSubmarkets: string[]
  propertyTypeCounts: Map<PropertyType, number>
  submarketCounts: Map<string, number>
}

const EXPIRY_OPTIONS: Array<{ value: NonNullable<Filters["expiryWindow"]>; label: string }> = [
  { value: "lt12", label: "< 12 months" },
  { value: "12to24", label: "12–24 months" },
  { value: "24to36", label: "24–36 months" },
  { value: "gt36", label: "> 36 months" },
]

const CONFIDENCE_OPTIONS: Array<{ value: NonNullable<Filters["confidence"]>; label: string }> = [
  { value: "high", label: "High only" },
  { value: "highmedium", label: "High + Medium" },
]

type ChipProps = {
  open: boolean
  onToggle: () => void
  onClose: () => void
  active: boolean
  label: string
  value: string
  onClear?: () => void
  children: React.ReactNode
}

function ChipMenu({ open, onToggle, onClose, active, label, value, onClear, children }: ChipProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open, onClose])

  return (
    <div className={`filter-chip${active ? " active" : ""}`} ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", padding: 0 }}
      >
        <span className="label">{label}</span>
        <span className="value">{value}</span>
        <span className="caret" aria-hidden="true">
          ▼
        </span>
      </button>
      {active && onClear && (
        <button type="button" className="filter-chip-clear" onClick={onClear} aria-label={`Clear ${label} filter`}>
          ×
        </button>
      )}
      {open && <div className="filter-chip-menu">{children}</div>}
    </div>
  )
}

export function FilterBar({
  filters,
  onChange,
  availableSubmarkets,
  propertyTypeCounts,
  submarketCounts,
}: Props) {
  const [openMenu, setOpenMenu] = useState<null | "type" | "submarket" | "expiry" | "confidence">(null)

  const closeAll = () => setOpenMenu(null)
  const toggle = (key: typeof openMenu) => setOpenMenu((prev) => (prev === key ? null : key))

  const updateType = (value: PropertyType | null) => {
    onChange({ ...filters, propertyType: value, submarket: null })
    closeAll()
  }
  const updateSubmarket = (value: string | null) => {
    onChange({ ...filters, submarket: value })
    closeAll()
  }
  const updateExpiry = (value: Filters["expiryWindow"]) => {
    onChange({ ...filters, expiryWindow: value })
    closeAll()
  }
  const updateConfidence = (value: Filters["confidence"]) => {
    onChange({ ...filters, confidence: value })
    closeAll()
  }

  const expiryLabel = filters.expiryWindow
    ? EXPIRY_OPTIONS.find((o) => o.value === filters.expiryWindow)?.label
    : "Any"
  const confidenceLabel = filters.confidence
    ? CONFIDENCE_OPTIONS.find((o) => o.value === filters.confidence)?.label
    : "Any"

  return (
    <div className="filter-bar" role="region" aria-label="Portfolio filters">
      <div className="filter-chip primary">
        <span className="label">Client</span>
        <span className="value">Bosch</span>
        <span className="caret" aria-hidden="true">
          ▼
        </span>
      </div>

      <ChipMenu
        open={openMenu === "type"}
        onToggle={() => toggle("type")}
        onClose={closeAll}
        active={filters.propertyType !== null}
        label="Property type"
        value={filters.propertyType ?? "All"}
        onClear={() => updateType(null)}
      >
        <div
          className={`filter-chip-menu-item${filters.propertyType === null ? " selected" : ""}`}
          onClick={() => updateType(null)}
        >
          <span>All types</span>
          <span className="ct">{Array.from(propertyTypeCounts.values()).reduce((a, b) => a + b, 0)}</span>
        </div>
        {PROPERTY_TYPE_ORDER.map((t) => {
          const count = propertyTypeCounts.get(t) ?? 0
          if (count === 0) return null
          return (
            <div
              key={t}
              className={`filter-chip-menu-item${filters.propertyType === t ? " selected" : ""}`}
              onClick={() => updateType(t)}
            >
              <span>{t}</span>
              <span className="ct">{count}</span>
            </div>
          )
        })}
      </ChipMenu>

      <ChipMenu
        open={openMenu === "submarket"}
        onToggle={() => toggle("submarket")}
        onClose={closeAll}
        active={filters.submarket !== null}
        label="Sub-market"
        value={filters.submarket ?? `All (${availableSubmarkets.length})`}
        onClear={() => updateSubmarket(null)}
      >
        <div
          className={`filter-chip-menu-item${filters.submarket === null ? " selected" : ""}`}
          onClick={() => updateSubmarket(null)}
        >
          <span>All sub-markets</span>
          <span className="ct">{availableSubmarkets.length}</span>
        </div>
        {availableSubmarkets.map((s) => {
          const count = submarketCounts.get(s) ?? 0
          return (
            <div
              key={s}
              className={`filter-chip-menu-item${filters.submarket === s ? " selected" : ""}`}
              onClick={() => updateSubmarket(s)}
            >
              <span>{s}</span>
              <span className="ct">{count}</span>
            </div>
          )
        })}
      </ChipMenu>

      <ChipMenu
        open={openMenu === "expiry"}
        onToggle={() => toggle("expiry")}
        onClose={closeAll}
        active={filters.expiryWindow !== null}
        label="Expires"
        value={expiryLabel ?? "Any"}
        onClear={() => updateExpiry(null)}
      >
        <div
          className={`filter-chip-menu-item${filters.expiryWindow === null ? " selected" : ""}`}
          onClick={() => updateExpiry(null)}
        >
          <span>Any</span>
        </div>
        {EXPIRY_OPTIONS.map((o) => (
          <div
            key={o.value}
            className={`filter-chip-menu-item${filters.expiryWindow === o.value ? " selected" : ""}`}
            onClick={() => updateExpiry(o.value)}
          >
            <span>{o.label}</span>
          </div>
        ))}
      </ChipMenu>

      <ChipMenu
        open={openMenu === "confidence"}
        onToggle={() => toggle("confidence")}
        onClose={closeAll}
        active={filters.confidence !== null}
        label="Confidence"
        value={confidenceLabel ?? "Any"}
        onClear={() => updateConfidence(null)}
      >
        <div
          className={`filter-chip-menu-item${filters.confidence === null ? " selected" : ""}`}
          onClick={() => updateConfidence(null)}
        >
          <span>Any</span>
        </div>
        {CONFIDENCE_OPTIONS.map((o) => (
          <div
            key={o.value}
            className={`filter-chip-menu-item${filters.confidence === o.value ? " selected" : ""}`}
            onClick={() => updateConfidence(o.value)}
          >
            <span>{o.label}</span>
          </div>
        ))}
      </ChipMenu>

      <div className="spacer" />
    </div>
  )
}
