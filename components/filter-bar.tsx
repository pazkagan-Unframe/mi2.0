"use client"

import { useMemo } from "react"
import type { Filters } from "@/lib/calculations"
import { PROPERTY_TYPE_ORDER } from "@/lib/calculations"
import type { PropertyType } from "@/lib/types"

type Props = {
  filters: Filters
  onChange: (next: Filters) => void
  availableSubmarkets: string[]
  totalCount: number
  filteredCount: number
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

export function FilterBar({
  filters,
  onChange,
  availableSubmarkets,
  totalCount,
  filteredCount,
}: Props) {
  const activeChips = useMemo(() => {
    const chips: Array<{ key: keyof Filters; label: string }> = []
    if (filters.propertyType) chips.push({ key: "propertyType", label: filters.propertyType })
    if (filters.submarket) chips.push({ key: "submarket", label: filters.submarket })
    if (filters.expiryWindow) {
      const label = EXPIRY_OPTIONS.find((o) => o.value === filters.expiryWindow)?.label ?? ""
      chips.push({ key: "expiryWindow", label: `Expires ${label}` })
    }
    if (filters.confidence) {
      const label = CONFIDENCE_OPTIONS.find((o) => o.value === filters.confidence)?.label ?? ""
      chips.push({ key: "confidence", label: `Confidence: ${label}` })
    }
    return chips
  }, [filters])

  const clear = (key: keyof Filters) => {
    const next: Filters = { ...filters, [key]: null }
    // If property type clears, also clear submarket because submarkets depend on it.
    if (key === "propertyType") next.submarket = null
    onChange(next)
  }

  const clearAll = () =>
    onChange({ propertyType: null, submarket: null, expiryWindow: null, confidence: null })

  return (
    <section className="filterbar" aria-label="Portfolio filters">
      <div className="filterbar-row">
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-type">
            Property type
          </label>
          <select
            id="filter-type"
            className="filter-select"
            value={filters.propertyType ?? ""}
            onChange={(e) => {
              const value = (e.target.value || null) as PropertyType | null
              onChange({ ...filters, propertyType: value, submarket: null })
            }}
          >
            <option value="">All types</option>
            {PROPERTY_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-submarket">
            Sub-market
          </label>
          <select
            id="filter-submarket"
            className="filter-select"
            value={filters.submarket ?? ""}
            onChange={(e) =>
              onChange({ ...filters, submarket: e.target.value || null })
            }
            disabled={availableSubmarkets.length === 0}
          >
            <option value="">All sub-markets</option>
            {availableSubmarkets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-expiry">
            Expires within
          </label>
          <select
            id="filter-expiry"
            className="filter-select"
            value={filters.expiryWindow ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                expiryWindow: (e.target.value || null) as Filters["expiryWindow"],
              })
            }
          >
            <option value="">Any</option>
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-confidence">
            Confidence
          </label>
          <select
            id="filter-confidence"
            className="filter-select"
            value={filters.confidence ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                confidence: (e.target.value || null) as Filters["confidence"],
              })
            }
          >
            <option value="">Any</option>
            {CONFIDENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filterbar-summary">
          <span className="mono">{filteredCount}</span>
          <span className="filter-summary-label">
            {filteredCount === totalCount ? "leases" : `of ${totalCount} leases`}
          </span>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="filter-chips">
          {activeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="chip"
              onClick={() => clear(c.key)}
              aria-label={`Remove filter: ${c.label}`}
            >
              {c.label}
              <span className="chip-x" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
          <button type="button" className="chip-clear-all" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}
    </section>
  )
}
